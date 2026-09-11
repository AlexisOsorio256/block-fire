#!/usr/bin/env node
/**
 * Isolated visual-verification boot: real Web host + repo presets + a synthetic
 * BUILD session whose log events mirror the shapes a real session emits, so the
 * browser renders the stats strip with figures. Prints the authenticated URL,
 * then stays alive until killed. Nothing here touches the live DSH_HOME.
 */
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, cpSync, existsSync, symlinkSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const harness = fileURLToPath(new URL('../', import.meta.url))
const repo = resolve(harness, '..')
// NOTE: this resolution runs BEFORE DSH_HOME is redirected to the temp home
// below, so it follows the REAL install's ACTIVE pin — after an `activate`,
// boots here run the candidate. Pin this boot to another version explicitly:
//   BLOCKFIRE_DSH_BIN=<bin> BLOCKFIRE_INSTALL_MODULES=<modules> node tests/visual-boot.mjs
const runtime = await import(pathToFileURL(join(harness, 'lib/runtime.mjs')).href).then(m => m.resolveRuntime())
if (!runtime.ok) throw new Error(runtime.error)
const modules = runtime.nodeModules
const require = createRequire(join(modules, 'blockfire-visual.cjs'))
const fromRuntime = async name => import(pathToFileURL(require.resolve(name)))

const home = mkdtempSync(join(tmpdir(), 'blockfire-visual-'))
process.env.DSH_HOME = home
process.env.DSH_TELEMETRY_DISABLED = '1'
// Real credentials + model catalog so the page boots with a working model route.
for (const name of ['.credentials.yaml', 'settings.yaml']) {
  const source = join(process.env.HOME ?? '', '.dsh', name)
  if (existsSync(source)) cpSync(source, join(home, name))
}
symlinkSync(modules, join(home, 'node_modules'), 'dir')
cpSync(join(harness, 'presets'), join(home, 'presets'), { recursive: true })
for (const space of ['build', 'creator']) symlinkSync(modules, join(home, 'presets', space, 'node_modules'), 'dir')
mkdirSync(join(home, 'storages'), { recursive: true })

const { boot, loadOverlayPatches } = await fromRuntime('@deepseek-ai/dsh-app-boot')
const { provideCmdline } = await fromRuntime('@deepseek-ai/dsh-cmdline')
writeFileSync(join(home, 'cordis.yml'), '[]\n')
const load = file => loadOverlayPatches('blockfire-visual', file)
const ownPatch = load(join(harness, 'host/patch.cordis.yml'))
for (const patch of ownPatch) for (const row of patch.insert ?? []) {
  if (row.id === 'blockfire-guard') row.name = pathToFileURL(join(harness, 'host/guard.js')).href
  if (row.id === 'blockfire-update-center') {
    row.name = pathToFileURL(join(harness, 'web/lib/index.js')).href
    // BF_UPDATE_FAKE_REPO=<dir with harness/bin/update.mjs>: drive the panel
    // against a hermetic updater (fixture scripts) instead of the real one.
    if (process.env.BF_UPDATE_FAKE_REPO) row.config = { repoRoot: process.env.BF_UPDATE_FAKE_REPO }
  }
}
const patches = [
  ...load(join(modules, '@deepseek-ai/dsh-base/cordis.patch.yml')),
  ...load(join(modules, '@deepseek-ai/dsh-web-app/cordis.patch.yml')),
  ...ownPatch,
  { id: 'agent-presets', config: { default: 'build', includeShippedRoot: false,
    includeUserRoot: false, roots: [{ path: join(home, 'presets'), trust: 'user' }] } },
  { id: 'session-telemetry-otel', disabled: true },
  { id: 'webserver', config: { host: '127.0.0.1', port: 3081 } },
  { id: 'web-runtime', config: { openBrowser: false, printUrl: true, surfaceContext: true } },
]

const ctx = await boot('blockfire-visual', join(home, 'cordis.yml'), patches,
  host => provideCmdline(host, { args: ['--no-open'], exit: code => { throw new Error(`unexpected exit ${code}`) } }),
  pathToFileURL(`${modules}/`).href)

// ── synthetic session with real event shapes (skippable for clean runs) ─────
const measureDir = process.env.BF_MEASURE_DIR
if (measureDir !== undefined || process.env.BF_SKIP_FIXTURE !== '1') {
  await ctx.workspaceRegistry.create(measureDir ?? repo, 'BlockFire')
}
if (process.env.BF_SKIP_FIXTURE !== '1') {
// The prefixed shape the current runtime issues (workspace registry, log dirs
// and the projection cache all key on it) — the delete route must accept it.
const sessionId = 'session-0b5e5ee1-7a70-4a12-9a3c-3f01c5a4b9a1'
const persistence = ctx.get('sessionPersistence')
const now = Date.now()
// persistence.create takes the full stored header and returns its write
// handle; there is no service-level append. The version is read from the
// runtime itself so the fixture tracks upstream format bumps.
const { SESSION_FORMAT_VERSION } = await fromRuntime('@deepseek-ai/dsh-session')
const meta = { version: SESSION_FORMAT_VERSION, id: sessionId, cwd: repo, createdAt: now, isSeeded: false, agentPreset: 'build', delegationDepth: 0 }
const fixtureHandle = await persistence.create(meta)
// Real event shapes from a recorded BUILD session (first steps), rebased —
// guarantees the log passes the gateway's stored-session validation.
// Streaming fragments (`assistant/chunk`) are transient: the stored-log
// reader refuses them fail-closed, so they are never written.
const { readFileSync } = await import('node:fs')
const events = JSON.parse(readFileSync(join(harness, 'tests', 'fixtures', 'session-log-fragment.json'), 'utf8'))
  .filter((event) => event.type !== 'assistant/chunk')

await fixtureHandle.append(events.map((event, seq) => {
  const rebased = { ...event, seq }
  // The recorder captured the message before its settlement trace; the
  // gateway requires turn/step/stream at the seed boundary. The trace itself
  // is timing data with no visual meaning, so an empty settlement stands in.
  if (rebased.type === 'assistant/message' && !Array.isArray(rebased.data?.stream)) {
    rebased.data = { ...rebased.data, stream: [] }
  }
  return rebased
}))
await fixtureHandle.flush()
await fixtureHandle.close()
console.log('visual boot ready: session', sessionId)
console.log(`visual boot session title: Revisa el estado real`)

}

// Host-side diagnostics so the verification driver can see what the browser
// SHOULD list: registry accounting and the controller-visible session record.
setTimeout(async () => {
  try {
    const workspaces = ctx.workspaceRegistry.list().map(w => ({ id: String(w.id), path: w.path, sessions: [...w.sessionIds] }))
    const persistence = ctx.get('sessionPersistence')
    const headers = await persistence.list()
    console.log('visual diagnostics persistence.list:', JSON.stringify(headers.map(h => ({ id: (h.header ?? h).id }))))
    const query = await ctx.get('sessionQuery').listSessions()
    console.log('visual diagnostics workspaces:', JSON.stringify(workspaces))
    console.log('visual diagnostics sessions:', JSON.stringify(headers.map(h => ({ id: (h.header ?? h).id, cwd: (h.header ?? h).cwd, origin: (h.header ?? h).origin }))))
  } catch (error) {
    console.log('visual diagnostics failed:', String(error && error.stack ? error.stack : error))
  }
}, 5000)

// Keep the process alive; the verification driver kills it.
await new Promise(() => {})
