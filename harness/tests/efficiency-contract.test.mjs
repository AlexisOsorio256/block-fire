#!/usr/bin/env node
/** Static contract for the anti-churn rules the model reads and the pruner enforces. */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const read = (...parts) => readFileSync(join(HARNESS, ...parts), 'utf8')

const build = read('presets', 'build', 'agent.cordis.yml')
const creator = read('presets', 'creator', 'agent.cordis.yml')
const prompt = read('presets', 'build', 'plugins', 'prompt.js')
const surface = read('presets', 'build', 'surface.cordis.yml')
const evidence = read('presets', 'shared', 'skills', 'blockfire-evidence', 'SKILL.md')

function numberAfter(name) {
  const match = new RegExp(`${name}:\\s*(\\d+)`).exec(surface)
  assert.notEqual(match, null, `${name} must stay explicit in the shared surface`)
  return Number(match[1])
}

test('personas require the shortest decisive path without mandatory meta-work', () => {
  for (const [name, text] of [['BUILD', build], ['CREATOR', creator]]) {
    assert.match(text, /Waste is prohibited: take the shortest decisive path/,
      `${name} must make shortest-path execution a permanent invariant`)
    assert.match(text, /duplicate reads\/tests, speculative subagents or extra planning/,
      `${name} must reject common workflow churn`)
  }
  assert.doesNotMatch(build, /Close significant work with a brief look at your own trajectory/,
    'BUILD must not force a retrospective after already-closed work')
})

test('tool descriptions prefer direct evidence over workflow fan-out', () => {
  assert.match(prompt, /Do not delegate a question solvable with a few direct tool calls/)
  assert.match(prompt, /Do not create todos for straightforward work or mirror every action/)
  assert.match(prompt, /Do not preload every possibly related skill/)
  assert.doesNotMatch(prompt, /load every applicable skill before acting on the task/)
  assert.match(prompt, /use the available image before inferring from code, geometry or proxy metrics/)
})

test('old tool payloads are pruned before they dominate later requests', () => {
  const threshold = numberAfter('thresholdChars')
  const head = numberAfter('headChars')
  const tail = numberAfter('tailChars')
  assert.ok(threshold <= 4096, `prune threshold regressed to ${threshold}`)
  assert.ok(head <= 2048, `retained head regressed to ${head}`)
  assert.ok(tail <= 768, `retained tail regressed to ${tail}`)
  assert.ok(head + tail < threshold, 'a pruned result must be materially smaller than the trigger')
})

test('evidence stops when the changed contract is already proved', () => {
  assert.match(evidence, /Once that\ncontract is proved, stop:/)
  assert.match(evidence, /Do not build a new\nprobe, geometry proof or analysis script for something the image already answers/)
  assert.match(evidence, /Do not rerun an already decisive check without a\nstate change/)
})
