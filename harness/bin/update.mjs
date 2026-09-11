#!/usr/bin/env node
/** Staged, verified and reversible DeepSeek Harness updates. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACKAGE, compareVersions, describeInstall, resolveRuntime } from '../lib/runtime.mjs'
import { updateVersionError, validUpdateVersion } from '../lib/update-version.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const REPO = resolve(HARNESS, '..')
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const STATE_DIR = join(DSH_HOME, '.blockfire-harness')
const STATE_FILE = join(STATE_DIR, 'state.json')
const STAGING_DIR = join(STATE_DIR, 'staging')
const RELEASES_URL = 'https://api.github.com/repos/deepseek-ai/deepseek-harness/releases'

process.stdout.on('error', (error) => { if (error?.code === 'EPIPE') process.exit(0) })
const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const force = argv.includes('--force')
const command = argv.find((arg) => !arg.startsWith('--')) ?? 'status'
const operand = argv.filter((arg) => !arg.startsWith('--'))[1]

function fail(message) {
  process.stderr.write(`update: ${message}\n`)
  process.exit(2)
}

/** Versions/tags become staging directory names; path syntax is never valid here. */
function safeVersion(version, action) {
  if (version === undefined) fail(`${action} needs a version`)
  if (!validUpdateVersion(version)) fail(updateVersionError(action))
  return version
}

function readState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')) }
  catch { return { active: undefined, previous: undefined, staged: {}, verified: {}, lastCheck: undefined } }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true })
  const tmp = `${STATE_FILE}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(state, undefined, 2)}\n`)
  renameSync(tmp, STATE_FILE)
}

function readJson(text) {
  try { return JSON.parse(text) } catch { return undefined }
}

function pinnedTree(state) {
  const active = state.active
  if (active === null || active === undefined || typeof active !== 'object') return undefined
  return describeInstall(active.nodeModules ?? active.bin, 'active-pin')
}

function installedTree() {
  const resolved = resolveRuntime({ skip: ['active-pin', 'staged'] })
  if (resolved.ok !== true) return undefined
  return {
    version: resolved.version,
    bin: resolved.bin,
    nodeModules: resolved.nodeModules,
    source: resolved.source,
    sourceLabel: resolved.sourceLabel,
  }
}

function activeTree(state) {
  return pinnedTree(state) ?? installedTree()
}

/** Web children inherit these from harness/bin/blockfire, so this is the actual host. */
function runningTree() {
  const version = process.env.BLOCKFIRE_RUNNING_DSH_VERSION
  if (typeof version === 'string' && version !== '') {
    return {
      version,
      bin: process.env.BLOCKFIRE_RUNNING_DSH_BIN,
      source: 'running-process',
      sourceLabel: process.env.BLOCKFIRE_RUNNING_DSH_SOURCE_LABEL ?? 'BLOCKFIRE host',
    }
  }
  return installedTree()
}

function npmView(args) {
  return execFileSync('npm', ['view', PACKAGE, ...args], { encoding: 'utf8', timeout: 120000 }).trim()
}
function npmJson(args) { return readJson(npmView([...args, '--json'])) }

async function releaseNotes() {
  try {
    const response = await fetch(`${RELEASES_URL}?per_page=15`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'blockfire-harness' },
    })
    if (!response.ok) return []
    return (await response.json()).map((release) => ({
      tag: String(release.tag_name ?? ''),
      url: String(release.html_url ?? ''),
      body: String(release.body ?? '').slice(0, 4000),
    }))
  } catch { return [] }
}

async function check() {
  const state = readState()
  const target = activeTree(state)
  const installed = target?.version ?? 'unknown'
  const distTags = npmJson(['dist-tags']) ?? {}
  const times = npmJson(['time']) ?? {}
  const versions = Object.keys(times).filter((key) => key !== 'created' && key !== 'modified')
  const newer = versions
    .filter((version) => installed === 'unknown' || compareVersions(version, installed) > 0)
    .sort((a, b) => compareVersions(b, a))
  const notes = await releaseNotes()
  const channels = Object.entries(distTags).map(([channel, version]) => {
    const release = notes.find((entry) => entry.tag === `dsh-v${String(version)}`)
    return {
      channel,
      version: String(version),
      publishedAt: times[String(version)] ?? undefined,
      notesUrl: release?.url,
      notes: release?.body?.split('\n').slice(0, 40).join('\n'),
    }
  })
  const result = {
    package: PACKAGE,
    installed,
    channels,
    newer: newer.map((version) => ({
      version,
      publishedAt: times[version],
      notesUrl: notes.find((entry) => entry.tag === `dsh-v${version}`)?.url,
    })),
    checkedAt: new Date().toISOString(),
  }
  state.lastCheck = result
  writeState(state)
  return result
}

function stagedTrees(state) {
  const out = {}
  for (const [version, entry] of Object.entries(state.staged ?? {})) {
    if (entry?.nodeModules !== undefined && existsSync(entry.nodeModules)) out[version] = entry
  }
  return out
}

function status() {
  const state = readState()
  const pinned = pinnedTree(state)
  return {
    package: PACKAGE,
    active: activeTree(state) ?? null,
    pinned: pinned ?? null,
    pinStale: state.active !== undefined && pinned === undefined,
    previous: state.previous ?? null,
    runningInstall: runningTree() ?? null,
    staged: stagedTrees(state),
    verified: state.verified ?? {},
    lastCheck: state.lastCheck ?? null,
    stateFile: STATE_FILE,
    repo: REPO,
  }
}

function stage(rawVersion) {
  const version = safeVersion(rawVersion, 'stage')
  const dir = join(STAGING_DIR, version)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  process.stdout.write(`staging ${PACKAGE}@${version}\n`)
  execFileSync('npm', ['install', '--prefix', dir, '--no-save', '--no-audit', '--no-fund', `${PACKAGE}@${version}`], {
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 900000,
  })
  const tree = describeInstall(join(dir, 'node_modules'), 'staged')
  if (tree === undefined) fail(`staged tree at ${dir} does not contain ${PACKAGE}`)
  const state = readState()
  state.staged = { ...(state.staged ?? {}), [version]: tree }
  state.verified = { ...(state.verified ?? {}) }
  delete state.verified[version] // a fresh tree never inherits an old verdict
  writeState(state)
  process.stdout.write(`staged ${version}\n`)
}

function verify(rawVersion) {
  const version = safeVersion(rawVersion, 'verify')
  const state = readState()
  const tree = stagedTrees(state)[version]
  if (tree === undefined) fail(`${version} is not staged`)
  process.stdout.write(`verifying ${version}\n`)
  let ok = false
  let output = ''
  try {
    output = execFileSync('bash', [join(HARNESS, 'test.sh'), '--install', tree.nodeModules, '--dsh-bin', tree.bin], {
      encoding: 'utf8',
      timeout: 900000,
      env: { ...process.env, BLOCKFIRE_COMPAT_CANDIDATE: version },
    })
    ok = true
  } catch (error) {
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`
  }

  const usedModules = /^ {2}install modules: (.+)$/m.exec(output)?.[1]?.trim()
  if (ok && usedModules !== undefined) {
    try { ok = realpathSync(usedModules) === realpathSync(tree.nodeModules) } catch { ok = false }
    if (!ok) output += `\nverify: suite did not run against ${tree.nodeModules}\n`
  } else if (ok) {
    ok = false
    output += '\nverify: suite did not report its node_modules; verdict refused\n'
  }

  state.verified = {
    ...(state.verified ?? {}),
    [version]: { ok, at: new Date().toISOString(), tail: output.trim().split('\n').slice(-40).join('\n') },
  }
  writeState(state)
  process.stdout.write(`${output}\n${ok ? 'PASS' : 'FAIL'} ${version}\n`)
  process.exit(ok ? 0 : 1)
}

function activate(rawVersion) {
  const version = safeVersion(rawVersion, 'activate')
  const state = readState()
  const tree = stagedTrees(state)[version]
  if (tree === undefined) fail(`${version} is not staged`)
  if (state.verified?.[version]?.ok !== true && !force) fail(`${version} has not passed verification`)
  const current = activeTree(state)
  state.previous = current ?? undefined
  state.active = tree
  writeState(state)
  process.stdout.write(`active -> ${version}\nrestart BLOCKFIRE to use it\n`)
}

function rollback() {
  const state = readState()
  if (state.previous === undefined) fail('nothing to roll back to')
  const target = describeInstall(state.previous.nodeModules ?? state.previous.bin, 'rollback')
  if (target === undefined) fail('rollback target no longer exists')
  const current = activeTree(state)
  state.previous = current ?? undefined
  state.active = target
  writeState(state)
  process.stdout.write(`rolled back -> ${target.version}\nrestart BLOCKFIRE to use it\n`)
}

function printStatus(value) {
  const running = value.runningInstall
  process.stdout.write(`running                  ${running ? `${running.version} (${running.sourceLabel ?? running.source ?? 'unknown'})` : 'unknown'}\n`)
  process.stdout.write(`next launch              ${value.active?.version ?? 'resolver default'}\n`)
  process.stdout.write(`pin                      ${value.pinned?.version ?? '(none)'}\n`)
  if (value.pinStale) process.stdout.write('WARNING                  active pin is stale; resolver default will be used\n')
  process.stdout.write(`rollback                 ${value.previous?.version ?? '(none)'}\n`)
  const staged = Object.keys(value.staged)
  process.stdout.write(`staged                   ${staged.length ? staged.join(', ') : '(none)'}\n`)
}

function printCheck(value) {
  process.stdout.write(`current ${value.installed}\n`)
  for (const channel of value.channels) process.stdout.write(`${channel.channel.padEnd(10)} ${channel.version}\n`)
  process.stdout.write(value.newer.length === 0 ? 'up to date\n' : `newer ${value.newer.map((entry) => entry.version).join(', ')}\n`)
}

switch (command) {
  case 'status': {
    const value = status()
    process.stdout.write(asJson ? `${JSON.stringify(value, undefined, 2)}\n` : '')
    if (!asJson) printStatus(value)
    break
  }
  case 'check': {
    const value = await check()
    process.stdout.write(asJson ? `${JSON.stringify(value, undefined, 2)}\n` : '')
    if (!asJson) printCheck(value)
    break
  }
  case 'stage': stage(operand); break
  case 'verify': verify(operand); break
  case 'activate': activate(operand); break
  case 'rollback': rollback(); break
  default: fail(`unknown command "${command}"`)
}
