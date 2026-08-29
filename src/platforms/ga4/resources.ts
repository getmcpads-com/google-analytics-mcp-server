/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GA4_METRIC_CATALOG } from "./metric-catalog.js";
import { GA4_DIMENSION_CATALOG } from "./dimension-catalog.js";

export function registerGA4Resources(server: McpServer): void {
  server.resource("ga4-metrics", "ga4://metrics", async () => ({
    contents: [{ uri: "ga4://metrics", mimeType: "application/json",
      text: JSON.stringify(GA4_METRIC_CATALOG.map(m => ({
        key: m.key, name: m.name, description: m.description,
        category: m.category, type: m.type, format: m.format, apiField: m.apiField,
      })), null, 2) }],
  }));

  server.resource("ga4-dimensions", "ga4://dimensions", async () => ({
    contents: [{ uri: "ga4://dimensions", mimeType: "application/json",
      text: JSON.stringify(GA4_DIMENSION_CATALOG.map(d => ({
        key: d.key, name: d.name, description: d.description,
        category: d.category, apiField: d.apiField,
      })), null, 2) }],
  }));

  server.resource("ga4-compatibility", "ga4://compatibility", async () => ({
    contents: [{ uri: "ga4://compatibility", mimeType: "application/json",
      text: JSON.stringify({
        description: "GA4 constraints: max 9 dimensions + 10 metrics per request. Ecommerce dimensions require ecommerce metrics.",
        maxDimensions: 9, maxMetrics: 10, maxRowsPerCoreRequest: 250000, maxReportsPerBatch: 5, maxPivotCells: 250000,
        dateFormats: ["YYYY-MM-DD", "7daysAgo", "yesterday", "today"],
      }, null, 2) }],
  }));

  server.resource("ga4-manifest", "ga4://manifest", async () => ({
    contents: [{ uri: "ga4://manifest", mimeType: "application/json",
      text: JSON.stringify({
        name: "GA4 MCP",
        platform: "google_analytics_4",
        readOnly: true,
        authentication: {
          type: "google_oauth_refresh_token",
          tokensExposedByTools: false,
        },
        tools: [
          { name: "ga4_health_check", purpose: "Verify credentials, list properties, and test property/metadata access" },
          { name: "ga4_list_properties", purpose: "List accessible GA4 properties" },
          { name: "ga4_run_report", purpose: "Run standard GA4 Data API reports" },
          { name: "ga4_run_pivot_report", purpose: "Run native GA4 Data API pivot reports" },
          { name: "ga4_batch_run_reports", purpose: "Run up to five Core reports in one official batch request" },
          { name: "ga4_batch_run_pivot_reports", purpose: "Run up to five pivot reports in one official batch request" },
          { name: "ga4_check_compatibility", purpose: "Check official Core dimension/metric compatibility" },
          { name: "ga4_get_property_quotas_snapshot", purpose: "Read the current Data API property quota snapshot" },
          { name: "ga4_run_realtime_report", purpose: "Run GA4 Data API realtime reports with limited realtime-compatible fields" },
          { name: "ga4_get_metadata", purpose: "Return property metadata dimensions and metrics" },
          { name: "ga4_get_custom_definitions", purpose: "Inventory reportable custom dimensions and metrics from metadata" },
          { name: "ga4_get_key_events", purpose: "Best-effort key event/conversion inventory from reports" },
          { name: "ga4_get_ecommerce_diagnostics", purpose: "Diagnose ecommerce event, revenue, and item coverage" },
          { name: "ga4_get_event_parameters", purpose: "Approximate event parameter inventory from registered custom definitions" },
          { name: "ga4_run_funnel_recipe", purpose: "Run simple read-only event/pagePath funnel step counts" },
          { name: "ga4_get_audience_export_diagnostics", purpose: "List existing Audience Exports and inspect state/readiness without creating exports" },
          { name: "ga4_get_audience_diagnostics", purpose: "List Admin audiences, recurring audience lists, and observed audienceName report fallback" },
          { name: "ga4_get_bigquery_export_diagnostics", purpose: "Detect BigQuery export links, export modes, stream coverage, and excluded events" },
          { name: "ga4_get_server_side_tagging_diagnostics", purpose: "Infer server-side/server-to-server tagging signals from data streams and Measurement Protocol secrets" },
          { name: "ga4_run_advanced_funnel_report", purpose: "Run Data API v1alpha funnel reports with breakdown/next-action and read-only fallback" },
          { name: "ga4_get_channel_groups", purpose: "List custom channel groups" },
          { name: "ga4_list_accounts", purpose: "List raw accessible Analytics Admin accounts" },
          { name: "ga4_list_admin_resources", purpose: "List allowlisted property Admin collections" },
          { name: "ga4_get_property_configuration", purpose: "Read property details and singleton Admin settings" },
          { name: "ga4_list_audience_exports", purpose: "List existing audience exports and recurring audience lists" },
          { name: "ga4_query_audience_export", purpose: "Query rows from an existing audience export" },
          { name: "ga4_validate_query", purpose: "Validate report metric/dimension combinations" },
        ],
        resources: ["ga4://metrics", "ga4://dimensions", "ga4://compatibility", "ga4://manifest", "ga4://recipes", "ga4://p2-diagnostics"],
        safety: [
          "No write or mutate endpoints are registered.",
          "OAuth access and refresh tokens are never returned in tool responses.",
          "Measurement Protocol secret values are redacted before tool output.",
          "Audience Export and access-binding personal identifiers are redacted unless explicitly opted in.",
          "Diagnostics are best-effort read-only views over Data API/Admin read endpoints.",
        ],
      }, null, 2) }],
  }));

  server.resource("ga4-recipes", "ga4://recipes", async () => ({
    contents: [{ uri: "ga4://recipes", mimeType: "application/json",
      text: JSON.stringify({
        recipes: [
          {
            name: "Account readiness check",
            tool: "ga4_health_check",
            input: { propertyId: "123456789" },
            useWhen: "Before querying a new credential set or property.",
          },
          {
            name: "Realtime traffic snapshot",
            tool: "ga4_run_realtime_report",
            input: { propertyId: "123456789", metrics: ["activeUsers"], dimensions: ["eventName"], limit: 25 },
            useWhen: "To inspect live activity with realtime-compatible fields.",
          },
          {
            name: "Key event inventory",
            tool: "ga4_get_key_events",
            input: { propertyId: "123456789", datePreset: "last28days", limit: 100 },
            useWhen: "To identify key events/conversions currently receiving traffic.",
          },
          {
            name: "Ecommerce implementation diagnostics",
            tool: "ga4_get_ecommerce_diagnostics",
            input: { propertyId: "123456789", datePreset: "last28days", limit: 100 },
            useWhen: "To check view_item, add_to_cart, begin_checkout, purchase, revenue, and item coverage.",
          },
          {
            name: "Registered event parameters",
            tool: "ga4_get_event_parameters",
            input: { propertyId: "123456789", eventNames: ["purchase", "add_to_cart"], datePreset: "last28days" },
            useWhen: "To discover reportable custom event parameters and sample event volume.",
          },
          {
            name: "Simple ecommerce funnel",
            tool: "ga4_run_funnel_recipe",
            input: {
              propertyId: "123456789",
              metric: "activeUsers",
              datePreset: "last28days",
              steps: [
                { name: "Product views", eventName: "view_item" },
                { name: "Cart adds", eventName: "add_to_cart" },
                { name: "Checkout starts", eventName: "begin_checkout" },
                { name: "Purchases", eventName: "purchase" },
              ],
            },
            useWhen: "To get quick step counts without GA4 Explore funnel semantics.",
          },
          {
            name: "Advanced funnel with device breakdown",
            tool: "ga4_run_advanced_funnel_report",
            input: {
              propertyId: "123456789",
              datePreset: "last28days",
              breakdownDimension: "deviceCategory",
              steps: [
                { name: "Landing", pagePath: "/", matchType: "EXACT" },
                { name: "Signup start", eventName: "sign_up_start" },
                { name: "Signup complete", eventName: "sign_up" },
              ],
            },
            useWhen: "To use GA4 Data API funnel semantics with optional fallback to independent step counts.",
          },
          {
            name: "Pivoted country/device performance",
            tool: "ga4_run_pivot_report",
            input: {
              propertyId: "123456789",
              report: {
                dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
                dimensions: ["country", "deviceCategory"],
                metrics: ["sessions", "totalRevenue"],
                pivots: [{ fieldNames: ["country"], limit: 20 }, { fieldNames: ["deviceCategory"], limit: 3 }],
              },
            },
            useWhen: "To return a native multidimensional pivot and property quota state.",
          },
          {
            name: "Audience readiness",
            tool: "ga4_get_audience_diagnostics",
            input: { propertyId: "123456789", datePreset: "last28days", limit: 100 },
            useWhen: "To inspect Admin audiences, recurring audience lists, and observed audienceName traffic.",
          },
          {
            name: "Audience export readiness",
            tool: "ga4_get_audience_export_diagnostics",
            input: { propertyId: "123456789", pageSize: 100 },
            useWhen: "To find existing Audience Exports and their ACTIVE/FAILED/CREATING states without creating new exports.",
          },
          {
            name: "BigQuery export detection",
            tool: "ga4_get_bigquery_export_diagnostics",
            input: { propertyId: "123456789", includeDataStreams: true },
            useWhen: "To confirm whether GA4 BigQuery export is configured and which export modes are enabled.",
          },
          {
            name: "Server-side tagging inference",
            tool: "ga4_get_server_side_tagging_diagnostics",
            input: { propertyId: "123456789", includeSettings: true, includeRules: true },
            useWhen: "To infer server-side/server-to-server collection signals while keeping Measurement Protocol secret values redacted.",
          },
        ],
        notes: [
          "Use ga4://metrics and ga4://dimensions for standard report fields.",
          "Use ga4_get_metadata or ga4_get_custom_definitions for property-specific custom fields.",
          "Funnel recipes are independent step counts, not sequence-aware user path analysis.",
          "Advanced funnel reports use the GA4 Data API v1alpha runFunnelReport endpoint and can fall back to independent step counts.",
          "Audience Export and Recurring Audience List diagnostics are read-only and never create new lists.",
          "ga4_list_admin_resources is an allowlisted GET-only explorer over Admin API v1beta/v1alpha collections.",
          "Batch Data API methods accept at most five reports for one property, matching the official API contract.",
          "Core report and pivot-cell limits are 250,000; every pivot must include a limit.",
        ],
      }, null, 2) }],
  }));

  server.resource("ga4-p2-diagnostics", "ga4://p2-diagnostics", async () => ({
    contents: [{ uri: "ga4://p2-diagnostics", mimeType: "application/json",
      text: JSON.stringify({
        readOnlyP2Tools: [
          {
            name: "ga4_get_audience_export_diagnostics",
            endpoints: [
              "GET analyticsdata.googleapis.com/v1beta/properties/{property}/audienceExports",
              "GET analyticsdata.googleapis.com/v1beta/properties/{property}/audienceExports/{audienceExport}",
              "POST analyticsdata.googleapis.com/v1beta/properties/{property}/audienceExports/{audienceExport}:query (optional read-only sample)",
            ],
            noCreateEndpointCalled: true,
          },
          {
            name: "ga4_get_audience_diagnostics",
            endpoints: [
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/audiences",
              "GET analyticsdata.googleapis.com/v1alpha/properties/{property}/recurringAudienceLists",
              "POST analyticsdata.googleapis.com/v1beta/properties/{property}:runReport for audienceName fallback",
            ],
            noCreateEndpointCalled: true,
          },
          {
            name: "ga4_get_bigquery_export_diagnostics",
            endpoints: [
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/bigQueryLinks",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams",
            ],
          },
          {
            name: "ga4_get_server_side_tagging_diagnostics",
            endpoints: [
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams/{stream}/measurementProtocolSecrets",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams/{stream}/enhancedMeasurementSettings",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams/{stream}/dataRedactionSettings",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams/{stream}/eventCreateRules",
              "GET analyticsadmin.googleapis.com/v1alpha/properties/{property}/dataStreams/{stream}/eventEditRules",
            ],
            secretHandling: "measurementProtocolSecrets.secretValue is redacted",
          },
          {
            name: "ga4_run_advanced_funnel_report",
            endpoints: [
              "POST analyticsdata.googleapis.com/v1alpha/properties/{property}:runFunnelReport",
              "POST analyticsdata.googleapis.com/v1beta/properties/{property}:runReport fallback when enabled",
            ],
          },
        ],
        agentNotes: [
          "Prefer diagnostics tools before asking to create GA4 assets; this server has no mutate tools.",
          "Treat alpha Admin/Data API fields as best-effort and inspect warnings in every response.",
          "Use includeRowSample on Audience Exports only when user-level export rows are explicitly needed.",
        ],
      }, null, 2) }],
  }));
}
