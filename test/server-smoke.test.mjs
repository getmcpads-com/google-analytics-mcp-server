import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(repoRoot, "..", "..");
const binName = process.platform === "win32" ? "tsx.cmd" : "tsx";
const localTsxBin = path.join(repoRoot, "node_modules", ".bin", binName);
const workspaceTsxBin = path.join(workspaceRoot, "node_modules", ".bin", binName);
const tsxBin = fs.existsSync(localTsxBin) ? localTsxBin : workspaceTsxBin;

function cleanEnv(extra) {
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string")),
    ...extra,
  };
}

test("GA4 MCP exposes core tools and resources over stdio", async () => {
  const client = new Client({ name: "ga4-mcp-smoke", version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: tsxBin,
    args: ["src/cli.ts"],
    cwd: repoRoot,
    env: cleanEnv({
      GA4_CLIENT_ID: "test-client-id",
      GA4_CLIENT_SECRET: "test-client-secret",
      GA4_REFRESH_TOKEN: "test-refresh-token",
      LOG_LEVEL: "error",
    }),
    stderr: "pipe",
  });

  try {
    await client.connect(transport, { timeout: 15000 });
    const tools = await client.listTools(undefined, { timeout: 15000 });
    const toolNames = tools.tools.map((tool) => tool.name);
    assert.equal(toolNames.length, 27);

    for (const name of [
      "ga4_health_check",
      "ga4_run_report",
      "ga4_validate_query",
      "ga4_run_advanced_funnel_report",
      "ga4_run_pivot_report",
      "ga4_batch_run_reports",
      "ga4_batch_run_pivot_reports",
      "ga4_check_compatibility",
      "ga4_get_property_quotas_snapshot",
      "ga4_list_admin_resources",
      "ga4_query_audience_export",
    ]) {
      assert.ok(toolNames.includes(name), `missing tool ${name}`);
    }

    const pivotTool = tools.tools.find((tool) => tool.name === "ga4_run_pivot_report");
    const pivotItemSchema = pivotTool.inputSchema.properties.report.properties.pivots.items;
    assert.equal(pivotItemSchema.properties.limit.maximum, 250000);
    assert.ok(pivotItemSchema.required.includes("limit"));

    const adminTool = tools.tools.find((tool) => tool.name === "ga4_list_admin_resources");
    assert.equal(adminTool.inputSchema.properties.includePersonalIdentifiers.default, false);
    const audienceTool = tools.tools.find((tool) => tool.name === "ga4_query_audience_export");
    assert.equal(audienceTool.inputSchema.properties.includePersonalIdentifiers.default, false);

    const resources = await client.listResources(undefined, { timeout: 15000 });
    const resourceUris = resources.resources.map((resource) => resource.uri);

    for (const uri of [
      "ga4://manifest",
      "ga4://metrics",
      "ga4://compatibility",
    ]) {
      assert.ok(resourceUris.includes(uri), `missing resource ${uri}`);
    }

    const manifest = await client.readResource({ uri: "ga4://manifest" }, { timeout: 15000 });
    const manifestJson = JSON.parse(manifest.contents[0].text);
    assert.equal(manifestJson.tools.length, 27);
  } finally {
    await transport.close().catch(() => undefined);
  }
});
