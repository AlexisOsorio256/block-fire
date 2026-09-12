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

async function harnessFor() {
  const module = await import(`${GUARD}?t=${Date.now()}-${Math.random()}`)
  const guards = []
  const listeners = new Map()
  const ctx = {
    tools: { guard(check) { guards.push(check); return () => {} } },
    effect(factory) { return factory() },
    on(name, listener) { listeners.set(name, listener); return () => listeners.delete(name) },
  }
  module.apply(ctx)
  assert.equal(guards.length, 1)
  assert.equal(typeof listeners.get('agent/request'), 'function')
  return { guard: guards[0], request: listeners.get('agent/request') }
}

async function guardFor() { return (await harnessFor()).guard }
const call = (guard, name, args = {}) => guard({ name, arguments: args })

test('BUILD composition keeps the terminal evidence-lock contract', () => {
  const build = readFileSync(BUILD, 'utf8')
  const surface = readFileSync(SURFACE, 'utf8')
  const prompt = readFileSync(PROMPT, 'utf8')
  assert.match(build, /After that sweep choose exactly one outcome once/)
  assert.match(build, /A `TERMINAL VISUAL PASS` guard result is final for the turn/)
  assert.match(build, /Temporary QA lives only under `\/tmp\/blockfire-\*`/)
  assert.match(build, /id: workflow-guard[\s\S]*name: '\.\/plugins\/workflow-guard\.js'/)
  assert.doesNotMatch(surface, /id: workflow-guard/, 'CREATOR reuses the surface; the BUILD guard must not leak there')
  assert.match(prompt, /If no player-visible defect is nameable, stop instead of reconstructing the images from memory/)
  assert.match(prompt, /no more images are allowed until after a real edit/)
})

test('BUILD request cap prevents a reasoning-only runaway without lowering smaller provider caps', async () => {
  const { request } = await harnessFor()
  assert.deepEqual(
    await request({}, async () => ({ provider: 'p', model: 'm', maxTokens: 256000 })),
    { provider: 'p', model: 'm', maxTokens: 16384 },
  )
  assert.deepEqual(
    await request({}, async () => ({ provider: 'p', model: 'm', maxTokens: 8192 })),
    { provider: 'p', model: 'm', maxTokens: 8192 },
    'a stricter route/model cap stays authoritative',
  )
  assert.deepEqual(
    await request({}, async () => ({ provider: 'p', model: 'm' })),
    { provider: 'p', model: 'm', maxTokens: 16384 },
  )
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

test('discovery without owner becomes terminal instead of forcing an edit', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/side.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/detail.png' }), undefined)
  const fourth = call(guard, 'read_image', { file_path: '/tmp/blockfire/again.png' })
  assert.equal(typeof fourth, 'string')
  assert.match(fourth, /TERMINAL VISUAL PASS/)
  assert.match(fourth, /no justified edit/)
  assert.match(fourth, /Do not reconstruct or re-judge the same images from memory/)

  const speculativeEdit = call(guard, 'edit', { file_path: 'game/player/player.gd' })
  assert.equal(typeof speculativeEdit, 'string', 'terminal no-defect state must not force fabricated edits')
  assert.match(speculativeEdit, /TERMINAL VISUAL PASS/)
})

test('first post-visual investigation commits to one owner and must edit quickly', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  // First non-visual tool is the implicit owner commitment.
  assert.equal(call(guard, 'grep', { pattern: 'carry_blend', path: 'game' }), undefined)
  assert.equal(call(guard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'tools/bf qa ik --baseline' }), undefined)
  // The real edit itself is still allowed after the three owner/check calls.
  assert.equal(call(guard, 'edit', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  // Edit resets the visual cycle, so comparable after evidence can be read.
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/after.png' }), undefined)
})

test('locked hypothesis cannot switch into another proof marathon', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'grep', { pattern: 'candidate', path: 'game' }), undefined)
  assert.equal(call(guard, 'read', { file_path: 'game/a.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'printf causal-check' }), undefined)
  const fourth = call(guard, 'read', { file_path: 'game/b.gd' })
  assert.equal(typeof fourth, 'string')
  assert.match(fourth, /TERMINAL VISUAL PASS/)
  assert.match(fourth, /used 3 owner\/check tools without producing an edit/)
  assert.equal(typeof call(guard, 'edit', { file_path: 'game/b.gd' }), 'string',
    'after the committed path expires, a speculative replacement edit is blocked')
})

test('EVIDENCE LOCK forbids returning to images or creating a new temp lab', async () => {
  const imageGuard = await guardFor()
  assert.equal(call(imageGuard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(imageGuard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  const image = call(imageGuard, 'read_image', { file_path: '/tmp/blockfire/one-more.png' })
  assert.equal(typeof image, 'string')
  assert.match(image, /TERMINAL VISUAL PASS/)

  const labGuard = await guardFor()
  assert.equal(call(labGuard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(labGuard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  const lab = call(labGuard, 'write', { file_path: '/tmp/blockfire/new-probe.gd' })
  assert.equal(typeof lab, 'string')
  assert.match(lab, /new throwaway lab\/script/)
})

test('background capture bookkeeping does not accidentally commit an owner', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/front.png' }), undefined)
  assert.equal(call(guard, 'job_output', { job_id: 'a' }), undefined)
  assert.equal(call(guard, 'job_list'), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/side.png' }), undefined)
})
