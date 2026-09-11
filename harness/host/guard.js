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

/** Split a command into path-like tokens, dropping quotes and redirections. */
function tokensOf(text) {
  return text
    .split(/[\s;|&()]+/)
    .map((token) => token.replace(/^['"]+|['"]+$/g, ''))
    .filter((token) => token !== '')
}

/** One path's protected-prefix test. */
function protectedPath(rawPath) {
  const expanded = expand(rawPath)
  for (const raw of PROTECTED_PATHS) {
    const path = expand(raw)
    if (expanded === path || expanded.startsWith(`${path}/`)) return raw
  }
  return undefined
}

function protectedHit(text) {
  for (const token of tokensOf(text)) {
    const hit = protectedPath(token)
    if (hit !== undefined) return hit
  }
  return undefined
}

function catastrophicHit(text) {
  for (const token of tokensOf(text)) {
    const expanded = expand(token)
    for (const target of CATASTROPHIC_TARGETS) {
      if (token === target || expanded === expand(target)) return target
    }
  }
  return undefined
}

/**
 * The first command word of every shell segment. Checking the COMMAND POSITION
 * rather than the whole string is what keeps `grep -rn "sudo" game/` working
 * while `sudo rm -rf /` is denied.
 */
function commandWords(text) {
  const words = []
  for (const segment of text.split(/[;|&()`\n]+/)) {
    const tokens = segment
      .trim()
      .split(/\s+/)
      .filter((token) => token !== '' && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(token))
    if (tokens.length > 0) words.push(tokens[0].replace(/^['"]+|['"]+$/g, ''))
  }
  return words
}

function segments(text) {
  return text.split(/[;|&()`\n]+/).map((segment) => segment.trim()).filter((segment) => segment !== '')
}

/** Deny reasons, in order. Each is a synchronous, cheap test on the command text. */
function bashReason(command) {
  const text = command.trim()
  if (text === '') return undefined

  const words = commandWords(text)
  for (const privilege of ['sudo', 'doas', 'pkexec']) {
    if (words.includes(privilege)) return `privilege escalation (${privilege}) is outside the harness boundary`
  }

  for (const word of words) {
    if (word === 'mkfs' || word.startsWith('mkfs.') || word === 'wipefs' || word === 'shred') {
      return 'writing to a block device or creating a filesystem'
    }
    if (word === 'dd' && segments(text).some((segment) => segment.startsWith('dd ') && segment.includes('of=/dev/'))) {
      return 'writing to a block device or creating a filesystem'
    }
  }

  const recursiveDelete = /\brm\b[^|;]*(?:-[a-z]*[rf][a-z]*|--recursive|--force)/.test(text)
  if (recursiveDelete) {
    const catastrophic = catastrophicHit(text)
    if (catastrophic !== undefined) return `recursive delete of ${catastrophic}`
    const hit = protectedHit(text)
    if (hit !== undefined) return `recursive delete under ${hit}`
  }

  if (/\b(chmod|chown)\b[^|;]*-R[^|;]*\s\/(?:\s|$)/.test(text)) {
    return 'recursive ownership/permission change at the filesystem root'
  }

  if (/(?:^|[\s;|&])(?:>|>>|tee)\s*\/dev\/(?:sd|nvme|vd)/.test(text)) {
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
