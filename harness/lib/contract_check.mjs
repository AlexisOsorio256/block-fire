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
import { existsSync, readFileSync } from 'node:fs'
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

function events(file) {
  let text
  try {
    text = execFileSync('zstd', ['-dc', file], { maxBuffer: 1024 * 1024 * 512 }).toString('utf8')
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
    bad(`no events in ${file}`)
    return
  }
  const present = new Set(rows.map((row) => row.type))
  for (const required of CONTRACT.sessionLog.events) {
    if (present.has(required)) ok(`session log emits ${required}`)
    else bad(`session log no longer emits ${required} — session-report.mjs would silently lose data`)
  }
  const header = rows.find((row) => row.type === 'request/header')?.data?.header
  if (header === undefined) bad('request/header carries no header object')
  else {
    for (const field of CONTRACT.sessionLog.fields['request/header']) {
      const value = get({ header }, field)
      if (value === undefined) bad(`request/header.${field} missing`)
      else ok(`request/header.${field} present`)
    }
  }
  const message = rows.find((row) => row.type === 'assistant/message' && row.data?.usage !== undefined)
  if (message === undefined) warn('no assistant/message with usage in this log (usage fields unverified)')
  else {
    for (const field of CONTRACT.sessionLog.fields['assistant/message']) {
      if (get(message.data, field) === undefined) bad(`assistant/message.${field} missing`)
      else ok(`assistant/message.${field} present`)
    }
  }
}

function checkSurface(file, space) {
  const expected = CONTRACT.spaces?.[space]
  if (expected === undefined) {
    bad(`contract.json declares no space "${space}"`)
    return
  }
  const rows = events(file)
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
