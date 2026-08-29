/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { RateLimitError } from "./errors.js";
import { logger } from "./logger.js";
export class RateLimiter {
  private timestamps: number[] = [];
  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);
    const lastSec = this.timestamps.filter(t => now - t < 1000);
    if (lastSec.length >= 10) { const w = 1000 - (now - lastSec[0]!) + 50; logger.debug("ga4", `Rate limit: ${w}ms`); await new Promise(r => setTimeout(r, w)); }
    if (this.timestamps.length >= 600) { const w = 60_000 - (now - this.timestamps[0]!) + 100; await new Promise(r => setTimeout(r, w)); }
    this.timestamps.push(Date.now());
  }
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i <= 3; i++) {
      await this.acquire();
      try { return await fn(); } catch (e) {
        const isRL = e instanceof RateLimitError || (e instanceof Error && e.message.toLowerCase().includes("rate limit"));
        if (isRL && i < 3) { await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, i) + Math.floor(Math.random() * 500), 30_000))); continue; }
        throw e;
      }
    }
    throw new RateLimitError();
  }
}
