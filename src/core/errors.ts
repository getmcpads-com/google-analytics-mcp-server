/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
export class PlatformApiError extends Error {
  constructor(public readonly platform: string, public readonly code: number, message: string,
    public readonly isRateLimit: boolean = false, public readonly isAuth: boolean = false,
    public readonly isPermission: boolean = false, public readonly suggestion: string = "",
    public readonly retryAfter?: number) { super(message); this.name = "PlatformApiError"; }
  toMcpError() {
    return { error: this.message, platform: this.platform, code: this.code,
      isRateLimit: this.isRateLimit, isAuth: this.isAuth, suggestion: this.suggestion,
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }) };
  }
}
export class RateLimitError extends PlatformApiError {
  constructor(retryAfter?: number) { super("ga4", 429, "Rate limit exceeded", true, false, false, "Wait and retry with backoff", retryAfter); }
}
export class AuthError extends PlatformApiError {
  constructor(msg?: string) { super("ga4", 401, msg ?? "Auth failed. Check GA4 credentials.", false, true, false, "Verify GA4_CLIENT_ID, GA4_CLIENT_SECRET, GA4_REFRESH_TOKEN"); }
}
export function formatMcpToolError(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  if (error instanceof PlatformApiError) return { content: [{ type: "text", text: JSON.stringify(error.toMcpError(), null, 2) }], isError: true };
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }, null, 2) }], isError: true };
}
