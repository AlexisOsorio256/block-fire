#!/usr/bin/env node
/**
 * BLOCKFIRE harness — session report.
 *
 * DSH already records everything the model received and every token it spent:
 * each session's append-only log holds the exact system prompt and tool
 * schemas per request, per-step token usage with cache reads, and every tool
 * call. This script only folds that record into the numbers the harness layer
 * is judged by, so cache and context claims are measured instead of asserted.
 *
 * It adds no telemetry and writes nothing: it reads the log DSH already keeps.
 *
 *   node harness/bin/session-report.mjs                  # current session ($DSH_SESSION_JSONL)
 *   node harness/bin/session-report.mjs --last 5         # five most recent sessions
 *   node harness/bin/session-report.mjs --session <id>   # one session by id or path
 *   node harness/bin/session-report.mjs --json           # machine-readable
 *
 * Uses `zstd` (already required by DSH's own log format) to decompress; no npm
 * dependency is added.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// `... | head` closes the pipe early; that is not an error worth a stack trace.
process.stdout.on('error', (error) => {
  if (error?.code === 'EPIPE') process.exit(0)
})

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const lastIndex = args.indexOf('--last')
const sessionIndex = args.indexOf('--session')
const wantLast = lastIndex >= 0 ? Number(args[lastIndex + 1] ?? 5) : 0
const wantSession = sessionIndex >= 0 ? args[sessionIndex + 1] : undefined

const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const sessionsRoot = join(dshHome, 'sessions')

function fail(message) {
  process.stderr.write(`session-report: ${message}\n`)
  process.exit(2)
}

function listSessionFiles() {
  if (!existsSync(sessionsRoot)) fail(`no session root at ${sessionsRoot}`)
  const found = []
  for (const project of readdirSync(sessionsRoot)) {
    const projectDir = join(sessionsRoot, project)
    let entries
    try {
      entries = readdirSync(projectDir)
    } catch {
      continue
    }
    for (const entry of entries) {
      const file = join(projectDir, entry, 'session.jsonl.zstd')
      try {
        found.push({ file, mtime: statSync(file).mtimeMs })
      } catch {
        // Not every session directory holds a log yet.
      }
    }
  }
  return found.sort((left, right) => right.mtime - left.mtime)
}

function resolveTargets() {
  if (wantSession !== undefined) {
    if (existsSync(wantSession)) return [wantSession]
    const hit = listSessionFiles().find((entry) => entry.file.includes(wantSession))
    if (hit === undefined) fail(`no session log matching "${wantSession}"`)
    return [hit.file]
  }
  const fromEnv = process.env.DSH_SESSION_JSONL
  if (fromEnv !== undefined && existsSync(fromEnv)) return [fromEnv]
  const all = listSessionFiles()
  if (all.length === 0) fail(`no session logs under ${sessionsRoot}`)
  return (wantLast > 0 ? all.slice(0, wantLast) : all.slice(0, 1)).map((entry) => entry.file)
}

function readEvents(file) {
  let text
  try {
    text = execFileSync('zstd', ['-dc', file], { maxBuffer: 1024 * 1024 * 512 }).toString('utf8')
  } catch (error) {
    fail(`cannot decompress ${file}: ${String(error?.message ?? error)}`)
  }
  const events = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try {
      events.push(JSON.parse(line))
    } catch {
      // A truncated final line is expected while a session is live.
    }
  }
  return events
}

function fold(file, events) {
  const report = {
    file,
    sessionId: undefined,
    cwd: undefined,
    agentPreset: undefined,
    model: undefined,
    provider: undefined,
    permission: {},
    startedAt: undefined,
    requests: 0,
    turns: 0,
    retries: 0,
    compactions: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    firstRequestInput: undefined,
    firstRequestCached: undefined,
    systemChars: undefined,
    toolCount: undefined,
    toolSchemaChars: undefined,
    toolSchemaTop: [],
    tools: {},
    capabilities: [],
    skillsLoaded: [],
    subagents: [],
    userMessages: 0,
    lastEventTime: undefined,
  }

  for (const event of events) {
    if (typeof event.time === 'number') report.lastEventTime = event.time
    switch (event.type) {
      case 'session':
        report.sessionId = event.id
        report.cwd = event.cwd
        report.agentPreset = event.agentPreset
        report.startedAt = event.createdAt
        break
      case 'agent-preset/selected':
        report.agentPreset = event.data?.preset ?? event.data?.agentPreset ?? report.agentPreset
        break
      case 'model/selection':
        report.provider = event.data?.provider ?? report.provider
        report.model = event.data?.model ?? report.model
        break
      case 'permission/preset':
        report.permission.preset = event.data?.preset
        break
      case 'sandbox/mode':
        report.permission.sandbox = event.data?.mode
        break
      case 'approval/policy':
        report.permission.approval = event.data?.policy
        break
      case 'turn/start':
        report.turns += 1
        break
      case 'llm/retry':
        report.retries += 1
        break
      case 'compaction':
      case 'manual-compaction':
        report.compactions += 1
        break
      case 'request/header': {
        const header = event.data?.header ?? {}
        report.model = header.config?.model ?? report.model
        report.provider = header.config?.provider ?? report.provider
        if (report.systemChars === undefined && typeof header.system === 'string') {
          report.systemChars = header.system.length
          report.toolCount = Array.isArray(header.tools) ? header.tools.length : undefined
          report.toolSchemaChars = Array.isArray(header.tools)
            ? JSON.stringify(header.tools).length
            : undefined
          report.toolSchemaTop = Array.isArray(header.tools)
            ? header.tools
                .map((tool) => [String(tool?.name ?? '?'), JSON.stringify(tool).length])
                .sort((left, right) => right[1] - left[1])
                .slice(0, 8)
            : []
        }
        break
      }
      case 'user/message':
        report.userMessages += 1
        break
      case 'assistant/message': {
        const usage = event.data?.usage
        if (usage === undefined) break
        report.requests += 1
        report.inputTokens += usage.inputTokens ?? 0
        report.cacheReadTokens += usage.cacheReadTokens ?? 0
        report.outputTokens += usage.outputTokens ?? 0
        report.reasoningTokens += usage.reasoningTokens ?? 0
        if (report.firstRequestInput === undefined) {
          report.firstRequestInput = usage.inputTokens ?? 0
          report.firstRequestCached = usage.cacheReadTokens ?? 0
        }
        for (const block of event.data?.message?.content ?? []) {
          if (block.type !== 'tool-call') continue
          report.tools[block.name] = (report.tools[block.name] ?? 0) + 1
          if (block.name === 'skill') {
            try {
              const parsed = JSON.parse(block.arguments)
              if (typeof parsed?.name === 'string') report.skillsLoaded.push(parsed.name)
            } catch {
              // Malformed historical arguments are not this report's problem.
            }
          }
          if (block.name === 'bf_capability') {
            try {
              const parsed = JSON.parse(block.arguments)
              report.capabilities.push(`${parsed?.action ?? 'list'}:${parsed?.capability ?? '*'}`)
            } catch {
              report.capabilities.push('unparsed')
            }
          }
          if (block.name === 'subagent' || block.name === 'subagent_fork') {
            try {
              const parsed = JSON.parse(block.arguments)
              report.subagents.push(parsed?.description ?? parsed?.prompt?.slice(0, 60) ?? block.name)
            } catch {
              report.subagents.push(block.name)
            }
          }
        }
        break
      }
      default:
        break
    }
  }

  const promptTokens = report.inputTokens + report.cacheReadTokens
  report.cacheHitPercent = promptTokens > 0
    ? Math.round((report.cacheReadTokens / promptTokens) * 1000) / 10
    : undefined
  report.wallMs = report.startedAt !== undefined && report.lastEventTime !== undefined
    ? report.lastEventTime - report.startedAt
    : undefined
  return report
}

function pct(value) {
  return value === undefined ? 'n/a' : `${value}%`
}

const reports = resolveTargets().map((file) => fold(file, readEvents(file)))

if (asJson) {
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`)
  process.exit(0)
}

for (const report of reports) {
  const lines = []
  lines.push(`session ${report.sessionId ?? '?'}  preset=${report.agentPreset ?? '?'}  model=${report.model ?? '?'}  provider=${report.provider ?? '?'}`)
  lines.push(`  cwd            ${report.cwd ?? '?'}`)
  if (Object.keys(report.permission).length > 0) {
    lines.push(`  policy         preset=${report.permission.preset ?? '?'}  sandbox=${report.permission.sandbox ?? '?'}  approval=${report.permission.approval ?? '?'}`)
  }
  lines.push(`  requests       ${report.requests}  (turns ${report.turns}, user messages ${report.userMessages}, llm retries ${report.retries}, compactions ${report.compactions})`)
  if (report.wallMs !== undefined) {
    lines.push(`  wall time      ${(report.wallMs / 1000).toFixed(1)}s`)
  }
  lines.push(`  prompt tokens  ${report.inputTokens + report.cacheReadTokens} total  |  uncached ${report.inputTokens}  |  cache read ${report.cacheReadTokens}  |  hit ${pct(report.cacheHitPercent)}`)
  lines.push(`  output tokens  ${report.outputTokens} (reasoning ${report.reasoningTokens})`)
  if (report.systemChars !== undefined) {
    lines.push(`  first header   system ${report.systemChars} chars  |  ${report.toolCount} tools / ${report.toolSchemaChars} schema chars`)
    if (report.toolSchemaTop.length > 0) {
      lines.push(`  schema cost    ${report.toolSchemaTop.map(([name, chars]) => `${name} ${chars}`).join('  |  ')}`)
    }
  }
  if (report.firstRequestInput !== undefined) {
    lines.push(`  first request  uncached ${report.firstRequestInput}  |  cached ${report.firstRequestCached}`)
  }
  const toolNames = Object.entries(report.tools).sort((left, right) => right[1] - left[1])
  lines.push(`  tools used     ${toolNames.length === 0 ? '(none)' : toolNames.map(([name, count]) => `${name}×${count}`).join(', ')}`)
  if (report.capabilities.length > 0) lines.push(`  capabilities   ${report.capabilities.join(', ')}`)
  if (report.skillsLoaded.length > 0) lines.push(`  skills loaded  ${report.skillsLoaded.join(', ')}`)
  if (report.subagents.length > 0) lines.push(`  subagents      ${report.subagents.join(', ')}`)
  process.stdout.write(`${lines.join('\n')}\n\n`)
}
