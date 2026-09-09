#!/usr/bin/env node
// Real Web host + both presets, in an ephemeral DSH_HOME. No model requests.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, readFileSync, appendFileSync, cpSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveRuntime } from '../lib/runtime.mjs'

const harness = fileURLToPath(new URL('../', import.meta.url))
const runtime = resolveRuntime()
assert.equal(runtime.ok, true, runtime.error)
const modules = runtime.nodeModules
const require = createRequire(join(modules, 'blockfire-mount.cjs'))
const fromRuntime = async name => import(pathToFileURL(require.resolve(name)))
// Set the home BEFORE importing runtime packages; some sample it at import time.
const temporary = mkdtempSync(join(tmpdir(), 'blockfire-mount-'))
process.env.DSH_HOME = temporary
process.env.DSH_TELEMETRY_DISABLED = '1'
let ctx
try {
  const { boot, loadOverlayPatches } = await fromRuntime('@deepseek-ai/dsh-app-boot')
  const { provideCmdline } = await fromRuntime('@deepseek-ai/dsh-cmdline')
  writeFileSync(join(temporary, 'cordis.yml'), '[]\n')
  symlinkSync(modules, join(temporary, 'node_modules'), 'dir')
  cpSync(join(harness, 'presets'), join(temporary, 'presets'), { recursive: true })
  for (const space of ['build', 'creator']) {
    symlinkSync(modules, join(temporary, 'presets', space, 'node_modules'), 'dir')
  }
  const fixture = join(temporary, 'probe.mjs')
  writeFileSync(fixture, `export const inject = ['tools'];
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({name:'mcp__probe__ping', description:'Lifecycle fixture',
    parameters:{type:'object',properties:{}}, output:{schema:{type:'string'},render:()=>[]},
    execute:async()=> 'pong'}));
}`)
  // Test a lightweight local capability through the installed router, without Blender.
  appendFileSync(join(temporary, 'presets/build/surface.cordis.yml'),
    `\n  config:\n    capabilities:\n      probe:\n        package: ${JSON.stringify(fixture)}\n        config:\n          serverName: probe\n`)
  const load = file => loadOverlayPatches('blockfire-mount', file)
  const ownPatch = load(join(harness, 'host/patch.cordis.yml'))
  // Same repo modules as install.sh links, without writing into candidate packages.
  for (const patch of ownPatch) for (const row of patch.insert ?? []) {
    if (row.id === 'blockfire-guard') row.name = pathToFileURL(join(harness, 'host/guard.js')).href
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
  if (process.argv.includes('--missing-host-service')) {
    patches.push({ id: 'subagent-model-selection-settings', disabled: true })
  }
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
    for (const name of ['blockfire-orientation', 'blockfire-evidence', 'blockfire-harness',
      'blockfire-android-qa', 'blockfire-animation-craft',
      ...(space === 'creator' ? ['editing-cordis-compositions', 'cordis-plugin-development'] : [])]) {
      assert(skills.includes(name), `${space} missing skill ${name}`)
    }
    console.log(`  ok    live mount ${space}: ${schemas.length} tools, ${JSON.stringify(schemas).length} schema chars, ${skills.length} skills (DSH ${runtime.version})`)
    if (space === 'build') {
      const sibling = await ctx.agents.create({ sessionId: 'blockfire-mount-sibling',
        meta: { cwd: resolve(harness, '..'), agentPreset: space },
        setup: async agentCtx => { await ctx.agentPresets.mount(agentCtx, space) } })
      try {
        const router = ctx.tools.get('bf_capability', scope)
        const call = action => router.execute({ action, capability: 'probe' }, { agent: handle.agent })
        for (let cycle = 0; cycle < 2; cycle++) {
          assert.match(await call('on'), /activated/)
          assert(ctx.tools.get('mcp__probe__ping', scope), 'capability tools visible to owner')
          assert.equal(ctx.tools.get('mcp__probe__ping', scopeOf(sibling.agent.ctx)), undefined,
            'capability must not leak into sibling')
          assert.match(await call('list'), /tools now visible: mcp__probe__ping/)
          assert.match(await call('off'), /deactivated/)
          assert.equal(ctx.tools.get('mcp__probe__ping', scope), undefined, 'off removes tools')
        }
        console.log('  ok    real capability lifecycle: on/list/off twice, session isolation')
      } finally { await sibling.dispose() }
    }
    } finally { await handle.dispose() }
  }
} finally {
  try { await ctx?.fiber.dispose() } finally { rmSync(temporary, { recursive: true, force: true }) }
}
