#!/usr/bin/env node
/**
 * BLOCKFIRE compatibility contract checks.
 *
 * The layer depends on a small, named set of upstream surfaces. This script
 * asserts each one against REAL evidence instead of hope:
 *
 *   dsh <version>        the DSH version the layer was validated against
 *   log <session.jsonl>  the session-log events and usage fields the metrics
 *                        (harness/bin/session-report.mjs) read
 *   surface <log> <space> the tool catalog a space actually composed, compared
 *                        with harness/contract/contract.json
 *
 * Every check prints `ok`/`FAIL` lines and exits non-zero on any FAIL, so
 * `harness/test.sh` can treat a silent upstream change as a red build.
 */

import { execFileSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const CONTRACT = JSON.parse(readFileSync(join(HARNESS, 'contract', 'contract.json'), 'utf8'))

let failed = 0
const ok = (message) => process.stdout.write(`  ok    ${message}\n`)
const bad = (message) => {
  failed = 1
  process.stdout.write(`  FAIL  ${message}\n`)
}
const warn = (message) => process.stdout.write(`  warn  ${message}\n`)
/** No evidence either way: the log cannot certify or refute the contract. */
const skip = (message) => process.stdout.write(`  skip  ${message}\n`)

/** Zstd files start with 0x28 B5 2F FD; anything else is treated as plain JSONL. */
function isZstd(file) {
  const magic = Buffer.alloc(4)
  const fd = openSync(file, 'r')
  try {
    readSync(fd, magic, 0, 4, 0)
  } finally {
    closeSync(fd)
  }
  return magic.equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd]))
}

function events(file) {
  let text
  try {
    // Real session logs are zstd; plain JSONL is accepted (fixtures, exports).
    text = isZstd(file)
      ? execFileSync('zstd', ['-dc', file], { maxBuffer: 1024 * 1024 * 512 }).toString('utf8')
      : readFileSync(file, 'utf8')
  } catch (error) {
    bad(`cannot decompress ${file}: ${String(error?.message ?? error)}`)
    return []
  }
  const out = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try {
      out.push(JSON.parse(line))
    } catch {
      // A truncated final line is normal while a session is live.
    }
  }
  return out
}

function get(value, path) {
  let current = value
  for (const key of path.split('.')) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

function checkDsh(version) {
  const expected = CONTRACT.validatedAgainst?.dsh
  if (version === expected) ok(`DSH ${version} matches the validated contract`)
  else warn(`DSH ${version} was not the validated version (${expected}) — the log/surface checks below are the real verdict`)
  if (typeof version === 'string' && version !== '') ok(`DSH version reported: ${version}`)
  else bad('no DSH version could be resolved')
}

function checkLog(file) {
  const rows = events(file)
  if (rows.length === 0) {
    skip(`no events in ${file} — SIN EVIDENCIA: an empty session verifies nothing and disproves nothing`)
    return
  }
  const present = new Set(rows.map((row) => row.type))
  if (!present.has('request/header')) {
    skip(`no request/header in ${file} — SIN EVIDENCIA: a session without model requests verifies no contract`)
    return
  }
  // Required always: the report cannot even name the session without these.
  for (const required of CONTRACT.sessionLog.requiredEvents ?? ['session']) {
    if (present.has(required)) ok(`session log emits ${required}`)
    else bad(`session log no longer emits ${required} — session-report.mjs would silently lose data`)
  }
  // Everything else is conditional vocabulary: absence only means the operation
  // never happened here, which is evidence about this log, not about the runtime.
  const conditional = (CONTRACT.sessionLog.events ?? []).filter((type) => !present.has(type))
  if (conditional.length > 0) {
    warn(`this log never emitted ${conditional.join(', ')} — no evidence either way (session did not do that)`)
  } else {
    ok(`session log emitted every event the metrics read (${CONTRACT.sessionLog.events.length} types)`)
  }
  const header = rows.find((row) => row.type === 'request/header')?.data?.header
  if (header === undefined || typeof header !== 'object') bad('request/header carries no header object')
  else {
    for (const field of CONTRACT.sessionLog.fields['request/header']) {
      const value = get({ header }, field)
      if (value === undefined) bad(`request/header.${field} missing`)
      else ok(`request/header.${field} present`)
    }
  }
  // Usage fields are adapter-dependent: absent from a report is "unavailable",
  // never zero and never an incompatibility on its own.
  const messages = rows.filter((row) => row.type === 'assistant/message')
  if (messages.length === 0) {
    warn('no assistant/message events — no model answer in this log (in-flight or truncated session?)')
  } else {
    const withUsage = messages.filter((row) => row.data?.usage !== undefined)
    if (withUsage.length === 0) {
      warn('no assistant/message carries usage — this adapter reported no token usage (not zero cost)')
    } else {
      for (const field of CONTRACT.sessionLog.fields['assistant/message']) {
        const missing = withUsage.filter((row) => get(row.data, field) === undefined).length
        if (missing === 0) ok(`assistant/message.${field} present in every usage report`)
        else if (missing === withUsage.length) warn(`assistant/message.${field} never reported — adapter does not provide it`)
        else warn(`assistant/message.${field} missing in ${missing}/${withUsage.length} usage reports`)
      }
    }
  }
  // Causal obligation: a started call must have its result. Matching is by
  // callId; a call without a result breaks pairing and every metric built on it.
  // Result shape varies by runtime version: source.callId (0.1.x), message.callId
  // or a bare data.callId — accept the shapes, require one of them.
  const resultCallId = (row) =>
    row.data?.message?.source?.callId ?? row.data?.message?.callId ?? row.data?.callId
  const results = new Set(rows.filter((row) => row.type === 'tool/result').map(resultCallId))
  const calls = rows.filter((row) => row.type === 'tool/call')
  if (calls.length === 0 && results.size > 0) {
    warn('tool/result without any tool/call — pairing vocabulary changed?')
  } else if (calls.length > 0) {
    const orphans = calls.filter((row) => row.data?.callId === undefined || !results.has(row.data.callId))
    if (orphans.length === 0) {
      ok(`all ${calls.length} tool/call events have their result`)
    } else {
      // A call still waiting for its result AFTER later events happened means
      // the result was genuinely lost: that breaks pairing and fails. A call
      // with nothing after it but more calls may simply still be running — the
      // log of a live session is read mid-flight; that is SIN EVIDENCIA.
      const lastResultIdx = rows.map((row, index) => row.type === 'tool/result' ? index : -1)
        .reduce((left, right) => Math.max(left, right), -1)
      const lost = orphans.filter((row) => rows.indexOf(row) < lastResultIdx)
      if (lost.length > 0) {
        bad(`${lost.length}/${calls.length} tool/call without a matching tool/result and the log continued past them (first: ${lost[0].data?.name ?? 'unknown'}) — call/result pairing broke`)
      } else {
        warn(`${orphans.length} newest tool/call without a result yet — the log was read while the session was live (SIN EVIDENCIA)`)
      }
    }
  }
  // A compaction that never closed is detectable by design; the log may also be
  // truncated. Neither certifies nor breaks the contract: warn, don't fail.
  const starts = rows.filter((row) => row.type === 'compaction/start').length
  const ends = rows.filter((row) => row.type === 'compaction/end').length
  if (starts > ends) {
    warn(`${starts} compaction/start vs ${ends} compaction/end — a compaction was interrupted or the log is truncated`)
  }
}

/**
 * The preset the session actually mounted: the last explicit selection wins over
 * the session event's initial label (a session can be recomposed after creation).
 */
function effectivePreset(rows) {
  const selected = [...rows].reverse().find((row) => row.type === 'agent-preset/selected')
  const initial = rows.find((row) => row.type === 'session')?.agentPreset
  return selected?.data?.agentPreset ?? selected?.data?.preset ?? initial ?? undefined
}

function checkSurface(file, space) {
  const expected = CONTRACT.spaces?.[space]
  if (expected === undefined) {
    bad(`contract.json declares no space "${space}"`)
    return
  }
  const rows = events(file)
  const mounted = effectivePreset(rows)
  if (mounted !== undefined && mounted !== space) {
    skip(`log mounted preset "${mounted}", not "${space}" — nothing to compare (SIN EVIDENCIA for ${space})`)
    return
  }
  const header = rows.find((row) => row.type === 'request/header')?.data?.header
  if (header === undefined) {
    bad(`no request/header in ${file}`)
    return
  }
  const observed = (header.tools ?? []).map((tool) => tool.name).sort()
  const wanted = [...expected.tools].sort()
  const missing = wanted.filter((name) => !observed.includes(name))
  const added = observed.filter((name) => !wanted.includes(name))
  const schemaChars = JSON.stringify(header.tools ?? []).length
  if (missing.length === 0 && added.length === 0) {
    ok(`${space} surface matches the contract (${observed.length} tools)`)
  } else {
    if (missing.length > 0) bad(`${space} lost tools: ${missing.join(', ')}`)
    if (added.length > 0) bad(`${space} gained tools: ${added.join(', ')} — a permanent row is being paid for`)
  }
  if (typeof expected.schemaChars === 'number') {
    const delta = schemaChars - expected.schemaChars
    const note = `${space} tool schema ${schemaChars} chars (contract ${expected.schemaChars}, delta ${delta >= 0 ? '+' : ''}${delta})`
    if (Math.abs(delta) > (expected.schemaTolerance ?? 0)) warn(note)
    else ok(note)
  }
}

const [command, ...rest] = process.argv.slice(2)
switch (command) {
  case 'dsh':
    checkDsh(rest[0])
    break
  case 'log':
    if (rest[0] === undefined || !existsSync(rest[0])) bad(`log not found: ${rest[0]}`)
    else checkLog(rest[0])
    break
  case 'surface':
    if (rest[0] === undefined || !existsSync(rest[0])) bad(`log not found: ${rest[0]}`)
    else checkSurface(rest[0], rest[1] ?? '')
    break
  default:
    process.stderr.write('usage: contract_check.mjs dsh <version> | log <session.jsonl> | surface <session.jsonl> <space>\n')
    process.exit(2)
}

process.exit(failed)
