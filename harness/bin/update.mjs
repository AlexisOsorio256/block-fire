#!/usr/bin/env node
/**
 * BLOCKFIRE Update Center — detect, stage, verify, switch, roll back.
 *
 * WHY THIS EXISTS
 * Freezing DSH forever is wrong (the layer is a thin boundary, not a fork) and
 * updating blindly is wrong (the layer's composition, tool surface and metrics
 * all depend on upstream shapes). This tool makes the update a STAGED, VERIFIED,
 * REVERSIBLE operation:
 *
 *   1. `check`    — what is installed, what exists upstream, what changed.
 *   2. `stage`    — install the candidate into an isolated tree. The running
 *                   installation is never touched.
 *   3. `verify`   — run the BLOCKFIRE compatibility suite against that tree.
 *   4. `activate` — point the launcher at it. The previous tree is kept.
 *   5. `rollback` — point the launcher back.
 *
 * NO FAKE ATOMICITY: the switch is a single state file write, and it takes
 * effect on the NEXT launch. The process that is running keeps running whatever
 * it booted with. That is the honest guarantee this V1 can make.
 *
 * WHICH DSH TREES EXIST is not decided here. `installed` and the ACTIVE pin come
 * from harness/lib/runtime.mjs, the one resolver shared with the launcher,
 * install.sh and test.sh — a second copy of the discovery rules is exactly the
 * bug that used to make `harness/bin/blockfire` claim there was no runtime.
 *
 *   node harness/bin/update.mjs status [--json]
 *   node harness/bin/update.mjs check [--json]
 *   node harness/bin/update.mjs stage <version>
 *   node harness/bin/update.mjs verify <version>
 *   node harness/bin/update.mjs activate <version> [--force]
 *   node harness/bin/update.mjs rollback
 *
 * State: $DSH_HOME/.blockfire-harness/state.json  (never inside the repo)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PACKAGE, compareVersions, describeInstall, resolveRuntime } from '../lib/runtime.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const REPO = resolve(HARNESS, '..')
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const STATE_DIR = join(DSH_HOME, '.blockfire-harness')
const STATE_FILE = join(STATE_DIR, 'state.json')
const STAGING_DIR = join(STATE_DIR, 'staging')
const RELEASES_URL = 'https://api.github.com/repos/deepseek-ai/deepseek-harness/releases'

// `... | head` closes the pipe early; that is not an error worth a stack trace.
process.stdout.on('error', (error) => {
  if (error?.code === 'EPIPE') process.exit(0)
})

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const force = argv.includes('--force')
const command = argv.find((arg) => !arg.startsWith('--')) ?? 'status'
const operand = argv.filter((arg) => !arg.startsWith('--'))[1]

function fail(message) {
  process.stderr.write(`update: ${message}\n`)
  process.exit(2)
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { active: undefined, previous: undefined, staged: {}, lastCheck: undefined }
  }
}

function writeState(state) {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(state, undefined, 2)}\n`)
}

function readJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** The tree the launcher is pinned to by `activate`, or undefined. */
function pinnedTree(state) {
  const active = state.active
  if (active === null || active === undefined || typeof active !== 'object') return undefined
  return describeInstall(active.nodeModules ?? active.bin, 'active-pin')
}

/**
 * What a plain `dsh` on this machine resolves to: the shared resolver without
 * the BLOCKFIRE-managed sources. PATH alone would miss the npx cache, which is
 * where DSH normally lives here.
 */
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

function npmView(args) {
  return execFileSync('npm', ['view', PACKAGE, ...args], { encoding: 'utf8', timeout: 120000 }).trim()
}

function npmJson(args) {
  const text = npmView([...args, '--json'])
  return readJson(text)
}

async function releaseNotes() {
  try {
    const response = await fetch(`${RELEASES_URL}?per_page=15`, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'blockfire-harness' },
    })
    if (!response.ok) return []
    const releases = await response.json()
    return releases.map((release) => ({
      tag: String(release.tag_name ?? ''),
      name: String(release.name ?? ''),
      url: String(release.html_url ?? ''),
      publishedAt: String(release.published_at ?? ''),
      body: String(release.body ?? '').slice(0, 4000),
    }))
  } catch {
    return []
  }
}

async function check() {
  const state = readState()
  const active = activeTree(state)
  const installed = active?.version ?? 'unknown'
  const distTags = npmJson(['dist-tags']) ?? {}
  const times = npmJson(['time']) ?? {}
  const versions = Object.keys(times)
    .filter((key) => key !== 'created' && key !== 'modified')
    .sort(compareVersions)
  // Newest first: the first entry is the natural Update target, and the Web
  // panel defaults its version picker to exactly this order.
  const newer = versions
    .filter((version) => installed === 'unknown' || compareVersions(version, installed) > 0)
    .sort((left, right) => compareVersions(right, left))
  const notes = await releaseNotes()
  const channels = Object.entries(distTags).map(([channel, version]) => {
    const release = notes.find((entry) => entry.tag === `dsh-v${String(version)}`)
    return {
      channel,
      version: String(version),
      publishedAt: times[String(version)] ?? undefined,
      notesUrl: release?.url,
      notes: release?.body === undefined ? undefined : release.body.split('\n').slice(0, 40).join('\n'),
    }
  })
  const checkResult = {
    package: PACKAGE,
    installed,
    activeBin: active?.bin,
    channels,
    newer: newer.map((version) => ({
      version,
      publishedAt: times[version],
      notesUrl: notes.find((entry) => entry.tag === `dsh-v${version}`)?.url,
    })),
    checkedAt: new Date().toISOString(),
  }
  state.lastCheck = checkResult
  writeState(state)
  return checkResult
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
  const active = activeTree(state)
  const installed = installedTree()
  const pinned = pinnedTree(state)
  return {
    package: PACKAGE,
    active: active ?? null,
    pinned: pinned ?? null,
    pinStale: state.active !== undefined && pinned === undefined,
    previous: state.previous ?? null,
    runningInstall: installed ?? null,
    staged: stagedTrees(state),
    verified: state.verified ?? {},
    lastCheck: state.lastCheck ?? null,
    stateFile: STATE_FILE,
    repo: REPO,
  }
}

function stage(version) {
  if (version === undefined) fail('stage needs a version, for example: update.mjs stage 0.1.5-alpha.2')
  const dir = join(STAGING_DIR, version)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  process.stdout.write(`staging ${PACKAGE}@${version} into ${dir}\n`)
  execFileSync('npm', ['install', '--prefix', dir, '--no-save', '--no-audit', '--no-fund', `${PACKAGE}@${version}`], {
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 900000,
  })
  const tree = describeInstall(join(dir, 'node_modules'), 'staged')
  if (tree === undefined) fail(`staged tree at ${dir} does not contain ${PACKAGE}`)
  const state = readState()
  state.staged = { ...(state.staged ?? {}), [version]: tree }
  writeState(state)
  process.stdout.write(`staged ${version} (bin: ${tree.bin})\nnext: node harness/bin/update.mjs verify ${version}\n`)
}

function verify(version) {
  if (version === undefined) fail('verify needs a version')
  const state = readState()
  const tree = stagedTrees(state)[version]
  if (tree === undefined) fail(`${version} is not staged — run: update.mjs stage ${version}`)
  process.stdout.write(`verifying ${version} against harness/test.sh\n`)
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
    ok = false
  }
  // The suite must have run against the CANDIDATE tree. A resolver regression
  // once made it quietly test the installed runtime instead, which would make
  // `verify` worthless, so the reported tree is cross-checked here.
  const usedModules = /^ {2}install modules: (.+)$/m.exec(output)?.[1]?.trim()
  if (ok && usedModules !== undefined) {
    let same = usedModules === tree.nodeModules
    try {
      same = realpathSync(usedModules) === realpathSync(tree.nodeModules)
    } catch {
      same = false
    }
    if (!same) {
      ok = false
      output = `${output}\nverify: the suite ran against ${usedModules}, not the staged tree ${tree.nodeModules}\n`
    }
  } else if (ok && usedModules === undefined) {
    ok = false
    output = `${output}\nverify: the suite did not report which node_modules it used — refusing to trust the verdict\n`
  }
  state.verified = {
    ...(state.verified ?? {}),
    // 40 lines, not 12: the FAIL line and its section header live at the top
    // of the tail, and re-running the whole suite just to see which check
    // failed is minutes of the same evidence.
    [version]: { ok, at: new Date().toISOString(), tail: output.trim().split('\n').slice(-40).join('\n') },
  }
  writeState(state)
  process.stdout.write(`${output}\n`)
  process.stdout.write(ok ? `verified ${version}: PASS\n` : `verified ${version}: FAIL — activation refused unless --force\n`)
  process.exit(ok ? 0 : 1)
}

function activate(version) {
  if (version === undefined) fail('activate needs a version')
  const state = readState()
  const tree = stagedTrees(state)[version]
  if (tree === undefined) fail(`${version} is not staged — run: update.mjs stage ${version}`)
  const verdict = state.verified?.[version]
  if (verdict?.ok !== true && !force) {
    fail(`${version} has not passed the compatibility suite — run: update.mjs verify ${version} (or --force)`)
  }
  const current = activeTree(state)
  state.previous = current ?? undefined
  state.active = tree
  writeState(state)
  process.stdout.write(`active -> ${version} (${tree.bin})\n`)
  if (current !== undefined) process.stdout.write(`previous kept -> ${current.version} (${current.bin})\n`)
  process.stdout.write('takes effect on the next launch; the running process is untouched\n')
}

function rollback() {
  const state = readState()
  if (state.previous === undefined) fail('nothing to roll back to')
  const current = activeTree(state)
  const target = state.previous
  state.previous = current ?? undefined
  state.active = target
  writeState(state)
  process.stdout.write(`rolled back -> ${target.version} (${target.bin})\n`)
  process.stdout.write('takes effect on the next launch\n')
}

function printStatus(value) {
  const installed = value.runningInstall
  process.stdout.write(`installed (resolver)     ${installed === null ? 'unknown' : `${installed.version} (${installed.sourceLabel ?? installed.source ?? 'unknown'})`}\n`)
  process.stdout.write(`launcher pin (active)    ${value.active?.version ?? '(none: resolver default)'}\n`)
  if (value.pinStale === true) {
    process.stdout.write('WARNING                  the active pin in state.json no longer resolves; the resolver default is used\n')
  }
  process.stdout.write(`previous (rollback)      ${value.previous?.version ?? '(none)'}\n`)
  const staged = Object.keys(value.staged)
  process.stdout.write(`staged candidates        ${staged.length === 0 ? '(none)' : staged.join(', ')}\n`)
  for (const [version, verdict] of Object.entries(value.verified)) {
    process.stdout.write(`  verified ${version}        ${verdict.ok ? 'PASS' : 'FAIL'} (${verdict.at})\n`)
  }
  process.stdout.write(`state file               ${value.stateFile}\n`)
}

function printCheck(value) {
  process.stdout.write(`installed ${value.installed}\n`)
  process.stdout.write('channels\n')
  for (const channel of value.channels) {
    process.stdout.write(`  ${channel.channel.padEnd(8)} ${channel.version}  ${channel.publishedAt ?? ''}\n`)
    if (channel.notesUrl !== undefined) process.stdout.write(`           ${channel.notesUrl}\n`)
  }
  process.stdout.write(value.newer.length === 0 ? 'no newer version published\n' : 'newer versions\n')
  for (const entry of value.newer) {
    process.stdout.write(`  ${entry.version.padEnd(16)} ${entry.publishedAt ?? ''}${entry.notesUrl === undefined ? '' : `  ${entry.notesUrl}`}\n`)
  }
}

switch (command) {
  case 'status': {
    const value = status()
    if (asJson) process.stdout.write(`${JSON.stringify(value, undefined, 2)}\n`)
    else printStatus(value)
    break
  }
  case 'check': {
    const value = await check()
    if (asJson) process.stdout.write(`${JSON.stringify(value, undefined, 2)}\n`)
    else printCheck(value)
    break
  }
  case 'stage':
    stage(operand)
    break
  case 'verify':
    verify(operand)
    break
  case 'activate':
    activate(operand)
    break
  case 'rollback':
    rollback()
    break
  default:
    fail(`unknown command "${command}" — use status, check, stage, verify, activate or rollback`)
}
