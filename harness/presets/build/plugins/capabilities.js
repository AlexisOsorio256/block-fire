/** Session-scoped JIT capabilities. Heavy schemas stay out of the default catalog. */
export const name = 'blockfire-capabilities'
export const inject = ['tools']

const DEFAULT_CAPABILITIES = {
  blender: {
    package: './blender-min.js',
    conflictsWith: ['blender-full'],
    whenToUse: 'Blender craft: execute code + viewport screenshot. Use first for visual/animation work.',
    config: { toolCallTimeoutMs: 120000 },
  },
  'blender-full': {
    package: '@deepseek-ai/dsh-mcp-client',
    conflictsWith: ['blender'],
    whenToUse: 'Full Blender MCP only when the two-tool craft loop is insufficient.',
    config: {
      serverName: 'blender',
      transport: 'stdio',
      command:
        process.env.BLOCKFIRE_BLENDER_MCP ??
        `${process.env.HOME ?? ''}/.local/share/blockfire-tools/blender-mcp-venv/bin/blender-mcp`,
      args: [],
      toolCallTimeoutMs: 120000,
    },
  },
}

const PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['list', 'on', 'off'],
      description: 'List, activate or release an optional capability.',
    },
    capability: {
      type: 'string',
      description: 'Capability key returned by list. Required for on/off.',
    },
  },
  required: ['action'],
}

const DESCRIPTION = 'List, activate or release heavyweight capabilities for this session. Keep them off unless needed.'

export function apply(ctx, config) {
  const defaults = config?.includeDefaults === false ? {} : DEFAULT_CAPABILITIES
  const specs = { ...defaults, ...(config?.capabilities ?? {}) }
  const mounted = new Map()

  const ownerOf = (exec) => (exec?.agent !== undefined && exec.agent !== null ? exec.agent : undefined)
  const ownerKeyOf = (exec) => {
    const agent = ownerOf(exec)
    return typeof agent?.id === 'string' ? agent.id : undefined
  }
  const ownerCtxOf = (exec) => {
    const agent = ownerOf(exec)
    return typeof agent?.ctx?.plugin === 'function' ? agent.ctx : undefined
  }
  const ofOwner = (ownerKey) => {
    let owner = mounted.get(ownerKey)
    if (owner === undefined) {
      owner = new Map()
      mounted.set(ownerKey, owner)
    }
    return owner
  }

  async function scopeKeyOf(scope) {
    try {
      const { scopeOf } = await import('@deepseek-ai/dsh-scope')
      return scopeOf(scope)
    } catch {
      return scope
    }
  }

  async function schemaNames(scope) {
    try {
      return ctx.tools.schemas(scope === undefined ? undefined : await scopeKeyOf(scope))
        .map((schema) => schema?.name)
        .filter((toolName) => typeof toolName === 'string')
    } catch {
      return undefined
    }
  }

  const toolPrefixOf = (spec) => {
    if (typeof spec?.toolPrefix === 'string' && spec.toolPrefix !== '') return spec.toolPrefix
    const serverName = spec?.config?.serverName
    return typeof serverName === 'string' && serverName !== '' ? `mcp__${serverName}__` : undefined
  }

  async function registeredNames(spec, entry, scope) {
    const names = await schemaNames(scope)
    if (names === undefined) return undefined
    const prefix = toolPrefixOf(spec)
    const discovered = entry?.discovered
    return names
      .filter((toolName) => (prefix !== undefined && toolName.startsWith(prefix)) || discovered?.has(toolName) === true)
      .sort()
  }

  async function describeAll(exec) {
    const ownerKey = ownerKeyOf(exec)
    const owner = ownerKey === undefined ? undefined : mounted.get(ownerKey)
    const keys = Object.keys(specs)
    if (keys.length === 0) return 'No optional capabilities in this space.'
    const lines = ['Optional capabilities:']
    for (const key of keys) {
      const spec = specs[key]
      const entry = owner?.get(key)
      const state = entry === undefined
        ? 'off'
        : entry.state === 'starting'
          ? 'starting'
          : entry.state === 'stuck'
            ? 'active; release failed'
            : 'active'
      lines.push(`- ${key} [${state}] — ${spec?.whenToUse ?? ''}`)
      if (entry !== undefined && entry.state !== 'starting') {
        const names = await registeredNames(spec, entry, ownerCtxOf(exec) ?? ctx)
        if (names?.length > 0) lines.push(`  tools: ${names.join(', ')}`)
      }
    }
    return lines.join('\n')
  }

  async function activate(key, exec) {
    const spec = specs[key]
    if (spec === undefined || typeof spec !== 'object') {
      return `Unknown capability "${key}". Declared: ${Object.keys(specs).join(', ') || '(none)'}`
    }
    const host = ownerCtxOf(exec)
    const ownerKey = ownerKeyOf(exec)
    if (host === undefined || ownerKey === undefined) return `Capability "${key}" requires a session context.`

    const owner = ofOwner(ownerKey)
    const existing = owner.get(key)
    if (existing !== undefined) {
      return existing.state === 'starting'
        ? `Capability "${key}" is already starting.`
        : `Capability "${key}" is already active.`
    }
    if (typeof spec.package !== 'string' || spec.package === '') return `Capability "${key}" has no package.`

    for (const other of Array.isArray(spec.conflictsWith) ? spec.conflictsWith : []) {
      if (owner.get(other) !== undefined) return `Capability "${key}" conflicts with "${other}". Turn "${other}" off first.`
    }

    const entry = { state: 'starting', discovered: undefined }
    owner.set(key, entry)
    try {
      let moduleNamespace
      try {
        const id = spec.package.startsWith('.') || spec.package.startsWith('/')
          ? new URL(spec.package, import.meta.url).href
          : spec.package
        moduleNamespace = await import(id)
      } catch (error) {
        return `Capability "${key}" could not load ${spec.package}: ${String(error?.message ?? error)}. Run harness/install.sh and retry.`
      }

      const plugin = moduleNamespace?.default ?? moduleNamespace
      if (typeof plugin !== 'function' && !(plugin && typeof plugin === 'object' && typeof plugin.apply === 'function')) {
        return `Capability "${key}" could not mount: ${spec.package} is not a Cordis plugin.`
      }

      let before
      let fiber
      try {
        before = await schemaNames(host)
        fiber = host.plugin(plugin, spec.config ?? {})
        await fiber.await()
      } catch (error) {
        let cleanup = ''
        if (typeof fiber?.dispose === 'function') {
          try { await fiber.dispose() } catch (cleanupError) {
            cleanup = ` Cleanup also failed: ${String(cleanupError?.message ?? cleanupError)}`
          }
        }
        owner.delete(key)
        return `Capability "${key}" failed: ${String(error?.message ?? error)}.${cleanup}`
      }

      if (before !== undefined) {
        const after = await schemaNames(host)
        if (after !== undefined) {
          const added = new Set(after.filter((toolName) => !before.includes(toolName)))
          if (added.size > 0) entry.discovered = added
        }
      }

      entry.state = 'active'
      entry.dispose = typeof fiber.dispose === 'function' ? fiber.dispose.bind(fiber) : undefined
      if (typeof host.effect === 'function') {
        host.effect(() => async () => {
          const current = mounted.get(ownerKey)
          if (current?.get(key) === entry) {
            current.delete(key)
            if (current.size === 0) mounted.delete(ownerKey)
          }
        }, `blockfire-capability:${key}`)
      }
      return `Capability "${key}" activated. Its tools are available on the next step.`
    } finally {
      if (entry.state === 'starting') {
        owner.delete(key)
        if (owner.size === 0) mounted.delete(ownerKey)
      }
    }
  }

  async function deactivate(key, exec) {
    const ownerKey = ownerKeyOf(exec)
    const entry = ownerKey === undefined ? undefined : mounted.get(ownerKey)?.get(key)
    if (entry === undefined) return `Capability "${key}" is not active.`
    if (entry.state === 'starting') return `Capability "${key}" is still starting; retry off shortly.`
    if (typeof entry.dispose !== 'function') {
      entry.state = 'stuck'
      return `Capability "${key}" has no disposer; treat it as still active.`
    }
    try {
      await entry.dispose()
    } catch (error) {
      entry.state = 'stuck'
      return `Capability "${key}" release failed: ${String(error?.message ?? error)}`
    }
    const owner = mounted.get(ownerKey)
    owner?.delete(key)
    if (owner !== undefined && owner.size === 0) mounted.delete(ownerKey)
    return `Capability "${key}" deactivated.`
  }

  const disposeTool = ctx.tools.register({
    name: 'bf_capability',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: {
      schema: { type: 'string' },
      render(_args, value) { return [{ type: 'text', text: String(value) }] },
    },
    async execute(args, exec) {
      const action = typeof args?.action === 'string' && args.action !== '' ? args.action : 'list'
      if (action === 'list') return describeAll(exec)
      const key = typeof args?.capability === 'string' ? args.capability.trim() : ''
      if (key === '') return `action "${action}" needs a capability key.`
      if (action === 'on') return activate(key, exec)
      if (action === 'off') return deactivate(key, exec)
      return `Unknown action "${action}". Use list, on or off.`
    },
  })

  ctx.effect(() => async () => {
    disposeTool()
    for (const owner of mounted.values()) {
      for (const entry of owner.values()) {
        if (typeof entry.dispose !== 'function') continue
        try { await entry.dispose() } catch {}
      }
      owner.clear()
    }
    mounted.clear()
  }, 'blockfire-capabilities')
}
