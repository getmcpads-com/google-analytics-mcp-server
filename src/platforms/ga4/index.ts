/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { GA4Config } from "../../config.js";
import { registerGA4Tools } from "./tools.js";
import { registerGA4Resources } from "./resources.js";
import { logger } from "../../core/logger.js";

export function registerGA4(server: McpServer, config: GA4Config): void {
  registerGA4Tools(server, config);
  registerGA4Resources(server);
  logger.info("ga4", "Registered 27 read tools and 6 resources");
}
