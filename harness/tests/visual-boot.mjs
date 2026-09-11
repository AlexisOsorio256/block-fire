#!/usr/bin/env node
/**
 * Isolated visual-verification boot: real Web host + repo presets + a synthetic
 * BUILD session whose log events mirror the shapes a real session emits, so the
 * browser renders the stats strip with figures. Prints the authenticated URL,
 * then stays alive until SIGINT/SIGTERM. Nothing here reads live credentials or
 * touches the user's DSH_HOME.
 */
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, cpSync, symlinkSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const harness = fileURLToPath(new URL('../', import.meta.url))
const repo = resolve(harness, '..')
// NOTE: resolution runs BEFORE DSH_HOME is redirected to the temp home below,
// so it follows the REAL install's ACTIVE pin. Pin this boot explicitly with:
//   BLOCKFIRE_DSH_BIN=<bin> BLOCKFIRE_INSTALL_MODULES=<modules> node tests/visual-boot.mjs
const runtime = await import(pathToFileURL(join(harness, 'lib/runtime.mjs')).href).then(m => m.resolveRuntime())
if (!runtime.ok) throw new Error(runtime.error)
const modules = runtime.nodeModules
const require = createRequire(join(modules, 'blockfire-visual.cjs'))
const fromRuntime = async name => import(pathToFileURL(require.resolve(name)))

const home = mkdtempSync(join(tmpdir(), 'blockfire-visual-'))
const previousHome = process.env.DSH_HOME
const previousTelemetry = process.env.DSH_TELEMETRY_DISABLED
process.env.DSH_HOME = home
process.env.DSH_TELEMETRY_DISABLED = '1'
let ctx
let cleaned = false

function restoreEnvironment() {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  if (previousTelemetry === undefined) delete process.env.DSH_TELEMETRY_DISABLED
  else process.env.DSH_TELEMETRY_DISABLED = previousTelemetry
}

async function cleanup() {
  if (cleaned) return
  cleaned = true
  try { await ctx?.fiber.dispose() } catch {}
  restoreEnvironment()
  rmSync(home, { recursive: true, force: true })
}

try {
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
      // against a hermetic updater fixture instead of the real one.
      if (process.env.BF_UPDATE_FAKE_REPO) row.config = { repoRoot: process.env.BF_UPDATE_FAKE_REPO }
    }
  }
  const requestedPort = Number(process.env.BF_VISUAL_PORT ?? '0')
  const visualPort = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535 ? requestedPort : 0
  const patches = [
    ...load(join(modules, '@deepseek-ai/dsh-base/cordis.patch.yml')),
    ...load(join(modules, '@deepseek-ai/dsh-web-app/cordis.patch.yml')),
    ...ownPatch,
    { id: 'agent-presets', config: { default: 'build', includeShippedRoot: false,
      includeUserRoot: false, roots: [{ path: join(home, 'presets'), trust: 'user' }] } },
    { id: 'session-telemetry-otel', disabled: true },
    { id: 'webserver', config: { host: '127.0.0.1', port: visualPort } },
    { id: 'web-runtime', config: { openBrowser: false, printUrl: true, surfaceContext: true } },
  ]

  ctx = await boot('blockfire-visual', join(home, 'cordis.yml'), patches,
    host => provideCmdline(host, { args: ['--no-open'], exit: code => { throw new Error(`unexpected exit ${code}`) } }),
    pathToFileURL(`${modules}/`).href)

  // ── synthetic session with real event shapes (skippable for clean runs) ───
  const measureDir = process.env.BF_MEASURE_DIR
  if (measureDir !== undefined || process.env.BF_SKIP_FIXTURE !== '1') {
    await ctx.workspaceRegistry.create(measureDir ?? repo, 'BlockFire')
  }
  if (process.env.BF_SKIP_FIXTURE !== '1') {
    // The prefixed shape the current runtime issues (workspace registry, log
    // dirs and projection cache all key on it) — delete must accept it.
    const sessionId = 'session-0b5e5ee1-7a70-4a12-9a3c-3f01c5a4b9a1'
    const persistence = ctx.get('sessionPersistence')
    const now = Date.now()
    const { SESSION_FORMAT_VERSION } = await fromRuntime('@deepseek-ai/dsh-session')
    const meta = { version: SESSION_FORMAT_VERSION, id: sessionId, cwd: repo, createdAt: now, isSeeded: false, agentPreset: 'build', delegationDepth: 0 }
    const fixtureHandle = await persistence.create(meta)
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
    console.log('visual boot session title: Revisa el estado real')
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
      void query
    } catch (error) {
      console.log('visual diagnostics failed:', String(error && error.stack ? error.stack : error))
    }
  }, 5000)

  // Keep the visual host alive until the driver/user terminates it gracefully.
  await new Promise((resolveStop) => {
    process.once('SIGINT', resolveStop)
    process.once('SIGTERM', resolveStop)
  })
} finally {
  await cleanup()
}
