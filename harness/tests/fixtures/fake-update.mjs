#!/usr/bin/env node
/**
 * Fake update.mjs for host-route tests and the visual-boot panel E2E: records
 * its argv to the file named by FAKE_UPDATE_LOG and obeys the FAKE_UPDATE_*
 * knobs, so tests can drive the action route without npm, the network or a
 * real DSH tree.
 *
 *   FAKE_UPDATE_LOG=<file>    append one line per invocation ("<cmd> <ver>")
 *   FAKE_VERIFY_FAIL=1        `verify` exits 1 with a failing verdict line
 *   FAKE_UPDATE_DELAY_MS=<n>  sleep before doing anything (single-flight test)
 *   FAKE_STATUS_JSON=<json>   `status --json` prints this payload verbatim
 *   FAKE_CHECK_JSON=<json>    `check --json` prints this payload verbatim
 */
import { appendFileSync } from 'node:fs'

const args = process.argv.slice(2)
if (process.env.FAKE_UPDATE_LOG) appendFileSync(process.env.FAKE_UPDATE_LOG, `${args.join(' ')}\n`)
if (process.env.FAKE_UPDATE_DELAY_MS) {
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.FAKE_UPDATE_DELAY_MS)))
}
const [command] = args
if (command === 'status' && process.env.FAKE_STATUS_JSON) {
  process.stdout.write(`${process.env.FAKE_STATUS_JSON}\n`)
  process.exit(0)
}
if (command === 'check' && process.env.FAKE_CHECK_JSON) {
  process.stdout.write(`${process.env.FAKE_CHECK_JSON}\n`)
  process.exit(0)
}
if (command === 'status' || command === 'check') {
  process.stdout.write(`${JSON.stringify({ fake: command })}\n`)
  process.exit(0)
}
if (command === 'verify' && process.env.FAKE_VERIFY_FAIL === '1') {
  process.stderr.write('verified: FAIL — the suite rejected the candidate\n')
  process.exit(1)
}
if (command === 'stage') process.stdout.write(`staged ${args[1]}\n`)
if (command === 'activate') process.stdout.write(`active -> ${args[1]}\n`)
if (command === 'rollback') process.stdout.write('rolled back\n')
process.exit(0)
