#!/usr/bin/env node
/**
 * BLOCKFIRE harness layer — plugin unit tests.
 *
 * The two plugins this layer owns are pure JavaScript with a tiny Cordis surface
 * (`ctx.tools.register`, `ctx.tools.guard`, `ctx.effect`, `ctx.plugin`). That is
 * enough to test them for real, with a fake context, in milliseconds and without
 * a runtime, a model call, or a session:
 *
 *   * `capabilities.js` — the router must list, mount and release a declared
 *     capability, and must fail with a useful message instead of throwing.
 *   * `guard.js` — the destructive-operation boundary must deny exactly the
 *     catastrophic shapes and leave normal work alone. A guard that over-blocks
 *     is as broken as one that under-blocks, so both directions are asserted.
 *
 * Run directly (`node harness/tests/plugins.test.mjs`) or through
 * `harness/test.sh`.
 */

import { strict as assert } from 'node:assert'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { resolveRuntime } from '../lib/runtime.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const CAPABILITIES = pathToFileURL(join(HARNESS, 'presets', 'build', 'plugins', 'capabilities.js')).href
const GUARD = pathToFileURL(join(HARNESS, 'host', 'guard.js')).href
const UPDATE_CENTER = pathToFileURL(join(HARNESS, 'web', 'lib', 'index.js')).href

/** Minimal Cordis context: records registrations and runs effect factories. */
function fakeCtx() {
  const state = { tools: [], guards: [], plugins: [], disposers: [], fibers: [] }
  const tools = {
    register(definition) {
      state.tools.push(definition)
      return () => {
        const index = state.tools.indexOf(definition)
        if (index >= 0) state.tools.splice(index, 1)
      }
    },
    guard(check) {
      state.guards.push(check)
      return () => {
        const index = state.guards.indexOf(check)
        if (index >= 0) state.guards.splice(index, 1)
      }
    },
  }
  const ctx = {
    tools,
    get(name) {
      return name === 'tools' ? tools : undefined
    },
    plugin(plugin, config) {
      state.plugins.push({ plugin, config })
      // Tests queue a Fiber shape to inject startup/release behavior; the
      // default mimics Cordis: await() settles, dispose() unwinds the plugin.
      const fiber = state.fibers.shift() ?? {
        await: async () => {},
        dispose: async () => {
          const index = state.plugins.findIndex((entry) => entry.plugin === plugin)
          if (index >= 0) state.plugins.splice(index, 1)
        },
      }
      return fiber
    },
    effect(factory, label = 'anonymous') {
      const disposer = factory()
      state.disposers.push({ label, disposer })
      return disposer
    },
  }
  return { ctx, state }
}

/** A tool call attributed to a fake session, the way the runtime issues it. */
const sessionExec = (ctx, id = 'unit-session') => ({ agent: { id, ctx } })

/**
 * A resolvable Cordis plugin module, used as the router's test capability. The
 * DSH install comes from the shared resolver (harness/lib/runtime.mjs); no path
 * is baked into this test, and no assumption is made about `dsh` being on PATH.
 */
function discoverTestPackage() {
  const resolved = resolveRuntime()
  if (resolved.ok !== true) return undefined
  const candidate = join(resolved.nodeModules, '@deepseek-ai', 'dsh-tool-todo', 'lib', 'index.js')
  return existsSync(candidate) ? candidate : undefined
}

// ── capability router ───────────────────────────────────────────────────────

test('capabilities: registers exactly one tool and declares the shared default', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, undefined)
  assert.equal(state.tools.length, 1, 'the router registers one tool')
  assert.equal(state.tools[0].name, 'bf_capability')
  const listed = await state.tools[0].execute({ action: 'list' }, {})
  assert.match(listed, /blender/)
  assert.match(listed, /off/, 'the shared capability is off by default')
})

test('capabilities: composition config merges over the default, and unknown keys fail soft', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { extra: { package: 'x', whenToUse: 'a test capability' } } })
  const listed = await state.tools[0].execute({ action: 'list' }, {})
  assert.match(listed, /blender/, 'the default survives a composition that only adds')
  assert.match(listed, /extra/)
  const unknown = await state.tools[0].execute({ action: 'on', capability: 'nope' }, {})
  assert.match(unknown, /Unknown capability/)
  assert.match(unknown, /blender/)
})

test('capabilities: on mounts through ctx.plugin, off disposes it', async () => {
  const target = discoverTestPackage()
  if (target === undefined) {
    assert.ok(true, 'no DSH install found; mount path not exercised')
    return
  }
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { probe: { package: target, whenToUse: 'unit-test capability' } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  const activated = await router.execute({ action: 'on', capability: 'probe' }, exec)
  assert.match(activated, /activated/)
  assert.equal(state.plugins.length, 1, 'the capability was mounted exactly once')
  assert.deepEqual(state.plugins[0].config, {}, 'no config declared means an empty config object')
  const again = await router.execute({ action: 'on', capability: 'probe' }, exec)
  assert.match(again, /already active/)
  const released = await router.execute({ action: 'off', capability: 'probe' }, exec)
  assert.match(released, /deactivated/)
  assert.equal(state.plugins.length, 0, 'releasing disposed the mount')
  const missing = await router.execute({ action: 'off', capability: 'probe' }, exec)
  assert.match(missing, /not active/)
})

test('capabilities: activation requires a session context and says so', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { probe: { package: 'x', whenToUse: 'y' } } })
  const result = await state.tools[0].execute({ action: 'on', capability: 'probe' }, {})
  assert.match(result, /only be activated from a session/)
  assert.equal(state.plugins.length, 0, 'nothing was mounted without a session')
})

/** A loadable no-op plugin module, so tests exercise the real import path. */
const NOOP_PACKAGE = 'data:text/javascript,export default function apply() {}'

test('capabilities: a failed start leaves no mount, even when its cleanup also fails', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  let disposeCalls = 0
  state.fibers.push({
    await: async () => { throw new Error('bridge exploded') },
    dispose: async () => { disposeCalls += 1; throw new Error('cleanup exploded too') },
  })
  module.apply(ctx, { capabilities: { probe: { package: NOOP_PACKAGE, whenToUse: 'y' } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  const result = await router.execute({ action: 'on', capability: 'probe' }, exec)
  assert.match(result, /failed to start/)
  assert.match(result, /bridge exploded/, 'the startup error is the headline, not the cleanup error')
  assert.match(result, /cleanup exploded too/, 'the cleanup failure is reported instead of masking the first error')
  assert.equal(disposeCalls, 1, 'the partially started mount was disposed')
  const retry = await router.execute({ action: 'on', capability: 'probe' }, exec)
  assert.doesNotMatch(retry, /already active/, 'the failed attempt freed the slot')
})

test('capabilities: off resolves only after disposal settles, and a failed release stays visible', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  let disposeResult = Promise.resolve()
  state.fibers.push({ await: async () => {}, dispose: () => disposeResult })
  module.apply(ctx, { capabilities: { probe: { package: NOOP_PACKAGE, whenToUse: 'y' } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  assert.match(await router.execute({ action: 'on', capability: 'probe' }, exec), /activated/)
  disposeResult = Promise.reject(new Error('release exploded'))
  const failed = await router.execute({ action: 'off', capability: 'probe' }, exec)
  assert.match(failed, /disposed with an error/)
  assert.match(failed, /release exploded/)
  const listed = await router.execute({ action: 'list' }, exec)
  assert.match(listed, /release failed/, 'list must not claim a clean release happened')
  disposeResult = Promise.resolve()
  assert.match(await router.execute({ action: 'off', capability: 'probe' }, exec), /deactivated/,
    'the stuck entry can be retried once disposal works')
  assert.match(await router.execute({ action: 'off', capability: 'probe' }, exec), /not active/)
})

test('capabilities: two concurrent on calls mount once', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  let release
  let reached
  const reachedPromise = new Promise((resolve) => { reached = resolve })
  state.fibers.push({
    await: () => {
      reached()
      return new Promise((resolve) => { release = resolve })
    },
    dispose: async () => {},
  })
  module.apply(ctx, { capabilities: { probe: { package: NOOP_PACKAGE, whenToUse: 'y' } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  const first = router.execute({ action: 'on', capability: 'probe' }, exec)
  const second = await router.execute({ action: 'on', capability: 'probe' }, exec)
  assert.match(second, /already starting/, 'the in-flight mount is visible to a concurrent call')
  await reachedPromise
  release()
  assert.match(await first, /activated/)
  assert.equal(state.plugins.length, 1, 'exactly one mount happened')
})

test('capabilities: the bookkeeping entry dies with the session that owns it', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { probe: { package: NOOP_PACKAGE, whenToUse: 'y' } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  assert.match(await router.execute({ action: 'on', capability: 'probe' }, exec), /activated/)
  const ownerEffect = state.disposers.find(({ label }) => label === 'blockfire-capability:probe')
  assert.notEqual(ownerEffect, undefined, 'activation registered an effect on the owning context')
  await ownerEffect.disposer()
  const afterClose = await router.execute({ action: 'off', capability: 'probe' }, exec)
  assert.match(afterClose, /not active/, 'closing the session freed the entry')
  state.fibers.push({ await: async () => {}, dispose: async () => {} })
  assert.match(await router.execute({ action: 'on', capability: 'probe' }, exec), /activated/,
    'a resumed session with the same id can activate again')
})

test('capabilities: list names the tools a capability really added (no prefix rule needed)', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  // Simulates the real flow: the capability's tools appear while its plugin starts.
  const visible = ['bash']
  ctx.tools.schemas = () => visible.map((name) => ({ name }))
  state.fibers.push({
    await: async () => { visible.push('cordis_run', 'cordis_stop') },
    dispose: async () => {},
  })
  module.apply(ctx, { capabilities: { cordis: { package: NOOP_PACKAGE, whenToUse: 'y', config: {} } } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  await router.execute({ action: 'on', capability: 'cordis' }, exec)
  const listed = await router.execute({ action: 'list' }, exec)
  assert.match(listed, /tools now visible: cordis_run, cordis_stop/,
    'the activation diff names the real tools even without an mcp__ prefix')
})

test('capabilities: a package that cannot load reports an actionable error', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { broken: { package: '@blockfire/does-not-exist', whenToUse: 'x' } } })
  const result = await state.tools[0].execute({ action: 'on', capability: 'broken' }, sessionExec(ctx))
  assert.match(result, /could not load/)
  assert.match(result, /install\.sh/)
})

// ── destructive-operation guard ─────────────────────────────────────────────

async function guardFor() {
  const module = await import(GUARD)
  const { ctx, state } = fakeCtx()
  module.apply(ctx)
  assert.equal(state.guards.length, 1, 'the guard registers one check')
  return state.guards[0]
}

const DENIED = [
  ['bash', { command: 'sudo rm -rf /var/lib/docker' }],
  ['bash', { command: 'rm -rf /' }],
  ['bash', { command: 'rm -rf /*' }],
  ['bash', { command: 'rm -rf ~' }],
  ['bash', { command: 'rm -rf $HOME' }],
  ['bash', { command: 'rm -rf /home' }],
  ['bash', { command: 'rm -rf /etc' }],
  ['bash', { command: 'mkfs.ext4 /dev/sda1' }],
  ['bash', { command: 'dd if=/dev/zero of=/dev/sda bs=1M' }],
  ['bash', { command: 'chmod -R 777 /' }],
  ['bash', { command: 'chown -R root /' }],
  ['bash', { command: 'cat secret > /dev/sda' }],
  ['bash', { command: 'rm -rf ~/.ssh' }],
  ['bash', { command: 'rm -f ~/.dsh/.credentials.yaml' }],
  ['write', { file_path: '~/.ssh/authorized_keys' }],
  ['edit', { file_path: '/etc/hosts' }],
]

const ALLOWED = [
  ['bash', { command: 'rm -rf .godot' }],
  ['bash', { command: 'rm -rf /tmp/blockfire-build' }],
  ['bash', { command: 'rm -rf build/android' }],
  ['bash', { command: 'tools/bf test' }],
  ['bash', { command: 'tools/bf build android' }],
  ['bash', { command: 'git commit -m "x" && git push origin main' }],
  ['bash', { command: 'adb install -r builds/blockfire.apk' }],
  ['bash', { command: 'godot --headless --path . --script tests/smoke.gd' }],
  ['bash', { command: 'blender --background assets/animation_sources/ReloadRifle.blend --python tools/x.py' }],
  ['bash', { command: 'grep -rn "sudo" game/ || true' }],
  ['bash', { command: 'echo "the mkfs note is in docs/" > /tmp/note' }],
  ['read', { file_path: '~/.dsh/.credentials.yaml' }],
  ['write', { file_path: 'game/player/player.gd' }],
  ['edit', { file_path: 'harness/README.md' }],
]

test('guard: catastrophic operations are denied with a policy reason', async () => {
  const guard = await guardFor()
  for (const [name, args] of DENIED) {
    const reason = guard({ name, arguments: args })
    assert.equal(typeof reason, 'string', `${name} ${JSON.stringify(args)} must be denied`)
    assert.match(reason, /BLOCKFIRE policy blocked/)
    assert.match(reason, /Do not try to work around it/)
  }
})

test('guard: normal BLOCKFIRE work is never touched', async () => {
  const guard = await guardFor()
  for (const [name, args] of ALLOWED) {
    const reason = guard({ name, arguments: args })
    assert.equal(reason, undefined, `${name} ${JSON.stringify(args)} must be allowed, got: ${reason}`)
  }
})

test('guard: unrelated tools are ignored', async () => {
  const guard = await guardFor()
  assert.equal(guard({ name: 'web_search', arguments: { queries: ['rm -rf /'] } }), undefined)
  assert.equal(guard({ name: 'read_image', arguments: { file_path: '/etc/shadow' } }), undefined)
})

// ── Update Center host routes ───────────────────────────────────────────────

test('update center: serves the status JSON the Web panel reads', async () => {
  const module = await import(UPDATE_CENTER)
  const routes = []
  const ctx = {
    get() {
      return undefined
    },
    webServer: {
      register(route) {
        routes.push(route)
        return () => {
          const index = routes.indexOf(route)
          if (index >= 0) routes.splice(index, 1)
        }
      },
    },
    effect(factory) {
      return factory()
    },
  }
  module.apply(ctx)
  assert.equal(routes.length, 2, 'the plugin registers the status route and the delete route')
  assert.equal(routes[0].path, '/blockfire/update')
  assert.equal(routes[0].kind, 'exact')
  assert.equal(routes[1].path, '/blockfire/session/delete')
  assert.equal(routes[1].kind, 'exact')

  const chunks = []
  const res = {
    writeHead(status, headers) {
      chunks.push({ status, headers })
    },
    end(body) {
      chunks.push({ body })
    },
  }
  await routes[0].handler({ url: '/blockfire/update' }, res)
  const head = chunks.find((chunk) => chunk.status !== undefined)
  const payload = JSON.parse(chunks.find((chunk) => typeof chunk.body === 'string').body)
  assert.equal(head.status, 200, 'a local status read must not fail')
  assert.equal(payload.ok, true)
  assert.equal(typeof payload.status, 'object')
  assert.ok(payload.status.stateFile.includes('.blockfire-harness'), 'status reports its state file')
  assert.equal(payload.check, null, 'no network check unless explicitly requested')
})

// ── permanent delete route ──────────────────────────────────────────────────

/** Fake host context exposing exactly the services the delete route reads and writes. */
async function deleteCtx(options = {}) {
  const sessionId = options.sessionId
  const root = options.root
  const records = new Map(options.workspaces ?? [])
  let global = { initialized: true, workspaceIds: options.workspaceIds ?? [], archivedSessionIds: [...(options.archived ?? [])] }
  const stateWrites = []
  const entityRebuilds = []
  const registry = {
    setState(next) {
      stateWrites.push(next.archivedSessionIds)
      global = next
    },
    rebuildEntities() {
      entityRebuilds.push(entityRebuilds.length + 1)
    },
  }
  const domain = {
    table(name) {
      assert.equal(name, 'workspaces')
      return {
        entries: () => [...records.entries()],
        async put(id, record) {
          records.set(id, record)
        },
      }
    },
    global: {
      get: () => global,
      async set(next) {
        global = next
      },
    },
  }
  const agents = new Map(options.agents ?? [])
  const routes = []
  const module = await import(UPDATE_CENTER)
  // The route closes over the plugin ctx, which declares inject:
  // ['webServer', 'sessionPersistence', 'storageDomain'] — so the fake must
  // expose those services as ctx properties, exactly as Cordis does.
  const services = {
    sessionPersistence: {
      async list() {
        return (options.knownIds ?? [sessionId]).map((id) => ({ id, cwd: root }))
      },
      locate(meta) {
        return { kind: 'jsonl', path: join(root, 'log', meta.id, 'session.jsonl.zstd') }
      },
    },
    storageDomain: { get: () => domain },
    workspaceRegistry: registry,
    agents: { get: (id) => agents.get(id) },
  }
  module.apply({
    get(name) {
      return services[name]
    },
    sessionPersistence: services.sessionPersistence,
    storageDomain: services.storageDomain,
    workspaceRegistry: services.workspaceRegistry,
    agents: services.agents,
    webServer: {
      register(route) {
        routes.push(route)
      },
    },
    effect(factory) {
      return factory()
    },
  })
  const call = async (request) => {
    const chunks = []
    const res = {
      writeHead(status) {
        chunks.push({ status })
      },
      end(body) {
        chunks.push({ body })
      },
    }
    await routes[1].handler(request, res)
    return {
      status: chunks.find((chunk) => chunk.status !== undefined)?.status,
      body: JSON.parse(chunks.find((chunk) => typeof chunk.body === 'string')?.body ?? 'null'),
    }
  }
  const post = (body, headers = { 'x-blockfire-delete': '1' }) => {
    const payload = JSON.stringify(body)
    return call({
      method: 'POST',
      headers,
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(payload))
        if (event === 'end') handler()
      },
    })
  }
  return { post, call, records, agents, stateWrites, entityRebuilds, global: () => global }
}

const DELETE_ID = '0123abcd-0000-4000-8000-000000000001'
const OTHER_ID = '0123abcd-0000-4000-8000-000000000002'
const deleteHome = async () => {
  const fs = await import('node:fs/promises')
  const home = await fs.mkdtemp(join(tmpdir(), 'blockfire-del-'))
  process.env.DSH_HOME = home
  return home
}

test('delete: refuses anything that is not a POST with the delete header and a session id', async () => {
  await deleteHome()
  const ctx = await deleteCtx({ sessionId: DELETE_ID, root: process.env.DSH_HOME })
  const denied = await ctx.call({ method: 'GET', headers: {} })
  assert.equal(denied.status, 405, 'GET is never a delete')
  const noHeader = await ctx.post({ sessionId: DELETE_ID }, {})
  assert.equal(noHeader.status, 405, 'a cross-origin form cannot forge the custom header')
  const badBody = await ctx.post({ sessionId: 'not-a-session-id' })
  assert.equal(badBody.status, 400, 'a malformed session id is rejected before any write')
})

test('delete: 404 unknown session, 409 running session, no writes on either', async () => {
  await deleteHome()
  const ctx = await deleteCtx({
    sessionId: DELETE_ID,
    root: process.env.DSH_HOME,
    workspaces: [['w1', { path: '/p', title: 't', createdAt: '', updatedAt: '', sessionIds: [DELETE_ID] }]],
  })
  const missing = await deleteCtx({ sessionId: OTHER_ID, root: process.env.DSH_HOME, knownIds: [] })
  const unknown = await missing.post({ sessionId: OTHER_ID })
  assert.equal(unknown.status, 404)
  assert.equal(ctx.records.get('w1').sessionIds.length, 1, 'no accounting change for an unknown session')
  ctx.agents.set(DELETE_ID, { status: 'running' })
  const running = await ctx.post({ sessionId: DELETE_ID })
  assert.equal(running.status, 409, 'a RUNNING agent must not have its log deleted under it')
  assert.equal(ctx.records.get('w1').sessionIds.length, 1, 'no accounting change while the session runs')
})

test('delete: removes workspace accounting, archived set entry, log dir and cache entry', async () => {
  const fs = await import('node:fs/promises')
  const home = await deleteHome()
  const cacheDir = join(home, 'storages', 'session_projcache', 'sessions')
  await fs.mkdir(cacheDir, { recursive: true })
  const logDir = join(home, 'log', DELETE_ID)
  await fs.mkdir(logDir, { recursive: true })
  await fs.writeFile(join(logDir, 'session.jsonl.zstd'), 'x')
  const cacheEntry = join(cacheDir, `${DELETE_ID}.json`)
  await fs.writeFile(cacheEntry, '{}')
  const ctx = await deleteCtx({
    sessionId: DELETE_ID,
    root: home,
    workspaces: [['w1', { path: '/p', title: 't', createdAt: '', updatedAt: '', sessionIds: [DELETE_ID, OTHER_ID] }]],
    workspaceIds: ['w1'],
    archived: [DELETE_ID],
  })
  const result = await ctx.post({ sessionId: DELETE_ID })
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.deepEqual(ctx.records.get('w1').sessionIds, [OTHER_ID], 'the deleted id leaves its workspace record')
  assert.deepEqual(ctx.global().archivedSessionIds, [], 'the deleted id leaves the archive set')
  assert.equal(ctx.stateWrites.length, 1, 'the global write goes through the registry setState')
  assert.equal(ctx.entityRebuilds.length, 1, 'entity cache rebuilt from the table after the write')
  assert.equal(existsSync(logDir), false, 'the session log directory is gone')
  assert.equal(existsSync(cacheEntry), false, 'the projection-cache entry is gone')
  const again = await ctx.post({ sessionId: DELETE_ID })
  assert.equal(again.status, 200, 'a second call stays consistent (accounting already clean)')
})
