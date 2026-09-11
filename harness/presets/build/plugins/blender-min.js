/**
 * BLOCKFIRE minimal Blender craft loop — a JIT capability plugin, never permanent surface.
 *
 * WHY THIS EXISTS
 * The full Blender MCP bridge advertises ~28 tools (~7.4k tokens of schema),
 * most of them 3D-asset marketplaces (Polyhaven, Sketchfab, Hyper3D, Hunyuan)
 * that craft work never calls. Real interactive animation work uses almost
 * exclusively two primitives in a tight loop:
 *
 *   screenshot → focal change → screenshot → judge
 *
 * This plugin exposes exactly those two primitives — `blender_exec` (Execute
 * Blender Code) and `blender_screenshot` (Get Viewport Screenshot) — and
 * nothing else. The full bridge stays one `bf_capability` call away as the
 * `blender-full` capability for the sessions that genuinely need the rest.
 *
 * WHY A PROXY INSTEAD OF FILTERING THE BRIDGE
 * Neither layer that could filter offers a filter: the `dsh-mcp-client`
 * bridge's Config schema has no tool allowlist (it registers every tool the
 * server lists), and the blender-mcp server itself has no subset flag. And the
 * tool registry cannot hide them afterwards either: `tools.restrict()` filters
 * only the INHERITED surface, while bridge tools register into the owning
 * session's own layer, which is always visible to it. So the minimal supported
 * layer is a small plugin that registers two tools and forwards their calls
 * over MCP to the same `blender-mcp` binary — no fork, no dependency edits,
 * no Blender logic copied (scene/rig/export knowledge stays in the server and
 * the addon; this file only carries the MCP envelope and the image-admission
 * plumbing the host already provides for any tool).
 *
 * LIFECYCLE AND FAILURE CONTRACT
 * Like the capability router, this module imports nothing at load time: the
 * MCP SDK is resolved lazily on the first call, so a missing bridge link can
 * never stop the preset from mounting. Mounting registers the two tools
 * synchronously and spawns nothing; the server process starts on the first
 * execute and is closed when the owning session scope dies. Every connection
 * or Blender-side failure surfaces as an actionable tool error (open Blender
 * with the right .blend, run `tools/bf doctor`), never as a mount failure.
 */

export const name = 'blockfire-blender-min'
export const inject = ['tools']

const RAW_EXEC = 'execute_blender_code'
const RAW_SCREENSHOT = 'get_viewport_screenshot'

/** Model-facing names: short on purpose — they are paid for in every call while active. */
export const TOOL_EXEC = 'blender_exec'
export const TOOL_SCREENSHOT = 'blender_screenshot'

/** Same binary the full bridge uses; configurable the same way. */
const defaultCommand = () =>
  process.env.BLOCKFIRE_BLENDER_MCP ??
  `${process.env.HOME ?? ''}/.local/share/blockfire-tools/blender-mcp-venv/bin/blender-mcp`

const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/** Generic MCP text projection: text blocks joined, anything else a placeholder line. */
function extractText(content) {
  const lines = []
  for (const block of content ?? []) {
    if (block !== null && typeof block === 'object' && !Array.isArray(block) && block.type === 'text' && typeof block.text === 'string') {
      lines.push(block.text)
    } else if (block !== null && typeof block === 'object' && !Array.isArray(block)) {
      lines.push(`[${block.type ?? 'unknown'} result: not text; see structured content]`)
    }
  }
  return lines.join('\n')
}

const BLENDER_DOWN = [
  'Blender MCP did not answer.',
  'Open Blender (GUI) with the right .blend and check `tools/bf doctor` reports Blender MCP OK (addon listening on 127.0.0.1:9876).',
  'Then retry this call; the connection is re-established automatically.',
].join(' ')

export function apply(ctx, config) {
  const command = typeof config?.command === 'string' && config.command !== '' ? config.command : defaultCommand()
  const args = Array.isArray(config?.args) ? config.args : []
  const env = config?.env !== undefined ? config.env : undefined
  const cwd = typeof config?.cwd === 'string' && config.cwd !== '' ? config.cwd : undefined
  const timeoutMs = Number.isFinite(config?.toolCallTimeoutMs) && config.toolCallTimeoutMs > 0
    ? config.toolCallTimeoutMs
    : 120000

  /** One lazy MCP client per mounted session; dropped on transport failure so the next call reconnects. */
  let clientPromise = undefined
  const dropClient = () => { clientPromise = undefined }

  async function ensureClient() {
    if (clientPromise !== undefined) return clientPromise
    clientPromise = (async () => {
      let sdk, stdio
      try {
        sdk = await import('@modelcontextprotocol/sdk/client/index.js')
        stdio = await import('@modelcontextprotocol/sdk/client/stdio.js')
      } catch (error) {
        throw new Error(
          `The Blender craft tools need the MCP client library and it did not resolve: ${String(error?.message ?? error)}. ` +
          'Run `harness/install.sh` (it links node_modules into the installed preset) and try again.',
        )
      }
      const client = new sdk.Client({ name: 'blockfire-blender-min', version: '0.0.1' }, { capabilities: {} })
      try {
        await client.connect(new stdio.StdioClientTransport({ command, args, ...(env !== undefined ? { env } : {}), ...(cwd !== undefined ? { cwd } : {}) }))
      } catch (error) {
        try { await client.close() } catch {}
        throw new Error(`${BLENDER_DOWN} (server start failed: ${String(error?.message ?? error)})`)
      }
      return client
    })()
    try {
      return await clientPromise
    } catch (error) {
      dropClient()
      throw error
    }
  }

  async function callRaw(rawName, rawArgs, exec) {
    const client = await ensureClient()
    try {
      return await client.callTool({ name: rawName, arguments: rawArgs }, undefined, {
        signal: exec?.signal,
        timeout: timeoutMs,
      })
    } catch (error) {
      // A broken pipe is worth exactly one automatic reconnect; anything else
      // (including Blender-side errors like bad code) belongs to the caller.
      const message = String(error?.message ?? error)
      if (/closed|terminated|EPIPE|ECONNRESET|not connected/i.test(message)) {
        dropClient()
        try { await client.close() } catch {}
        try {
          const retry = await ensureClient()
          return await retry.callTool({ name: rawName, arguments: rawArgs }, undefined, {
            signal: exec?.signal,
            timeout: timeoutMs,
          })
        } catch (retryError) {
          throw new Error(`${BLENDER_DOWN} (${String(retryError?.message ?? retryError)})`)
        }
      }
      throw error instanceof Error ? error : new Error(message)
    }
  }

  /**
   * Execution-local image projections, same shape as the full bridge: the tool
   * VALUE stays canonical MCP vocabulary for programmatic callers, while
   * `finalizeContent` swaps what the model sees for the admitted image refs.
   */
  const projections = new WeakMap()

  /** Durable image admission through the host's own services (attachments + llm route proof). */
  async function admitImages(ctx, exec, images) {
    for (const image of images) {
      if (!IMAGE_MEDIA_TYPES.includes(image.mimeType)) {
        throw new Error(`the screenshot media type is not PNG, JPEG, WebP, or GIF (got ${image.mimeType ?? 'unknown'})`)
      }
      if (typeof image.data !== 'string' || !CANONICAL_BASE64.test(image.data)) {
        throw new Error('the screenshot data is not canonical base64')
      }
    }
    const attachments = ctx.get('attachments')
    if (attachments === undefined) throw new Error('no attachment store is mounted')
    const routed = exec?.agent?.session?.requestHeader?.()?.config
    const provider = routed?.provider ?? exec?.agent?.options?.provider
    const model = routed?.model ?? exec?.agent?.options?.model
    const llm = ctx.get('llm')
    if (provider === undefined || model === undefined || llm === undefined) {
      throw new Error('the current model route could not be resolved')
    }
    let info
    try {
      info = await llm.resolveModelInfo(provider, model, exec?.signal)
    } catch {
      throw new Error('the current model route could not be verified')
    }
    if (info?.inputModalities === undefined || !info.inputModalities.includes('image')) {
      throw new Error(`model "${model}" does not declare image input`)
    }
    if (exec?.signal?.aborted === true) throw new Error('the tool call was canceled before image storage')
    return attachments.saveImages(images.map((image) => ({
      data: Buffer.from(image.data, 'base64'),
      mediaType: image.mimeType,
    })))
  }

  const disposers = [
    ctx.tools.register({
      name: TOOL_EXEC,
      description:
        'Execute Python code in the open Blender GUI (one focal change per call: move a bone, tweak a keyframe, adjust the rig). ' +
        'Part of the minimal craft loop: screenshot, focal change, screenshot, judge. ' +
        'For scene queries, asset marketplaces or anything beyond executing code, activate the blender-full capability instead.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The Python code to execute in Blender.' },
        },
        required: ['code'],
      },
      output: {
        schema: { type: 'string' },
        render(_args, value) { return [{ type: 'text', text: String(value) }] },
      },
      async execute(args, exec) {
        const code = typeof args?.code === 'string' ? args.code : ''
        if (code === '') throw new Error('blender_exec needs a "code" string with the Python to run in Blender.')
        let result
        try {
          result = await callRaw(RAW_EXEC, { code }, exec)
        } catch (error) {
          throw new Error(String(error?.message ?? error))
        }
        if (result?.isError === true) throw new Error(extractText(result?.content) || 'Blender reported an error with no message.')
        return extractText(result?.content) || '(Blender returned no text)'
      },
    }),

    ctx.tools.register({
      name: TOOL_SCREENSHOT,
      description:
        'Capture a screenshot of the current Blender 3D viewport and SEE it. ' +
        'Part of the minimal craft loop: screenshot, focal change, screenshot, judge. ' +
        'Call it before judging any clip, pose or rig change.',
      parameters: {
        type: 'object',
        properties: {
          max_size: { type: 'number', description: 'Longest side in pixels (default 1000).' },
        },
        required: [],
      },
      output: {
        schema: { type: 'object', properties: { content: { type: 'array', items: {} } }, required: ['content'], additionalProperties: false },
        render(_args, value) { return [{ type: 'text', text: extractText(value?.content) || '(screenshot taken)' }] },
      },
      async execute(args, exec) {
        const rawArgs = args !== null && typeof args === 'object' && Number.isFinite(args.max_size)
          ? { max_size: args.max_size }
          : {}
        let result
        try {
          result = await callRaw(RAW_SCREENSHOT, rawArgs, exec)
        } catch (error) {
          throw new Error(String(error?.message ?? error))
        }
        if (result?.isError === true) throw new Error(extractText(result?.content) || 'Blender screenshot failed with no message.')
        const content = Array.isArray(result?.content) ? result.content : []
        const value = { content }
        const images = content.filter((block) =>
          block !== null && typeof block === 'object' && !Array.isArray(block) && block.type === 'image')
        if (images.length === 0) return value
        const fallback = [{ type: 'text', text: extractText(content) || '(screenshot taken)' }]
        let projected
        try {
          const refs = await admitImages(ctx, exec, images)
          let next = 0
          projected = []
          for (const block of content) {
            if (block !== null && typeof block === 'object' && !Array.isArray(block) && block.type === 'image') {
              projected.push({ type: 'image', attachment: refs[next++] })
            } else if (block !== null && typeof block === 'object' && !Array.isArray(block) && block.type === 'text' && typeof block.text === 'string') {
              projected.push({ type: 'text', text: block.text })
            }
          }
          if (projected.length === 0) projected = fallback
        } catch (error) {
          projected = [{ type: 'text', text: `[screenshot unavailable: ${String(error?.message ?? error)}]` }]
        }
        projections.set(exec, { value, fallback, content: projected })
        return value
      },
      finalizeContent(exec, result) {
        const projection = projections.get(exec)
        if (projection === undefined) return undefined
        projections.delete(exec)
        if (result?.isError === true) return undefined
        return projection.content
      },
    }),
  ]

  ctx.effect(() => async () => {
    for (const dispose of disposers) {
      try { dispose() } catch {}
    }
    if (clientPromise !== undefined) {
      try {
        const client = await clientPromise
        await client.close()
      } catch {
        // Best-effort during teardown; the owning session scope is going away anyway.
      } finally {
        dropClient()
      }
    }
  }, 'blockfire-blender-min')
}
