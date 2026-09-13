import { installToolQuality } from "./tool-quality.js";
/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GA4Config } from "./config.js";
import { registerGA4 } from "./platforms/ga4/index.js";
import { logger } from "./core/logger.js";

export const PACKAGE_VERSION = "1.1.0";

export function createServer(config: GA4Config): McpServer {
  const server = new McpServer(
    { name: "google-analytics-mcp", version: PACKAGE_VERSION, title: "Google Analytics 4", websiteUrl: "https://www.getmcpads.com/tools/ga4", icons: [{ src: "https://mcp.getmcpads.com/icon.svg", mimeType: "image/svg+xml" }] },
    { capabilities: { tools: { listChanged: true }, resources: { subscribe: false, listChanged: true } } },
  );
  installToolQuality(server);
  registerGA4(server, config);
  logger.system(`google-analytics-mcp v${PACKAGE_VERSION} ready, read-only`);
  return server;
}
