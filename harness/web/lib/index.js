/** BLOCKFIRE Web host: updater bridge + safe permanent-session delete. */
import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { updateVersionError, validUpdateVersion } from '../../lib/update-version.mjs'

export const name = 'blockfire-update-center'
export const inject = ['webServer', 'sessionPersistence', 'workspaceRegistry', 'storageDomain']

const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const CHECK_TTL_MS = 10 * 60 * 1000
const BODY_LIMIT = 64 * 1024
const UPDATE_ACTIONS = new Set(['check', 'stage', 'verify', 'activate', 'rollback', 'update'])
const SESSION_ID_RE = /^[0-9A-Za-z-]{8,64}$/
const JOB_OUTPUT_CAP = 64 * 1024
const JOB_TIMEOUT_MS = 20 * 60 * 1000

function runCli(cli, args, timeoutMs) {
  return new Promise((settle) => {
    execFile(process.execPath, [cli, ...args], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return settle({ ok: false, error: String(stderr || error.message).slice(0, 2000) })
      try { settle({ ok: true, value: JSON.parse(stdout) }) }
      catch (cause) { settle({ ok: false, error: `update.mjs produced non-JSON output: ${String(cause?.message ?? cause)}` }) }
    })
  })
}

function send(res, status, value) {
  const body = `${JSON.stringify(value)}\n`
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJsonBody(req, limit = BODY_LIMIT) {
  return new Promise((settle) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        settle({ ok: false, error: 'body too large' })
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return settle({ ok: false, error: 'empty body' })
      try { settle({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
      catch (error) { settle({ ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` }) }
    })
    req.on('error', () => settle({ ok: false, error: 'request error' }))
  })
}

function queueFile() {
  const home = process.env.DSH_HOME ?? resolve(process.env.HOME ?? '', '.dsh')
  return resolve(home, '.blockfire-harness', 'pending-session-deletes.json')
}

function queuePhysicalDelete(sessionId) {
  const file = queueFile()
  let ids = []
  if (existsSync(file)) {
    let parsed
    try { parsed = JSON.parse(readFileSync(file, 'utf8')) }
    catch (error) { throw new Error(`pending session-delete queue is unreadable: ${String(error?.message ?? error)}`) }
    if (!Array.isArray(parsed)) throw new Error('pending session-delete queue is not an array')
    const invalid = parsed.filter((id) => typeof id !== 'string' || !SESSION_ID_RE.test(id))
    if (invalid.length > 0) throw new Error(`pending session-delete queue contains ${invalid.length} invalid session id(s)`)
    ids = [...new Set(parsed)]
  }
  if (!ids.includes(sessionId)) ids.push(sessionId)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(ids, null, 2)}\n`)
  renameSync(tmp, file)
}

/** Old pre-snapshot DSH fallback, used only when the runtime lacks registry APIs. */
async function legacyDelete(ctx, header, sessionId) {
  const registry = ctx.get('workspaceRegistry')
  const domain = ctx.storageDomain?.get?.('workspace')
  if (domain !== undefined && domain !== null) {
    const table = domain.table('workspaces')
    for (const [id, record] of table.entries()) {
      if (!Array.isArray(record?.sessionIds) || !record.sessionIds.includes(sessionId)) continue
      await table.put(id, {
        ...record,
        sessionIds: record.sessionIds.filter((member) => member !== sessionId),
        updatedAt: new Date().toISOString(),
      })
    }
    const state = domain.global.get()
    if (Array.isArray(state?.archivedSessionIds) && state.archivedSessionIds.includes(sessionId)) {
      const next = { ...state, archivedSessionIds: state.archivedSessionIds.filter((member) => member !== sessionId) }
      if (typeof registry?.setState === 'function') await registry.setState(next)
      else await domain.global.set(next)
    }
    if (typeof registry?.rebuildEntities === 'function') registry.rebuildEntities()
  }

  let logDir = null
  if (typeof ctx.sessionPersistence.locate === 'function') {
    try {
      const location = ctx.sessionPersistence.locate(header)
      if (typeof location?.path === 'string' && location.path.includes(sessionId)) logDir = dirname(location.path)
    } catch {}
  }
  if (logDir !== null && existsSync(logDir)) rmSync(logDir, { recursive: true, force: true })
  const home = process.env.DSH_HOME ?? resolve(process.env.HOME ?? '', '.dsh')
  const cacheEntry = resolve(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  if (existsSync(cacheEntry)) rmSync(cacheEntry, { force: true })
  return { status: 200, value: { ok: true, sessionId, legacy: true, logDir, cacheEntry } }
}

/**
 * Current DSH: list() returns snapshots and persistence has no delete/locate API.
 * Record durable delete intent before hiding/detaching, then purge physical
 * artifacts at next launcher boot. A corrupt queue must fail before state moves.
 */
async function deleteSession(ctx, sessionId) {
  const agent = ctx.get('agents')?.get(sessionId)
  if (agent?.status === 'running') {
    return { status: 409, value: { ok: false, error: 'session is running — stop it before deleting' } }
  }

  const listed = await ctx.sessionPersistence.list()
  const item = listed.find((candidate) => (candidate?.header ?? candidate)?.id === sessionId)
  if (item === undefined) return { status: 404, value: { ok: false, error: `unknown session "${sessionId}"` } }

  const isSnapshot = item?.header !== undefined
  const registry = ctx.workspaceRegistry ?? ctx.get('workspaceRegistry')
  if (!isSnapshot || typeof registry?.archiveSession !== 'function' || typeof registry?.list !== 'function') {
    return legacyDelete(ctx, item?.header ?? item, sessionId)
  }

  queuePhysicalDelete(sessionId)
  await registry.archiveSession(sessionId)
  const detached = []
  for (const workspace of registry.list()) {
    if (!Array.isArray(workspace.sessionIds) || !workspace.sessionIds.includes(sessionId)) continue
    await workspace.detachSession(sessionId)
    detached.push(String(workspace.id))
  }
  return { status: 200, value: { ok: true, sessionId, detached, pendingPurge: true } }
}

export function apply(ctx, config) {
  const repo = typeof config?.repoRoot === 'string' && config.repoRoot !== '' ? config.repoRoot : DEFAULT_REPO
  const cli = resolve(repo, 'harness', 'bin', 'update.mjs')
  const cache = { at: 0, value: undefined }
  let job = null
  let jobSeq = 0
  let stopping = false

  function spawnStep(args, onChunk) {
    if (stopping) return Promise.resolve({ ok: false, note: 'host is shutting down; update step was not started' })
    return new Promise((settle) => {
      const child = spawn(process.execPath, [cli, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
      if (job !== null) job.child = child
      let timedOut = false
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL') }, JOB_TIMEOUT_MS)
      const forward = (chunk) => onChunk(chunk.toString('utf8'))
      const clearChild = () => { if (job?.child === child) job.child = undefined }
      child.stdout.on('data', forward)
      child.stderr.on('data', forward)
      child.on('error', (error) => {
        clearTimeout(timer)
        clearChild()
        settle({ ok: false, note: `could not run ${cli}: ${String(error?.message ?? error)}` })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        clearChild()
        settle({ ok: code === 0 && !timedOut && !stopping, note: timedOut ? `step killed after ${Math.round(JOB_TIMEOUT_MS / 60000)} minutes` : stopping ? 'host shut down during update; no further step will run' : code === 0 ? undefined : `step exited with code ${code}` })
      })
    })
  }

  async function runJob(running, steps) {
    const append = (text) => {
      running.output = `${running.output}${text}`
      if (running.output.length > JOB_OUTPUT_CAP) running.output = running.output.slice(-JOB_OUTPUT_CAP)
    }
    for (const step of steps) {
      if (stopping) { append('\nupdate canceled because the host is shutting down\n'); return false }
      append(`\n── ${step.label} ──\n`)
      const result = await spawnStep(step.args, append)
      if (result.note) append(`${result.note}\n`)
      if (!result.ok) {
        append(stopping ? 'update canceled — no further step will run\n' : 'update stopped — nothing was activated\n')
        return false
      }
    }
    return true
  }

  function beginJob(action, version, steps) {
    const running = { id: `u${++jobSeq}`, action, version: version ?? null, state: 'running', ok: null, startedAt: new Date().toISOString(), endedAt: null, output: '', child: undefined }
    job = running
    runJob(running, steps).then((ok) => {
      if (job !== running) return
      running.state = 'done'; running.ok = ok; running.endedAt = new Date().toISOString()
    }).catch((error) => {
      if (job !== running) return
      running.state = 'done'; running.ok = false; running.output += `\n${String(error?.message ?? error)}\n`; running.endedAt = new Date().toISOString()
    })
    return running
  }

  const statusHandler = async (req, res) => {
    if (!existsSync(cli)) return send(res, 500, { ok: false, error: `update.mjs not found at ${cli}` })
    const wantsCheck = new URL(req.url ?? '/', 'http://localhost').searchParams.get('check') === '1'
    const status = await runCli(cli, ['status', '--json'], 30000)
    if (!status.ok) return send(res, 500, { ok: false, error: status.error })
    if (!wantsCheck) return send(res, 200, { ok: true, status: status.value, check: cache.value ?? null, checkedAt: cache.at || null })
    if (cache.value !== undefined && Date.now() - cache.at < CHECK_TTL_MS) return send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
    const checked = await runCli(cli, ['check', '--json'], 180000)
    if (!checked.ok) return send(res, 200, { ok: true, status: status.value, check: null, checkError: checked.error })
    cache.value = checked.value; cache.at = Date.now()
    send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
  }

  const deleteHandler = async (req, res) => {
    if (req.method !== 'POST' || req.headers['x-blockfire-delete'] !== '1') return send(res, 405, { ok: false, error: 'POST with x-blockfire-delete: 1 required' })
    const body = await readJsonBody(req)
    if (!body.ok) return send(res, 400, { ok: false, error: body.error })
    const sessionId = typeof body.value?.sessionId === 'string' ? body.value.sessionId : ''
    if (!SESSION_ID_RE.test(sessionId)) return send(res, 400, { ok: false, error: 'invalid sessionId' })
    try {
      const outcome = await deleteSession(ctx, sessionId)
      send(res, outcome.status, outcome.value)
    } catch (error) { send(res, 500, { ok: false, error: String(error?.message ?? error).slice(0, 500) }) }
  }

  const actionHandler = async (req, res) => {
    if (req.method !== 'POST' || req.headers['x-blockfire-update'] !== '1') return send(res, 405, { ok: false, error: 'POST with x-blockfire-update: 1 required' })
    if (!existsSync(cli)) return send(res, 500, { ok: false, error: `update.mjs not found at ${cli}` })
    const body = await readJsonBody(req)
    if (!body.ok) return send(res, 400, { ok: false, error: body.error })
    const action = body.value?.action
    const version = typeof body.value?.version === 'string' ? body.value.version : undefined
    if (typeof action !== 'string' || !UPDATE_ACTIONS.has(action)) return send(res, 400, { ok: false, error: `action must be one of: ${[...UPDATE_ACTIONS].sort().join(', ')}` })
    if (['stage', 'verify', 'activate', 'update'].includes(action) && !validUpdateVersion(version)) {
      return send(res, 400, { ok: false, error: updateVersionError(action) })
    }
    if (job?.state === 'running') return send(res, 409, { ok: false, error: 'an update operation is already running' })
    const steps = action === 'update'
      ? [{ label: `stage ${version}`, args: ['stage', version] }, { label: `verify ${version}`, args: ['verify', version] }, { label: `activate ${version}`, args: ['activate', version] }]
      : [{ label: action === 'rollback' ? 'rollback' : `${action}${version ? ` ${version}` : ''}`, args: version ? [action, version] : [action] }]
    const started = beginJob(action, version, steps)
    send(res, 200, { ok: true, jobId: started.id })
  }

  const jobHandler = async (req, res) => {
    const wanted = new URL(req.url ?? '/', 'http://localhost').searchParams.get('job')
    if (job === null || (wanted !== null && job.id !== wanted)) return send(res, 404, { ok: false, error: 'no such job' })
    send(res, 200, { ok: true, job: { id: job.id, action: job.action, version: job.version, state: job.state, ok: job.ok, startedAt: job.startedAt, endedAt: job.endedAt, output: job.output } })
  }

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update', handler: statusHandler }), 'blockfire:update')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update/action', handler: actionHandler }), 'blockfire:update-action')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update/job', handler: jobHandler }), 'blockfire:update-job')
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/blockfire/session/delete', handler: deleteHandler }), 'blockfire:delete')
  ctx.effect(() => () => {
    stopping = true
    if (job?.state === 'running' && job.child !== undefined) job.child.kill('SIGKILL')
  }, 'blockfire:update-kill')
}
