/** BUILD-only deterministic workflow boundaries.
 * Semantic stop/decision rules live in the persona/skills; this guard enforces
 * the parts that are mechanically knowable without guessing model intent.
 */
export const name = 'blockfire-workflow-guard'
export const inject = ['tools']

const DENIAL = 'BLOCKFIRE workflow blocked this call: '

function clean(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\\/g, '/')
}

function capturePath(value) {
  const path = clean(value)
  if (path === 'captures' || path === './captures') return true
  if (path.startsWith('captures/') || path.startsWith('./captures/')) return true
  return /\/captures(?:\/|$)/.test(path)
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
  ctx.effect(() => ctx.tools.guard((execution) => {
    if ((execution.name === 'write' || execution.name === 'edit') && capturePath(fileTarget(execution.arguments))) {
      return DENIAL + 'session QA/evidence must not be written under captures/. Use /tmp/blockfire-* and discard it after the task.'
    }
    if ((execution.name === 'bash' || execution.name === 'pwsh') && bashWritesCaptures(execution.arguments?.command)) {
      return DENIAL + 'generated QA output belongs under /tmp/blockfire-*, not captures/ in the checkout.'
    }
    return undefined
  }), 'blockfire-workflow-guard')
}
