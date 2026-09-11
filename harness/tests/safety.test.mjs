#!/usr/bin/env node
/** Cheap regressions for host/update boundaries that must fail before side effects. */
import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const GUARD = pathToFileURL(join(HARNESS, 'host', 'guard.js')).href
const UPDATE = join(HARNESS, 'bin', 'update.mjs')

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
