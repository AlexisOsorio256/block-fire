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
 * `host.plugin()` returns a Cordis Fiber: activation is awaited with
 * `fiber.await()` (it rethrows startup errors) and release is `fiber.dispose()`.
 * Bookkeeping per session/capability is written BEFORE any await, so two
 * concurrent `on` calls see the same entry instead of mounting twice, and the
 * entry is deleted when the owning session scope dies (effect on the owner
 * context) — a resumed session starts with the capability OFF instead of
 * inheriting a stale ACTIVE. `off` resolves only after the disposal settles; a
 * failed release keeps the entry in a `stuck` state so `list` never lies.
 *
 * TOOL DISCOVERY FOR `list`
 * A capability may declare `toolPrefix` (for example `mcp__blender__`). When it
 * does not, MCP-style prefixes are still derived from `config.serverName`, and
 * otherwise `list` falls back to the tools the capability actually ADDED at
 * activation time (schema diff before/after mount) — that is how the Cordis
 * toolset (`cordis_*`) reports its real names without assuming any bridge shape.
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
  /**
   * Per-session bookkeeping: ownerKey -> capability -> entry. An entry exists in
   * state `starting` from the synchronous moment `on` begins, becomes `active`
   * (with its Fiber disposer and the tools it added) once the mount settles, or
   * `stuck` when a release failed. Removing it always follows the owner's own
   * lifecycle: the entry carries an effect on the owner context, so closing or
   * resuming a session never leaves a stale ACTIVE behind.
   *
   * @type {Map<string, Map<string, {
   *   state: 'starting'|'active'|'stuck',
   *   dispose?: () => unknown,
   *   discovered?: Set<string>,
   * }>>}
   */
  const mounted = new Map()

  /** The calling session's agent, or undefined when no session issued the call. */
  const ownerOf = (exec) => (exec?.agent !== undefined && exec.agent !== null ? exec.agent : undefined)
  const ownerKeyOf = (exec) => {
    const agent = ownerOf(exec)
    if (agent === undefined || typeof agent.id !== 'string') return undefined
    return agent.id
  }
  /** The session context a capability mounts into, or undefined without a session. */
  const ownerCtxOf = (exec) => {
    const agent = ownerOf(exec)
    if (agent !== undefined && agent.ctx !== undefined && typeof agent.ctx.plugin === 'function') return agent.ctx
    return undefined
  }
  const ofOwner = (ownerKey) => {
    let entry = mounted.get(ownerKey)
    if (entry === undefined) {
      entry = new Map()
      mounted.set(ownerKey, entry)
    }
    return entry
  }

  /**
   * The scope key a context is tagged with. Falls back to the context itself
   * when the scope package cannot resolve (read-only listing must not depend on
   * node_modules layout); every real runtime path resolves through `scopeOf`.
   */
  async function scopeKeyOf(scope) {
    try {
      const { scopeOf } = await import('@deepseek-ai/dsh-scope')
      return scopeOf(scope)
    } catch {
      return scope
    }
  }

  /**
   * Schema names a scope sees, or undefined when the schema service is
   * unavailable. Read-only: a scopeless query answers with the global view, so
   * `list` can still name tools when called outside a session.
   */
  async function schemaNames(scope) {
    try {
      return ctx.tools.schemas(scope === undefined ? undefined : await scopeKeyOf(scope))
        .map((schema) => schema?.name)
        .filter((toolName) => typeof toolName === 'string')
    } catch {
      return undefined
    }
  }

  /** Declared selector first; MCP-style derivation from serverName second. */
  const toolPrefixOf = (spec) => {
    if (typeof spec?.toolPrefix === 'string' && spec.toolPrefix !== '') return spec.toolPrefix
    const serverName = spec?.config?.serverName
    return typeof serverName === 'string' && serverName !== '' ? `mcp__${serverName}__` : undefined
  }

  /**
   * Tools a capability contributes right now: names matching its declared or
   * derived prefix, plus the names it actually added when it was mounted (the
   * activation diff). Capabilities without any selector rely on the diff, which
   * is measured, not assumed.
   */
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
    const owner = ownerKey !== undefined ? mounted.get(ownerKey) : undefined
    const keys = Object.keys(specs)
    if (keys.length === 0) return 'No optional capabilities are declared in this preset.'
    const lines = ['Optional capabilities (off by default; each costs tool-schema tokens only while active):']
    for (const key of keys) {
      const spec = specs[key]
      const entry = owner?.get(key)
      const state = entry === undefined
        ? 'off'
        : entry.state === 'starting'
          ? 'STARTING'
          : entry.state === 'stuck'
            ? 'ACTIVE (release failed; call off again to retry)'
            : 'ACTIVE'
      lines.push(`- ${key} [${state}] — ${spec?.whenToUse ?? 'no description'}`)
      if (entry !== undefined && entry.state !== 'starting') {
        const names = await registeredNames(spec, entry, ownerCtxOf(exec) ?? ctx)
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
    const host = ownerCtxOf(exec)
    const ownerKey = ownerKeyOf(exec)
    if (host === undefined || ownerKey === undefined) {
      return `Capability "${key}" can only be activated from a session: this call carried no agent context to mount into.`
    }
    const owner = ofOwner(ownerKey)
    const existing = owner.get(key)
    if (existing !== undefined) {
      return existing.state === 'starting'
        ? `Capability "${key}" is already starting in this session.`
        : `Capability "${key}" is already active in this session.`
    }
    if (typeof spec.package !== 'string' || spec.package === '') {
      return `Capability "${key}" has no "package" configured.`
    }

    // Claimed synchronously, BEFORE the first await: a concurrent `on` sees
    // `starting` instead of issuing a second mount. Every early return below
    // happens while state is still `starting`, so the finally frees the slot.
    const entry = { state: 'starting', discovered: undefined }
    owner.set(key, entry)
    try {
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

      let before
      let fiber
      try {
        before = await schemaNames(host)
        fiber = host.plugin(plugin, spec.config ?? {})
        await fiber.await()
      } catch (error) {
        // Best-effort cleanup of a partially started mount. Its failure must not
        // replace the startup error as the answer to the caller.
        let cleanupNote = ''
        if (fiber !== undefined && typeof fiber.dispose === 'function') {
          try {
            await fiber.dispose()
          } catch (cleanupError) {
            cleanupNote = ` Cleaning the partial mount also failed: ${String(cleanupError?.message ?? cleanupError)}`
          }
        }
        owner.delete(key)
        return `Capability "${key}" failed to start: ${String(error?.message ?? error)}.${cleanupNote} Nothing was left mounted.`
      }

      // Remember what this capability actually added, so `list` can name its real
      // tools even when no prefix rule applies to it.
      if (before !== undefined) {
        const after = await schemaNames(host)
        if (after !== undefined) {
          const added = new Set(after.filter((toolName) => !before.includes(toolName)))
          if (added.size > 0) entry.discovered = added
        }
      }

      entry.state = 'active'
      entry.dispose = typeof fiber.dispose === 'function' ? fiber.dispose : undefined
      // Follow the owner's lifecycle: when this session scope dies the entry goes
      // with it, so a resumed session reports the capability OFF, never ACTIVE.
      if (typeof host.effect === 'function') {
        host.effect(() => async () => {
          const current = mounted.get(ownerKey)
          if (current?.get(key) === entry) {
            current.delete(key)
            if (current.size === 0) mounted.delete(ownerKey)
          }
        }, `blockfire-capability:${key}`)
      }
      return [
        `Capability "${key}" activated from ${spec.package} for this session.`,
        'Its tools appear in the catalog on the next step (a stdio bridge needs a moment to list them).',
        'This changes the tool-schema prefix for this session: KV-cache reuse resumes from the new prefix.',
        'Call this tool again with action "list" to confirm the tools are registered, or action "off" to release them.',
      ].join('\n')
    } finally {
      if (entry.state === 'starting') owner.delete(key)
    }
  }

  async function deactivate(key, exec) {
    const ownerKey = ownerKeyOf(exec)
    const entry = ownerKey !== undefined ? mounted.get(ownerKey)?.get(key) : undefined
    if (entry === undefined) return `Capability "${key}" is not active in this session.`
    if (entry.state === 'starting') {
      return `Capability "${key}" is still starting; call off again in a moment.`
    }
    if (typeof entry.dispose !== 'function') {
      entry.state = 'stuck'
      return `Capability "${key}" has no disposer to call; it may still be mounted. Report this as a harness defect.`
    }
    try {
      await entry.dispose()
    } catch (error) {
      // Success is only announced after the disposal settled. Keeping the entry
      // (as `stuck`) means `list` still shows it and another `off` can retry.
      entry.state = 'stuck'
      return [
        `Capability "${key}" disposed with an error: ${String(error?.message ?? error)}`,
        'Its tools may still be visible; call off again to retry, and treat "stuck" in list as still mounted.',
      ].join('\n')
    }
    const owner = mounted.get(ownerKey)
    owner?.delete(key)
    if (owner !== undefined && owner.size === 0) mounted.delete(ownerKey)
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
      for (const entry of owner.values()) {
        if (typeof entry.dispose !== 'function') continue
        try {
          await entry.dispose()
        } catch {
          // Best-effort during teardown; the owning fiber is going away anyway.
        }
      }
      owner.clear()
    }
    mounted.clear()
  }, 'blockfire-capabilities')
}
