#!/usr/bin/env node
/**
 * Finish Web-requested session deletions before DSH boots.
 *
 * DSH has archive/detach but no first-party persistence delete seam. Removing a
 * live log behind an open persistence handle is unsafe, so the Web route only
 * archives/detaches and queues the id. The normal BLOCKFIRE launcher runs this
 * file before starting DSH, when no handle from this new process exists.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const STATE_DIR = join(DSH_HOME, '.blockfire-harness')
const QUEUE = join(STATE_DIR, 'pending-session-deletes.json')
const SESSIONS = join(DSH_HOME, 'sessions')
const PROJCACHE = join(DSH_HOME, 'storages', 'session_projcache', 'sessions')
const ID_RE = /^[0-9A-Za-z-]{8,64}$/

function readQueue() {
  try {
    const parsed = JSON.parse(readFileSync(QUEUE, 'utf8'))
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch {
    return []
  }
}

function writeQueue(items) {
  mkdirSync(STATE_DIR, { recursive: true })
  if (items.length === 0) {
    rmSync(QUEUE, { force: true })
    return
  }
  writeFileSync(QUEUE, `${JSON.stringify({ version: 1, items }, null, 2)}\n`)
}

function sessionDirs(id) {
  if (!existsSync(SESSIONS)) return []
  const matches = []
  for (const project of readdirSync(SESSIONS, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const candidate = resolve(SESSIONS, project.name, id)
    const root = `${resolve(SESSIONS)}${process.platform === 'win32' ? '\\' : '/'}`
    if (!candidate.startsWith(root)) continue
    if (existsSync(candidate)) matches.push(candidate)
  }
  return matches
}

const pending = readQueue()
if (pending.length === 0) process.exit(0)

const retry = []
for (const item of pending) {
  const id = typeof item?.sessionId === 'string' ? item.sessionId : ''
  if (!ID_RE.test(id)) {
    process.stderr.write(`blockfire purge: refusing invalid queued session id ${JSON.stringify(id)}\n`)
    continue
  }
  try {
    const dirs = sessionDirs(id)
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    rmSync(join(PROJCACHE, `${id}.json`), { force: true })
    process.stdout.write(`blockfire purge: deleted ${id}${dirs.length === 0 ? ' (log already absent)' : ''}\n`)
  } catch (error) {
    retry.push(item)
    process.stderr.write(`blockfire purge: ${id}: ${String(error?.message ?? error)}\n`)
  }
}
writeQueue(retry)
if (retry.length > 0) process.exitCode = 1
