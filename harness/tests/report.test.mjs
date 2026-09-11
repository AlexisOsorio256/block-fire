#!/usr/bin/env node
/** Fixture tests for harness/bin/session-report.mjs. */

import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPORT = resolve(HERE, '..', 'bin', 'session-report.mjs')

function runJson(args, env = {}) {
  return JSON.parse(execFileSync(process.execPath, [REPORT, ...args], {
    encoding: 'utf8', env: { ...process.env, ...env },
  }))
}
function writeLog(file, rows) { writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n')) }
const sessionEvent = (id) => ({ type: 'session', id, cwd: '/fixture', agentPreset: 'build', createdAt: 0, time: 0 })

test('compaction counting follows lifecycle + legacy vocabulary', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('compaction-fixture'),
      { type: 'compaction/start', data: { compactionId: 'a' }, time: 1 },
      { type: 'compaction/summary', data: { compactionId: 'a' }, time: 2 },
      { type: 'compaction/end', data: { compactionId: 'a' }, time: 3 },
      { type: 'compaction/start', data: { compactionId: 'b' }, time: 4 },
      { type: 'compaction/end', data: { compactionId: 'b', error: [{ message: 'failed' }] }, time: 5 },
      { type: 'compaction/start', data: { compactionId: 'c' }, time: 6 },
      { type: 'compaction', time: 7 },
    ])
    const [r] = runJson(['--session', file, '--json'])
    assert.equal(r.compactions, 4)
    assert.equal(r.compactionsOk, 2)
    assert.equal(r.compactionsFailed, 1)
    assert.equal(r.compactionsIncomplete, 1)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('usage includes cache writes in billed prompt and cache denominator', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('usage-fixture'),
      { type: 'request/header', data: { header: { system: 'S', tools: [{ name: 'bash' }], config: { model: 'm' } } }, time: 1 },
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'bash', arguments: '{}' }] } }, time: 2 },
      { type: 'assistant/message', data: { usage: { inputTokens: 10, cacheReadTokens: 5, cacheWriteTokens: 5, outputTokens: 2, reasoningTokens: 1 }, message: { content: [] } }, time: 3 },
    ])
    const [r] = runJson(['--session', file, '--json'])
    assert.equal(r.requests, 2)
    assert.equal(r.usageReports, 1)
    assert.equal(r.requestHeaders, 1)
    assert.equal(r.tools.bash, 1)
    assert.equal(r.inputTokens, 10)
    assert.equal(r.cacheReadTokens, 5)
    assert.equal(r.cacheWriteTokens, 5)
    assert.equal(r.cacheHitPercent, 25)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('current runtime shapes: system/message sizes the prompt, systemless headers still yield tool cost', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('current-shapes'),
      { type: 'system/message', data: { message: { content: [{ type: 'text', text: 'ABCD' }] } }, time: 1 },
      { type: 'request/header', data: { header: { tools: [{ name: 'bash' }], config: { model: 'm' } } }, time: 2 },
    ])
    const [r] = runJson(['--session', file, '--json'])
    assert.equal(r.systemChars, 4)
    assert.equal(r.toolCount, 1)
    assert.ok(r.toolSchemaChars > 10)
    assert.deepEqual(r.toolSchemaTop.map(([name]) => name), ['bash'])
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('system prompt sizing tolerates string content from provider/runtime adapters', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('string-system-shape'),
      { type: 'system/message', data: { message: { content: 'ABCDE' } }, time: 1 },
      { type: 'request/header', data: { header: { tools: [], config: { model: 'm' } } }, time: 2 },
    ])
    const [r] = runJson(['--session', file, '--json'])
    assert.equal(r.systemChars, 5)
    assert.equal(r.toolCount, 0)
  } finally { rmSync(tmp, { recursive: true, force: true }) }
})

test('--last prefers current session.v3 logs and still sees legacy logs', () => {
  const home = mkdtempSync(join(tmpdir(), 'blockfire-report-home-'))
  try {
    const sessions = join(home, 'sessions', 'fixture-project')
    const legacy = join(sessions, 'aaa', 'session.jsonl.zstd')
    const v3 = join(sessions, 'bbb', 'session.v3.jsonl.zstd')
    mkdirSync(dirname(legacy), { recursive: true })
    mkdirSync(dirname(v3), { recursive: true })
    writeLog(legacy, [sessionEvent('legacy')])
    writeLog(v3, [sessionEvent('v3')])
    utimesSync(legacy, new Date(1000), new Date(1000))
    utimesSync(v3, new Date(2000), new Date(2000))
    const env = { DSH_HOME: home, DSH_SESSION_JSONL: legacy }
    assert.equal(runJson(['--json'], env)[0].sessionId, 'legacy', 'env pin still wins without --last')
    const lastTwo = runJson(['--last', '2', '--json'], env)
    assert.deepEqual(lastTwo.map((r) => r.sessionId), ['v3', 'legacy'])
  } finally { rmSync(home, { recursive: true, force: true }) }
})