#!/usr/bin/env node
// Real Web host + both presets, in an ephemeral DSH_HOME. No model requests.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, cpSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveRuntime } from '../lib/runtime.mjs'

const harness = fileURLToPath(new URL('../', import.meta.url))
const runtime = resolveRuntime()
assert.equal(runtime.ok, true, runtime.error)
const modules = runtime.nodeModules
const require = createRequire(join(modules, 'blockfire-mount.cjs'))
const fromRuntime = async name => import(pathToFileURL(require.resolve(name)))
const temporary = mkdtempSync(join(tmpdir(), 'blockfire-mount-'))
process.env.DSH_HOME = temporary
process.env.DSH_TELEMETRY_DISABLED = '1'
let ctx
try {
  const { boot, loadOverlayPatches } = await fromRuntime('@deepseek-ai/dsh-app-boot')
  const { provideCmdline } = await fromRuntime('@deepseek-ai/dsh-cmdline')
  writeFileSync(join(temporary, 'cordis.yml'), '[]\n')
  symlinkSync(modules, join(temporary, 'node_modules'), 'dir')
  // Match the installed Web profile: upstream's profile manifest has no version.
  // The guard is loaded through this symlink, not its repo-realpath.
  const profile = join(temporary, 'profile')
  mkdirSync(profile)
  writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', private: true }))
  symlinkSync(join(harness, 'host'), join(profile, 'blockfire'), 'dir')
  cpSync(join(harness, 'presets'), join(temporary, 'presets'), { recursive: true })
  for (const space of ['build', 'creator']) symlinkSync(modules, join(temporary, 'presets', space, 'node_modules'), 'dir')

  const fixture = join(temporary, 'probe.mjs')
  writeFileSync(fixture, `export const inject = ['tools'];
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({name:'mcp__probe__ping', description:'Lifecycle fixture',
    parameters:{type:'object',properties:{}}, output:{schema:{type:'string'},render:()=>[]},
    execute:async()=> 'pong'}));
}`)
  const failFixture = join(temporary, 'probe-fail.mjs')
  writeFileSync(failFixture, `export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({name:'mcp__fail__ping', description:'Partial mount fixture',
    parameters:{type:'object',properties:{}}, output:{schema:{type:'string'},render:()=>[]},
    execute:async()=> 'pong'}));
  throw new Error('probe start failure');
}`)
  appendFileSync(join(temporary, 'presets/build/surface.cordis.yml'),
    `\n  config:\n    capabilities:\n      probe:\n        package: ${JSON.stringify(fixture)}\n        config:\n          serverName: probe\n` +
    `      fail:\n        package: ${JSON.stringify(failFixture)}\n        config:\n          serverName: fail\n`)

  const load = file => loadOverlayPatches('blockfire-mount', file)
  const ownPatch = load(join(harness, 'host/patch.cordis.yml'))
  for (const patch of ownPatch) for (const row of patch.insert ?? []) {
    if (row.id === 'blockfire-guard') row.name = pathToFileURL(join(profile, 'blockfire/guard.js')).href
    if (row.id === 'blockfire-update-center') row.name = pathToFileURL(join(harness, 'web/lib/index.js')).href
  }
  const patches = [
    ...load(join(modules, '@deepseek-ai/dsh-base/cordis.patch.yml')),
    ...load(join(modules, '@deepseek-ai/dsh-web-app/cordis.patch.yml')),
    ...ownPatch,
    { id: 'agent-presets', config: { default: 'build', includeShippedRoot: false,
      includeUserRoot: false, roots: [{ path: join(temporary, 'presets'), trust: 'user' }] } },
    { id: 'session-telemetry-otel', disabled: true },
    { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
    { id: 'web-runtime', config: { openBrowser: false, printUrl: false, surfaceContext: true } },
  ]
  if (process.argv.includes('--missing-host-service')) patches.push({ id: 'subagent-model-selection-settings', disabled: true })
  ctx = await boot('blockfire-mount', join(temporary, 'cordis.yml'), patches,
    host => provideCmdline(host, { args: ['--no-open'], exit: code => { throw new Error(`unexpected exit ${code}`) } }),
    pathToFileURL(`${modules}/`).href)

  const contract = JSON.parse(readFileSync(join(harness, 'contract/contract.json'), 'utf8'))
  const { scopeOf } = await fromRuntime('@deepseek-ai/dsh-scope')
  for (const space of ['build', 'creator']) {
    const handle = await ctx.agents.create({ sessionId: `blockfire-mount-${space}`,
      meta: { cwd: resolve(harness, '..'), agentPreset: space },
      setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, space) } })
    try {
      const scope = scopeOf(handle.agent.ctx)
      const schemas = ctx.tools.schemas(scope)
      assert.deepEqual(schemas.map(tool => tool.name).sort(), [...contract.spaces[space].tools].sort(), `${space} tools`)
      const skills = (await ctx.skills.list({ scope })).map(skill => skill.name)
      for (const name of space === 'build'
        ? ['blockfire-evidence', 'blockfire-android-qa', 'blockfire-animation-craft']
        : ['blockfire-harness', 'editing-cordis-compositions', 'cordis-plugin-development']) {
        assert(skills.includes(name), `${space} missing skill ${name}`)
      }
      if (space === 'build') {
        assert(!skills.includes('blockfire-harness'), 'BUILD must not carry the harness-authoring skill')
      } else {
        assert(!skills.includes('blockfire-evidence') && !skills.includes('session-retrospective'),
          'CREATOR must not carry shared project workflow skills')
        assert(!skills.includes('blockfire-android-qa') && !skills.includes('blockfire-animation-craft'),
          'CREATOR must not carry game skills')
        const creatorRouter = ctx.tools.get('bf_capability', scope)
        const listed = await creatorRouter.execute({ action: 'list' }, { agent: handle.agent })
        assert.match(listed, /cordis/)
        assert.doesNotMatch(listed, /blender/, 'CREATOR capabilities are harness-only')
      }
      console.log(`  ok    live mount ${space}: ${schemas.length} tools, ${JSON.stringify(schemas).length} schema chars, ${skills.length} skills (DSH ${runtime.version})`)
      // Exercise the official adapter's pre-dispatch boundary without HTTP or keys.
      const extensions = ctx.get('deepseekLlmApiExtensions')
      assert(extensions, 'DeepSeek request extension registry is mounted')
      const prepared = await extensions.prepare({
        body: { model: 'deepseek-flash', messages: [] },
        signal: new AbortController().signal,
        sessionId: String(handle.agent.id),
      })
      assert(Array.isArray(prepared.fields.dsh_plugin_packages?.packages), 'plugin inventory is prepared')
      assert(prepared.fields.dsh_plugin_packages.packages.some(pkg =>
        pkg.name === '@blockfire/harness-host' && pkg.version === '1.0.0'),
      'guard contributes its own package identity through the installed symlink')
      assert(!prepared.fields.dsh_plugin_packages.packages.some(pkg => pkg.name === 'dsh-profile-web'),
        'profile container must not be reported as the guard package')
      console.log(`  ok    ${space} DeepSeek request extensions prepare without HTTP`)

      if (space === 'build') {
        const router = ctx.tools.get('bf_capability', scope)
        const sibling = await ctx.agents.create({ sessionId: 'blockfire-mount-sibling',
          meta: { cwd: resolve(harness, '..'), agentPreset: space },
          setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, space) } })
        try {
          const call = action => router.execute({ action, capability: 'probe' }, { agent: handle.agent })
          for (let cycle = 0; cycle < 2; cycle++) {
            assert.match(await call('on'), /activated/)
            assert(ctx.tools.get('mcp__probe__ping', scope), 'capability tools visible to owner')
            assert.equal(ctx.tools.get('mcp__probe__ping', scopeOf(sibling.agent.ctx)), undefined, 'capability must not leak into sibling')
            assert.match(await call('list'), /tools now visible: mcp__probe__ping/)
            assert.match(await call('off'), /deactivated/)
            assert.equal(ctx.tools.get('mcp__probe__ping', scope), undefined, 'off removes tools')
          }
          console.log('  ok    real capability lifecycle: on/list/off twice, session isolation')

          const bcall = action => router.execute({ action, capability: 'blender' }, { agent: handle.agent })
          const baseSchemas = ctx.tools.schemas(scope)
          assert.match(await bcall('on'), /activated/)
          assert(ctx.tools.get('blender_exec', scope), 'minimal exec visible to owner')
          assert(ctx.tools.get('blender_screenshot', scope), 'minimal screenshot visible to owner')
          assert.equal(ctx.tools.get('blender_exec', scopeOf(sibling.agent.ctx)), undefined, 'minimal loop must not leak into sibling')
          const minSchemas = ctx.tools.schemas(scope)
          const minAdded = minSchemas.filter(tool => !baseSchemas.some(base => base.name === tool.name))
          assert.deepEqual(minAdded.map(tool => tool.name).sort(), ['blender_exec', 'blender_screenshot'])
          console.log(`  ok    blender minimal: +${minAdded.length} tools, +${JSON.stringify(minAdded).length} schema chars (base ${baseSchemas.length} tools)`)
          assert.match(await bcall('list'), /tools now visible: blender_exec, blender_screenshot/)
          assert.match(await router.execute({ action: 'on', capability: 'blender-full' }, { agent: handle.agent }), /conflicts with "blender"/)
          assert.match(await bcall('off'), /deactivated/)
          assert.equal(ctx.tools.get('blender_exec', scope), undefined, 'off removes the minimal tools')

          const failCall = action => router.execute({ action, capability: 'fail' }, { agent: handle.agent })
          const failure = await failCall('on')
          assert.match(failure, /failed to start/)
          assert.match(failure, /probe start failure/)
          assert.equal(ctx.tools.get('mcp__fail__ping', scope), undefined, 'failed plugin leaves nothing behind')
          assert.doesNotMatch(await failCall('on'), /already active/)
          console.log('  ok    async start failure: original error surfaced, partial mount cleaned')
        } finally { await sibling.dispose() }
      }
    } finally { await handle.dispose() }
  }

  const resumeSetup = async agentCtx => { await ctx.agentPresets.mount(agentCtx, 'build') }
  const first = await ctx.agents.create({ sessionId: 'blockfire-mount-resume', meta: { cwd: resolve(harness, '..'), agentPreset: 'build' }, setup: resumeSetup })
  const router = ctx.tools.get('bf_capability', scopeOf(first.agent.ctx))
  try {
    assert.match(await router.execute({ action: 'on', capability: 'probe' }, { agent: first.agent }), /activated/)
  } finally { await first.dispose() }
  const resumed = await ctx.agents.resume({ resumeSessionId: 'blockfire-mount-resume', setup: resumeSetup })
  try {
    const listed = await router.execute({ action: 'list' }, { agent: resumed.agent })
    assert.match(listed, /\[off\]/, 'same-id resumed session must not inherit ACTIVE')
    assert.match(await router.execute({ action: 'on', capability: 'probe' }, { agent: resumed.agent }), /activated/)
    assert.match(await router.execute({ action: 'off', capability: 'probe' }, { agent: resumed.agent }), /deactivated/)
  } finally { await resumed.dispose() }
  console.log('  ok    session close releases the capability: same-id session starts OFF, re-activates')
} finally {
  try { await ctx?.fiber.dispose() } finally { rmSync(temporary, { recursive: true, force: true }) }
}
