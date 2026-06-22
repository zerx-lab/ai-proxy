import { ProxyAgent, type Dispatcher } from "undici";

// All Anthropic / Claude endpoints are geo/IP gated. When the host's egress IP is
// blocked (403 "Request not allowed"), route outbound calls through a proxy in an
// allowed region. Node's fetch ignores system proxy env vars by default, so we wire
// it explicitly: UPSTREAM_PROXY wins, else fall back to the standard
// HTTPS_PROXY / HTTP_PROXY (and lowercase) variables.
const PROXY_URL =
  process.env.UPSTREAM_PROXY?.trim() ||
  process.env.HTTPS_PROXY?.trim() ||
  process.env.https_proxy?.trim() ||
  process.env.HTTP_PROXY?.trim() ||
  process.env.http_proxy?.trim();

let dispatcher: Dispatcher | undefined;
if (PROXY_URL) {
  dispatcher = new ProxyAgent(PROXY_URL);
}

type FetchInit = RequestInit & { dispatcher?: Dispatcher };

// Drop-in fetch that transparently uses the configured proxy (if any).
export function upstreamFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  if (!dispatcher) return fetch(input, init);
  return fetch(input, { ...init, dispatcher } as FetchInit);
}

export const usingProxy = Boolean(PROXY_URL);
