#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = join(HERE, '..')
const GUARD_FILE = join(HARNESS, 'presets', 'build', 'plugins', 'workflow-guard.js')
const GUARD = pathToFileURL(GUARD_FILE).href
const BUILD = join(HARNESS, 'presets', 'build', 'agent.cordis.yml')
const SURFACE = join(HARNESS, 'presets', 'build', 'surface.cordis.yml')
const PROMPT = join(HARNESS, 'presets', 'build', 'plugins', 'prompt.js')

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

test('BUILD composition keeps the hard evidence-lock contract', () => {
  const build = readFileSync(BUILD, 'utf8')
  const surface = readFileSync(SURFACE, 'utf8')
  const prompt = readFileSync(PROMPT, 'utf8')
  assert.match(build, /EVIDENCE LOCK: once a player-visible defect is nameable and one owner is plausible, discovery ends/)
  assert.match(build, /Temporary QA lives only under `\/tmp\/blockfire-\*`/)
  assert.match(build, /id: workflow-guard[\s\S]*name: '\.\/plugins\/workflow-guard\.js'/)
  assert.doesNotMatch(surface, /id: workflow-guard/, 'CREATOR reuses the surface; the BUILD guard must not leak there')
  assert.match(prompt, /EVIDENCE LOCK applies: read no more images until after the edit/)
})

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

  assert.equal(call(guard, 'edit', { file_path: 'game/weapons/weapon_controller.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'printf after-edit' }), undefined)
})
