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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const CAPABILITIES = pathToFileURL(join(HARNESS, 'presets', 'build', 'plugins', 'capabilities.js')).href
const GUARD = pathToFileURL(join(HARNESS, 'host', 'guard.js')).href
const UPDATE_CENTER = pathToFileURL(join(HARNESS, 'web', 'lib', 'index.js')).href

/** Minimal Cordis context: records registrations and runs effect factories. */
function fakeCtx() {
  const state = { tools: [], guards: [], plugins: [], disposers: [] }
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
      return () => {
        const index = state.plugins.findIndex((entry) => entry.plugin === plugin)
        if (index >= 0) state.plugins.splice(index, 1)
      }
    },
    effect(factory) {
      const disposer = factory()
      state.disposers.push(disposer)
      return disposer
    },
  }
  return { ctx, state }
}

/** A resolvable Cordis plugin module, used as the router's test capability. */
function discoverTestPackage() {
  const roots = [
    process.env.BLOCKFIRE_DSH_MODULES,
    join(process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh'), '.agent-presets', 'build', 'node_modules'),
    '/home/alex/.npm/_npx/1e7f6d9597241db0/node_modules',
  ].filter((value) => typeof value === 'string' && value !== '')
  for (const root of roots) {
    const candidate = join(root, '@deepseek-ai', 'dsh-tool-todo', 'lib', 'index.js')
    if (existsSync(candidate)) return candidate
  }
  return undefined
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
  const activated = await router.execute({ action: 'on', capability: 'probe' }, {})
  assert.match(activated, /activated/)
  assert.equal(state.plugins.length, 1, 'the capability was mounted exactly once')
  assert.deepEqual(state.plugins[0].config, {}, 'no config declared means an empty config object')
  const again = await router.execute({ action: 'on', capability: 'probe' }, {})
  assert.match(again, /already active/)
  const released = await router.execute({ action: 'off', capability: 'probe' }, {})
  assert.match(released, /deactivated/)
  assert.equal(state.plugins.length, 0, 'releasing disposed the mount')
  const missing = await router.execute({ action: 'off', capability: 'probe' }, {})
  assert.match(missing, /not active/)
})

test('capabilities: a package that cannot load reports an actionable error', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { broken: { package: '@blockfire/does-not-exist', whenToUse: 'x' } } })
  const result = await state.tools[0].execute({ action: 'on', capability: 'broken' }, {})
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

// ── Update Center host route ────────────────────────────────────────────────

test('update center: serves the status JSON the Web panel reads', async () => {
  const module = await import(UPDATE_CENTER)
  const routes = []
  const ctx = {
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
  assert.equal(routes.length, 1, 'the plugin registers exactly one route')
  assert.equal(routes[0].path, '/blockfire/update')
  assert.equal(routes[0].kind, 'exact')

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
