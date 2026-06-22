// Claude Code impersonation: these headers make the request look like the official
// CLI, avoiding third-party downgrade on OAuth (subscription) accounts.
export const UPSTREAM_URL = "https://api.anthropic.com/v1/messages?beta=true";

export const CLAUDE_CODE_SYSTEM_PROMPT =
  "You are Claude Code, Anthropic's official CLI for Claude.";

const STAINLESS_HEADERS: Record<string, string> = {
  "User-Agent": "claude-cli/2.1.161 (external, cli)",
  "X-Stainless-Lang": "js",
  "X-Stainless-Package-Version": "0.94.0",
  "X-Stainless-OS": "Linux",
  "X-Stainless-Arch": "arm64",
  "X-Stainless-Runtime": "node",
  "X-Stainless-Runtime-Version": "v24.3.0",
  "X-Stainless-Retry-Count": "0",
  "X-Stainless-Timeout": "600",
  "X-App": "cli",
  "Anthropic-Dangerous-Direct-Browser-Access": "true",
};

const BETA_OAUTH =
  "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";
const BETA_APIKEY =
  "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";

// Short model name -> dated upstream id.
const MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4-5": "claude-sonnet-4-5-20250929",
  "claude-opus-4-1": "claude-opus-4-1-20250805",
  "claude-opus-4": "claude-opus-4-20250514",
  "claude-haiku-4-5": "claude-haiku-4-5-20251001",
  "claude-3-5-haiku": "claude-3-5-haiku-20241022",
};

export function mapModel(model: string | undefined): string | undefined {
  if (!model) return model;
  return MODEL_MAP[model] ?? model;
}

export function buildUpstreamHeaders(authType: string, credential: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-beta": authType === "oauth" ? BETA_OAUTH : BETA_APIKEY,
    ...STAINLESS_HEADERS,
  };
  if (authType === "oauth") {
    headers["Authorization"] = `Bearer ${credential}`;
  } else {
    headers["x-api-key"] = credential;
  }
  return headers;
}

interface AnthropicBody {
  model?: string;
  system?: unknown;
  metadata?: { user_id?: string };
  stream?: boolean;
  [k: string]: unknown;
}

// Rewrite client body to look like an official Claude Code request:
// - map model short name -> dated id
// - prepend the Claude Code system prompt block (cache_control ephemeral)
export function rewriteBody(raw: Buffer): { body: string; model: string | undefined; stream: boolean } {
  let parsed: AnthropicBody;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    // Not JSON we can parse; pass through unchanged.
    return { body: raw.toString("utf8"), model: undefined, stream: false };
  }

  parsed.model = mapModel(parsed.model);

  const ccBlock = {
    type: "text",
    text: CLAUDE_CODE_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  };

  if (typeof parsed.system === "string") {
    parsed.system = [ccBlock, { type: "text", text: parsed.system }];
  } else if (Array.isArray(parsed.system)) {
    const first = parsed.system[0] as { text?: string } | undefined;
    if (!first || first.text !== CLAUDE_CODE_SYSTEM_PROMPT) {
      parsed.system = [ccBlock, ...parsed.system];
    }
  } else {
    parsed.system = [ccBlock];
  }

  return {
    body: JSON.stringify(parsed),
    model: parsed.model,
    stream: parsed.stream === true,
  };
}

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

// Extract usage from a non-streaming JSON response body.
export function parseUsageFromJson(text: string): Usage {
  try {
    const obj = JSON.parse(text) as { usage?: Record<string, number> };
    return mapUsage(obj.usage);
  } catch {
    return {};
  }
}

// Extract usage from a captured SSE stream (message_start + message_delta events).
export function parseUsageFromSse(sse: string): Usage {
  const usage: Usage = {};
  for (const line of sse.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === "[DONE]") continue;
    try {
      const evt = JSON.parse(payload) as {
        message?: { usage?: Record<string, number> };
        usage?: Record<string, number>;
      };
      const u = evt.message?.usage ?? evt.usage;
      if (u) mergeDefined(usage, mapUsage(u));
    } catch {
      // ignore non-JSON data lines
    }
  }
  return usage;
}

function mergeDefined(target: Usage, src: Usage): void {
  for (const [k, v] of Object.entries(src)) {
    if (v !== undefined) (target as Record<string, number>)[k] = v;
  }
}

function mapUsage(u: Record<string, number> | undefined): Usage {
  if (!u) return {};
  return {
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens,
    cacheCreationTokens: u.cache_creation_input_tokens,
  };
}
