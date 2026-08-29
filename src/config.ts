/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import { logger } from "./core/logger.js";
const configSchema = z.object({
  clientId: z.string().min(1, "GA4_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "GA4_CLIENT_SECRET is required"),
  refreshToken: z.string().min(1, "GA4_REFRESH_TOKEN is required"),
  defaultPropertyId: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
export type GA4Config = z.infer<typeof configSchema>;
export function loadConfig(): GA4Config {
  const raw = {
    clientId: process.env["GA4_CLIENT_ID"] ?? "",
    clientSecret: process.env["GA4_CLIENT_SECRET"] ?? "",
    refreshToken: process.env["GA4_REFRESH_TOKEN"] ?? "",
    defaultPropertyId: process.env["GA4_PROPERTY_ID"] || process.env["GA4_DEFAULT_PROPERTY_ID"] || undefined,
    logLevel: process.env["LOG_LEVEL"] ?? "info",
  };
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const missing = result.error.issues.map(i => i.message).join(", ");
    logger.error("config", `Missing credentials: ${missing}`);
    throw new Error(`Missing GA4 credentials: ${missing}`);
  }
  logger.system("GA4 MCP Server configured");
  return result.data;
}
