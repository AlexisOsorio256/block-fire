#!/usr/bin/env node
/**
 * BLOCKFIRE Harness — what the model is actually sent, before it is sent.
 *
 * WHY THIS EXISTS
 * `session-report.mjs` can only measure a session that already happened, and a
 * live run costs tokens and minutes. Every prompt-shaped change (persona text,
 * tool descriptions, prompt sections, skill catalog) needs a number BEFORE it
 * ships, and the number that matters is the permanent prefix: everything the
 * model reads before the user's first word.
 *
 * This boots one isolated host with the repo's presets — no model request, no
 * network, no effect on `~/.dsh` — and prints that prefix decomposed by owner:
 * prompt sections, runtime context, tool schemas, skill catalog.
 *
 * WHAT IT IS NOT
 * It does not measure model behavior, and its token column is a heuristic
 * (chars / 3.6, the ratio this prefix actually shows against DeepSeek usage
 * reports). Real billed tokens come from `session-report.mjs` after a live run.
 *
 * CLI:
 *   node harness/bin/context-report.mjs                 both spaces, table
 *   node harness/bin/context-report.mjs build           one space
 *   node harness/bin/context-report.mjs --json          machine readable
 *   node harness/bin/context-report.mjs --details       every section and tool
 */

import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { withIsolatedHost, createSpaceAgent } from '../lib/isolated-host.mjs'

const harness = fileURLToPath(new URL('../', import.meta.url))
const repo = resolve(harness, '..')
const args = process.argv.slice(2)
const asJson = args.includes('--json')
const details = args.includes('--details')
const spaces = args.filter((arg) => !arg.startsWith('-'))
const wanted = spaces.length > 0 ? spaces : ['build', 'creator']

// The fixed frame dsh-tool-skill wraps around its `- \`name\`: description`
// lines, measured against DSH 0.1.5-rc.2. Only its arithmetic is used here, and
// `--details` reports the per-skill lines that dominate it anyway.
const CATALOG_FRAME = 683

/** Token estimate shared by every row, so comparisons stay consistent. */
const tokens = (chars) => Math.round(chars / 3.6)
const row = (label, chars) => ({ label, chars, tokens: tokens(chars) })

async function measure(host, space) {
  const { ctx, fromRuntime } = host
  const { scopeOf } = await fromRuntime('@deepseek-ai/dsh-scope')
  const { renderPrompt, renderContextSnapshot } = await fromRuntime('@deepseek-ai/dsh-system-prompt')
  const handle = await createSpaceAgent(ctx, space, repo)
  try {
    const scope = scopeOf(handle.agent.ctx)
    const assembly = await ctx.systemPrompt.assemble({ scope, agent: handle.agent })
    const system = renderPrompt(assembly)
    const context = renderContextSnapshot(assembly)
    const schemas = JSON.stringify(assembly.tools)
    const skills = await ctx.skills.list({ scope })
    const catalogLines = skills.map((skill) => `- \`${skill.name}\`: ${skill.description ?? ''}`)
    const catalogChars = skills.length === 0 ? 0 : CATALOG_FRAME + catalogLines.join('\n').length
    const sections = assembly.sections.filter((section) => section.text.length > 0)
      .map((section) => row(section.name, section.text.length)).sort((a, b) => b.chars - a.chars)
    const contexts = assembly.contexts.filter((entry) => entry.text.length > 0)
      .map((entry) => row(entry.name, entry.text.length)).sort((a, b) => b.chars - a.chars)
    const tools = assembly.tools.map((tool) => ({
      label: tool.name,
      chars: JSON.stringify(tool).length,
      description: tool.description.length,
      parameters: JSON.stringify(tool.parameters).length,
      tokens: tokens(JSON.stringify(tool).length),
    })).sort((a, b) => b.chars - a.chars)
    const skillRows = skills.map((skill, index) => row(skill.name, catalogLines[index].length))
      .sort((a, b) => b.chars - a.chars)
    const totals = {
      system: system.length,
      context: context.length,
      tools: schemas.length,
      skills: catalogChars,
    }
    const prefixChars = totals.system + totals.context + totals.tools + totals.skills
    return { space, totals, prefixChars, prefixTokens: tokens(prefixChars), sections, contexts, tools, skills: skillRows }
  } finally { await handle.dispose() }
}

function printReport(report) {
  const { space, totals, prefixChars, prefixTokens, sections, contexts, tools, skills } = report
  console.log(`\n${space.toUpperCase()}  permanent prefix ${prefixChars} chars (~${prefixTokens} tokens, heuristic)`)
  console.log(`  system prompt   ${String(totals.system).padStart(6)}  (${sections.length} sections)`)
  console.log(`  runtime context ${String(totals.context).padStart(6)}  (${contexts.length} entries)`)
  console.log(`  tool schemas    ${String(totals.tools).padStart(6)}  (${tools.length} tools)`)
  console.log(`  skill catalog   ${String(totals.skills).padStart(6)}  (${skills.length} skills)`)
  if (details) {
    console.log('  sections:')
    for (const entry of sections) console.log(`    ${String(entry.chars).padStart(6)}  ${entry.label}`)
    console.log('  context:')
    for (const entry of contexts) console.log(`    ${String(entry.chars).padStart(6)}  ${entry.label}`)
    console.log('  tools (schema = description + parameters):')
    for (const tool of tools) {
      console.log(`    ${String(tool.chars).padStart(6)}  ${tool.label.padEnd(20)} desc ${String(tool.description).padStart(5)}  params ${String(tool.parameters).padStart(5)}`)
    }
    console.log('  skill catalog lines:')
    for (const entry of skills) console.log(`    ${String(entry.chars).padStart(6)}  ${entry.label}`)
  }
}

const reports = []
await withIsolatedHost({ harness }, async (host) => {
  for (const space of wanted) {
    if (!['build', 'creator'].includes(space)) throw new Error(`unknown space "${space}" (expected build or creator)`)
    reports.push(await measure(host, space))
  }
})

if (asJson) {
  console.log(JSON.stringify({ spaces: reports }, null, 2))
} else {
  console.log(`BLOCKFIRE context report — repo presets, isolated host, no model requests`)
  for (const report of reports) printReport(report)
  const total = reports.reduce((sum, report) => sum + report.prefixChars, 0)
  console.log(`\ntotal across ${reports.length} space(s): ${total} chars (~${tokens(total)} tokens)\n`)
}
