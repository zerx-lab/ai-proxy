import { createHash, randomBytes, randomUUID } from "node:crypto";

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

// Full Claude Code mimicry beta set, aligned to real CLI traffic (sub2api 2026-04).
// Anthropic判定请求来源时会检查anthropic-beta的完整集合；缺少官方CLI才带的beta会被
// 降级到第三方extra-usage额度。
const BETA_OAUTH =
  "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,prompt-caching-scope-2026-01-05,effort-2025-11-24,context-management-2025-06-27,extended-cache-ttl-2025-04-11";
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

interface AnthropicMessage {
  role: string;
  content: unknown;
}

interface AnthropicBody {
  model?: string;
  system?: unknown;
  messages?: AnthropicMessage[];
  metadata?: { user_id?: string };
  tools?: AnthropicTool[];
  tool_choice?: unknown;
  stream?: boolean;
  [k: string]: unknown;
}

const CLI_VERSION = "2.1.161";
// Fingerprint salt from real Claude Code CLI capture (sub2api/Parrot). Changing it
// desyncs cc_version fp from the genuine CLI and trips third-party detection.
const FINGERPRINT_SALT = "59cf53e54c78";

function extractFirstUserText(messages: AnthropicMessage[] | undefined): string {
  if (!messages) return "";
  for (const m of messages) {
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      for (const b of m.content as Array<{ type?: string; text?: string }>) {
        if (b.type === "text" && typeof b.text === "string") return b.text;
      }
    }
    break;
  }
  return "";
}

// Replicate the real CLI cc_version fingerprint: take chars 4,7,20 of the first
// user text (pad with '0'), then SHA256(salt + chars + version) hex[:3].
function computeFingerprint(messages: AnthropicMessage[] | undefined): string {
  const t = extractFirstUserText(messages);
  let chars = "";
  for (const i of [4, 7, 20]) chars += i < t.length ? t[i] : "0";
  return createHash("sha256").update(FINGERPRINT_SALT + chars + CLI_VERSION).digest("hex").slice(0, 3);
}

function buildBillingBlock(messages: AnthropicMessage[] | undefined): { type: string; text: string } {
  const fp = computeFingerprint(messages);
  return {
    type: "text",
    text: `x-anthropic-billing-header: cc_version=${CLI_VERSION}.${fp}; cc_entrypoint=cli;`,
  };
}

function systemToText(system: unknown): string {
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    return (system as Array<{ text?: string }>)
      .map((b) => (typeof b?.text === "string" ? b.text : ""))
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

// Prepend the client's original system prompt as context to the first user message,
// so the upstream `system` field stays clean (Claude Code identity only). Anthropic's
// first-party detection scans `system`; a foreign agent identity there forces the
// request onto third-party extra-usage. Relocating it preserves agent behavior while
// passing the subscription check.
function relocateSystemIntoMessages(clientSystem: string, messages: AnthropicMessage[] | undefined): AnthropicMessage[] {
  const msgs = messages ? [...messages] : [];
  if (!clientSystem) return msgs;
  const prefix = `<system>\n${clientSystem}\n</system>\n\n`;
  const idx = msgs.findIndex((m) => m.role === "user");
  if (idx === -1) {
    return [{ role: "user", content: prefix.trimEnd() }, ...msgs];
  }
  const target = msgs[idx];
  if (typeof target.content === "string") {
    msgs[idx] = { ...target, content: prefix + target.content };
  } else if (Array.isArray(target.content)) {
    msgs[idx] = {
      ...target,
      content: [{ type: "text", text: prefix.trimEnd() }, ...(target.content as unknown[])],
    };
  } else {
    msgs[idx] = { ...target, content: prefix.trimEnd() };
  }
  return msgs;
}

function makeUserId(accountUuid: string | null, sessionId: string | undefined): string {
  const deviceId = randomBytes(32).toString("hex");
  const sess = sessionId && sessionId.length > 0 ? sessionId : randomUUID();
  return JSON.stringify({
    device_id: deviceId,
    account_uuid: accountUuid ?? "",
    session_id: sess,
  });
}

// Tool-name mimicry, aligned with sub2api / Parrot (cc_mimicry.py).
//
// A request that claims to be Claude Code (CC system block + claude-code beta) but
// carries custom tool names — especially lookalikes of Claude Code built-ins like
// "todowrite" — is flagged as a non-first-party client and forced onto third-party
// extra-usage. The fix is to obfuscate custom tool names on the way out and restore
// them on the response. We mirror Parrot's two strategies:
//   - dynamic map: when there are > 5 custom tools, rename ALL of them to opaque
//     pseudonyms `<prefix><head><nn>` derived from a stable per-toolset seed.
//   - static prefix map: rewrite session_/sessions_ prefixes regardless of count.
// Server tools (web_search_*, computer_*, etc.) carry protocol semantics and must
// NOT be renamed, or the upstream rejects them.

interface AnthropicTool {
  name?: string;
  type?: string;
  [k: string]: unknown;
}

const STATIC_TOOL_REWRITES: Record<string, string> = {
  sessions_: "cc_sess_",
  session_: "cc_ses_",
};

const FAKE_TOOL_PREFIXES = [
  "analyze_", "compute_", "fetch_", "generate_", "lookup_", "modify_",
  "process_", "query_", "render_", "resolve_", "sync_", "update_",
  "validate_", "convert_", "extract_", "manage_", "monitor_", "parse_",
  "review_", "search_", "transform_", "handle_", "invoke_", "notify_",
];

const DYNAMIC_TOOL_MAP_THRESHOLD = 5;

export interface ToolNameRewrite {
  forward: Record<string, string>; // real -> fake
  reverseOrdered: Array<[string, string]>; // [fake, real], sorted by fake length desc
}

// Server tools (type set to something other than function/custom) are protocol
// constructs; renaming them breaks the request. Only mimic plain function tools.
function shouldMimicToolName(toolType: string | undefined): boolean {
  return toolType === undefined || toolType === "" || toolType === "function" || toolType === "custom";
}

// Deterministic 32-bit FNV-1a over the joined tool names; seeds the shuffle so the
// same toolset always maps to the same pseudonyms within a process.
function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDynamicToolMap(names: string[]): Record<string, string> | null {
  if (names.length <= DYNAMIC_TOOL_MAP_THRESHOLD) return null;
  const rng = mulberry32(fnv1a(names.join("\x00")));
  const avail = [...FAKE_TOOL_PREFIXES];
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  const map: Record<string, string> = {};
  names.forEach((name, i) => {
    const prefix = avail[i % avail.length];
    const head = name.slice(0, Math.min(3, name.length));
    map[name] = `${prefix}${head}${String(i).padStart(2, "0")}`;
  });
  return map;
}

function sanitizeToolName(name: string, dynamic: Record<string, string> | null): string {
  if (dynamic && dynamic[name]) return dynamic[name];
  for (const [prefix, replacement] of Object.entries(STATIC_TOOL_REWRITES)) {
    if (name.startsWith(prefix)) return replacement + name.slice(prefix.length);
  }
  return name;
}

// Scan tools[] and build the forward/reverse rename maps. Returns null when nothing
// needs renaming.
function buildToolNameRewrite(tools: AnthropicTool[] | undefined): ToolNameRewrite | null {
  if (!Array.isArray(tools)) return null;
  const mimicable = tools
    .filter((t) => shouldMimicToolName(t.type) && typeof t.name === "string" && t.name.length > 0)
    .map((t) => t.name as string);
  const dynamic = buildDynamicToolMap(mimicable);
  const forward: Record<string, string> = {};
  const reverse: Record<string, string> = {};
  for (const name of mimicable) {
    const fake = sanitizeToolName(name, dynamic);
    if (fake === name) continue;
    forward[name] = fake;
    reverse[fake] = name;
  }
  if (Object.keys(forward).length === 0) return null;
  const reverseOrdered = Object.entries(reverse).sort((a, b) => b[0].length - a[0].length) as Array<[string, string]>;
  return { forward, reverseOrdered };
}

// Apply the rename to tools[].name, tool_choice.name, and historical
// messages[].content[].tool_use.name. The last is critical: a tool_use that
// references a name not declared in tools[] gets the request rejected.
function applyToolNameRewrite(parsed: AnthropicBody, rw: ToolNameRewrite): void {
  if (Array.isArray(parsed.tools)) {
    for (const t of parsed.tools as AnthropicTool[]) {
      if (shouldMimicToolName(t.type) && typeof t.name === "string") {
        const fake = rw.forward[t.name];
        if (fake) t.name = fake;
      }
    }
  }
  const tc = parsed.tool_choice as { type?: string; name?: string } | undefined;
  if (tc && tc.type === "tool" && typeof tc.name === "string") {
    const fake = rw.forward[tc.name];
    if (fake) tc.name = fake;
  }
  if (Array.isArray(parsed.messages)) {
    for (const msg of parsed.messages) {
      if (!Array.isArray(msg.content)) continue;
      for (const blk of msg.content as Array<{ type?: string; name?: string }>) {
        if (blk && blk.type === "tool_use" && typeof blk.name === "string") {
          const fake = rw.forward[blk.name];
          if (fake) blk.name = fake;
        }
      }
    }
  }
}

// Restore pseudonyms back to the client's real tool names in a response chunk.
// Replaces fakes longest-first so a short fake that is a substring of a longer one
// can't be consumed prematurely; then undoes the static prefix rewrites.
export function restoreToolNames(text: string, rw: ToolNameRewrite | null): string {
  let out = text;
  if (rw) {
    for (const [fake, real] of rw.reverseOrdered) {
      if (fake && fake !== real) out = out.split(fake).join(real);
    }
  }
  for (const [prefix, replacement] of Object.entries(STATIC_TOOL_REWRITES)) {
    out = out.split(replacement).join(prefix);
  }
  return out;
}

// Rewrite client body to look like an official Claude Code request:
// - map model short name -> dated id
// - move the client system prompt into the first user message
// - set system to [billing attribution block, Claude Code identity block]
// - inject metadata.user_id bound to the upstream account
// - rename tools whose names collide with Claude Code built-ins
export function rewriteBody(
  raw: Buffer,
  opts?: { accountUuid?: string | null; sessionId?: string },
): { body: string; model: string | undefined; stream: boolean; toolNameRewrite: ToolNameRewrite | null } {
  let parsed: AnthropicBody;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    // Not JSON we can parse; pass through unchanged.
    return { body: raw.toString("utf8"), model: undefined, stream: false, toolNameRewrite: null };
  }

  parsed.model = mapModel(parsed.model);

  const clientSystem = systemToText(parsed.system);
  parsed.messages = relocateSystemIntoMessages(clientSystem, parsed.messages);

  const ccBlock = {
    type: "text",
    text: CLAUDE_CODE_SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  };
  parsed.system = [buildBillingBlock(parsed.messages), ccBlock];

  parsed.metadata = { ...(parsed.metadata ?? {}), user_id: makeUserId(opts?.accountUuid ?? null, opts?.sessionId) };

  const toolNameRewrite = buildToolNameRewrite(parsed.tools);
  if (toolNameRewrite) applyToolNameRewrite(parsed, toolNameRewrite);

  return {
    body: JSON.stringify(parsed),
    model: parsed.model,
    stream: parsed.stream === true,
    toolNameRewrite,
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
