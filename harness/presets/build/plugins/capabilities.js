/**
 * BLOCKFIRE capability router — the only BLOCKFIRE-owned code in the preset.
 *
 * WHY THIS EXISTS
 * Tool schemas are paid for in every request. Blender MCP advertises 28 tools
 * (~26.7k JSON chars, ~7.4k tokens), most of them 3D-asset marketplaces that
 * BLOCKFIRE craft work never calls, while the sessions that do need Blender are
 * a minority. Mounting that bridge statically in the preset would tax every
 * code, QA, docs and Android session.
 *
 * So the preset mounts this router instead: one small tool, and the heavy
 * bridge is mounted only when a task asks for it.
 *
 * WHY THERE IS A DEFAULT CAPABILITY IN CODE
 * `blender` is the one capability both spaces share, and a loader patch replaces
 * a row's whole `config` instead of merging into it. Declaring it here once is
 * what keeps BUILD and CREATOR from drifting; a space still extends or overrides
 * it from its composition, because `config.capabilities` merges over these
 * defaults.
 *
 * SCOPE AND LIFETIME
 * A capability is mounted into the CALLING SESSION's scope, not the preset's, so
 * one session turning Blender on never changes another session's catalog, and
 * the bridge is disposed with the session that asked for it. The router's own
 * tool stays in the preset scope and disappears with the preset.
 *
 * FAIL-SOFT AT THE BOUNDARY
 * The router imports nothing at load time: the tool definition is built from the
 * documented `ctx.tools.register()` contract, so a missing optional dependency
 * can never stop the preset from mounting. Only `action: "on"` resolves the
 * capability, and any failure comes back as an actionable message.
 *
 * TRADE-OFF, STATED HONESTLY
 * Activating a capability mid-session changes that session's tool catalog,
 * which invalidates KV-cache reuse from the tool-schema position onward. That
 * is why the DEFAULT catalog is the stable one: a session that never asks for
 * Blender keeps a byte-identical prefix for its whole life.
 */

export const name = 'blockfire-capabilities'
export const inject = ['tools']

/**
 * Capabilities every BLOCKFIRE space can activate. A composition overrides a key
 * by declaring the same key and adds one by declaring a new key.
 */
const DEFAULT_CAPABILITIES = {
  blender: {
    package: '@deepseek-ai/dsh-mcp-client',
    whenToUse:
      'Blender GUI craft: animation clips, rigging, mesh and visual work on ' +
      'assets/animation_sources/*.blend while Blender is open. Requires the ' +
      'blender-mcp addon listening on 127.0.0.1:9876 (`tools/bf doctor` reports it).',
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

/** JSON-Schema parameters; `ctx.tools.register` consumes the definition as-is. */
const PARAMETERS = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['list', 'on', 'off'],
      description: 'list (default) shows declared capabilities and their state; on activates one; off releases one.',
    },
    capability: {
      type: 'string',
      description: 'Capability key to activate or release, for example "blender". Required for action on/off.',
    },
  },
  required: ['action'],
}

const DESCRIPTION = [
  'Activate, release or list BLOCKFIRE\'s optional heavyweight capabilities.',
  'Capabilities are OFF by default because their tool schemas are paid for in every request;',
  'turn one on only when the current task genuinely needs it, and turn it off when that work is done.',
  'Use action "list" to see what exists and whether it is active in this session.',
].join(' ')

export function apply(ctx, config) {
  const specs = { ...DEFAULT_CAPABILITIES, ...(config?.capabilities ?? {}) }
  /** @type {Map<string, Map<string, () => void>>} ownerKey -> capability -> disposer */
  const mounted = new Map()

  const ownerOf = (exec) => (exec?.agent !== undefined && exec.agent !== null ? exec.agent : undefined)
  const ownerKeyOf = (exec) => {
    const agent = ownerOf(exec)
    if (agent === undefined) return 'preset'
    return typeof agent.id === 'string' ? agent.id : 'preset'
  }
  const ownerCtxOf = (exec) => {
    const agent = ownerOf(exec)
    if (agent !== undefined && agent.ctx !== undefined && typeof agent.ctx.plugin === 'function') return agent.ctx
    return ctx
  }
  const ofOwner = (ownerKey) => {
    let entry = mounted.get(ownerKey)
    if (entry === undefined) {
      entry = new Map()
      mounted.set(ownerKey, entry)
    }
    return entry
  }

  const prefixOf = (spec) => `mcp__${String(spec?.config?.serverName ?? '')}__`

  async function registeredNames(spec, exec) {
    try {
      const prefix = prefixOf(spec)
      const { scopeOf } = await import('@deepseek-ai/dsh-scope')
      return ctx.tools.schemas(scopeOf(ownerCtxOf(exec)))
        .map((schema) => schema?.name)
        .filter((toolName) => typeof toolName === 'string' && toolName.startsWith(prefix))
        .sort()
    } catch {
      return undefined
    }
  }

  async function describeAll(exec) {
    const owner = ofOwner(ownerKeyOf(exec))
    const keys = Object.keys(specs)
    if (keys.length === 0) return 'No optional capabilities are declared in this preset.'
    const lines = ['Optional capabilities (off by default; each costs tool-schema tokens only while active):']
    for (const key of keys) {
      const spec = specs[key]
      const active = owner.has(key)
      lines.push(`- ${key} [${active ? 'ACTIVE' : 'off'}] — ${spec?.whenToUse ?? 'no description'}`)
      if (active) {
        const names = await registeredNames(spec, exec)
        if (names !== undefined) {
          lines.push(names.length > 0
            ? `    tools now visible: ${names.join(', ')}`
            : '    tools not registered yet: the bridge may still be connecting, or the server refused the connection')
        }
      }
    }
    return lines.join('\n')
  }

  async function activate(key, exec) {
    const spec = specs[key]
    if (spec === undefined || typeof spec !== 'object') {
      return `Unknown capability "${key}". Declared: ${Object.keys(specs).join(', ') || '(none)'}`
    }
    const owner = ofOwner(ownerKeyOf(exec))
    if (owner.has(key)) return `Capability "${key}" is already active in this session.`
    if (typeof spec.package !== 'string' || spec.package === '') {
      return `Capability "${key}" has no "package" configured.`
    }
    const host = ownerCtxOf(exec)
    if (typeof host.plugin !== 'function') {
      return `Capability "${key}" cannot be mounted: this runtime exposes no plugin mounting on the session context.`
    }
    let moduleNamespace
    try {
      moduleNamespace = await import(spec.package)
    } catch (error) {
      return [
        `Capability "${key}" could not load ${spec.package}: ${String(error?.message ?? error)}`,
        'The bridge resolves from the installed preset directory. Run `harness/install.sh`',
        '(it links node_modules into the installed copy) and try again.',
      ].join('\n')
    }
    const plugin = moduleNamespace?.default ?? moduleNamespace
    if (typeof plugin !== 'function' && !(plugin && typeof plugin === 'object' && typeof plugin.apply === 'function')) {
      return `Capability "${key}" could not be mounted: ${spec.package} did not export a Cordis plugin.`
    }
    let fiber
    try {
      fiber = host.plugin(plugin, spec.config ?? {})
      await fiber.await()
      owner.set(key, fiber.dispose)
    } catch (error) {
      await fiber?.dispose()

      return `Capability "${key}" failed to start: ${String(error?.message ?? error)}`
    }
    return [
      `Capability "${key}" activated from ${spec.package} for this session.`,
      'Its tools appear in the catalog on the next step (a stdio bridge needs a moment to list them).',
      'This changes the tool-schema prefix for this session: KV-cache reuse resumes from the new prefix.',
      'Call this tool again with action "list" to confirm the tools are registered, or action "off" to release them.',
    ].join('\n')
  }

  async function deactivate(key, exec) {
    const owner = ofOwner(ownerKeyOf(exec))
    const dispose = owner.get(key)
    if (dispose === undefined) return `Capability "${key}" is not active in this session.`
    owner.delete(key)
    try {
      await dispose()
    } catch (error) {
      return `Capability "${key}" disposed with an error: ${String(error?.message ?? error)}`
    }
    return `Capability "${key}" deactivated; its tools are gone from the catalog.`
  }

  const disposeTool = ctx.tools.register({
    name: 'bf_capability',
    description: DESCRIPTION,
    parameters: PARAMETERS,
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: String(value) }]
      },
    },
    async execute(args, exec) {
      const action = typeof args?.action === 'string' && args.action !== '' ? args.action : 'list'
      if (action === 'list') return describeAll(exec)
      const key = typeof args?.capability === 'string' ? args.capability.trim() : ''
      if (key === '') {
        return `action "${action}" needs a "capability" key. Declared: ${Object.keys(specs).join(', ') || '(none)'}`
      }
      if (action === 'on') return activate(key, exec)
      if (action === 'off') return deactivate(key, exec)
      return `Unknown action "${action}". Use list, on or off.`
    },
  })

  ctx.effect(() => async () => {
    disposeTool()
    for (const owner of mounted.values()) {
      for (const dispose of owner.values()) {
        try {
          await dispose()
        } catch {
          // Best-effort during teardown; the owning fiber is going away anyway.
        }
      }
      owner.clear()
    }
    mounted.clear()
  }, 'blockfire-capabilities')
}
