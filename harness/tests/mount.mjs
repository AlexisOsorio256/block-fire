#!/usr/bin/env node
// Real Web host + both presets, in an ephemeral DSH_HOME. No model requests.
//
// Beyond "does it mount", this suite owns the invariants of the model-facing
// prefix that a thin layer can actually break: every registered tool still
// reaches the model with untouched parameters, the permanent prefix stays
// inside budget, and the shortest-path rules survive composition.
import assert from 'node:assert/strict'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withIsolatedHost } from '../lib/isolated-host.mjs'

const harness = fileURLToPath(new URL('../', import.meta.url))
const repo = resolve(harness, '..')

/**
 * Permanent-prefix ceiling per space, in characters: system prompt + tool
 * schemas, measured with `harness/bin/context-report.mjs`. Raising a ceiling is
 * a deliberate decision with a measurement attached, never a silent side effect
 * of adding a section or a tool. The last raise (+500) paid for the mode
 * objective each persona now states, which is a standing directive, not prose.
 */
const PREFIX_BUDGET = { build: 17500, creator: 17500 }

/**
 * Old conversation/tool payloads are paid again on later requests. BLOCKFIRE's
 * repo is durable memory, so compact early and retain only a narrow recent tail;
 * reread the real owner when old detail matters again.
 */
const surfaceText = readFileSync(join(harness, 'presets/build/surface.cordis.yml'), 'utf8')
const surfaceValue = (name) => {
  const match = new RegExp(`${name}:\\s*([0-9]+(?:\\.[0-9]+)?)`).exec(surfaceText)
  assert.notEqual(match, null, `${name} must stay explicit in the shared surface`)
  return Number(match[1])
}
const compactThreshold = surfaceValue('thresholdRatio')
const compactRetain = surfaceValue('retainRatio')
const pruneThreshold = surfaceValue('thresholdChars')
const pruneHead = surfaceValue('headChars')
const pruneTail = surfaceValue('tailChars')
assert(compactThreshold <= 0.60, `compaction threshold regressed to ${compactThreshold}`)
assert(compactRetain <= 0.12, `compaction retention regressed to ${compactRetain}`)
assert(compactRetain < compactThreshold, 'compaction must retain less than its pressure threshold')
assert(pruneThreshold <= 4096, `tool-result prune threshold regressed to ${pruneThreshold}`)
assert(pruneHead <= 2048, `tool-result retained head regressed to ${pruneHead}`)
assert(pruneTail <= 768, `tool-result retained tail regressed to ${pruneTail}`)
assert(pruneHead + pruneTail < pruneThreshold, 'pruned tool output must be materially smaller than its trigger')

/**
 * Sections the prompt layer must have removed by the time the model sees the
 * prompt: each one only restated a tool description. If upstream renames one,
 * the layer degrades to pass-through — safe, but a silent budget leak — so the
 * suite fails here instead of discovering it months later.
 */
const DROPPED_SECTIONS = ['tool:bash', 'tool:glob', 'tool:grep', 'tool:subagent']

await withIsolatedHost({
  harness,
  beforeBoot({ temporary }) {
    writeFileSync(join(temporary, 'probe.mjs'), `export const inject = ['tools'];
export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({name:'mcp__probe__ping', description:'Lifecycle fixture',
    parameters:{type:'object',properties:{}}, output:{schema:{type:'string'},render:()=>[]},
    execute:async()=> 'pong'}));
}`)
    writeFileSync(join(temporary, 'probe-fail.mjs'), `export function apply(ctx) {
  ctx.effect(() => ctx.tools.register({name:'mcp__fail__ping', description:'Partial mount fixture',
    parameters:{type:'object',properties:{}}, output:{schema:{type:'string'},render:()=>[]},
    execute:async()=> 'pong'}));
  throw new Error('probe start failure');
}`)
    appendFileSync(join(temporary, 'presets/build/surface.cordis.yml'),
      `\n  config:\n    capabilities:\n      probe:\n        package: ${JSON.stringify(join(temporary, 'probe.mjs'))}\n        config:\n          serverName: probe\n` +
      `      fail:\n        package: ${JSON.stringify(join(temporary, 'probe-fail.mjs'))}\n        config:\n          serverName: fail\n`)
  },
  patches: process.argv.includes('--missing-host-service')
    ? [{ id: 'subagent-model-selection-settings', disabled: true }]
    : [],
}, async ({ ctx, modules, runtime, fromRuntime }) => {
  const contract = JSON.parse(readFileSync(join(harness, 'contract/contract.json'), 'utf8'))
  const { scopeOf } = await fromRuntime('@deepseek-ai/dsh-scope')
  const { renderPrompt, renderContextSnapshot } = await fromRuntime('@deepseek-ai/dsh-system-prompt')
  const mount = (space, sessionId) => ctx.agents.create({
    sessionId,
    meta: { cwd: repo, agentPreset: space },
    setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, space) },
  })

  for (const space of ['build', 'creator']) {
    const handle = await mount(space, `blockfire-mount-${space}`)
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

      // What the model is actually sent, assembled the way the loop assembles it.
      const assembly = await ctx.systemPrompt.assemble({ scope, agent: handle.agent })
      const byName = new Map(schemas.map(tool => [tool.name, tool]))
      for (const tool of assembly.tools) {
        const registered = byName.get(tool.name)
        assert(registered !== undefined, `${space}: assembled tool ${tool.name} is not registered`)
        assert.deepEqual(tool.parameters, registered.parameters,
          `${space}: the prompt layer must never touch ${tool.name} parameters`)
      }
      const system = renderPrompt(assembly)
      const prefix = system.length + JSON.stringify(assembly.tools).length
      assert(!/[áéíóúüñ¿¡]/i.test(system), `${space}: the model-facing prompt must be English (accented characters found)`)
      assert(!/[áéíóúüñ¿¡]/i.test(JSON.stringify(assembly.tools)), `${space}: tool schemas must be English`)
      assert.match(system, /Waste is prohibited: take the shortest decisive path/,
        `${space}: shortest-path execution rule must reach the model`)
      assert.match(system, /duplicate reads\/tests, speculative subagents or extra planning/,
        `${space}: anti-churn rule must reach the model`)
      assert(assembly.tools.some(tool => tool.name === 'bash'), `${space}: bash survives the prompt budget`)
      const descriptionOf = (name) => {
        const tool = assembly.tools.find(candidate => candidate.name === name)
        assert(tool !== undefined, `${space}: ${name} survives the prompt budget`)
        return tool.description
      }
      const bash = descriptionOf('bash')
      for (const marker of ['[exit code: N]', 'workdir', 'run_in_background']) {
        assert(bash.includes(marker), `${space}: the compressed bash description must keep ${marker} so results stay recognizable`)
      }
      assert(bash.length < 1200, `${space}: the bash description must stay fitted (${bash.length} chars) — upstream wording is back, so the prompt row stopped matching`)
      assert.match(descriptionOf('subagent'), /Do not delegate a question solvable with a few direct tool calls/,
        `${space}: delegation must not replace direct tool use`)
      assert.match(descriptionOf('skill'), /Do not preload every possibly related skill/,
        `${space}: skills must stay JIT rather than speculative context`)
      assert.doesNotMatch(descriptionOf('skill'), /load every applicable skill before acting/,
        `${space}: the old load-everything skill rule must not return`)
      assert.match(descriptionOf('read_image'), /before inferring from code, geometry or proxy metrics/,
        `${space}: visual questions must use direct observation first`)
      if (space === 'build') {
        assert.match(system, /Fan out independent read-only views concurrently/,
          'build: independent visual views must fan out instead of serial capture')
        assert.match(system, /composition, facing\/gaze, pose, weapon\/hand alignment, silhouette\/clipping, lighting, background and UI overlap/,
          'build: scene-level character review dimensions must reach the model')
      }
      for (const name of DROPPED_SECTIONS) {
        assert(!assembly.sections.some(section => section.name === name),
          `${space}: section ${name} only restates a description and must be gone from the assembled prompt`)
      }
      assert(assembly.sections.every(section => typeof section.text === 'string' && section.name.length > 0),
        `${space}: every assembled section keeps its name and text`)
      assert(prefix <= PREFIX_BUDGET[space],
        `${space}: permanent prefix ${prefix} chars exceeds its ${PREFIX_BUDGET[space]} budget — measure with harness/bin/context-report.mjs`)
      console.log(`  ok    ${space} prompt fitted: system ${system.length} + schemas ${JSON.stringify(assembly.tools).length} = ${prefix} chars (budget ${PREFIX_BUDGET[space]}), context ${renderContextSnapshot(assembly).length}`)

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
        const sibling = await mount(space, 'blockfire-mount-sibling')
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
  const first = await mount('build', 'blockfire-mount-resume')
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
})
