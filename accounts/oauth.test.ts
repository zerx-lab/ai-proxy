import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generatePkce, buildAuthorizeUrl, CLIENT_ID } from "./oauth";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("generatePkce", () => {
  it("produces a 43-char verifier and a matching S256 challenge", () => {
    const p = generatePkce();
    expect(p.codeVerifier).toHaveLength(43);
    expect(p.state).toHaveLength(43);
    const expected = b64url(createHash("sha256").update(p.codeVerifier).digest());
    expect(p.codeChallenge).toBe(expected);
  });
  it("generates unique values each call", () => {
    expect(generatePkce().state).not.toBe(generatePkce().state);
  });
});

describe("buildAuthorizeUrl", () => {
  it("targets claude.ai with all required PKCE params", () => {
    const p = generatePkce();
    const url = new URL(buildAuthorizeUrl(p));
    expect(url.origin + url.pathname).toBe("https://claude.ai/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge")).toBe(p.codeChallenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(p.state);
    expect(url.searchParams.get("scope")).toContain("user:inference");
  });
});
