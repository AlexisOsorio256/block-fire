#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARD = pathToFileURL(join(HERE, '..', 'presets', 'build', 'plugins', 'workflow-guard.js')).href

async function guardFor() {
  const module = await import(GUARD)
  const guards = []
  const ctx = {
    tools: { guard(check) { guards.push(check); return () => {} } },
    effect(factory) { return factory() },
  }
  module.apply(ctx)
  assert.equal(guards.length, 1)
  return guards[0]
}

test('BUILD guard keeps temporary visual evidence outside the checkout', async () => {
  const guard = await guardFor()
  for (const execution of [
    { name: 'write', arguments: { file_path: 'captures/pass/semantic-shot.gd' } },
    { name: 'edit', arguments: { file_path: '/work/BlockFire/captures/pass/axis-probe.gd' } },
    { name: 'bash', arguments: { command: 'tools/bf qa motion --out=captures/pass' } },
    { name: 'bash', arguments: { command: 'mkdir -p captures/pass' } },
    { name: 'bash', arguments: { command: 'printf x > captures/result.txt' } },
  ]) {
    const reason = guard(execution)
    assert.equal(typeof reason, 'string')
    assert.match(reason, /\/tmp\/blockfire-/)
  }

  for (const execution of [
    { name: 'write', arguments: { file_path: '/tmp/blockfire-pass/semantic-shot.gd' } },
    { name: 'edit', arguments: { file_path: 'game/characters/operator_visual.gd' } },
    { name: 'bash', arguments: { command: 'tools/bf qa motion --out=/tmp/blockfire-pass' } },
    { name: 'bash', arguments: { command: 'ls captures 2>/dev/null || true' } },
    { name: 'bash', arguments: { command: 'rm -rf captures/pass-combat' } },
  ]) {
    assert.equal(guard(execution), undefined)
  }
})
