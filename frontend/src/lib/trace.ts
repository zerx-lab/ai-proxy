// Normalizes Anthropic Messages API request/response captures into a flat,
// renderable conversation timeline — the data behind the trace detail view.

export type Role = 'system' | 'user' | 'assistant' | 'tool'

export interface TextPart {
  kind: 'text'
  text: string
}
export interface ThinkingPart {
  kind: 'thinking'
  text: string
}
export interface ToolUsePart {
  kind: 'tool_use'
  name: string
  input: unknown
  id?: string
}
export interface ToolResultPart {
  kind: 'tool_result'
  content: string
  toolUseId?: string
  isError?: boolean
}
export interface ImagePart {
  kind: 'image'
  mediaType?: string
}
export interface UnknownPart {
  kind: 'unknown'
  raw: unknown
}

export type Part = TextPart | ThinkingPart | ToolUsePart | ToolResultPart | ImagePart | UnknownPart

export interface ChatMessage {
  role: Role
  parts: Part[]
}

export interface ParsedTrace {
  messages: ChatMessage[]
  params: Record<string, unknown> // model, temperature, max_tokens, tools count, etc.
  stopReason?: string
  parseError?: string
}

function safeParse(text: string | null): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function stringifyContent(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map((b) => {
        if (b && typeof b === 'object' && 'text' in (b as object)) return String((b as { text: unknown }).text)
        return typeof b === 'string' ? b : JSON.stringify(b)
      })
      .join('\n')
  }
  return JSON.stringify(c)
}

function parseBlock(b: unknown): Part {
  if (typeof b === 'string') return { kind: 'text', text: b }
  if (!b || typeof b !== 'object') return { kind: 'unknown', raw: b }
  const o = b as Record<string, unknown>
  switch (o.type) {
    case 'text':
      return { kind: 'text', text: String(o.text ?? '') }
    case 'thinking':
      return { kind: 'thinking', text: String(o.thinking ?? o.text ?? '') }
    case 'tool_use':
      return { kind: 'tool_use', name: String(o.name ?? 'tool'), input: o.input, id: o.id as string | undefined }
    case 'tool_result':
      return {
        kind: 'tool_result',
        content: stringifyContent(o.content),
        toolUseId: o.tool_use_id as string | undefined,
        isError: o.is_error === true,
      }
    case 'image':
      return {
        kind: 'image',
        mediaType:
          o.source && typeof o.source === 'object'
            ? ((o.source as Record<string, unknown>).media_type as string | undefined)
            : undefined,
      }
    default:
      return { kind: 'unknown', raw: b }
  }
}

function partsFromContent(content: unknown): Part[] {
  if (typeof content === 'string') return [{ kind: 'text', text: content }]
  if (Array.isArray(content)) return content.map(parseBlock)
  return [{ kind: 'unknown', raw: content }]
}

function systemToParts(system: unknown): Part[] {
  if (typeof system === 'string') return [{ kind: 'text', text: system }]
  if (Array.isArray(system)) return system.map(parseBlock)
  return []
}

// Reconstruct an assistant message + usage from a captured SSE event stream.
function parseSse(sse: string): { parts: Part[]; stopReason?: string } {
  const blocks: Record<number, { type?: string; text: string; name?: string; json: string }> = {}
  let stopReason: string | undefined
  for (const line of sse.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    let evt: Record<string, unknown>
    try {
      evt = JSON.parse(payload)
    } catch {
      continue
    }
    const type = evt.type
    if (type === 'content_block_start') {
      const idx = Number(evt.index ?? 0)
      const cb = (evt.content_block ?? {}) as Record<string, unknown>
      blocks[idx] = { type: cb.type as string, text: '', name: cb.name as string | undefined, json: '' }
    } else if (type === 'content_block_delta') {
      const idx = Number(evt.index ?? 0)
      const d = (evt.delta ?? {}) as Record<string, unknown>
      blocks[idx] ??= { text: '', json: '' }
      if (typeof d.text === 'string') blocks[idx].text += d.text
      if (typeof d.thinking === 'string') blocks[idx].text += d.thinking
      if (typeof d.partial_json === 'string') blocks[idx].json += d.partial_json
    } else if (type === 'message_delta') {
      const d = (evt.delta ?? {}) as Record<string, unknown>
      if (typeof d.stop_reason === 'string') stopReason = d.stop_reason
    }
  }
  const parts: Part[] = Object.keys(blocks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => {
      const b = blocks[i]
      if (b.type === 'tool_use') {
        let input: unknown = b.json
        try {
          input = JSON.parse(b.json)
        } catch {
          /* keep raw */
        }
        return { kind: 'tool_use', name: b.name ?? 'tool', input } as Part
      }
      if (b.type === 'thinking') return { kind: 'thinking', text: b.text } as Part
      return { kind: 'text', text: b.text } as Part
    })
    .filter((p) => (p.kind === 'text' ? p.text.length > 0 : true))
  return { parts, stopReason }
}

export function parseTrace(
  requestBody: string | null,
  responseBody: string | null,
  stream: boolean | null,
): ParsedTrace {
  const messages: ChatMessage[] = []
  const params: Record<string, unknown> = {}

  const req = safeParse(requestBody) as Record<string, unknown> | null
  if (req) {
    for (const k of ['model', 'max_tokens', 'temperature', 'top_p', 'top_k']) {
      if (req[k] !== undefined) params[k] = req[k]
    }
    if (Array.isArray(req.tools)) params.tools = (req.tools as unknown[]).length
    if (req.system !== undefined) {
      const parts = systemToParts(req.system)
      if (parts.length) messages.push({ role: 'system', parts })
    }
    if (Array.isArray(req.messages)) {
      for (const m of req.messages as Array<Record<string, unknown>>) {
        const role = m.role === 'assistant' ? 'assistant' : 'user'
        const parts = partsFromContent(m.content)
        // Surface tool_result blocks as their own "tool" lane for readability.
        const toolParts = parts.filter((p) => p.kind === 'tool_result')
        const rest = parts.filter((p) => p.kind !== 'tool_result')
        if (toolParts.length) messages.push({ role: 'tool', parts: toolParts })
        if (rest.length) messages.push({ role, parts: rest })
      }
    }
  }

  let stopReason: string | undefined
  if (stream && responseBody && responseBody.includes('event:')) {
    const { parts, stopReason: sr } = parseSse(responseBody)
    if (parts.length) messages.push({ role: 'assistant', parts })
    stopReason = sr
  } else {
    const res = safeParse(responseBody) as Record<string, unknown> | null
    if (res) {
      if (res.content !== undefined) {
        messages.push({ role: 'assistant', parts: partsFromContent(res.content) })
      } else if (res.error) {
        messages.push({
          role: 'assistant',
          parts: [{ kind: 'text', text: JSON.stringify(res.error, null, 2) }],
        })
      }
      if (typeof res.stop_reason === 'string') stopReason = res.stop_reason
    }
  }

  return {
    messages,
    params,
    stopReason,
    parseError: !req && requestBody ? 'request not JSON' : undefined,
  }
}
