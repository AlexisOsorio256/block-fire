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

const call = (guard, name, args = {}) => guard({ name, arguments: args })

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

test('BUILD guard hard-stops serial visual rereading before an edit', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/side.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/detail.png' }), undefined)
  const fourth = call(guard, 'read_image', { file_path: '/tmp/blockfire/again.png' })
  assert.equal(typeof fourth, 'string')
  assert.match(fourth, /visual decision budget exhausted/)
  assert.match(fourth, /Edit the plausible owner now or stop/)

  // A real repo edit starts a fresh cycle; verification images are allowed.
  assert.equal(call(guard, 'edit', { file_path: 'game/player/player.gd' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/after.png' }), undefined)
})

test('BUILD guard caps proof-marathon tools and /tmp writes cannot reset it', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  for (let i = 0; i < 5; i += 1) {
    assert.equal(call(guard, i === 2 ? 'write' : 'bash', i === 2
      ? { file_path: '/tmp/blockfire/custom-lab.gd' }
      : { command: `printf ${i}` }), undefined)
  }
  assert.equal(call(guard, 'read', { file_path: 'game/weapons/weapon_controller.gd' }), undefined)
  const seventh = call(guard, 'bash', { command: 'grep -R muzzle game' })
  assert.equal(typeof seventh, 'string')
  assert.match(seventh, /decision budget exhausted/)
  assert.match(seventh, /Edit\/write the plausible owner now or stop/)

  // The demanded next action is accepted and resets the cycle.
  assert.equal(call(guard, 'edit', { file_path: 'game/weapons/weapon_controller.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'printf after-edit' }), undefined)
})
