#!/usr/bin/env node
/**
 * BLOCKFIRE Harness — the ONE DSH runtime resolver.
 *
 * WHY THIS EXISTS
 * The layer needs two answers about DSH at the same time: which binary to boot,
 * and which node_modules the optional bridges (Blender MCP and the other
 * capability packages) resolve against. Every consumer used to answer that on
 * its own with `command -v dsh`, which is wrong on the machine this layer is
 * built for: DSH is normally started with `npx @deepseek-ai/dsh`, so `dsh` is on
 * PATH only inside that npx process — never in a fresh shell.
 *
 * So the resolution lives here and nowhere else:
 *
 *   harness/bin/blockfire   (launcher)      -> harness/lib/runtime.sh
 *   harness/install.sh      (install/sync)  -> harness/lib/runtime.sh
 *   harness/test.sh         (compat suite)  -> harness/lib/runtime.sh
 *   harness/bin/update.mjs  (update center) -> imports this module
 *
 * ORDER — first valid candidate wins. A candidate is valid only when its
 * node_modules really contains @deepseek-ai/dsh with a version and a runnable
 * bin; anything else is reported and skipped:
 *
 *   1. override          BLOCKFIRE_DSH_BIN / BLOCKFIRE_INSTALL_MODULES
 *                        (+ DSH_BIN / DSH_INSTALL_MODULES / BLOCKFIRE_DSH_MODULES).
 *                        Authoritative: if one is set and invalid, resolution
 *                        FAILS instead of silently using another tree.
 *   2. active-pin        $DSH_HOME/.blockfire-harness/state.json `active`
 *                        (what `update.mjs activate` switched the launcher to)
 *   3. path              `dsh` on the current PATH, then on a login shell PATH
 *   4. local             node_modules walking up from the repo and the cwd
 *   5. global            the Node prefix's node_modules, then `npm root -g`
 *   6. npx-cache         <npm cache>/_npx/<hash>/node_modules (how this machine
 *                        normally has DSH at all)
 *   7. staged            state.json `staged` trees, verified ones first — last
 *                        resort, so a machine whose only DSH is a staged tree
 *                        still boots instead of claiming there is no runtime
 *
 * CLI:
 *   node harness/lib/runtime.mjs                 human summary
 *   node harness/lib/runtime.mjs --json          machine readable
 *   node harness/lib/runtime.mjs --shell         KEY='value' lines, for `eval`
 *   node harness/lib/runtime.mjs --field bin     one value (bin|nodeModules|
 *                                                version|source|sourceLabel)
 *   node harness/lib/runtime.mjs --verbose       diagnostics on stderr
 *   exit 0 = resolved, 3 = not resolved
 */

import { execFileSync } from 'node:child_process'
import { accessSync, constants, existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACKAGE = '@deepseek-ai/dsh'

/** Human labels for the source a runtime was resolved from. */
export const SOURCE_LABELS = {
	override: 'explicit override',
	'active-pin': 'BLOCKFIRE active runtime',
	path: 'dsh on PATH',
	local: 'local node_modules',
	global: 'global node_modules',
	'npx-cache': 'npx cache',
	staged: 'BLOCKFIRE staged candidate',
}

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const REPO = resolve(HARNESS, '..')

// `... | head` closes the pipe early; that is not an error worth a stack trace.
process.stdout.on('error', (error) => {
	if (error?.code === 'EPIPE') process.exit(0)
})

// ── tiny fs helpers ─────────────────────────────────────────────────────────

function nonEmpty(value) {
	return typeof value === 'string' && value !== ''
}

function readJsonFile(path) {
	try {
		return JSON.parse(readFileSync(path, 'utf8'))
	} catch {
		return undefined
	}
}

function isDirectory(path) {
	try {
		return statSync(path).isDirectory()
	} catch {
		return false
	}
}

function isFile(path) {
	try {
		return statSync(path).isFile()
	} catch {
		return false
	}
}

function isExecutable(path) {
	try {
		accessSync(path, constants.X_OK)
		return isFile(path)
	} catch {
		return false
	}
}

function realOr(path) {
	try {
		return realpathSync(path)
	} catch {
		return path
	}
}

// ── install description ─────────────────────────────────────────────────────

/**
 * The `node_modules` directory a path belongs to: the directory itself when it
 * is one, the enclosing one when it is a bin, and the nested one when it is a
 * tree prefix. Symlinks are resolved, so a preset's bridge link lands on the
 * real install.
 */
export function modulesRootOf(path) {
	if (!nonEmpty(path) || !existsSync(path)) return undefined
	const start = realOr(path)
	if (isFile(start)) {
		let dir = dirname(start)
		while (true) {
			if (basename(dir) === 'node_modules') return dir
			const parent = dirname(dir)
			if (parent === dir) return undefined
			dir = parent
		}
	}
	if (basename(start) === 'node_modules') return start
	const nested = join(start, 'node_modules')
	if (existsSync(join(nested, PACKAGE, 'package.json'))) return realOr(nested)
	if (existsSync(join(start, PACKAGE, 'package.json'))) return start
	return undefined
}

/** The JS entry DSH is booted with (`node <bin>`), or undefined. */
function binOf(nodeModules, packageDir, manifest) {
	const declared = typeof manifest.bin === 'string'
		? manifest.bin
		: (manifest.bin !== null && typeof manifest.bin === 'object' ? manifest.bin.dsh : undefined)
	const tries = []
	if (nonEmpty(declared)) tries.push(join(packageDir, declared))
	tries.push(join(packageDir, 'lib', 'bin.js'))
	const link = join(nodeModules, '.bin', 'dsh')
	if (existsSync(link)) tries.push(realOr(link))
	for (const candidate of tries) {
		if (isFile(candidate)) return realOr(candidate)
	}
	return undefined
}

/**
 * Describe a candidate as a DSH install, or undefined when it is not one.
 * `source` is the resolver source name (see SOURCE_LABELS).
 */
export function describeInstall(candidate, source = 'override') {
	const nodeModules = modulesRootOf(candidate)
	if (nodeModules === undefined) return undefined
	const packageDir = join(nodeModules, PACKAGE)
	const manifest = readJsonFile(join(packageDir, 'package.json'))
	if (manifest === undefined || !nonEmpty(manifest.version)) return undefined
	const bin = binOf(nodeModules, packageDir, manifest)
	if (bin === undefined) return undefined
	return { package: PACKAGE, version: manifest.version, bin, nodeModules, source }
}

/** `x.y.z(-tag.n)` ordering; a release outranks its own prereleases. */
export function compareVersions(left, right) {
	const parse = (value) => {
		const match = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z]+)\.(\d+))?$/.exec(value)
		if (match === null) return { numbers: [0, 0, 0], tag: 0, pre: 0 }
		const rank = { alpha: 1, beta: 2, rc: 3 }
		return {
			numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
			tag: match[4] === undefined ? 9 : (rank[match[4]] ?? 4),
			pre: match[5] === undefined ? 0 : Number(match[5]),
		}
	}
	const a = parse(left)
	const b = parse(right)
	for (let index = 0; index < 3; index += 1) {
		if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] - b.numbers[index]
	}
	if (a.tag !== b.tag) return a.tag - b.tag
	return a.pre - b.pre
}

// ── state file ──────────────────────────────────────────────────────────────

export function dshHome(env = process.env) {
	return nonEmpty(env.DSH_HOME) ? env.DSH_HOME : join(homedir(), '.dsh')
}

export function stateFile(env = process.env) {
	return join(dshHome(env), '.blockfire-harness', 'state.json')
}

export function readState(env = process.env) {
	const state = readJsonFile(stateFile(env))
	return state !== null && typeof state === 'object' ? state : {}
}

// ── candidate sources (each returns [{candidate, source, label}]) ───────────

function entry(candidate, source, label) {
	return { candidate, source, label: label ?? SOURCE_LABELS[source] ?? source }
}

/** 1. Explicit override — authoritative, never a silent fallback. */
function overrideEntries(env) {
	const entries = []
	for (const key of ['BLOCKFIRE_DSH_BIN', 'DSH_BIN']) {
		if (nonEmpty(env[key])) entries.push(entry(env[key], 'override', `${key} (explicit)`))
	}
	for (const key of ['BLOCKFIRE_INSTALL_MODULES', 'DSH_INSTALL_MODULES', 'BLOCKFIRE_DSH_MODULES']) {
		if (nonEmpty(env[key])) entries.push(entry(env[key], 'override', `${key} (explicit)`))
	}
	return entries
}

/** 2. The tree `update.mjs activate` pinned. */
function activePinEntries(env, diagnostics) {
	const active = readState(env).active
	if (active === null || active === undefined || typeof active !== 'object') return []
	const version = nonEmpty(active.version) ? active.version : 'unknown'
	const label = `BLOCKFIRE active runtime ${version}`
	const entries = []
	if (nonEmpty(active.nodeModules)) entries.push(entry(active.nodeModules, 'active-pin', label))
	if (nonEmpty(active.bin)) entries.push(entry(active.bin, 'active-pin', label))
	if (entries.length === 0) diagnostics.push('the active pin in state.json has neither nodeModules nor bin')
	return entries
}

/** 3. `dsh` on PATH. */
function pathEntries(env, diagnostics) {
	const direct = whichInPath('dsh', env)
	if (direct !== undefined) return [entry(direct, 'path', 'dsh on PATH')]
	const login = whichInLoginShell('dsh', env)
	if (login !== undefined) return [entry(login, 'path', 'dsh on PATH (login shell)')]
	diagnostics.push('no dsh on PATH (normal for `npx @deepseek-ai/dsh`; other sources are checked next)')
	return []
}

function whichInPath(name, env) {
	const path = nonEmpty(env.PATH) ? env.PATH : ''
	for (const dir of path.split(':')) {
		if (dir === '') continue
		const candidate = join(dir, name)
		if (isExecutable(candidate)) return candidate
	}
	return undefined
}

function whichInLoginShell(name, env) {
	try {
		const output = execFileSync('bash', ['-lc', `command -v ${name}`], {
			encoding: 'utf8',
			timeout: 15000,
			env,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const lines = output.split('\n').map((line) => line.trim()).filter((line) => line !== '')
		const last = lines[lines.length - 1]
		return last !== undefined && isFile(last) ? last : undefined
	} catch {
		return undefined
	}
}

/** 4. node_modules from the repo/cwd upward (a project-local DSH install). */
function localEntries(env, options) {
	const starts = [options.repo ?? REPO, nonEmpty(env.PWD) ? env.PWD : process.cwd()]
	const seen = new Set()
	const entries = []
	for (const start of starts) {
		let dir = resolve(start)
		while (true) {
			const modules = join(dir, 'node_modules')
			if (!seen.has(modules) && existsSync(join(modules, PACKAGE, 'package.json'))) {
				seen.add(modules)
				entries.push(entry(modules, 'local', `local node_modules (${dir})`))
			}
			const parent = dirname(dir)
			if (parent === dir) break
			dir = parent
		}
	}
	return entries
}

/** 5. Global install: the running Node prefix, then `npm root -g`. */
function globalEntries(env, diagnostics) {
	const roots = []
	const execDir = dirname(process.execPath)
	roots.push(process.platform === 'win32' ? join(execDir, 'node_modules') : join(dirname(execDir), 'lib', 'node_modules'))
	if (nonEmpty(env.npm_config_prefix)) roots.push(join(env.npm_config_prefix, 'lib', 'node_modules'))
	const entries = []
	for (const root of roots) {
		if (existsSync(join(root, PACKAGE, 'package.json'))) entries.push(entry(root, 'global', `global node_modules (${root})`))
	}
	if (entries.length === 0) {
		const npmRoot = runNpm(['root', '-g'], env)
		if (nonEmpty(npmRoot) && existsSync(join(npmRoot, PACKAGE, 'package.json'))) {
			entries.push(entry(npmRoot, 'global', `global node_modules (${npmRoot})`))
		}
	}
	if (entries.length === 0) diagnostics.push('no global install (node prefix and `npm root -g`)')
	return entries
}

function runNpm(args, env) {
	try {
		const output = execFileSync('npm', args, {
			encoding: 'utf8',
			timeout: 30000,
			env,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		const lines = output.split('\n').map((line) => line.trim()).filter((line) => line !== '')
		return lines[lines.length - 1]
	} catch {
		return undefined
	}
}

/**
 * 6. npx cache. `npx @deepseek-ai/dsh` unpacks into <cache>/_npx/<hash>/; this
 * is where DSH normally lives on a machine that never installed it globally.
 * Deterministic pick: highest version, then lexicographically smallest hash, so
 * `install.sh --check` does not flap when several trees share a version.
 */
function npxCacheEntries(env, diagnostics) {
	const cache = nonEmpty(env.npm_config_cache)
		? env.npm_config_cache
		: (runNpm(['config', 'get', 'cache'], env) ?? join(homedir(), '.npm'))
	const base = join(cache, '_npx')
	if (!isDirectory(base)) {
		diagnostics.push(`no npx cache at ${base}`)
		return []
	}
	let hashed
	try {
		hashed = readdirSync(base, { withFileTypes: true })
	} catch {
		diagnostics.push(`npx cache at ${base} is unreadable`)
		return []
	}
	const entries = []
	for (const item of hashed) {
		if (!item.isDirectory()) continue
		const modules = join(base, item.name, 'node_modules')
		if (!existsSync(join(modules, PACKAGE, 'package.json'))) continue
		const tree = describeInstall(modules, 'npx-cache')
		entries.push({ ...entry(modules, 'npx-cache', `npx cache (${item.name})`), version: tree?.version })
	}
	entries.sort((a, b) => compareVersions(b.version ?? '', a.version ?? '') || a.candidate.localeCompare(b.candidate))
	if (entries.length === 0) diagnostics.push(`no DSH in the npx cache at ${base}`)
	return entries
}

/**
 * 7. Trees the Update Center staged but never activated — last resort only.
 * Verified candidates first, then highest version.
 */
function stagedEntries(env, diagnostics) {
	const state = readState(env)
	const staged = state.staged
	if (staged === null || staged === undefined || typeof staged !== 'object') return []
	const verified = state.verified ?? {}
	const entries = []
	for (const [version, tree] of Object.entries(staged)) {
		if (tree === null || tree === undefined || typeof tree !== 'object') continue
		const candidate = nonEmpty(tree.nodeModules) ? tree.nodeModules : tree.bin
		if (!nonEmpty(candidate)) continue
		const passed = verified[version]?.ok === true
		entries.push({
			...entry(candidate, 'staged', `staged candidate ${version}${passed ? ' (verified)' : ''}`),
			version,
			verified: passed,
		})
	}
	entries.sort((a, b) => Number(b.verified) - Number(a.verified) || compareVersions(b.version ?? '', a.version ?? '') || a.candidate.localeCompare(b.candidate))
	if (entries.length === 0) diagnostics.push('no staged candidate in state.json')
	return entries
}

// ── the resolver ────────────────────────────────────────────────────────────

function describeAll(entries) {
	return entries.map((item) => {
		const tree = describeInstall(item.candidate, item.source)
		if (tree === undefined) return { ...item, ok: false }
		return { ...item, ...tree, ok: true, label: item.label }
	})
}

function resolved(winner) {
	return {
		ok: true,
		package: winner.package,
		version: winner.version,
		bin: winner.bin,
		nodeModules: winner.nodeModules,
		source: winner.source,
		sourceLabel: winner.label ?? SOURCE_LABELS[winner.source] ?? winner.source,
	}
}

/**
 * Resolve the DSH runtime this machine should use.
 *
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]  environment to read (default process.env)
 * @param {string} [options.repo]            repo root for the local-node_modules probe
 * @param {string[]} [options.skip]          source names to leave out, e.g.
 *                                           ['active-pin', 'staged'] to describe
 *                                           only what a plain `dsh` would be
 * @returns {{ok: boolean, bin?: string, nodeModules?: string, version?: string,
 *            source?: string, sourceLabel?: string, overridden?: boolean,
 *            error?: string, candidates: object[], diagnostics: string[]}}
 */
export function resolveRuntime(options = {}) {
	const env = options.env ?? process.env
	const skip = new Set(options.skip ?? [])
	const diagnostics = []
	const candidates = []

	const overrides = overrideEntries(env)
	if (overrides.length > 0) {
		const described = describeAll(overrides)
		candidates.push(...described)
		const winner = described.find((item) => item.ok === true)
		if (winner === undefined) {
			return {
				ok: false,
				error: `explicit DSH runtime override is not a valid install: ${described.map((item) => `${item.label} -> ${item.candidate}`).join(', ')}`,
				candidates,
				diagnostics,
			}
		}
		return { ...resolved(winner), overridden: true, candidates, diagnostics }
	}

	const groups = [
		['active-pin', () => activePinEntries(env, diagnostics)],
		['path', () => pathEntries(env, diagnostics)],
		['local', () => localEntries(env, options)],
		['global', () => globalEntries(env, diagnostics)],
		['npx-cache', () => npxCacheEntries(env, diagnostics)],
		['staged', () => stagedEntries(env, diagnostics)],
	]

	for (const [name, collect] of groups) {
		if (skip.has(name)) continue
		const described = describeAll(collect())
		candidates.push(...described)
		const winner = described.find((item) => item.ok === true)
		if (winner !== undefined) return { ...resolved(winner), overridden: false, candidates, diagnostics }
		if (described.length > 0) diagnostics.push(`${described[0].label}: not a valid DSH install (${described[0].candidate})`)
	}

	return { ok: false, error: 'no DSH runtime found', candidates, diagnostics }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function printCandidates(result) {
	if (result.candidates.length === 0) return
	process.stdout.write('candidates\n')
	const shown = result.candidates.slice(0, 12)
	for (const item of shown) {
		const state = item.ok === true ? 'ok  ' : 'bad '
		const version = nonEmpty(item.version) ? item.version : '-'
		process.stdout.write(`  ${state} ${String(item.source).padEnd(10)} ${version.padEnd(14)} ${item.candidate}\n`)
	}
	if (result.candidates.length > shown.length) {
		process.stdout.write(`  ... ${result.candidates.length - shown.length} more\n`)
	}
}

function printDiagnostics(result) {
	if (result.diagnostics.length === 0) return
	process.stdout.write('diagnostics\n')
	for (const line of result.diagnostics) process.stdout.write(`  ${line}\n`)
}

function printSummary(result) {
	if (result.ok !== true) {
		process.stdout.write(`DSH runtime       <not found> — ${result.error}\n`)
		printCandidates(result)
		printDiagnostics(result)
		return
	}
	process.stdout.write(`DSH runtime       ${result.version}\n`)
	process.stdout.write(`binary            ${result.bin}\n`)
	process.stdout.write(`node_modules      ${result.nodeModules}\n`)
	process.stdout.write(`resolved from     ${result.sourceLabel}\n`)
	if (result.overridden === true) process.stdout.write('override          yes (explicit environment)\n')
	printCandidates(result)
	printDiagnostics(result)
}

/** Single-quote a value for `eval` in bash. */
function shellQuote(value) {
	return `'${String(value ?? '').replaceAll("'", "'\\''")}'`
}

function shellOutput(result) {
	const values = {
		BLOCKFIRE_RUNTIME_OK: result.ok === true ? '1' : '0',
		BLOCKFIRE_DSH_BIN: result.bin,
		BLOCKFIRE_INSTALL_MODULES: result.nodeModules,
		BLOCKFIRE_RUNTIME_VERSION: result.version,
		BLOCKFIRE_RUNTIME_SOURCE: result.source,
		BLOCKFIRE_RUNTIME_SOURCE_LABEL: result.sourceLabel,
		BLOCKFIRE_RUNTIME_ERROR: result.error,
	}
	return Object.entries(values).map(([key, value]) => `${key}=${shellQuote(value)}`).join('\n')
}

function main(argv) {
	const asJson = argv.includes('--json')
	const asShell = argv.includes('--shell')
	const verbose = argv.includes('--verbose')
	const fieldIndex = argv.indexOf('--field')
	const field = fieldIndex >= 0 ? argv[fieldIndex + 1] : undefined
	const result = resolveRuntime()

	if (verbose) {
		for (const line of result.diagnostics) process.stderr.write(`runtime: ${line}\n`)
	}
	if (asShell) {
		process.stdout.write(`${shellOutput(result)}\n`)
		if (result.ok !== true) process.stderr.write(`runtime: ${result.error}\n`)
		return result.ok === true ? 0 : 3
	}
	if (asJson) {
		process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`)
		return result.ok === true ? 0 : 3
	}
	if (field !== undefined) {
		const value = result[field]
		if (!nonEmpty(value)) {
			process.stderr.write(`runtime: no value for --field ${field}${result.error === undefined ? '' : ` (${result.error})`}\n`)
			return 3
		}
		process.stdout.write(`${value}\n`)
		return 0
	}
	printSummary(result)
	return result.ok === true ? 0 : 3
}

const invokedDirectly = process.argv[1] !== undefined
	&& realOr(process.argv[1]) === realOr(fileURLToPath(import.meta.url))

if (invokedDirectly) {
	process.exitCode = main(process.argv.slice(2))
}
