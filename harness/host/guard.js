/**
 * BLOCKFIRE destructive-operation guard (host plane).
 *
 * WHY THIS EXISTS
 * BLOCKFIRE's toolchain legitimately writes outside the workspace: Godot writes
 * `~/.config/godot`, Blender `~/.config/blender`, Gradle `~/.gradle`, adb its
 * server socket. A `workspace-write` sandbox therefore breaks the product's own
 * build and craft workflows, so BLOCKFIRE runs with the sandbox fully open and
 * the approval policy set to `never` — no conversational approval loops.
 *
 * Open sandbox + no prompts would leave nothing protecting the machine. This
 * guard is that missing boundary, expressed as POLICY rather than as a question:
 * it denies a short list of catastrophic operations synchronously, with a reason
 * the model can act on. Normal work — reads, edits, tests, Godot, Blender,
 * builds, captures, commits, pushes — is never touched.
 *
 * WHAT IT IS NOT
 *   * It is not a sandbox. It cannot stop a determined command; it stops the
 *     obvious accidents and the shortcuts nobody should take unattended.
 *   * It is not a workflow rule. It has no opinion about how work is done.
 *   * It does not ask the user anything. Denial is a tool result.
 *
 * WHERE IT LIVES
 * Host plane, because approval/sandbox policy is host-plane by design: a preset
 * is exactly as privileged as the plugins it names, so a preset must never be
 * able to relax its own confinement. `harness/install.sh` writes the row into
 * the Web profile's user patch layer.
 */

export const name = 'blockfire-guard'
export const inject = ['tools']

/** Paths whose destruction is never an unattended operation. Prefix-matched. */
const PROTECTED_PATHS = [
  '/etc', '/boot', '/usr', '/bin', '/sbin', '/lib', '/lib64', '/var/lib', '/sys', '/proc',
  '~/.ssh', '~/.gnupg', '~/.aws', '~/.netrc', '~/.dsh/.credentials.yaml',
  '~/.config/gh', '~/.docker/config.json', '~/.kube/config',
]

/** Exact delete targets that are a machine-level event, never a task step. */
const CATASTROPHIC_TARGETS = [
  '/', '/*', '~', '~/*', '$HOME', '$HOME/*',
  '/home', '/home/*', '/root', '/root/*', '/var', '/var/*', '/opt', '/opt/*',
]

const HOME = process.env.HOME ?? ''

/** Expand common HOME spellings so protected paths cannot be bypassed by shell syntax. */
function expand(path) {
  if (HOME !== '') {
    if (path === '~' || path.startsWith('~/')) return HOME + path.slice(1)
    if (path === '$HOME' || path.startsWith('$HOME/')) return HOME + path.slice(5)
    if (path === '${HOME}' || path.startsWith('${HOME}/')) return HOME + path.slice(7)
  }
  return path
}

/** Shell permits adjacent quoted/unquoted pieces (`"$HOME"/.ssh`); paths here contain no spaces. */
function cleanToken(token) {
  return token.replace(/['"]/g, '')
}

function segments(text) {
  return text.split(/[;|&()`\n]+/).map((segment) => segment.trim()).filter((segment) => segment !== '')
}

/** Tokens after leading VAR=value assignments, enough to identify a direct command safely. */
function commandTokens(segment) {
  return segment
    .trim()
    .split(/\s+/)
    .map(cleanToken)
    .filter((token) => token !== '')
    .filter((token, index, all) => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) return true
      return all.slice(0, index).some((before) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(before))
    })
}

/** One path's protected-prefix test. */
function protectedPath(rawPath) {
  const expanded = expand(cleanToken(rawPath))
  for (const raw of PROTECTED_PATHS) {
    const path = expand(raw)
    if (expanded === path || expanded.startsWith(`${path}/`)) return raw
  }
  return undefined
}

function protectedHit(tokens) {
  for (const token of tokens) {
    const hit = protectedPath(token)
    if (hit !== undefined) return hit
  }
  return undefined
}

function catastrophicHit(tokens) {
  for (const rawToken of tokens) {
    const token = cleanToken(rawToken)
    const expanded = expand(token)
    for (const target of CATASTROPHIC_TARGETS) {
      if (token === target || expanded === expand(target)) return target
    }
  }
  return undefined
}

/**
 * The first command word of every shell segment. Checking COMMAND POSITION is
 * what lets docs/grep mention dangerous strings without turning them into a
 * policy denial.
 */
function commands(text) {
  return segments(text).map((segment) => ({ segment, tokens: commandTokens(segment) }))
    .filter((entry) => entry.tokens.length > 0)
}

/** Deny reasons, in order. Each is a synchronous, cheap test on the command text. */
function bashReason(command) {
  const text = command.trim()
  if (text === '') return undefined

  const entries = commands(text)
  for (const { tokens } of entries) {
    const word = tokens[0]
    if (['sudo', 'doas', 'pkexec'].includes(word)) {
      return `privilege escalation (${word}) is outside the harness boundary`
    }
    if (word === 'mkfs' || word.startsWith('mkfs.') || word === 'wipefs' || word === 'shred') {
      return 'writing to a block device or creating a filesystem'
    }
    if (word === 'dd' && tokens.slice(1).some((token) => token.startsWith('of=/dev/'))) {
      return 'writing to a block device or creating a filesystem'
    }
    if (word === 'rm') {
      const targets = tokens.slice(1).filter((token) => token !== '--' && !token.startsWith('-'))
      const catastrophic = catastrophicHit(targets)
      if (catastrophic !== undefined) return `delete of ${catastrophic}`
      const hit = protectedHit(targets)
      if (hit !== undefined) return `delete under ${hit}`
    }
    if ((word === 'chmod' || word === 'chown') && tokens.includes('-R') && tokens.includes('/')) {
      return 'recursive ownership/permission change at the filesystem root'
    }
    if ((word === 'tee' || word === '>' || word === '>>') && tokens.slice(1).some((token) => /^\/dev\/(?:sd|nvme|vd)/.test(token))) {
      return 'redirecting output onto a block device'
    }
  }

  // Redirection operators are not always command words (`echo x > /dev/sda`).
  if (/(?:^|[\s;|&])(?:>|>>)\s*\/dev\/(?:sd|nvme|vd)/.test(text)) {
    return 'redirecting output onto a block device'
  }

  return undefined
}

/** Deny reasons for a filesystem tool's target path. */
function pathReason(toolName, args) {
  const target = typeof args?.file_path === 'string' ? args.file_path : typeof args?.path === 'string' ? args.path : ''
  if (target === '') return undefined
  const hit = protectedPath(target)
  if (hit === undefined) return undefined
  return `${toolName} of ${hit} is outside the harness boundary`
}

const DENIAL_PREFIX = 'BLOCKFIRE policy blocked this call: '

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.tools.guard((execution) => {
        const args = execution.arguments
        let reason
        if (execution.name === 'bash' || execution.name === 'pwsh') {
          reason = bashReason(typeof args?.command === 'string' ? args.command : '')
        } else if (execution.name === 'write' || execution.name === 'edit') {
          reason = pathReason(execution.name, args)
        }
        if (reason === undefined) return undefined
        return (
          `${DENIAL_PREFIX}${reason}. This is a deliberate, non-negotiable limit of this harness, not a permissions bug. ` +
          'Do not try to work around it (no sudo, no alternate tool, no shell trick). ' +
          'If the operation is genuinely required, say so and let the user run it themselves.'
        )
      }),
    'blockfire-guard',
  )
}
