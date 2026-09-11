#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const HARNESS = resolve(HERE, '..')
const HOST = pathToFileURL(join(HARNESS, 'web', 'lib', 'index.js')).href
const PURGE = join(HARNESS, 'bin', 'purge-sessions.mjs')
const ID = 'session-0123abcd-0000-4000-8000-000000000001'

function post(route, body) {
  return new Promise((resolveCall) => {
    const payload = JSON.stringify(body)
    const chunks = []
    const req = {
      method: 'POST',
      headers: { 'x-blockfire-delete': '1' },
      on(event, handler) {
        if (event === 'data') handler(Buffer.from(payload))
        if (event === 'end') handler()
      },
    }
    const res = {
      writeHead(status) { chunks.push({ status }) },
      end(text) {
        chunks.push({ text })
        resolveCall({
          status: chunks.find((entry) => entry.status !== undefined)?.status,
          body: JSON.parse(String(text)),
        })
      },
    }
    route.handler(req, res)
  })
}

test('current DSH delete records intent, archives/detaches, then purges only before next boot', async () => {
  const home = await mkdtemp(join(tmpdir(), 'blockfire-delete-v3-'))
  const oldHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    const logDir = join(home, 'sessions', '--project--', ID)
    const cache = join(home, 'storages', 'session_projcache', 'sessions', `${ID}.json`)
    await mkdir(logDir, { recursive: true })
    await mkdir(dirname(cache), { recursive: true })
    await writeFile(join(logDir, 'session.v3.jsonl.zstd'), 'fixture')
    await writeFile(cache, '{}')

    const routes = []
    const archived = []
    const workspace = {
      id: 'w1',
      sessionIds: [ID],
      async detachSession(id) { this.sessionIds = this.sessionIds.filter((member) => member !== id) },
    }
    const registry = {
      async archiveSession(id) { archived.push(id) },
      list() { return [workspace] },
    }
    const module = await import(`${HOST}?v=${Date.now()}`)
    module.apply({
      get(name) { return name === 'agents' ? { get: () => undefined } : name === 'workspaceRegistry' ? registry : undefined },
      sessionPersistence: { async list() { return [{ header: { id: ID, cwd: '/project' }, revision: 'r1' }] } },
      workspaceRegistry: registry,
      storageDomain: { get: () => undefined },
      webServer: { register(route) { routes.push(route); return () => {} } },
      effect(factory) { return factory() },
    })

    const route = routes.find((entry) => entry.path === '/blockfire/session/delete')
    const result = await post(route, { sessionId: ID })
    assert.equal(result.status, 200)
    assert.equal(result.body.pendingPurge, true)
    assert.deepEqual(archived, [ID])
    assert.deepEqual(workspace.sessionIds, [])
    assert.equal(existsSync(logDir), true, 'live host must not rm an append-only log under persistence')
    assert.equal(existsSync(cache), true, 'physical cleanup is deferred with the log')

    const queue = join(home, '.blockfire-harness', 'pending-session-deletes.json')
    assert.deepEqual(JSON.parse(await readFile(queue, 'utf8')), [ID])
    execFileSync(process.execPath, [PURGE], { env: { ...process.env, DSH_HOME: home } })
    assert.equal(existsSync(logDir), false)
    assert.equal(existsSync(cache), false)
    assert.equal(existsSync(queue), false)
  } finally {
    if (oldHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = oldHome
    await rm(home, { recursive: true, force: true })
  }
})
