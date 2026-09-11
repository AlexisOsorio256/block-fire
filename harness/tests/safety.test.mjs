#!/usr/bin/env node
/** Cheap regressions for host/update/evidence boundaries that must fail safely. */
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const GUARD = pathToFileURL(join(HARNESS, 'host', 'guard.js')).href
const UPDATE = join(HARNESS, 'bin', 'update.mjs')
const PURGER = join(HARNESS, 'bin', 'purge-sessions.mjs')
const REPORT = join(HARNESS, 'bin', 'session-report.mjs')
const CONTRACT = join(HARNESS, 'lib', 'contract_check.mjs')

async function guardFor() {
  const module = await import(GUARD)
  const guards = []
  const ctx = {
    tools: {
      guard(check) {
        guards.push(check)
        return () => {}
      },
    },
    effect(factory) { return factory() },
  }
  module.apply(ctx)
  assert.equal(guards.length, 1)
  return guards[0]
}

test('auxiliary harness programs exist and parse before runtime-dependent tests', () => {
  for (const file of [UPDATE, PURGER, REPORT, CONTRACT]) {
    assert.equal(existsSync(file), true, `${file} must exist`)
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' })
    assert.equal(checked.status, 0, `${file} must parse: ${checked.stderr}`)
  }
})

test('guard: HOME-expanded protected paths are denied but normal cache cleanup stays allowed', async () => {
  const guard = await guardFor()
  for (const command of [
    'rm -rf "$HOME/.ssh"',
    'rm -rf "${HOME}/.gnupg"',
    'rm -rf "$HOME/.config/gh"',
  ]) {
    const reason = guard({ name: 'bash', arguments: { command } })
    assert.equal(typeof reason, 'string', `${command} must be denied`)
    assert.match(reason, /BLOCKFIRE policy blocked/)
  }
  assert.equal(
    guard({ name: 'bash', arguments: { command: 'rm -rf "$HOME/.cache/blockfire"' } }),
    undefined,
    'normal user cache cleanup must not be over-blocked',
  )
})

test('updater: path-shaped versions are rejected before staging touches disk or npm', () => {
  const home = mkdtempSync(join(tmpdir(), 'bf-update-safety-'))
  try {
    const stateDir = join(home, '.blockfire-harness')
    mkdirSync(stateDir, { recursive: true })
    const sentinel = join(stateDir, 'sentinel')
    writeFileSync(sentinel, 'keep\n')

    for (const action of ['stage', 'verify', 'activate']) {
      const result = spawnSync(process.execPath, [UPDATE, action, '../sentinel'], {
        encoding: 'utf8',
        env: { ...process.env, DSH_HOME: home },
      })
      assert.equal(result.status, 2, `${action} must reject path syntax`)
      assert.match(result.stderr, /version must be an npm version\/tag without path syntax/)
      assert.equal(existsSync(sentinel), true, `${action} must not touch the escaped target`)
      assert.equal(existsSync(join(stateDir, 'staging')), false, `${action} must fail before creating staging`)
    }
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('session purger: corrupt delete queue fails without rewriting or discarding it', () => {
  const home = mkdtempSync(join(tmpdir(), 'bf-purge-safety-'))
  try {
    const dir = join(home, '.blockfire-harness')
    mkdirSync(dir, { recursive: true })
    const queue = join(dir, 'pending-session-deletes.json')
    const corrupt = '{"unfinished":'
    writeFileSync(queue, corrupt)
    const result = spawnSync(process.execPath, [PURGER], {
      encoding: 'utf8',
      env: { ...process.env, DSH_HOME: home },
    })
    assert.equal(result.status, 1, 'corrupt durable delete intent must fail loud')
    assert.match(result.stderr, /delete queue is unreadable/)
    assert.equal(readFileSync(queue, 'utf8'), corrupt, 'corrupt evidence stays untouched for recovery')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('contract: dynamic system/message is valid evidence for current DSH headers', () => {
  const root = mkdtempSync(join(tmpdir(), 'bf-contract-system-'))
  try {
    const log = join(root, 'session.jsonl')
    writeFileSync(log, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      JSON.stringify({ type: 'request/header', data: { header: { tools: [], config: { model: 'm' } } } }),
      JSON.stringify({ type: 'system/message', data: { message: { content: [{ type: 'text', text: 'system prompt' }] } } }),
      '',
    ].join('\n'))
    const result = spawnSync(process.execPath, [CONTRACT, 'log', log], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.match(result.stdout, /system prompt present via system\/message/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('contract: malformed middle JSON fails, but a truncated final live line is tolerated', () => {
  const root = mkdtempSync(join(tmpdir(), 'bf-contract-jsonl-'))
  try {
    const middle = join(root, 'middle.jsonl')
    writeFileSync(middle, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      '{broken-json',
      JSON.stringify({ type: 'request/header', data: { header: { system: 'S', tools: [], config: { model: 'm' } } } }),
      '',
    ].join('\n'))
    const broken = spawnSync(process.execPath, [CONTRACT, 'log', middle], { encoding: 'utf8' })
    assert.notEqual(broken.status, 0, 'corruption before later events must fail the contract')
    assert.match(broken.stdout, /malformed JSONL before end/)

    const tail = join(root, 'tail.jsonl')
    writeFileSync(tail, [
      JSON.stringify({ type: 'session', id: 's', cwd: '/x', agentPreset: 'build', createdAt: 0 }),
      JSON.stringify({ type: 'request/header', data: { header: { system: 'S', tools: [], config: { model: 'm' } } } }),
      '{"type":',
    ].join('\n'))
    const live = spawnSync(process.execPath, [CONTRACT, 'log', tail], { encoding: 'utf8' })
    assert.equal(live.status, 0, live.stdout + live.stderr)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
