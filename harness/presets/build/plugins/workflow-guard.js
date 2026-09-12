/** BUILD workflow boundaries.
 * Checkout hygiene is universal. Aggressive anti-rumination limits are enabled
 * only for DeepSeek Flash, whose observed failure mode is proof/visual churn.
 */
export const name = 'blockfire-workflow-guard'
export const inject = ['tools']

const DENIAL = 'BLOCKFIRE workflow blocked this call: '
const MAX_DISCOVERY_VISUALS = 3
const MAX_LOCK_TOOLS = 3
const MAX_REQUEST_TOKENS = 16_384

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

function isDeepSeekFlash(config) {
  const provider = String(config?.provider ?? '').toLowerCase()
  const model = String(config?.model ?? '').toLowerCase()
  return provider.includes('deepseek') && /(^|[-_/])flash($|[-_/])/.test(model)
}

function terminalMessage(reason) {
  return DENIAL + `TERMINAL VISUAL PASS: ${reason} Do not reconstruct or re-judge the same images from memory, choose a new hypothesis, create a probe, or edit speculatively. End this turn now and report that this sweep produced no justified edit.`
}

export function apply(ctx) {
  let strictMode = false
  let phase = 'idle'
  let discoveryVisuals = 0
  let lockTools = 0

  const reset = () => {
    phase = 'idle'
    discoveryVisuals = 0
    lockTools = 0
  }

  // Request config is also the reliable model-selection signal. Do not punish a
  // stronger/different model for a DeepSeek-Flash-specific failure mode.
  ctx.on('agent/request', async (_payload, next) => {
    const config = await next()
    const nextStrictMode = isDeepSeekFlash(config)
    if (nextStrictMode !== strictMode) reset()
    strictMode = nextStrictMode
    if (!strictMode) return config
    if (Number.isSafeInteger(config.maxTokens) && config.maxTokens > 0 && config.maxTokens <= MAX_REQUEST_TOKENS) return config
    return { ...config, maxTokens: MAX_REQUEST_TOKENS }
  })

  ctx.effect(() => ctx.tools.guard((execution) => {
    const name = execution.name
    const args = execution.arguments
    const target = fileTarget(args)
    const repoEdit = (name === 'write' || name === 'edit') && !tempPath(target) && !capturePath(target)

    // Universal checkout hygiene: generated session evidence never belongs here.
    if ((name === 'write' || name === 'edit') && capturePath(target)) {
      return DENIAL + 'session QA/evidence must not be written under captures/. Use /tmp/blockfire-* and discard it after the task.'
    }
    if ((name === 'bash' || name === 'pwsh') && bashWritesCaptures(args?.command)) {
      return DENIAL + 'generated QA output belongs under /tmp/blockfire-*, not captures/ in the checkout.'
    }

    // All remaining mechanical limits compensate specifically for DeepSeek Flash.
    if (!strictMode) return undefined

    if (phase === 'terminal') {
      return terminalMessage('the bounded pass already ended without a justified edit.')
    }

    if (repoEdit) {
      reset()
      return undefined
    }

    if (phase === 'idle') {
      if (name === 'read_image') {
        phase = 'discovery'
        discoveryVisuals = 1
      }
      return undefined
    }

    if (phase === 'discovery') {
      if (name === 'read_image') {
        if (discoveryVisuals >= MAX_DISCOVERY_VISUALS) {
          phase = 'terminal'
          return terminalMessage(`discovery used ${MAX_DISCOVERY_VISUALS} visual reads without committing to an owner.`)
        }
        discoveryVisuals += 1
        return undefined
      }
      if (name === 'job_output' || name === 'job_list' || name === 'job_kill') return undefined
      phase = 'locked'
      lockTools = 1
      return undefined
    }

    if (phase === 'locked') {
      if (name === 'read_image') {
        phase = 'terminal'
        return terminalMessage('EVIDENCE LOCK was already active and another image was requested before editing.')
      }
      if ((name === 'write' || name === 'edit') && tempPath(target)) {
        phase = 'terminal'
        return terminalMessage('EVIDENCE LOCK was already active and a new throwaway lab/script was requested instead of editing the owner.')
      }
      if (lockTools >= MAX_LOCK_TOOLS) {
        phase = 'terminal'
        return terminalMessage(`EVIDENCE LOCK used ${MAX_LOCK_TOOLS} owner/check tools without producing an edit.`)
      }
      lockTools += 1
    }
    return undefined
  }), 'blockfire-workflow-guard')
}
