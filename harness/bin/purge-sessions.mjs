#!/usr/bin/env node
/** Finish Web session deletes before a new DSH process opens persistence handles. */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
const queueFile = join(dshHome, '.blockfire-harness', 'pending-session-deletes.json')
const sessionsRoot = join(dshHome, 'sessions')
const idShape = /^[0-9A-Za-z-]{8,64}$/

function readQueue() {
  try {
    const value = JSON.parse(readFileSync(queueFile, 'utf8'))
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string' && idShape.test(id)) : []
  } catch {
    return []
  }
}

function writeQueue(ids) {
  if (ids.length === 0) {
    rmSync(queueFile, { force: true })
    return
  }
  mkdirSync(dirname(queueFile), { recursive: true })
  const tmp = `${queueFile}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify([...new Set(ids)], null, 2)}\n`)
  renameSync(tmp, queueFile)
}

function sessionDirs(id) {
  if (!existsSync(sessionsRoot)) return []
  const found = []
  for (const project of readdirSync(sessionsRoot, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    const candidate = join(sessionsRoot, project.name, id)
    if (existsSync(candidate)) found.push(candidate)
  }
  return found
}

const pending = readQueue()
if (pending.length === 0) process.exit(0)

const retry = []
for (const id of pending) {
  try {
    const dirs = sessionDirs(id)
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
    rmSync(join(dshHome, 'storages', 'session_projcache', 'sessions', `${id}.json`), { force: true })
    process.stdout.write(`blockfire: purged session ${id}${dirs.length === 0 ? ' (no materialized log)' : ''}\n`)
  } catch (error) {
    retry.push(id)
    process.stderr.write(`blockfire: could not purge ${id}: ${String(error?.message ?? error)}\n`)
  }
}
writeQueue(retry)
if (retry.length > 0) process.exitCode = 1
