/**
 * BLOCKFIRE Update Center — host half.
 *
 * Two surfaces over the SAME mechanism, `harness/bin/update.mjs`, so the Web
 * panel and the CLI can never disagree about what is installed, what is staged,
 * and what is verified:
 *
 *   GET  /blockfire/update        status (+ optional upstream check, TTL-cached)
 *   POST /blockfire/update/action run one operation as a background job:
 *                                 stage → verify → activate ("update"),
 *                                 or rollback / check / single steps.
 *   GET  /blockfire/update/job    poll the running/last job (live output tail)
 *   POST /blockfire/session/delete
 *
 * The operations themselves are NEVER reimplemented here: the route spawns
 * `update.mjs` and reports its output verbatim, so progress and failures are
 * the CLI's own words. Activation without a passing verify is refused by the
 * CLI itself (exit code), which is what the "update" chain keys on. One job at
 * a time — an update is a rare, serial operation. The running process is never
 * touched: an activation applies on the NEXT launch, and the previous version
 * stays pinned for rollback (both facts the panel renders).
 *
 * Mutating routes require their custom header (`x-blockfire-update`,
 * `x-blockfire-delete`): a cross-origin browser form cannot send it, and
 * same-origin UI always does. GET is never a mutation.
 *
 * Also serves `POST /blockfire/session/delete` — the permanent-delete option
 * upstream DSH does not have (0.1.2-rc.1 persistence is append-only and the
 * workspace registry exposes archive but no removal). The route performs the
 * whole delete through real seams of the running version:
 *
 *   1. refuse a session whose agent is RUNNING (idle is fine);
 *   2. remove the id from its workspace record and from the registry-global
 *      archive set — via the registry's own write points (`rebuildEntities`,
 *      `setState`) over the workspace storage domain, so the durable state,
 *      the registry's cache, and the controller's live feed all agree;
 *   3. delete the session log directory and the projection-cache entry.
 *
 * The minimal upstream seam this works around (documented in
 * harness/ARCHITECTURE.md): `sessionPersistence.delete(id)` plus
 * `workspaceRegistry.removeSession(id)` as one durable operation.
 *
 * NO FORK: this is an ordinary host plugin row in the Web profile's user patch
 * layer plus one hand-written client bundle. No upstream file is modified.
 */

import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'blockfire-update-center'
export const inject = ['webServer', 'sessionPersistence', 'storageDomain']

/** lib/ -> web/ -> harness/ -> repository root. */
const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const CHECK_TTL_MS = 10 * 60 * 1000
const DELETE_BODY_LIMIT = 64 * 1024
const UPDATE_ACTIONS = new Set(['check', 'stage', 'verify', 'activate', 'rollback', 'update'])
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/ // npm-shaped, e.g. 0.1.5-alpha.2
const JOB_OUTPUT_CAP = 64 * 1024
const JOB_TIMEOUT_MS = 20 * 60 * 1000 // stage/verify each get 15 min in the CLI; kill past this

function runCli(cli, args, timeoutMs) {
  return new Promise((settle) => {
    execFile(process.execPath, [cli, ...args], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error !== null && error !== undefined) {
        settle({ ok: false, error: String(stderr || error.message).slice(0, 2000) })
        return
      }
      try {
        settle({ ok: true, value: JSON.parse(stdout) })
      } catch (parseError) {
        settle({ ok: false, error: `update.mjs produced non-JSON output: ${String(parseError?.message ?? parseError)}` })
      }
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

/** Read one small JSON body; rejects oversized or non-JSON payloads. */
function readJsonBody(req, limit) {
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
      if (chunks.length === 0) {
        settle({ ok: false, error: 'empty body' })
        return
      }
      try {
        settle({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) })
      } catch (error) {
        settle({ ok: false, error: `invalid JSON: ${String(error?.message ?? error)}` })
      }
    })
    req.on('error', () => settle({ ok: false, error: 'request error' }))
  })
}

/**
 * Permanent delete of one durable session. Order matters: accounting first
 * (so the sidebar never shows a session whose log is already gone), then
 * artifacts.
 */
async function deleteSession(ctx, sessionId) {
  // ── running guard: a RUNNING agent would keep appending to a deleted log ──
  const agent = ctx.get('agents')?.get(sessionId)
  if (agent !== undefined && agent !== null && agent.status === 'running') {
    return { status: 409, value: { ok: false, error: 'session is running — stop it before deleting' } }
  }

  // ── durable identity: the session must exist in persistence ───────────────
  const headers = await ctx.sessionPersistence.list()
  const header = headers.find((candidate) => candidate.id === sessionId)
  if (header === undefined) {
    return { status: 404, value: { ok: false, error: `unknown session "${sessionId}"` } }
  }

  // ── workspace accounting through the registry's own write points ──────────
  const registry = ctx.get('workspaceRegistry')
  const domain = ctx.storageDomain.get('workspace')
  let workspaceId = null
  let archived = false
  if (domain !== undefined && domain !== null) {
    const table = domain.table('workspaces')
    for (const [id, record] of table.entries()) {
      if (!Array.isArray(record?.sessionIds) || !record.sessionIds.includes(sessionId)) continue
      workspaceId = String(id)
      await table.put(id, {
        ...record,
        sessionIds: record.sessionIds.filter((member) => member !== sessionId),
        updatedAt: new Date().toISOString(),
      })
    }
    const state = domain.global.get()
    if (state !== undefined && state !== null && Array.isArray(state.archivedSessionIds) && state.archivedSessionIds.includes(sessionId)) {
      archived = true
      const next = { ...state, archivedSessionIds: state.archivedSessionIds.filter((member) => member !== sessionId) }
      // setState is the registry's single write point for the global: it
      // persists through the domain AND refreshes the registry's cached
      // view, so a later registry mutation cannot resurrect the id.
      if (registry !== undefined && registry !== null && typeof registry.setState === 'function') {
        await registry.setState(next)
      } else {
        await domain.global.set(next)
      }
    }
    if (registry !== undefined && registry !== null && typeof registry.rebuildEntities === 'function') {
      registry.rebuildEntities()
    }
  }

  // ── artifacts: session log directory + projection-cache entry ─────────────
  let logDir = null
  try {
    const location = ctx.sessionPersistence.locate(header)
    if (typeof location?.path === 'string' && location.path.includes(sessionId)) {
      logDir = dirname(location.path)
    }
  } catch {
    // locate() is pure path math; a refusal here only means an unknown layout.
  }
  if (logDir !== null && existsSync(logDir)) {
    rmSync(logDir, { recursive: true, force: true })
  }
  let cacheEntry = null
  const dshHome = process.env.DSH_HOME ?? resolve(process.env.HOME ?? '', '.dsh')
  const candidate = resolve(dshHome, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  if (existsSync(candidate)) {
    rmSync(candidate, { force: true })
    cacheEntry = candidate
  }

  return { status: 200, value: { ok: true, sessionId, workspaceId, archived, logDir, cacheEntry } }
}

export function apply(ctx, config) {
  const repo = typeof config?.repoRoot === 'string' && config.repoRoot !== '' ? config.repoRoot : DEFAULT_REPO
  const cli = resolve(repo, 'harness', 'bin', 'update.mjs')
  const cache = { at: 0, value: undefined }

  // ── job runner: one update operation at a time, driven by update.mjs ──────
  let job = null
  let jobSeq = 0

  function spawnStep(args, onChunk) {
    return new Promise((settle) => {
      const child = spawn(process.execPath, [cli, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
      if (job !== null) job.child = child
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        child.kill('SIGKILL')
      }, JOB_TIMEOUT_MS)
      const forward = (chunk) => onChunk(chunk.toString('utf8'))
      child.stdout.on('data', forward)
      child.stderr.on('data', forward)
      child.on('error', (error) => {
        clearTimeout(timer)
        settle({ ok: false, note: `could not run ${cli}: ${String(error?.message ?? error)}` })
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        settle({
          ok: code === 0 && !timedOut,
          note: timedOut
            ? `step killed after ${Math.round(JOB_TIMEOUT_MS / 60000)} minutes`
            : code === 0
              ? undefined
              : `step exited with code ${code}`,
        })
      })
    })
  }

  async function runJob(running, steps) {
    const append = (text) => {
      running.output = `${running.output}${text}`
      if (running.output.length > JOB_OUTPUT_CAP) running.output = running.output.slice(-JOB_OUTPUT_CAP)
    }
    for (const step of steps) {
      append(`\n── blockfire update: ${step.label} ──\n`)
      const result = await spawnStep(step.args, append)
      if (result.note !== undefined) append(`${result.note}\n`)
      if (!result.ok) {
        append('update: stopped — nothing was activated\n')
        return false
      }
    }
    return true
  }

  function beginJob(action, version, steps) {
    jobSeq += 1
    const running = {
      id: `u${jobSeq}`,
      action,
      version: version ?? null,
      state: 'running',
      ok: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
      output: '',
      child: undefined,
    }
    job = running
    runJob(running, steps)
      .then((ok) => {
        if (job !== running) return
        running.state = 'done'
        running.ok = ok
        running.endedAt = new Date().toISOString()
      })
      .catch(() => {
        if (job !== running) return
        running.state = 'done'
        running.ok = false
        running.endedAt = new Date().toISOString()
      })
    return running
  }

  const handler = async (req, res) => {
    if (!existsSync(cli)) {
      send(res, 500, { ok: false, error: `update.mjs not found at ${cli} — run harness/install.sh` })
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const wantsCheck = url.searchParams.get('check') === '1'
    const status = await runCli(cli, ['status', '--json'], 30000)
    if (!status.ok) {
      send(res, 500, { ok: false, error: status.error })
      return
    }
    if (!wantsCheck) {
      send(res, 200, { ok: true, status: status.value, check: cache.value ?? null, checkedAt: cache.at || null })
      return
    }
    if (cache.value !== undefined && Date.now() - cache.at < CHECK_TTL_MS) {
      send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
      return
    }
    const checked = await runCli(cli, ['check', '--json'], 180000)
    if (!checked.ok) {
      send(res, 200, { ok: true, status: status.value, check: null, checkError: checked.error })
      return
    }
    cache.value = checked.value
    cache.at = Date.now()
    send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
  }

  const deleteHandler = async (req, res) => {
    // CSRF posture: a cross-origin browser form cannot send a custom header,
    // and same-origin UI always sends both. GET is never a delete.
    if (req.method !== 'POST' || req.headers['x-blockfire-delete'] !== '1') {
      send(res, 405, { ok: false, error: 'POST with the x-blockfire-delete header required' })
      return
    }
    const body = await readJsonBody(req, DELETE_BODY_LIMIT)
    if (!body.ok) {
      send(res, 400, { ok: false, error: body.error })
      return
    }
    const sessionId = typeof body.value?.sessionId === 'string' ? body.value.sessionId : ''
    // Session ids are opaque upstream strings; the current runtime issues
    // `session-<uuid>` (the workspace registry, the persistence log dirs and
    // the projection cache all key on it), older installs used a bare uuid.
    // Only a charset/length shape is enforced here — traversal-safe — because
    // the persistence lookup below is the real gate: an unknown id is a 404,
    // never a write.
    if (!/^[0-9A-Za-z-]{8,64}$/.test(sessionId)) {
      send(res, 400, { ok: false, error: 'sessionId must be a session id string' })
      return
    }
    try {
      const outcome = await deleteSession(ctx, sessionId)
      send(res, outcome.status, outcome.value)
    } catch (error) {
      send(res, 500, { ok: false, error: String(error?.message ?? error).slice(0, 500) })
    }
  }

  const actionHandler = async (req, res) => {
    if (req.method !== 'POST' || req.headers['x-blockfire-update'] !== '1') {
      send(res, 405, { ok: false, error: 'POST with the x-blockfire-update header required' })
      return
    }
    if (!existsSync(cli)) {
      send(res, 500, { ok: false, error: `update.mjs not found at ${cli} — run harness/install.sh` })
      return
    }
    const body = await readJsonBody(req, DELETE_BODY_LIMIT)
    if (!body.ok) {
      send(res, 400, { ok: false, error: body.error })
      return
    }
    const action = body.value?.action
    const version = typeof body.value?.version === 'string' ? body.value.version : undefined
    if (typeof action !== 'string' || !UPDATE_ACTIONS.has(action)) {
      send(res, 400, { ok: false, error: `action must be one of: ${[...UPDATE_ACTIONS].sort().join(', ')}` })
      return
    }
    if ((action === 'stage' || action === 'verify' || action === 'activate' || action === 'update') &&
        (version === undefined || !VERSION_RE.test(version))) {
      send(res, 400, { ok: false, error: 'a valid version is required for this action' })
      return
    }
    if (job !== null && job.state === 'running') {
      send(res, 409, { ok: false, error: `an update operation is already running (${job.action} ${job.version ?? ''})`.trim() })
      return
    }
    // "update" IS the user's button: stage, verify, activate — in that order,
    // refusing the next step the moment one fails (exit codes of the CLI).
    const steps = action === 'update'
      ? [
          { label: `stage ${version} (isolated tree, the running install is untouched)`, args: ['stage', version] },
          { label: `verify ${version} (BLOCKFIRE compatibility suite against the candidate)`, args: ['verify', version] },
          { label: `activate ${version} (only reached if verify passed)`, args: ['activate', version] },
        ]
      : [{ label: action === 'rollback' ? 'rollback' : `${action}${version === undefined ? '' : ` ${version}`}`, args: version === undefined ? [action] : [action, version] }]
    const started = beginJob(action, version, steps)
    send(res, 200, { ok: true, jobId: started.id })
  }

  const jobHandler = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const wanted = url.searchParams.get('job')
    if (job === null || (wanted !== null && job.id !== wanted)) {
      send(res, 404, { ok: false, error: 'no such job' })
      return
    }
    send(res, 200, {
      ok: true,
      job: {
        id: job.id,
        action: job.action,
        version: job.version,
        state: job.state,
        ok: job.ok,
        startedAt: job.startedAt,
        endedAt: job.endedAt,
        output: job.output,
      },
    })
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update', handler }),
    'blockfire-update-center: route',
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update/action', handler: actionHandler }),
    'blockfire-update-center: action route',
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update/job', handler: jobHandler }),
    'blockfire-update-center: job route',
  )
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: '/blockfire/session/delete', handler: deleteHandler }),
    'blockfire-update-center: delete route',
  )
  // A running update must not outlive the host that owns it.
  ctx.effect(
    () => () => {
      if (job !== null && job.state === 'running' && job.child !== undefined) job.child.kill('SIGKILL')
    },
    'blockfire-update-center: kill running update on dispose',
  )
}
