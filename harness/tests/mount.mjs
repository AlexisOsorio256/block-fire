#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { readFile, readFileSync } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'
import { withIsolatedHost } from '../lib/isolated-host.mjs'
import { renderContextSnapshot, renderPrompt } from '../lib/check_composition.py'

const HERE = dirname(fileURLToPath(import.meta.url))
const harness = join(HERE, '..')
const root = join(harness, '..')
const contract = JSON.parse(readFileSync(join(harness, 'contract/contract.json'), 'utf8'))
const { values } = parseArgs({
  options: {
    'missing-host-service': { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

const PREFIX_BUDGET = { build: 17_500, creator: 15_500 }
const DROPPED_SECTIONS = ['tool:bash', 'tool:glob', 'tool:grep', 'tool:subagent']

function yamlPath(path) {
  return path.replaceAll('\\', '/')
}

function buildIsolationOverlay(temporary, options = {}) {
  const files = []
  const presetRoot = join(temporary, 'presets')
  for (const space of ['build', 'creator']) {
    const source = join(harness, 'presets', space)
    const target = join(presetRoot, space)
    files.push([join(target, 'preset.yml'), `name: ${space}\n`])
    files.push([join(target, 'surface.cordis.yml'), `- id: probe\n  name: ${JSON.stringify(yamlPath(join(temporary, 'probe-ok.mjs')))}\n  config:\n    serverName: probe\n`])
    if (space === 'build') {
      files.push([join(target, 'agent.cordis.yml'), `- id: surface\n  name: cordis:include\n  config:\n    path: ${JSON.stringify(yamlPath(join(source, 'agent.cordis.yml')))}\n`])
    } else {
      files.push([join(target, 'agent.cordis.yml'), `- id: surface\n  name: cordis:include\n  config:\n    path: ${JSON.stringify(yamlPath(join(source, 'agent.cordis.yml')))}\n`])
    }
  }
  files.push([join(temporary, 'probe-ok.mjs'), `export const name='probe-ok'; export function apply(ctx,config={}){ctx.provide(config.serverName||'probe',{ok:true})}\n`])
  files.push([join(temporary, 'probe-fail.mjs'), `export const name='probe-fail'; export function apply(ctx,config={}){ctx.inject=['definitelyMissing'];ctx.provide(config.serverName||'probe',{ok:true})}\n`])
  for (const [path, content] of files) {
    const dir = dirname(path)
    await import('node:fs/promises').then(({ mkdir, writeFile }) => mkdir(dir, { recursive: true }).then(() => writeFile(path, content)))
  }
  return {
    presetRoot,
    patches: options.missingHostService
      ? [{ id: 'subagent-model-selection-settings', disabled: true }]
      : [],
  }
}

await withIsolatedHost({
  root,
  harness,
  temporaryPrefix: 'blockfire-mount-',
  prepare: async ({ temporary }) => buildIsolationOverlay(temporary, { missingHostService: values['missing-host-service'] }),
}, async ({ ctx, modules, runtime, fromRuntime }) => {
  const contract = JSON.parse(readFileSync(join(harness, 'contract/contract.json'), 'utf8'))
  for (const space of ['build', 'creator']) {
    const presetPath = join(harness, 'presets', space)
    const handle = await ctx.agents.create({ preset: presetPath })
    try {
      const scope = String(handle.agent.id)
      const assembly = await ctx.systemPrompt.assemble({ agent: handle.agent, scope })
      const schemas = ctx.tools.schemas({ scope })
      assert.deepEqual(schemas.map(tool => tool.name).sort(), [...contract.spaces[space].tools].sort(), `${space} tools`)
      const skills = (await ctx.skills.list({ scope })).map(skill => skill.name)
      for (const name of space === 'build'
        ? ['blockfire-evidence', 'blockfire-animation-craft', 'blockfire-android']
        : ['blockfire-harness']) {
        assert(skills.includes(name), `${space}: expected skill ${name}`)
      }
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
      assert.match(system, /shortest decisive path/i,
        `${space}: shortest-path execution rule must reach the model`)
      assert.match(system, /duplicate reads\/tests/,
        `${space}: duplicate-read anti-churn rule must reach the model`)
      assert.match(system, /speculative subagents/,
        `${space}: speculative delegation anti-churn rule must reach the model`)
      assert.match(system, /extra planning/,
        `${space}: planning anti-churn rule must reach the model`)
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
        'the profile package itself is not a plugin package')
    } finally {
      await handle.dispose()
    }
  }
})
