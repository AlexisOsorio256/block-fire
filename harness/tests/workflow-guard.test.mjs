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

async function harnessFor(config = { provider: 'deepseek-official', model: 'deepseek-flash' }) {
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
  const request = listeners.get('agent/request')
  assert.equal(typeof request, 'function')
  const resolved = await request({}, async () => ({ ...config }))
  return { guard: guards[0], request, resolved }
}

async function guardFor(config) { return (await harnessFor(config)).guard }
const call = (guard, name, args = {}) => guard({ name, arguments: args })

test('BUILD composition keeps a compact model-neutral visual contract', () => {
  const build = readFileSync(BUILD, 'utf8')
  const surface = readFileSync(SURFACE, 'utf8')
  const prompt = readFileSync(PROMPT, 'utf8')
  assert.match(build, /Once a player-visible defect and plausible owner are clear, stop discovery/)
  assert.match(build, /If no important defect is nameable from the bounded sweep, stop rather than inventing or hunting for one/)
  assert.match(build, /Temporary QA lives only under `\/tmp\/blockfire-\*`/)
  assert.match(build, /stricter anti-rumination[\s\S]*only for model profiles that need them/)
  assert.match(build, /id: workflow-guard[\s\S]*name: '\.\/plugins\/workflow-guard\.js'/)
  assert.doesNotMatch(surface, /id: workflow-guard/, 'CREATOR reuses the surface; the BUILD guard must not leak there')
  assert.match(prompt, /If no player-visible defect is nameable, stop instead of reconstructing the images from memory/)
  assert.match(prompt, /no more images are allowed until after a real edit/)
})

test('request cap targets DeepSeek Flash only', async () => {
  const deepseek = await harnessFor({ provider: 'deepseek-official', model: 'deepseek-flash', maxTokens: 256000 })
  assert.equal(deepseek.resolved.maxTokens, 16384)

  const lowerCap = await harnessFor({ provider: 'deepseek-official', model: 'deepseek-flash', maxTokens: 8192 })
  assert.equal(lowerCap.resolved.maxTokens, 8192, 'a stricter route/model cap stays authoritative')

  for (const config of [
    { provider: 'openai', model: 'gpt-6-codex', maxTokens: 256000 },
    { provider: 'openai', model: 'astra', maxTokens: 131072 },
    { provider: 'other', model: 'strong-model' },
  ]) {
    const other = await harnessFor(config)
    assert.deepEqual(other.resolved, config, 'non-DeepSeek-Flash models keep their native request budget')
  }
})

test('checkout hygiene applies to every model', async () => {
  for (const config of [
    { provider: 'deepseek-official', model: 'deepseek-flash' },
    { provider: 'openai', model: 'gpt-6-codex' },
  ]) {
    const guard = await guardFor(config)
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
  }
})

test('stronger models are not mechanically throttled by DeepSeek-specific visual budgets', async () => {
  const guard = await guardFor({ provider: 'openai', model: 'gpt-6-codex' })
  for (let i = 0; i < 8; i += 1) {
    assert.equal(call(guard, 'read_image', { file_path: `/tmp/blockfire/${i}.png` }), undefined)
  }
  for (let i = 0; i < 8; i += 1) {
    assert.equal(call(guard, 'read', { file_path: `game/${i}.gd` }), undefined)
  }
})

test('DeepSeek discovery without owner becomes terminal instead of forcing an edit', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/side.png' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/detail.png' }), undefined)
  const fourth = call(guard, 'read_image', { file_path: '/tmp/blockfire/again.png' })
  assert.equal(typeof fourth, 'string')
  assert.match(fourth, /TERMINAL VISUAL PASS/)
  assert.match(fourth, /no justified edit/)
  assert.match(fourth, /Do not reconstruct or re-judge the same images from memory/)
  assert.equal(typeof call(guard, 'edit', { file_path: 'game/player/player.gd' }), 'string')
})

test('DeepSeek first post-visual investigation commits to one owner and must edit quickly', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'grep', { pattern: 'carry_blend', path: 'game' }), undefined)
  assert.equal(call(guard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'tools/bf qa ik --baseline' }), undefined)
  assert.equal(call(guard, 'edit', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/after.png' }), undefined)
})

test('DeepSeek locked hypothesis cannot switch into another proof marathon', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(guard, 'grep', { pattern: 'candidate', path: 'game' }), undefined)
  assert.equal(call(guard, 'read', { file_path: 'game/a.gd' }), undefined)
  assert.equal(call(guard, 'bash', { command: 'printf causal-check' }), undefined)
  const fourth = call(guard, 'read', { file_path: 'game/b.gd' })
  assert.equal(typeof fourth, 'string')
  assert.match(fourth, /TERMINAL VISUAL PASS/)
  assert.match(fourth, /used 3 owner\/check tools without producing an edit/)
  assert.equal(typeof call(guard, 'edit', { file_path: 'game/b.gd' }), 'string')
})

test('DeepSeek EVIDENCE LOCK forbids returning to images or creating a new temp lab', async () => {
  const imageGuard = await guardFor()
  assert.equal(call(imageGuard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(imageGuard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  assert.match(call(imageGuard, 'read_image', { file_path: '/tmp/blockfire/one-more.png' }), /TERMINAL VISUAL PASS/)

  const labGuard = await guardFor()
  assert.equal(call(labGuard, 'read_image', { file_path: '/tmp/blockfire/sheet.png' }), undefined)
  assert.equal(call(labGuard, 'read', { file_path: 'game/characters/operator_visual.gd' }), undefined)
  assert.match(call(labGuard, 'write', { file_path: '/tmp/blockfire/new-probe.gd' }), /new throwaway lab\/script/)
})

test('background capture bookkeeping does not accidentally commit an owner', async () => {
  const guard = await guardFor()
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/front.png' }), undefined)
  assert.equal(call(guard, 'job_output', { job_id: 'a' }), undefined)
  assert.equal(call(guard, 'job_list'), undefined)
  assert.equal(call(guard, 'read_image', { file_path: '/tmp/blockfire/side.png' }), undefined)
})
