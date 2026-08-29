import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { GA4Client } from "../src/platforms/ga4/client.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("GA4 advanced client methods use official read-only/reporting routes", async () => {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      return jsonResponse({ access_token: "token", expires_in: 3600 });
    }
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith(":batchRunReports")) return jsonResponse({ reports: [] });
    if (url.endsWith(":runPivotReport")) return jsonResponse({ rows: [] });
    if (url.endsWith(":batchRunPivotReports")) return jsonResponse({ pivotReports: [] });
    if (url.endsWith(":checkCompatibility")) return jsonResponse({ dimensionCompatibilities: [] });
    if (url.endsWith("/propertyQuotasSnapshot")) return jsonResponse({ corePropertyQuota: {} });
    if (url.includes("/customDimensions")) return jsonResponse({ customDimensions: [] });
    if (url.endsWith("/dataRetentionSettings")) return jsonResponse({ eventDataRetention: "FOURTEEN_MONTHS" });
    throw new Error(`Unexpected URL ${url}`);
  };

  const client = new GA4Client({ clientId: "id", clientSecret: "secret", refreshToken: "refresh" });
  await client.batchRunReports("properties/123", [{ dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "sessions" }] }]);
  await client.runPivotReport("123", {
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    dimensions: [{ name: "country" }], metrics: [{ name: "sessions" }],
    pivots: [{ fieldNames: ["country"], limit: 10 }],
  });
  await client.batchRunPivotReports("123", []);
  await client.checkCompatibility("123", { metrics: [{ name: "sessions" }] });
  await client.getPropertyQuotasSnapshot("123");
  await client.listAdminPropertyResources("123", "customDimensions", 50);
  await client.getPropertySetting("123", "dataRetentionSettings");

  assert.deepEqual(calls.map(({ url }) => url), [
    "https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports",
    "https://analyticsdata.googleapis.com/v1beta/properties/123:runPivotReport",
    "https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunPivotReports",
    "https://analyticsdata.googleapis.com/v1beta/properties/123:checkCompatibility",
    "https://analyticsdata.googleapis.com/v1alpha/properties/123/propertyQuotasSnapshot",
    "https://analyticsadmin.googleapis.com/v1beta/properties/123/customDimensions?pageSize=50",
    "https://analyticsadmin.googleapis.com/v1beta/properties/123/dataRetentionSettings",
  ]);
  assert.deepEqual(calls[0].body.requests[0].metrics, [{ name: "sessions" }]);
  assert.equal(calls.every(({ init }) => init.method === "POST" || init.method === undefined), true);
});
