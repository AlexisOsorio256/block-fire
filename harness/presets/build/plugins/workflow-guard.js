/** BUILD-only deterministic workflow boundaries.
 * Semantic stop/decision rules live in the persona/skills; this guard enforces
 * the parts that are mechanically knowable without guessing model intent.
 */
export const name = 'blockfire-workflow-guard'
export const inject = ['tools']

const DENIAL = 'BLOCKFIRE workflow blocked this call: '
const MAX_VISUAL_READS_BEFORE_EDIT = 3
const MAX_TOOLS_AFTER_FIRST_VISUAL = 6

function clean(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\\/g, '/')
}

function capturePath(value) {
  const path = clean(value)
  if (path === 'captures' || path === './captures') return true
  if (path.startsWith('captures/') || path.startsWith('./captures/')) return true
  return /\/captures(?:\/|$)/.test(path)
}

function tempPath(value) {
  const path = clean(value)
  return path === '/tmp' || path.startsWith('/tmp/')
}

function fileTarget(args) {
  if (typeof args?.file_path === 'string') return args.file_path
  if (typeof args?.path === 'string') return args.path
  return ''
}

function bashWritesCaptures(command) {
  const text = String(command ?? '').replace(/\\/g, '/')
  if (/--out=(?:['"])?(?:\.\/)?captures(?:\/|\b)/.test(text)) return true
  if (/(?:>|>>)\s*(?:['"])?(?:\.\/)?captures(?:\/|\b)/.test(text)) return true
  if (/\b(?:mkdir|touch|tee|cp|mv)\b[^\n;&|]*(?:^|\s)(?:\.\/)?captures(?:\/|\b)/m.test(text)) return true
  return false
}

export function apply(ctx) {
  // This plugin is mounted inside one BUILD session, so the counters below are
  // session-local. They deliberately cap indecision, not total task complexity:
  // every real repo edit starts a fresh observation/verification cycle.
  let visualReads = 0
  let toolsAfterFirstVisual = 0

  const resetDecisionCycle = () => {
    visualReads = 0
    toolsAfterFirstVisual = 0
  }

  ctx.effect(() => ctx.tools.guard((execution) => {
    const name = execution.name
    const args = execution.arguments
    const target = fileTarget(args)

    if ((name === 'write' || name === 'edit') && capturePath(target)) {
      return DENIAL + 'session QA/evidence must not be written under captures/. Use /tmp/blockfire-* and discard it after the task.'
    }
    if ((name === 'bash' || name === 'pwsh') && bashWritesCaptures(args?.command)) {
      return DENIAL + 'generated QA output belongs under /tmp/blockfire-*, not captures/ in the checkout.'
    }

    // A real repo edit is always allowed and closes the current evidence cycle.
    // A throwaway /tmp write does not reset the budget, so creating a custom lab
    // cannot be used to buy another round of discovery.
    if ((name === 'write' || name === 'edit') && !tempPath(target)) {
      resetDecisionCycle()
      return undefined
    }

    if (name === 'read_image') {
      if (visualReads === 0) {
        visualReads = 1
        return undefined
      }
      if (visualReads >= MAX_VISUAL_READS_BEFORE_EDIT) {
        return DENIAL + `visual decision budget exhausted (${MAX_VISUAL_READS_BEFORE_EDIT} reads). Edit the plausible owner now or stop; the next image belongs after the edit.`
      }
      if (toolsAfterFirstVisual >= MAX_TOOLS_AFTER_FIRST_VISUAL) {
        return DENIAL + `decision budget exhausted (${MAX_TOOLS_AFTER_FIRST_VISUAL} tools after first visual). The next repo-changing action must be edit/write or the task must stop.`
      }
      visualReads += 1
      toolsAfterFirstVisual += 1
      return undefined
    }

    if (visualReads > 0) {
      if (toolsAfterFirstVisual >= MAX_TOOLS_AFTER_FIRST_VISUAL) {
        return DENIAL + `decision budget exhausted (${MAX_TOOLS_AFTER_FIRST_VISUAL} tools after first visual). Edit/write the plausible owner now or stop; do not gather more confidence evidence.`
      }
      toolsAfterFirstVisual += 1
    }
    return undefined
  }), 'blockfire-workflow-guard')
}
