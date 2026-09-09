/**
 * BLOCKFIRE Update Center — host half.
 *
 * Serves one read-only JSON endpoint that the browser half renders in
 * Settings → BLOCKFIRE. The endpoint runs `harness/bin/update.mjs`, so the Web
 * panel and the CLI can never disagree about what is installed, what is staged,
 * and what is verified.
 *
 * It is deliberately read-only over HTTP: staging, verifying and switching are
 * privileged operations (they install packages and change what the launcher
 * boots), so they stay in the CLI where the user runs them knowingly. The panel
 * tells the user the exact command to run.
 *
 * NO FORK: this is an ordinary host plugin row in the Web profile's user patch
 * layer plus one hand-written client bundle. No upstream file is modified.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'blockfire-update-center'
export const inject = ['webServer']

/** lib/ -> web/ -> harness/ -> repository root. */
const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

const CHECK_TTL_MS = 10 * 60 * 1000

function runCli(cli, args, timeoutMs) {
  return new Promise((settle) => {
    execFile('node', [cli, ...args], { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error !== null && error !== undefined) {
        settle({ ok: false, error: String(stderr || error.message).slice(0, 2000) })
        return
      }
      try {
        settle({ ok: true, value: JSON.parse(stdout) })
      } catch (parseError) {
        settle({ ok: false, error: `update.mjs produced non-JSON output: ${String(parseError?.message ?? parseError)}` })
      }
    })
  })
}

function send(res, status, value) {
  const body = `${JSON.stringify(value)}\n`
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

export function apply(ctx, config) {
  const repo = typeof config?.repoRoot === 'string' && config.repoRoot !== '' ? config.repoRoot : DEFAULT_REPO
  const cli = resolve(repo, 'harness', 'bin', 'update.mjs')
  const cache = { at: 0, value: undefined }

  const handler = async (req, res) => {
    if (!existsSync(cli)) {
      send(res, 500, { ok: false, error: `update.mjs not found at ${cli} — run harness/install.sh` })
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const wantsCheck = url.searchParams.get('check') === '1'
    const status = await runCli(cli, ['status', '--json'], 30000)
    if (!status.ok) {
      send(res, 500, { ok: false, error: status.error })
      return
    }
    if (!wantsCheck) {
      send(res, 200, { ok: true, status: status.value, check: cache.value ?? null, checkedAt: cache.at || null })
      return
    }
    if (cache.value !== undefined && Date.now() - cache.at < CHECK_TTL_MS) {
      send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
      return
    }
    const checked = await runCli(cli, ['check', '--json'], 180000)
    if (!checked.ok) {
      send(res, 200, { ok: true, status: status.value, check: null, checkError: checked.error })
      return
    }
    cache.value = checked.value
    cache.at = Date.now()
    send(res, 200, { ok: true, status: status.value, check: cache.value, checkedAt: cache.at })
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: '/blockfire/update', handler }),
    'blockfire-update-center: route',
  )
}
