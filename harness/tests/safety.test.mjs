#!/usr/bin/env node
/** Cheap regressions for host/update/evidence boundaries that must fail safely. */
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const GUARD = pathToFileURL(join(HARNESS, 'host', 'guard.js')).href
const WEB = pathToFileURL(join(HARNESS, 'web', 'lib', 'index.js')).href
const UPDATE = join(HARNESS, 'bin', 'update.mjs')
const PURGER = join(HARNESS, 'bin', 'purge-sessions.mjs')
const REPORT = join(HARNESS, 'bin', 'session-report.mjs')
const CONTRACT = join(HARNESS, 'lib', 'contract_check.mjs')
const DELETE_CURRENT = join(HARNESS, 'tests', 'delete-current.test.mjs')
const VISUAL_BOOT = join(HARNESS, 'tests', 'visual-boot.mjs')

async function guardFor() {
  const module = await import(GUARD)
  const guards = []
  const ctx = {
    tools: {
      guard(check) {
        guards.push(check)
        return () => {}
      },
    },
    effect(factory) { return factory() },
  }
  module.apply(ctx)
  assert.equal(guards.length, 1)
  return guards[0]
}

function requestFor(body, header, url = '/') {
  const payload = JSON.stringify(body)
  return {
    method: 'POST',
    url,
    headers: header,
    on(event, handler) {
      if (event === 'data') handler(Buffer.from(payload))
      if (event === 'end') handler()
    },
  }
}

async function callRoute(route, request) {
  const chunks = []
  const response = {
    writeHead(status) { chunks.push({ status }) },
    end(body) { chunks.push({ body }) },
  }
  await route.handler(request, response)
  return {
    status: chunks.find((chunk) => chunk.status !== undefined)?.status,
    body: JSON.parse(chunks.find((chunk) => typeof chunk.body === 'string')?.body ?? 'null'),
  }
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

test('auxiliary harness programs exist and parse before runtime-dependent tests', () => {
  for (const file of [UPDATE, PURGER, REPORT, CONTRACT, DELETE_CURRENT, VISUAL_BOOT]) {
    assert.equal(existsSync(file), true, `${file} must exist`)
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
    assert.equal(checked.status, 0, `${file} must parse: ${checked.stderr}`)
  }
})

test('guard: protected HOME paths are denied without blocking harmless mentions', async () => {
  const guard = await guardFor()
  for (const command of [
    'rm -rf "$HOME/.ssh"',
    'rm -rf "$HOME"/.ssh/known_hosts',
    'rm -rf "${HOME}/.gnupg"',
    'rm "$HOME/.config/gh/hosts.yml"',
  ]) {
    const reason = guard({ name: 'bash', arguments: { command } })
    assert.equal(typeof reason, 'string', `${command} must be denied`)
    assert.match(reason, /BLOCKFIRE policy blocked/)
  }
  for (const command of [
    'rm -rf "$HOME/.cache/blockfire"',
    'echo "example: rm -rf /etc"',
    'grep -R "rm -rf /etc" harness/',
  ]) {
    assert.equal(
      guard({ name: 'bash', arguments: { command } }),
      undefined,
      `${command} must not be over-blocked`,
    )
  }
})

test('updater: path-shaped versions are rejected before staging touches disk or npm', () => {
  const home = mkdtempSync(join(tmpdir(), 'bf-update-safety-'))
  try {
    const stateDir = join(home, '.blockfire-harness')
    mkdirSync(stateDir, { recursive: true })
    const sentinel = join(stateDir, 'sentinel')
    writeFileSync(sentinel, 'keep\n')

    for (const action of ['stage', 'verify', 'activate']) {
      const result = spawnSync(process.execPath, [UPDATE, action, '../sentinel'], {
        encoding: 'utf8',
        env: { ...process.env, DSH_HOME: home },
      })
      assert.equal(result.status, 2, `${action} must reject path syntax`)
      assert.match(result.stderr, /version must be an npm version\/tag without path syntax/)
      assert.equal(existsSync(sentinel), true, `${action} must not touch the escaped target`)
      assert.equal(existsSync(join(stateDir, 'staging')), false, `${action} must fail before creating staging`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('session purger: corrupt delete queue fails without rewriting or discarding it', () => {
  const home = mkdtempSync(join(tmpdir(), 'bf-purge-safety-'))
  try {
    const dir = join(home, '.blockfire-harness')
    mkdirSync(dir, { recursive: true })
    const queue = join(dir, 'pending-session-deletes.json')
    const corrupt = '{"unfinished":'
    writeFileSync(queue, corrupt)
    const result = spawnSync(process.execPath, [PURGER], {
      encoding: 'utf8',
      env: { ...process.env, DSH_HOME: home },
    })
    assert.equal(result.status, 1, 'corrupt durable delete intent must fail loud')
    assert.match(result.stderr, /delete queue is unreadable/)
    assert.equal(readFileSync(queue, 'utf8'), corrupt, 'corrupt evidence stays untouched for recovery')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('current delete integration: archive/detach + preboot purge stays green', () => {
  const result = spawnSync(process.execPath, [DELETE_CURRENT], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /current DSH delete records intent/)
})

test('Web snapshot delete: durable queue is written before archive/detach, and corruption blocks mutation', async () => {
  const previousHome = process.env.DSH_HOME
  const home = mkdtempSync(join(tmpdir(), 'bf-web-delete-'))
  process.env.DSH_HOME = home
  try {
    const sessionId = 'session-0123abcd-0000-4000-8000-000000000001'
    const queueDir = join(home, '.blockfire-harness')
    const queue = join(queueDir, 'pending-session-deletes.json')
    mkdirSync(queueDir, { recursive: true })
    const corrupt = '{broken'
    writeFileSync(queue, corrupt)

    let archived = 0
    let detached = 0
    const routes = []
    const workspace = {
      id: 'w1',
      sessionIds: [sessionId],
      async detachSession(id) { assert.equal(id, sessionId); detached += 1 },
    }
    const registry = {
      async archiveSession(id) { assert.equal(id, sessionId); archived += 1 },
      list() { return [workspace] },
    }
    const persistence = { async list() { return [{ header: { id: sessionId, cwd: '/fixture' } }] } }
    const module = await import(WEB)
    module.apply({
      get(name) {
        if (name === 'agents') return { get() { return undefined } }
        if (name === 'workspaceRegistry') return registry
        return undefined
      },
      sessionPersistence: persistence,
      workspaceRegistry: registry,
      webServer: { register(route) { routes.push(route) } },
      effect(factory) { return factory() },
    })
    const route = routes.find((candidate) => candidate.path === '/blockfire/session/delete')
    const blocked = await callRoute(route, requestFor(
      { sessionId },
      { 'x-blockfire-delete': '1', 'content-type': 'application/json' },
      '/blockfire/session/delete',
    ))
    assert.equal(blocked.status, 500)
    assert.equal(archived, 0, 'queue failure happens before archive')
    assert.equal(detached, 0, 'queue failure happens before detach')
    assert.equal(readFileSync(queue, 'utf8'), corrupt, 'corrupt queue is never overwritten')

    rmSync(queue)
    const accepted = await callRoute(route, requestFor(
      { sessionId },
      { 'x-blockfire-delete': '1', 'content-type': 'application/json' },
      '/blockfire/session/delete',
    ))
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.pendingPurge, true)
    assert.deepEqual(JSON.parse(readFileSync(queue, 'utf8')), [sessionId])
    assert.equal(archived, 1)
    assert.equal(detached, 1)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    rmSync(home, { recursive: true, force: true })
  }
})

test('Web updater: host teardown kills the current step and never advances to activate', async () => {
  const root = mkdtempSync(join(tmpdir(), 'bf-web-update-'))
  const previousLog = process.env.BLOCKFIRE_FAKE_UPDATE_LOG
  try {
    const bin = join(root, 'harness', 'bin')
    mkdirSync(bin, { recursive: true })
    const log = join(root, 'steps.log')
    process.env.BLOCKFIRE_FAKE_UPDATE_LOG = log
    writeFileSync(join(bin, 'update.mjs'), [
      "import { appendFileSync } from 'node:fs'",
      "const action = process.argv[2] ?? '?'",
      "appendFileSync(process.env.BLOCKFIRE_FAKE_UPDATE_LOG, action + '\\n')",
      "if (action === 'verify') await new Promise((resolve) => setTimeout(resolve, 5000))",
      "process.stdout.write(action + ' done\\n')",
      '',
    ].join('\n'))

    const routes = []
    const disposers = new Map()
    const module = await import(WEB)
    module.apply({
      get() { return undefined },
      webServer: { register(route) { routes.push(route) } },
      effect(factory, label) {
        const value = factory()
        if (typeof value === 'function') disposers.set(label, value)
        return value
      },
    }, { repoRoot: root })
    const action = routes.find((candidate) => candidate.path === '/blockfire/update/action')
    const started = await callRoute(action, requestFor(
      { action: 'update', version: '9.9.9-test' },
      { 'x-blockfire-update': '1', 'content-type': 'application/json' },
      '/blockfire/update/action',
    ))
    assert.equal(started.status, 200)

    const deadline = Date.now() + 3000
    while ((!existsSync(log) || !readFileSync(log, 'utf8').includes('verify')) && Date.now() < deadline) await sleep(20)
    assert.equal(existsSync(log), true)
    assert.match(readFileSync(log, 'utf8'), /verify/, 'verify step started before teardown')
    const stop = disposers.get('blockfire:update-kill')
    assert.equal(typeof stop, 'function')
    stop()
    await sleep(250)
    const steps = readFileSync(log, 'utf8').trim().split('\n')
    assert.deepEqual(steps, ['stage', 'verify'], 'teardown must never advance to activate')
  } finally {
    if (previousLog === undefined) delete process.env.BLOCKFIRE_FAKE_UPDATE_LOG
    else process.env.BLOCKFIRE_FAKE_UPDATE_LOG = previousLog
    rmSync(root, { recursive: true, force: true })
  }
})

test('contract: dynamic system/message is valid evidence for current DSH headers', () => {
  const root = mkdtempSync(join(tmpdir(), 'bf-contract-system-'))
  try {
    const log = join(root, 'session.jsonl')
    writeFileSync(log, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      JSON.stringify({ type: 'request/header', data: { header: { tools: [], config: { model: 'm' } } } }),
      JSON.stringify({ type: 'system/message', data: { message: { content: [{ type: 'text', text: 'system prompt' }] } } }),
      '',
    ].join('\n'))
    const result = spawnSync(process.execPath, [CONTRACT, 'log', log], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /system prompt present via system\/message/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('contract: malformed middle JSON fails, but a truncated final live line is tolerated', () => {
  const root = mkdtempSync(join(tmpdir(), 'bf-contract-jsonl-'))
  try {
    const middle = join(root, 'middle.jsonl')
    writeFileSync(middle, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      '{broken-json',
      JSON.stringify({ type: 'request/header', data: { header: { system: 'S', tools: [], config: { model: 'm' } } } }),
      '',
    ].join('\n'))
    const broken = spawnSync(process.execPath, [CONTRACT, 'log', middle], { encoding: 'utf8' })
    assert.notEqual(broken.status, 0, 'corruption before later events must fail the contract')
    assert.match(broken.stdout, /malformed JSONL before end/)

    const tail = join(root, 'tail.jsonl')
    writeFileSync(tail, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      JSON.stringify({ type: 'request/header', data: { header: { system: 'S', tools: [], config: { model: 'm' } } } }),
      '{"type":',
    ].join('\n'))
    const live = spawnSync(process.execPath, [CONTRACT, 'log', tail], { encoding: 'utf8' })
    assert.equal(live.status, 0, live.stdout + live.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
