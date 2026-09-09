#!/usr/bin/env node
/**
 * BLOCKFIRE harness layer — session-report fixture tests.
 *
 * `bin/session-report.mjs` folds real session logs into the numbers the harness
 * layer is judged by. These fixtures pin the counters to event shapes that
 * historical logs may never contain on demand: a compaction that succeeds, one
 * that fails, one that never closes, the older single-event vocabulary, usage
 * that an adapter does not report, and the priority of an explicit `--last`
 * over the environment. Fixtures are plain JSONL; the report sniffs the zstd
 * magic number, so no compression is needed here.
 *
 * Run directly (`node harness/tests/report.test.mjs`) or through
 * `harness/test.sh`.
 */

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
  const out = execFileSync(process.execPath, [REPORT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  return JSON.parse(out)
}

function writeLog(file, rows) {
  writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n'))
}

const sessionEvent = (id) => ({ type: 'session', id, cwd: '/fixture', agentPreset: 'build', createdAt: 0, time: 0 })

test('compaction counting follows the real lifecycle vocabulary', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('compaction-fixture'),
      { type: 'compaction/start', data: { compactionId: 'a' }, time: 1 },
      { type: 'compaction/summary', data: { compactionId: 'a' }, time: 2 },
      { type: 'compaction/end', data: { compactionId: 'a' }, time: 3 },
      { type: 'compaction/start', data: { compactionId: 'b' }, time: 4 },
      { type: 'compaction/end', data: { compactionId: 'b', error: [{ message: 'summary failed' }] }, time: 5 },
      { type: 'compaction/start', data: { compactionId: 'c' }, time: 6 },
      { type: 'compaction', time: 7 },
    ])
    const [report] = runJson(['--session', file, '--json'])
    assert.equal(report.compactions, 4, 'three lifecycle starts plus one legacy event')
    assert.equal(report.compactionsOk, 2, 'one paired end plus the legacy event')
    assert.equal(report.compactionsFailed, 1, 'an end carrying an error is a failure, not an attempt lost')
    assert.equal(report.compactionsIncomplete, 1, 'a start the log never closed is incomplete')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('requests come from responses, and tools count even without usage', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'blockfire-report-'))
  try {
    const file = join(tmp, 'fixture.jsonl')
    writeLog(file, [
      sessionEvent('usage-fixture'),
      { type: 'request/header', data: { header: { system: 'S', tools: [{ name: 'bash' }], config: { model: 'm' } } }, time: 1 },
      { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', name: 'bash', arguments: '{}' }] } }, time: 2 },
      { type: 'assistant/message', data: { usage: { inputTokens: 10, cacheReadTokens: 5, outputTokens: 2, reasoningTokens: 1 }, message: { content: [] } }, time: 3 },
    ])
    const [report] = runJson(['--session', file, '--json'])
    assert.equal(report.requests, 2, 'one event per model response, independent of usage reporting')
    assert.equal(report.usageReports, 1)
    assert.equal(report.requestHeaders, 1, 'surface snapshots are counted separately')
    assert.equal(report.tools.bash, 1, 'a tool call without usage must still be counted')
    assert.equal(report.inputTokens, 10)
    assert.equal(report.cacheHitPercent, 33.3)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('--last N wins over DSH_SESSION_JSONL and lists N sessions', () => {
  const home = mkdtempSync(join(tmpdir(), 'blockfire-report-home-'))
  try {
    const sessions = join(home, 'sessions', 'fixture-project')
    const pinned = join(sessions, 'aaa', 'session.jsonl.zstd')
    const newer = join(sessions, 'bbb', 'session.jsonl.zstd')
    mkdirSync(dirname(pinned), { recursive: true })
    mkdirSync(dirname(newer), { recursive: true })
    writeLog(pinned, [sessionEvent('pinned')])
    writeLog(newer, [sessionEvent('newer')])
    utimesSync(pinned, new Date(1000), new Date(1000))
    utimesSync(newer, new Date(2000), new Date(2000))
    const env = { DSH_HOME: home, DSH_SESSION_JSONL: pinned }
    const pinnedOnly = runJson(['--json'], env)
    assert.equal(pinnedOnly.length, 1)
    assert.equal(pinnedOnly[0].sessionId, 'pinned', 'without --last the env pin selects the session')
    const lastTwo = runJson(['--last', '2', '--json'], env)
    assert.equal(lastTwo.length, 2, '--last 2 means two sessions, not the env pin')
    assert.deepEqual(lastTwo.map((report) => report.sessionId).sort(), ['newer', 'pinned'])
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
