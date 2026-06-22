import { describe, it, expect } from "vitest";
import {
  mapModel,
  buildUpstreamHeaders,
  rewriteBody,
  parseUsageFromJson,
  parseUsageFromSse,
  restoreToolNames,
  CLAUDE_CODE_SYSTEM_PROMPT,
} from "./upstream";

describe("mapModel", () => {
  it("maps short names to dated ids", () => {
    expect(mapModel("claude-sonnet-4-5")).toBe("claude-sonnet-4-5-20250929");
  });
  it("passes through unknown/dated models unchanged", () => {
    expect(mapModel("claude-sonnet-4-5-20250929")).toBe("claude-sonnet-4-5-20250929");
    expect(mapModel("some-future-model")).toBe("some-future-model");
  });
  it("handles undefined", () => {
    expect(mapModel(undefined)).toBeUndefined();
  });
});

describe("buildUpstreamHeaders", () => {
  it("uses Bearer + oauth beta for oauth accounts", () => {
    const h = buildUpstreamHeaders("oauth", "tok123");
    expect(h["Authorization"]).toBe("Bearer tok123");
    expect(h["x-api-key"]).toBeUndefined();
    expect(h["anthropic-beta"]).toContain("oauth-2025-04-20");
    expect(h["User-Agent"]).toContain("claude-cli");
  });
  it("uses x-api-key + non-oauth beta for apikey accounts", () => {
    const h = buildUpstreamHeaders("apikey", "sk-ant-xxx");
    expect(h["x-api-key"]).toBe("sk-ant-xxx");
    expect(h["Authorization"]).toBeUndefined();
    expect(h["anthropic-beta"]).not.toContain("oauth-2025-04-20");
  });
});

describe("rewriteBody", () => {
  it("maps model and relocates string system into the first user message", () => {
    const raw = Buffer.from(
      JSON.stringify({ model: "claude-sonnet-4-5", system: "be helpful", messages: [{ role: "user", content: "hi" }] }),
    );
    const { body, model, stream } = rewriteBody(raw, { accountUuid: "acc-uuid" });
    const parsed = JSON.parse(body);
    expect(model).toBe("claude-sonnet-4-5-20250929");
    expect(stream).toBe(false);
    // system field carries only the billing block + Claude Code identity
    expect(parsed.system).toHaveLength(2);
    expect(parsed.system[0].text).toMatch(/^x-anthropic-billing-header: cc_version=/);
    expect(parsed.system[1].text).toBe(CLAUDE_CODE_SYSTEM_PROMPT);
    expect(parsed.system[1].cache_control).toEqual({ type: "ephemeral" });
    // client system moved into the user message, original system field gone
    expect(parsed.messages[0].content).toContain("<system>\nbe helpful\n</system>");
    expect(parsed.messages[0].content).toContain("hi");
  });
  it("relocates array system blocks too", () => {
    const raw = Buffer.from(
      JSON.stringify({
        system: [{ type: "text", text: "You are OpenCode" }],
        messages: [{ role: "user", content: "go" }],
      }),
    );
    const { body } = rewriteBody(raw, { accountUuid: "acc-uuid" });
    const parsed = JSON.parse(body);
    expect(parsed.system[1].text).toBe(CLAUDE_CODE_SYSTEM_PROMPT);
    expect(parsed.messages[0].content).toContain("You are OpenCode");
  });
  it("injects metadata.user_id bound to the account uuid", () => {
    const { body } = rewriteBody(Buffer.from(JSON.stringify({ messages: [{ role: "user", content: "x" }] })), {
      accountUuid: "the-uuid",
      sessionId: "ses_abc",
    });
    const parsed = JSON.parse(body);
    const uid = JSON.parse(parsed.metadata.user_id);
    expect(uid.account_uuid).toBe("the-uuid");
    expect(uid.session_id).toBe("ses_abc");
    expect(uid.device_id).toMatch(/^[0-9a-f]{64}$/);
  });
  it("creates a user message when none present", () => {
    const { body } = rewriteBody(Buffer.from(JSON.stringify({ system: "ctx", messages: [] })), {});
    const parsed = JSON.parse(body);
    expect(parsed.messages[0].role).toBe("user");
    expect(parsed.messages[0].content).toContain("<system>\nctx\n</system>");
  });
  it("detects stream flag", () => {
    const { stream } = rewriteBody(Buffer.from(JSON.stringify({ stream: true, messages: [] })), {});
    expect(stream).toBe(true);
  });
  it("passes through non-JSON bodies unchanged", () => {
    const { body, model } = rewriteBody(Buffer.from("not json"), {});
    expect(body).toBe("not json");
    expect(model).toBeUndefined();
  });
});

describe("parseUsageFromJson", () => {
  it("extracts usage from a message response", () => {
    const u = parseUsageFromJson(
      JSON.stringify({ usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 } }),
    );
    expect(u).toEqual({ inputTokens: 10, outputTokens: 5, cacheReadTokens: 3, cacheCreationTokens: undefined });
  });
  it("returns empty on garbage", () => {
    expect(parseUsageFromJson("xxx")).toEqual({});
  });
});

describe("parseUsageFromSse", () => {
  it("merges usage from message_start and message_delta events", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"usage":{"input_tokens":100,"output_tokens":1}}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","usage":{"output_tokens":42}}',
      '',
      'data: [DONE]',
    ].join("\n");
    const u = parseUsageFromSse(sse);
    expect(u.inputTokens).toBe(100);
    expect(u.outputTokens).toBe(42); // delta overrides
  });
  it("ignores non-JSON data lines", () => {
    expect(parseUsageFromSse("data: not-json\n\n")).toEqual({});
  });
});

describe("tool name mimicry", () => {
  const elevenTools = (names: string[]) => names.map((name) => ({ name, input_schema: { type: "object" } }));

  it("renames all tools when there are more than 5 (dynamic map)", () => {
    const names = ["bash", "edit", "glob", "grep", "read", "todowrite", "task", "write"];
    const { body, toolNameRewrite } = rewriteBody(
      Buffer.from(JSON.stringify({ tools: elevenTools(names), messages: [{ role: "user", content: "hi" }] })),
      {},
    );
    expect(toolNameRewrite).not.toBeNull();
    const parsed = JSON.parse(body);
    // every tool got an opaque pseudonym, none keeps its original name
    for (const t of parsed.tools) expect(names).not.toContain(t.name);
    // reverse map round-trips
    expect(Object.keys(toolNameRewrite!.forward)).toHaveLength(names.length);
  });

  it("does not rename when 5 or fewer tools and no static-prefix match", () => {
    const names = ["read", "bash", "edit", "write", "subagent"];
    const { body, toolNameRewrite } = rewriteBody(
      Buffer.from(JSON.stringify({ tools: elevenTools(names), messages: [{ role: "user", content: "hi" }] })),
      {},
    );
    expect(toolNameRewrite).toBeNull();
    const parsed = JSON.parse(body);
    expect(parsed.tools.map((t: { name: string }) => t.name)).toEqual(names);
  });

  it("rewrites session_/sessions_ prefixes regardless of tool count", () => {
    const { body, toolNameRewrite } = rewriteBody(
      Buffer.from(JSON.stringify({ tools: elevenTools(["session_list", "read"]), messages: [] })),
      {},
    );
    expect(toolNameRewrite).not.toBeNull();
    const parsed = JSON.parse(body);
    const renamed = parsed.tools.find((t: { name: string }) => t.name.startsWith("cc_ses_"));
    expect(renamed.name).toBe("cc_ses_list");
  });

  it("rewrites historical tool_use names to match renamed tools", () => {
    const names = ["bash", "edit", "glob", "grep", "read", "todowrite"];
    const { body, toolNameRewrite } = rewriteBody(
      Buffer.from(
        JSON.stringify({
          tools: elevenTools(names),
          messages: [
            { role: "user", content: "hi" },
            { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "todowrite", input: {} }] },
          ],
        }),
      ),
      {},
    );
    const parsed = JSON.parse(body);
    const fake = toolNameRewrite!.forward["todowrite"];
    const block = parsed.messages[1].content[0];
    expect(block.name).toBe(fake);
    expect(block.name).not.toBe("todowrite");
  });

  it("restores pseudonyms back to real names in responses", () => {
    const names = ["bash", "edit", "glob", "grep", "read", "todowrite"];
    const { toolNameRewrite } = rewriteBody(
      Buffer.from(JSON.stringify({ tools: elevenTools(names), messages: [] })),
      {},
    );
    const fake = toolNameRewrite!.forward["todowrite"];
    const chunk = `event: content_block_start\ndata: {"type":"tool_use","name":"${fake}"}\n`;
    const restored = restoreToolNames(chunk, toolNameRewrite);
    expect(restored).toContain('"name":"todowrite"');
    expect(restored).not.toContain(fake);
  });

  it("leaves server tools (typed) untouched", () => {
    const tools = [
      { name: "web_search_20250305", type: "web_search_20250305" },
      { name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }, { name: "e" }, { name: "f" },
    ];
    const { body } = rewriteBody(Buffer.from(JSON.stringify({ tools, messages: [] })), {});
    const parsed = JSON.parse(body);
    const server = parsed.tools.find((t: { type?: string }) => t.type === "web_search_20250305");
    expect(server.name).toBe("web_search_20250305");
  });
});
