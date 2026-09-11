#!/usr/bin/env node
/**
 * BLOCKFIRE Harness — one isolated DSH host, for tests and context measurement.
 *
 * WHY THIS EXISTS
 * `harness/tests/mount.mjs` and `harness/bin/context-report.mjs` both need the
 * same expensive thing: a real Web host booted in a throwaway DSH_HOME, with the
 * repo's presets mounted and both spaces installed, but with NO model requests
 * and NO effect on the user's own `~/.dsh`. Keeping that boot sequence in one
 * place means a change to how a space is composed cannot silently make the test
 * and the measurement disagree about what the model is sent.
 *
 * The host boots with the same patch stack the launcher uses:
 *   1. upstream `dsh-base` and `dsh-web-app` patches,
 *   2. `harness/host/patch.cordis.yml` (guard + update center),
 *   3. test ownership of the composition: the repo presets as the only roster,
 *      telemetry off, an ephemeral webserver port and no browser.
 *
 * Callers get the booted context plus the paths it was built from, and may
 * inspect or extend the composition through `beforeBoot`.
 */

import { pathToFileURL } from 'node:url'
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveRuntime } from './runtime.mjs'

/**
 * Boot one isolated host and hand it to `run`.
 *
 * @param object options
 * @param function options.beforeBoot - `({ temporary, modules, profile }) => void`,
 *   runs after the throwaway tree exists and before DSH boots. This is where a
 *   caller adds fixture rows or extra patch files.
 * @param function options.run - `(host) => Promise<unknown>`; the host is
 *   disposed and the tree removed when it settles, whatever it returns.
 * @param string options.harness - harness root; defaults to this file's parent.
 * @returns whatever `run` returned.
 */
export async function withIsolatedHost(options, run) {
  const harness = options.harness
  const runtime = resolveRuntime()
  if (runtime.ok !== true) throw new Error(String(runtime.error ?? 'no DSH runtime resolved'))
  const modules = runtime.nodeModules
  const { createRequire } = await import('node:module')
  const require = createRequire(join(modules, 'blockfire-isolated-host.cjs'))
  const fromRuntime = async (name) => import(pathToFileURL(require.resolve(name)))

  const temporary = mkdtempSync(join(tmpdir(), 'blockfire-isolated-'))
  const previousHome = process.env.DSH_HOME
  const previousTelemetry = process.env.DSH_TELEMETRY_DISABLED
  process.env.DSH_HOME = temporary
  process.env.DSH_TELEMETRY_DISABLED = '1'
  let ctx
  try {
    const { boot, loadOverlayPatches } = await fromRuntime('@deepseek-ai/dsh-app-boot')
    const { provideCmdline } = await fromRuntime('@deepseek-ai/dsh-cmdline')
    writeFileSync(join(temporary, 'cordis.yml'), '[]\n')
    symlinkSync(modules, join(temporary, 'node_modules'), 'dir')
    // Match the installed Web profile: upstream's profile manifest has no
    // version, and the guard is loaded through this symlink rather than its
    // repo realpath.
    const profile = join(temporary, 'profile')
    mkdirSync(profile)
    writeFileSync(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', private: true }))
    symlinkSync(join(harness, 'host'), join(profile, 'blockfire'), 'dir')
    cpSync(join(harness, 'presets'), join(temporary, 'presets'), { recursive: true })
    for (const space of ['build', 'creator']) symlinkSync(modules, join(temporary, 'presets', space, 'node_modules'), 'dir')

    if (typeof options.beforeBoot === 'function') await options.beforeBoot({ temporary, modules, profile, harness })

    const load = (file) => loadOverlayPatches('blockfire-isolated', file)
    const ownPatch = load(join(harness, 'host/patch.cordis.yml'))
    for (const patch of ownPatch) for (const row of patch.insert ?? []) {
      if (row.id === 'blockfire-guard') row.name = pathToFileURL(join(profile, 'blockfire/guard.js')).href
      if (row.id === 'blockfire-update-center') row.name = pathToFileURL(join(harness, 'web/lib/index.js')).href
    }
    const patches = [
      ...load(join(modules, '@deepseek-ai/dsh-base/cordis.patch.yml')),
      ...load(join(modules, '@deepseek-ai/dsh-web-app/cordis.patch.yml')),
      ...ownPatch,
      {
        id: 'agent-presets',
        config: {
          default: 'build',
          includeShippedRoot: false,
          includeUserRoot: false,
          roots: [{ path: join(temporary, 'presets'), trust: 'user' }],
        },
      },
      { id: 'session-telemetry-otel', disabled: true },
      { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
      { id: 'web-runtime', config: { openBrowser: false, printUrl: false, surfaceContext: true } },
      ...(options.patches ?? []),
    ]
    ctx = await boot('blockfire-isolated', join(temporary, 'cordis.yml'), patches,
      (host) => provideCmdline(host, { args: ['--no-open'], exit: (code) => { throw new Error(`unexpected exit ${code}`) } }),
      pathToFileURL(`${modules}/`).href)

    return await run({ ctx, temporary, modules, profile, harness, runtime, load, patches, fromRuntime })
  } finally {
    try { await ctx?.fiber.dispose() } finally {
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      if (previousTelemetry === undefined) delete process.env.DSH_TELEMETRY_DISABLED
      else process.env.DSH_TELEMETRY_DISABLED = previousTelemetry
      rmSync(temporary, { recursive: true, force: true })
    }
  }
}

/** Create an idle agent for one space in an isolated host. */
export async function createSpaceAgent(ctx, space, cwd) {
  return ctx.agents.create({
    sessionId: `blockfire-isolated-${space}-${Date.now().toString(36)}`,
    meta: { cwd, agentPreset: space },
    setup: async (agentCtx) => { await ctx.agentPresets.mount(agentCtx, space) },
  })
}
