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
 *     Its Blender defaults are `blender` (minimal craft loop) plus the
 *     `blender-full` escalation, which must refuse to run alongside each other.
 *   * `blender-min.js` — the minimal craft plugin must register exactly two
 *     cheap tools and fail soft (actionable message, never a mount failure)
 *     when Blender is unreachable.
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
const BLENDER_MIN = pathToFileURL(join(HARNESS, 'presets', 'build', 'plugins', 'blender-min.js')).href
const PROMPT = pathToFileURL(join(HARNESS, 'presets', 'build', 'plugins', 'prompt.js')).href
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
  assert.match(listed, /blender-full/, 'the full-bridge escalation is declared next to the minimal loop')
  assert.match(listed, /off/, 'the shared capabilities are off by default')
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

test('capabilities: conflicting capabilities refuse to run together', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: {
    min: { package: NOOP_PACKAGE, whenToUse: 'y', conflictsWith: ['full'] },
    full: { package: NOOP_PACKAGE, whenToUse: 'y', conflictsWith: ['min'] },
  } })
  const router = state.tools[0]
  const exec = sessionExec(ctx)
  assert.match(await router.execute({ action: 'on', capability: 'min' }, exec), /activated/)
  const clash = await router.execute({ action: 'on', capability: 'full' }, exec)
  assert.match(clash, /conflicts with "min"/, 'the second Blender connection is refused with a message')
  assert.match(clash, /"off"/, 'the message says how to proceed')
  assert.equal(state.plugins.length, 1, 'the refused activation mounted nothing')
  assert.match(await router.execute({ action: 'off', capability: 'min' }, exec), /deactivated/)
  assert.match(await router.execute({ action: 'on', capability: 'full' }, exec), /activated/,
    'escalation works once the minimal loop is off')
})

test('capabilities: a package that cannot load reports an actionable error', async () => {
  const module = await import(CAPABILITIES)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, { capabilities: { broken: { package: '@blockfire/does-not-exist', whenToUse: 'x' } } })
  const result = await state.tools[0].execute({ action: 'on', capability: 'broken' }, sessionExec(ctx))
  assert.match(result, /could not load/)
  assert.match(result, /install\.sh/)
})

// ── prompt fit ──────────────────────────────────────────────────────────────
//
// `prompt.js` is a pure function over an assembled prompt, which makes it
// testable without a host. The fixtures are the upstream texts this layer
// actually meets — the bash description below is verbatim DSH 0.1.5-rc.2 — so
// "terse" is asserted against reality rather than against a straw man.

const UPSTREAM_BASH = 'Execute a bash command (`bash -c`) and return its stdout/stderr. Each call runs in a fresh shell: no state (cwd, variables, functions) persists between calls — pass `workdir` instead of using `cd`. Non-zero exits are reported as `[exit code: N]`. Current harness environment facts are exposed through managed `$DSH_*` variables; inspect them when needed. Commands may run under a file sandbox; a blocked file operation is reported as `[sandbox: file access denied under <mode> mode]` — a policy denial, not a bug in the command; do not retry another way. Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. Set `run_in_background: true` for long-running commands: the call returns a job id immediately; read its output with `job_output` and stop it with `job_kill`. Attempting a command the sandbox may deny is safe and expected: run it and read the marker rather than assuming the denial. When a command is denied and a wider mode would let it succeed, escalate immediately in the same turn — the one sanctioned exception to a denial: retry the exact same command once with `sandbox_permissions` (the narrowest wider mode that suffices) plus a one-sentence `justification`. Do not detour through chat to ask permission first — the approval prompt raised by that retry is how the user consents. If the session states approval prompts are disabled, there is no exception: a denial is final — do not set `sandbox_permissions`. Never escalate speculatively: ground the request in a real denial — normally the one this command just hit; escalating up front is fine only when this session already denied the same access. A rejected escalation is final for that command — stop and explain, never work around it — but it does not forbid attempting or escalating other commands later.'

const UPSTREAM_GLOB = 'Find files whose paths match a glob pattern. Returns matching file paths — never directories — including hidden and ignored files (VCS metadata directories are excluded). Up to 100 paths come back in modification-time order; a larger result returns the first 100 paths in modification-time order, says so, and reports where the complete sorted list was saved. This tool does not enumerate directory entries.'

/** One assembly shaped like the waterfall's, with the sections a preset really has. */
function fitFixture({ descriptions = {}, sections = [], contexts = [] } = {}) {
  return {
    variables: {},
    contexts: contexts.map(([name, text]) => ({ name, text })),
    sections: sections.map(([name, text]) => ({ name, text })),
    tools: Object.entries(descriptions).map(([name, description]) => ({
      name,
      description,
      parameters: { type: 'object', properties: { [name]: { type: 'string' } }, required: [name] },
    })),
  }
}

const APPROVAL_ASK = ['approval:policy', 'Approval policy: ask. Operations that require approval may ask through the configured answerers; without an available answerer, the request fails closed.']
const APPROVAL_NEVER = ['approval:policy', 'Approval prompts are disabled in this session: actions that require approval are rejected automatically — do not request sandbox escalation (do not set `sandbox_permissions`).']
const DENIAL = '[sandbox: file access denied under'

test('prompt: a known tool gets a terse English description and keeps its parameters', async () => {
  const { fit } = await import(PROMPT)
  const assembly = fitFixture({ descriptions: { bash: UPSTREAM_BASH, glob: UPSTREAM_GLOB, unknown_tool: 'Some upstream text about an unknown tool.' } })
  const fitted = fit(assembly, { harnessSource: false })
  const bash = fitted.tools.find(tool => tool.name === 'bash')
  const glob = fitted.tools.find(tool => tool.name === 'glob')
  assert(bash.description.length < UPSTREAM_BASH.length * 0.6,
    `bash must shrink substantially (${UPSTREAM_BASH.length} -> ${bash.description.length})`)
  assert(glob.description.length < UPSTREAM_GLOB.length * 0.85, 'glob must shrink')
  for (const marker of ['[exit code: N]', 'workdir', 'run_in_background', 'job_output', 'job_kill', DENIAL, '$DSH_*']) {
    assert(bash.description.includes(marker), `bash keeps ${marker} so the model recognizes it in results`)
  }
  assert.equal(fitted.tools.find(tool => tool.name === 'unknown_tool').description,
    assembly.tools.find(tool => tool.name === 'unknown_tool').description,
    'an unknown tool passes through untouched instead of being dropped')
  assert.deepEqual(fitted.tools.map(tool => tool.parameters), assembly.tools.map(tool => tool.parameters),
    'parameters are never touched')
  assert.deepEqual(fitted.tools.map(tool => tool.name), assembly.tools.map(tool => tool.name), 'tool order is preserved')
  assert(!/[áéíóúüñ¿¡]/.test(JSON.stringify(fitted.tools)), 'rewritten schemas stay ASCII English')
  assert.equal(assembly.tools.find(tool => tool.name === 'bash').description, UPSTREAM_BASH,
    'the input assembly is never mutated')
})

test('prompt: the sandbox wording follows the policy this session actually has', async () => {
  const { fit } = await import(PROMPT)
  const of = async contexts => fit(fitFixture({ descriptions: { bash: UPSTREAM_BASH }, contexts }), {})
    .tools.find(tool => tool.name === 'bash').description
  const ask = await of([APPROVAL_ASK])
  const never = await of([APPROVAL_NEVER])
  const unstated = await of([])
  assert(ask.includes('sandbox_permissions') && ask.includes('justification'), 'an asking session keeps the escalation path')
  assert(!ask.includes('Approval prompts are disabled in this session: actions'), 'upstream boilerplate is not repeated')
  assert(never.includes('do not set `sandbox_permissions`'), 'a never-ask session is told a denial is final')
  assert(!never.includes('retry the exact same command once'), 'a never-ask session is not taught an escalation it cannot get')
  assert(unstated.includes('sandbox_permissions'), 'an unstated policy keeps the conditional wording')
  assert(never.length < ask.length, 'the disabled policy is the shorter text')
})

test('prompt: a section that only restates a description goes away only when that tool is present', async () => {
  const { fit } = await import(PROMPT)
  const sections = [['tool:bash', 'Check the [exit code: N] marker.'], ['tool:glob', 'Use the glob tool.'], ['tool:subagent', 'Use subagent in the background.'], ['tool:jobs', 'Track every background job id.']]
  const withTools = fit(fitFixture({ descriptions: { bash: UPSTREAM_BASH, glob: UPSTREAM_GLOB, subagent: 'Delegate a self-contained task to a subagent.' }, sections }), {})
  assert.deepEqual(withTools.sections.map(section => section.name), ['tool:jobs'],
    'redundant sections are dropped, unrelated ones survive')
  const withoutTools = fit(fitFixture({ descriptions: { bash: UPSTREAM_BASH }, sections }), {})
  assert.deepEqual(withoutTools.sections.map(section => section.name), ['tool:glob', 'tool:subagent', 'tool:jobs'],
    'without the tool, upstream keeps owning the fact')
})

test('prompt: upstream prose is rewritten only when it is the text we recognize', async () => {
  const { fit } = await import(PROMPT)
  const upstream = "Use the edit tool for targeted changes to existing UTF-8 text files. It replaces literal old_string with new_string; by default old_string must appear exactly once. If old_string appears multiple times, provide a more specific old_string or set replace_all to true. Read the file first (the default fs-observation-policy requires it), unless you just created or edited it in this session."
  const rewritten = fit(fitFixture({ sections: [['tool:edit', upstream]] }), {})
  assert(rewritten.sections[0].text.length < upstream.length, 'recognized prose is rewritten shorter')
  assert(rewritten.sections[0].text.includes('old_string'), 'the rewritten prose keeps the parameter semantics')
  const renamed = fit(fitFixture({ sections: [['tool:edit', 'Entirely different upstream wording.']] }), {})
  assert.equal(renamed.sections[0].text, 'Entirely different upstream wording.',
    'unrecognized prose passes through instead of being replaced by a stale copy')
  const dynamic = fit(fitFixture({ sections: [['app:web-surface', 'You are interacting with the user through the DeepSeek Harness Web GUI at http://127.0.0.1:9999. Change something.']] }), {})
  assert.equal(dynamic.sections[0].text.includes('window.__DSH_BOOT__'), false, 'the web section needs its own marker to be rewritten')
})

test('prompt: the checkout section is dropped only where it is configured away', async () => {
  const { fit } = await import(PROMPT)
  const checkout = 'The DeepSeek Harness implementation checkout is at /tmp/dsh-checkout. The checkout location and the current working directory are separate values and may differ; never infer the working directory from this path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.'
  const sections = [['harness:source', checkout], ['harness:identity', 'You are an AI agent powered by DeepSeek Harness.']]
  assert.deepEqual(fit(fitFixture({ sections }), { harnessSource: false }).sections.map(section => section.name), ['harness:identity'])
  const kept = fit(fitFixture({ sections }), { harnessSource: true }).sections
  assert.deepEqual(kept.map(section => section.name), ['harness:source', 'harness:identity'])
  assert(kept[0].text.includes('/tmp/dsh-checkout'), 'the checkout path survives the rewrite')
  assert(kept[0].text.length < checkout.length, 'the kept section is compressed')
})

test('prompt: fitting is idempotent, and apply() joins the assemble waterfall', async () => {
  const module = await import(PROMPT)
  const assembly = fitFixture({ descriptions: { bash: UPSTREAM_BASH, glob: UPSTREAM_GLOB }, sections: [['tool:glob', 'Use the glob tool.']], contexts: [APPROVAL_ASK] })
  const once = module.fit(assembly, { harnessSource: false })
  assert.deepEqual(module.fit(once, { harnessSource: false }), once, 'a second pass changes nothing')

  const listeners = []
  module.apply({ on: (event, handler) => listeners.push({ event, handler }) }, { harnessSource: false })
  assert.equal(listeners.length, 1)
  assert.equal(listeners[0].event, 'system-prompt/assemble')
  let called = 0
  const fitted = await listeners[0].handler({}, {}, async () => { called += 1; return assembly })
  assert.equal(called, 1, 'the listener continues the waterfall exactly once')
  assert.equal(fitted.tools.find(tool => tool.name === 'bash').description.length < UPSTREAM_BASH.length, true)
})

// ── minimal Blender craft loop ──────────────────────────────────────────────

async function blenderMinFor(config = {}) {
  const module = await import(BLENDER_MIN)
  const { ctx, state } = fakeCtx()
  module.apply(ctx, config)
  assert.equal(state.tools.length, 2, 'the minimal loop registers exactly two tools')
  const byName = Object.fromEntries(state.tools.map((tool) => [tool.name, tool]))
  assert.ok(byName.blender_exec, 'execute-code primitive present')
  assert.ok(byName.blender_screenshot, 'viewport-screenshot primitive present')
  return { ctx, state, byName }
}

test('blender-min: two cheap tools, no connection at mount', async () => {
  const { state, byName } = await blenderMinFor()
  assert.deepEqual(byName.blender_exec.parameters.required, ['code'])
  assert.deepEqual(byName.blender_screenshot.parameters.required, [])
  const chars = JSON.stringify(state.tools.map(({ name, description, parameters }) =>
    ({ name, description, parameters }))).length
  assert.ok(chars < 4000, `both schemas together stay cheap, got ${chars} chars`)
  const finalize = byName.blender_screenshot.finalizeContent
  assert.equal(typeof finalize, 'function', 'the screenshot tool owns its image projection')
  assert.equal(finalize({}, { isError: false }), undefined, 'no projection without an execution')
})

test('blender-min: executing without Blender fails soft with an actionable error', async () => {
  const { byName } = await blenderMinFor({ command: '/nonexistent/blender-mcp-for-unit-tests' })
  await assert.rejects(
    byName.blender_exec.execute({}, {}),
    /"code"/,
    'missing code is rejected before any connection attempt',
  )
  const failure = await byName.blender_exec.execute({ code: 'x = 1' }, {}).then(
    () => { throw new Error('must not succeed without a server') },
    (error) => String(error?.message ?? error),
  )
  assert.match(failure, /Blender/i, 'the error names Blender and how to fix it, never a stack trace')
  const shot = await byName.blender_screenshot.execute({}, {}).then(
    () => { throw new Error('must not succeed without a server') },
    (error) => String(error?.message ?? error),
  )
  assert.match(shot, /Blender/i)
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
  assert.equal(routes.length, 4, 'status, action, job and delete routes are registered')
  assert.equal(routes[0].path, '/blockfire/update')
  assert.equal(routes[0].kind, 'exact')
  assert.equal(routes[1].path, '/blockfire/update/action')
  assert.equal(routes[2].path, '/blockfire/update/job')
  assert.equal(routes[3].path, '/blockfire/session/delete')
  assert.equal(routes[3].kind, 'exact')

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
    const route = routes.find((candidate) => candidate.path === '/blockfire/session/delete')
    await route.handler(request, res)
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
  const missing = await ctx.post({})
  assert.equal(missing.status, 400, 'a missing session id is rejected before any write')
  const traversal = await ctx.post({ sessionId: '../../etc' })
  assert.equal(traversal.status, 400, 'ids are charset-checked: no path shapes')
})

test('delete: an unknown but well-formed id is a 404, never a write', async () => {
  await deleteHome()
  const ctx = await deleteCtx({
    sessionId: DELETE_ID,
    root: process.env.DSH_HOME,
    workspaces: [['w1', { path: '/p', title: 't', createdAt: '', updatedAt: '', sessionIds: [DELETE_ID] }]],
  })
  const unknown = await ctx.post({ sessionId: 'not-a-real-session-id' })
  assert.equal(unknown.status, 404, 'the persistence lookup is the real gate')
  assert.equal(ctx.records.get('w1').sessionIds.length, 1, 'no accounting change for an unknown session')
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

test('delete: accepts the session- prefixed ids the current runtime issues', async () => {
  // The workspace registry, the log directories and the projection cache all
  // key on `session-<uuid>` today (this exact shape is what the user's real
  // GUI sends); the bare uuid above covers older installs. Regression: the
  // validator used to demand exactly 36 hex-ish chars and rejected it.
  const fs = await import('node:fs/promises')
  const home = await deleteHome()
  const prefixed = `session-${DELETE_ID}`
  const cacheDir = join(home, 'storages', 'session_projcache', 'sessions')
  await fs.mkdir(cacheDir, { recursive: true })
  const logDir = join(home, 'log', prefixed)
  await fs.mkdir(logDir, { recursive: true })
  await fs.writeFile(join(logDir, 'session.jsonl.zstd'), 'x')
  const cacheEntry = join(cacheDir, `${prefixed}.json`)
  await fs.writeFile(cacheEntry, '{}')
  const ctx = await deleteCtx({
    sessionId: prefixed,
    root: home,
    workspaces: [['w1', { path: '/p', title: 't', createdAt: '', updatedAt: '', sessionIds: [prefixed] }]],
    workspaceIds: ['w1'],
    archived: [prefixed],
  })
  const result = await ctx.post({ sessionId: prefixed })
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.deepEqual(ctx.records.get('w1').sessionIds, [], 'the prefixed id leaves its workspace record')
  assert.deepEqual(ctx.global().archivedSessionIds, [], 'the prefixed id leaves the archive set')
  assert.equal(existsSync(logDir), false, 'the session log directory is gone')
  assert.equal(existsSync(cacheEntry), false, 'the projection-cache entry is gone')
})

// ── update actions: the Web driving the same CLI mechanism ──────────────────

/**
 * A host context with a fake `<repoRoot>/harness/bin/update.mjs` (fixture
 * copy), so the action route spawns something hermetic instead of npm, the
 * network or the real state file. The fixture records every invocation.
 */
async function actionCtx(options = {}) {
  const fs = await import('node:fs/promises')
  const root = await fs.mkdtemp(join(tmpdir(), 'blockfire-act-'))
  await fs.mkdir(join(root, 'harness', 'bin'), { recursive: true })
  await fs.copyFile(join(HARNESS, 'tests', 'fixtures', 'fake-update.mjs'), join(root, 'harness', 'bin', 'update.mjs'))
  process.env.FAKE_UPDATE_LOG = join(root, 'invocations.log')
  process.env.FAKE_VERIFY_FAIL = options.verifyFails === true ? '1' : ''
  process.env.FAKE_UPDATE_DELAY_MS = options.delayMs === undefined ? '' : String(options.delayMs)
  const routes = []
  const module = await import(UPDATE_CENTER)
  module.apply(
    {
      get() {
        return undefined
      },
      webServer: {
        register(route) {
          routes.push(route)
        },
      },
      effect(factory) {
        return factory()
      },
    },
    { repoRoot: root },
  )
  const actionRoute = routes.find((route) => route.path === '/blockfire/update/action')
  const jobRoute = routes.find((route) => route.path === '/blockfire/update/job')
  const call = async (route, request) => {
    const chunks = []
    const res = {
      writeHead(status) {
        chunks.push({ status })
      },
      end(body) {
        chunks.push({ body })
      },
    }
    await route.handler(request, res)
    return {
      status: chunks.find((chunk) => chunk.status !== undefined)?.status,
      body: JSON.parse(chunks.find((chunk) => typeof chunk.body === 'string')?.body ?? 'null'),
    }
  }
  const post = (body, headers = { 'x-blockfire-update': '1' }) => {
    const payload = JSON.stringify(body)
    return call(actionRoute, {
      method: 'POST',
      headers,
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(payload))
        if (event === 'end') handler()
      },
    })
  }
  const getJob = () => call(jobRoute, { method: 'GET', url: '/blockfire/update/job', headers: {} })
  const waitFor = async (predicate, timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const reply = await getJob()
      if (reply.body?.job && predicate(reply.body.job)) return reply.body.job
      if (Date.now() > deadline) throw new Error(`job never settled: ${JSON.stringify(reply.body)}`)
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
  }
  const invocations = async () => (await fs.readFile(process.env.FAKE_UPDATE_LOG, 'utf8')).trim().split('\n')
  return { post, getJob, waitFor, invocations }
}

test('update actions: header-gated, validated, and single-flight', async () => {
  const ctx = await actionCtx({ delayMs: 500 })
  const noHeader = await ctx.post({ action: 'rollback' }, {})
  assert.equal(noHeader.status, 405, 'a cross-origin form cannot forge the custom header')
  const unknown = await ctx.post({ action: 'reinstall' })
  assert.equal(unknown.status, 400)
  const noVersion = await ctx.post({ action: 'stage' })
  assert.equal(noVersion.status, 400, 'stage without a version is rejected before spawning')
  const badVersion = await ctx.post({ action: 'update', version: '../etc' })
  assert.equal(badVersion.status, 400, 'versions are shape-checked')
  const started = await ctx.post({ action: 'rollback' })
  assert.equal(started.status, 200)
  assert.ok(started.body.jobId, 'the caller gets a job id to poll')
  const concurrent = await ctx.post({ action: 'rollback' })
  assert.equal(concurrent.status, 409, 'one update operation at a time')
  const job = await ctx.waitFor((candidate) => candidate.state === 'done')
  assert.equal(job.ok, true)
  assert.deepEqual(await ctx.invocations(), ['rollback'])
})

test('update actions: the update chain is stage → verify → activate, stopping on failure', async () => {
  const ctx = await actionCtx({ verifyFails: true })
  const started = await ctx.post({ action: 'update', version: '9.9.9-fake' })
  assert.equal(started.status, 200)
  const job = await ctx.waitFor((candidate) => candidate.state === 'done')
  assert.equal(job.ok, false, 'a failed verify fails the whole chain')
  assert.match(job.output, /FAIL — the suite rejected the candidate/, 'the exact CLI failure is in the job output')
  assert.match(job.output, /stopped — nothing was activated/)
  assert.deepEqual(await ctx.invocations(), ['stage 9.9.9-fake', 'verify 9.9.9-fake'], 'activate is never reached')
})

test('update actions: a passing chain reaches activate', async () => {
  const ctx = await actionCtx()
  const started = await ctx.post({ action: 'update', version: '9.9.9-fake' })
  assert.equal(started.status, 200)
  const job = await ctx.waitFor((candidate) => candidate.state === 'done')
  assert.equal(job.ok, true)
  assert.deepEqual(await ctx.invocations(), ['stage 9.9.9-fake', 'verify 9.9.9-fake', 'activate 9.9.9-fake'])
})

test('update actions: the job endpoint reports state and output', async () => {
  const ctx = await actionCtx({ delayMs: 300 })
  await ctx.post({ action: 'rollback' })
  const running = await ctx.getJob()
  assert.equal(running.status, 200)
  assert.equal(running.body.job.state, 'running', 'the job is visible while it runs')
  const job = await ctx.waitFor((candidate) => candidate.state === 'done')
  assert.match(job.output, /rolled back/, 'the CLI output is reported verbatim')
  const missing = await ctx.getJob() // last job — a wrong id would be a 404
  assert.equal(missing.status, 200)
})
