import { describe, it, expect } from "vitest";
import {
  mapModel,
  buildUpstreamHeaders,
  rewriteBody,
  parseUsageFromJson,
  parseUsageFromSse,
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
  it("maps model and prepends Claude Code system block when system is a string", () => {
    const raw = Buffer.from(JSON.stringify({ model: "claude-sonnet-4-5", system: "be helpful", messages: [] }));
    const { body, model, stream } = rewriteBody(raw);
    const parsed = JSON.parse(body);
    expect(model).toBe("claude-sonnet-4-5-20250929");
    expect(stream).toBe(false);
    expect(Array.isArray(parsed.system)).toBe(true);
    expect(parsed.system[0].text).toBe(CLAUDE_CODE_SYSTEM_PROMPT);
    expect(parsed.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(parsed.system[1].text).toBe("be helpful");
  });
  it("creates system array when absent", () => {
    const { body } = rewriteBody(Buffer.from(JSON.stringify({ model: "x", messages: [] })));
    const parsed = JSON.parse(body);
    expect(parsed.system[0].text).toBe(CLAUDE_CODE_SYSTEM_PROMPT);
  });
  it("does not double-prepend when CC block already present", () => {
    const existing = [{ type: "text", text: CLAUDE_CODE_SYSTEM_PROMPT }];
    const { body } = rewriteBody(Buffer.from(JSON.stringify({ system: existing, messages: [] })));
    const parsed = JSON.parse(body);
    expect(parsed.system.length).toBe(1);
  });
  it("detects stream flag", () => {
    const { stream } = rewriteBody(Buffer.from(JSON.stringify({ stream: true, messages: [] })));
    expect(stream).toBe(true);
  });
  it("passes through non-JSON bodies unchanged", () => {
    const { body, model } = rewriteBody(Buffer.from("not json"));
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
