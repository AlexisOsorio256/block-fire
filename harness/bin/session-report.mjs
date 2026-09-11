#!/usr/bin/env node
/**
 * BLOCKFIRE harness — fold DSH's existing session log into context/tool usage.
 * Read-only: no telemetry, no persistent analyzer.
 */

import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

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
// 0.1.5 writes v3; older installs/rollbacks use the legacy name.
const SESSION_LOG_NAMES = ['session.v3.jsonl.zstd', 'session.jsonl.zstd']

function fail(message) {
  process.stderr.write(`session-report: ${message}\n`)
  process.exit(2)
}

function logInDir(dir) {
  for (const name of SESSION_LOG_NAMES) {
    const file = join(dir, name)
    try {
      const stat = statSync(file)
      return { file, mtime: stat.mtimeMs }
    } catch {}
  }
  return undefined
}

function listSessionFiles() {
  if (!existsSync(sessionsRoot)) fail(`no session root at ${sessionsRoot}`)
  const found = []
  for (const project of readdirSync(sessionsRoot)) {
    const projectDir = join(sessionsRoot, project)
    let entries
    try { entries = readdirSync(projectDir) } catch { continue }
    for (const entry of entries) {
      const hit = logInDir(join(projectDir, entry))
      if (hit !== undefined) found.push(hit)
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime)
}

function resolveTargets() {
  if (wantSession !== undefined) {
    if (existsSync(wantSession)) return [wantSession]
    const hit = listSessionFiles().find((entry) => entry.file.includes(wantSession))
    if (hit === undefined) fail(`no session log matching "${wantSession}"`)
    return [hit.file]
  }
  if (wantLast > 0) {
    const all = listSessionFiles()
    if (all.length === 0) fail(`no session logs under ${sessionsRoot}`)
    return all.slice(0, wantLast).map((entry) => entry.file)
  }
  const fromEnv = process.env.DSH_SESSION_JSONL
  if (fromEnv !== undefined && existsSync(fromEnv)) return [fromEnv]
  const all = listSessionFiles()
  if (all.length === 0) fail(`no session logs under ${sessionsRoot}`)
  return [all[0].file]
}

function isZstd(file) {
  const magic = Buffer.alloc(4)
  const fd = openSync(file, 'r')
  try { readSync(fd, magic, 0, 4, 0) } finally { closeSync(fd) }
  return magic.equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))
}

function readEvents(file) {
  let text
  try {
    text = isZstd(file)
      ? execFileSync('zstd', ['-dc', file], { maxBuffer: 1024 * 1024 * 512 }).toString('utf8')
      : readFileSync(file, 'utf8')
  } catch (error) {
    fail(`cannot read ${file}: ${String(error?.message ?? error)}`)
  }
  const events = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try { events.push(JSON.parse(line)) } catch {}
  }
  return events
}

function messageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((block) => {
    if (typeof block === 'string') return block
    return typeof block?.text === 'string' ? block.text : ''
  }).join('')
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
    usageReports: 0,
    requestHeaders: 0,
    turns: 0,
    retries: 0,
    compactions: 0,
    compactionsOk: 0,
    compactionsFailed: 0,
    compactionsIncomplete: 0,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    firstRequestInput: undefined,
    firstRequestCached: undefined,
    firstRequestCacheWrite: undefined,
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

  const openCompactions = new Set()

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
      case 'permission/preset': report.permission.preset = event.data?.preset; break
      case 'sandbox/mode': report.permission.sandbox = event.data?.mode; break
      case 'approval/policy': report.permission.approval = event.data?.policy; break
      case 'turn/start': report.turns += 1; break
      case 'llm/retry': report.retries += 1; break
      case 'compaction/start':
        report.compactions += 1
        if (typeof event.data?.compactionId === 'string') openCompactions.add(event.data.compactionId)
        break
      case 'compaction/end':
        if (event.data?.error !== undefined) report.compactionsFailed += 1
        else report.compactionsOk += 1
        if (typeof event.data?.compactionId === 'string') openCompactions.delete(event.data.compactionId)
        break
      case 'compaction':
      case 'manual-compaction':
        report.compactions += 1
        report.compactionsOk += 1
        break
      case 'request/header': {
        report.requestHeaders += 1
        const header = event.data?.header ?? {}
        report.model = header.config?.model ?? report.model
        report.provider = header.config?.provider ?? report.provider
        // Current runtimes send the system prompt as system/message events
        // (dynamic, KV-cache friendly), so header.system is usually absent.
        // Older snapshots may store either a string or text blocks here.
        if (report.systemChars === undefined) {
          const text = messageText(header.system)
          if (text !== '') report.systemChars = text.length
        }
        // Tool schemas still ride the header: capture them independently.
        if (report.toolCount === undefined && Array.isArray(header.tools)) {
          report.toolCount = header.tools.length
          report.toolSchemaChars = JSON.stringify(header.tools).length
          report.toolSchemaTop = header.tools.map((tool) => [String(tool?.name ?? '?'), JSON.stringify(tool).length])
            .sort((a, b) => b[1] - a[1]).slice(0, 8)
        }
        break
      }
      case 'system/message': {
        // First system/message sizes the permanent prompt on runtimes that
        // manage it dynamically instead of embedding it in every header.
        if (report.systemChars === undefined) {
          const text = messageText(event.data?.message?.content)
          if (text !== '') report.systemChars = text.length
        }
        break
      }
      case 'user/message': report.userMessages += 1; break
      case 'assistant/message': {
        report.requests += 1
        const usage = event.data?.usage
        if (usage !== undefined) {
          report.usageReports += 1
          report.inputTokens += usage.inputTokens ?? 0
          report.cacheReadTokens += usage.cacheReadTokens ?? 0
          report.cacheWriteTokens += usage.cacheWriteTokens ?? 0
          report.outputTokens += usage.outputTokens ?? 0
          report.reasoningTokens += usage.reasoningTokens ?? 0
          if (report.firstRequestInput === undefined) {
            report.firstRequestInput = usage.inputTokens ?? 0
            report.firstRequestCached = usage.cacheReadTokens ?? 0
            report.firstRequestCacheWrite = usage.cacheWriteTokens ?? 0
          }
        }
        for (const block of event.data?.message?.content ?? []) {
          if (block.type !== 'tool-call') continue
          report.tools[block.name] = (report.tools[block.name] ?? 0) + 1
          if (block.name === 'skill') {
            try {
              const parsed = JSON.parse(block.arguments)
              if (typeof parsed?.name === 'string') report.skillsLoaded.push(parsed.name)
            } catch {}
          }
          if (block.name === 'bf_capability') {
            try {
              const parsed = JSON.parse(block.arguments)
              report.capabilities.push(`${parsed?.action ?? 'list'}:${parsed?.capability ?? '*'}`)
            } catch { report.capabilities.push('unparsed') }
          }
          if (block.name === 'subagent' || block.name === 'subagent_fork') {
            try {
              const parsed = JSON.parse(block.arguments)
              report.subagents.push(parsed?.description ?? parsed?.prompt?.slice(0, 60) ?? block.name)
            } catch { report.subagents.push(block.name) }
          }
        }
        break
      }
      default: break
    }
  }

  report.compactionsIncomplete = openCompactions.size
  const billedPrompt = report.inputTokens + report.cacheReadTokens + report.cacheWriteTokens
  report.cacheHitPercent = billedPrompt > 0
    ? Math.round((report.cacheReadTokens / billedPrompt) * 1000) / 10
    : undefined
  report.wallMs = report.startedAt !== undefined && report.lastEventTime !== undefined
    ? report.lastEventTime - report.startedAt
    : undefined
  return report
}

const pct = (value) => value === undefined ? 'n/a' : `${value}%`
const reports = resolveTargets().map((file) => fold(file, readEvents(file)))

if (asJson) {
  process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`)
  process.exit(0)
}

for (const report of reports) {
  const lines = []
  const billedPrompt = report.inputTokens + report.cacheReadTokens + report.cacheWriteTokens
  lines.push(`session ${report.sessionId ?? '?'}  preset=${report.agentPreset ?? '?'}  model=${report.model ?? '?'}  provider=${report.provider ?? '?'}`)
  lines.push(`  cwd            ${report.cwd ?? '?'}`)
  if (Object.keys(report.permission).length > 0) {
    lines.push(`  policy         preset=${report.permission.preset ?? '?'}  sandbox=${report.permission.sandbox ?? '?'}  approval=${report.permission.approval ?? '?'}`)
  }
  lines.push(`  requests       ${report.requests}  (usage ${report.usageReports}, headers ${report.requestHeaders}, turns ${report.turns}, user ${report.userMessages}, retries ${report.retries})`)
  lines.push(`  compactions    ${report.compactions} attempts (ok ${report.compactionsOk}, failed ${report.compactionsFailed}, incomplete ${report.compactionsIncomplete})`)
  if (report.wallMs !== undefined) lines.push(`  wall time      ${(report.wallMs / 1000).toFixed(1)}s`)
  lines.push(`  prompt tokens  ${billedPrompt} billed | uncached ${report.inputTokens} | cache read ${report.cacheReadTokens} | cache write ${report.cacheWriteTokens} | hit ${pct(report.cacheHitPercent)}`)
  lines.push(`  output tokens  ${report.outputTokens} (reasoning ${report.reasoningTokens})`)
  if (report.systemChars !== undefined) {
    lines.push(`  first header   system ${report.systemChars} chars | ${report.toolCount} tools / ${report.toolSchemaChars} schema chars`)
    if (report.toolSchemaTop.length > 0) lines.push(`  schema cost    ${report.toolSchemaTop.map(([name, chars]) => `${name} ${chars}`).join(' | ')}`)
  }
  if (report.firstRequestInput !== undefined) {
    lines.push(`  first request  uncached ${report.firstRequestInput} | cache read ${report.firstRequestCached} | cache write ${report.firstRequestCacheWrite}`)
  }
  const tools = Object.entries(report.tools).sort((a, b) => b[1] - a[1])
  lines.push(`  tools used     ${tools.length === 0 ? '(none)' : tools.map(([name, count]) => `${name}×${count}`).join(', ')}`)
  if (report.capabilities.length > 0) lines.push(`  capabilities   ${report.capabilities.join(', ')}`)
  if (report.skillsLoaded.length > 0) lines.push(`  skills loaded  ${report.skillsLoaded.join(', ')}`)
  if (report.subagents.length > 0) lines.push(`  subagents      ${report.subagents.join(', ')}`)
  process.stdout.write(`${lines.join('\n')}\n\n`)
}