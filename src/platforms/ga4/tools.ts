/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GA4Client } from "./client.js";
import { planGA4Query } from "./query-planner.js";
import { validateGA4QuerySelection } from "./compatibility-rules.js";
import { enrichWithCalculatedMetrics } from "./calculated-metrics.js";
import { formatMcpToolError } from "../../core/errors.js";
import type { GA4Config } from "../../config.js";
import type {
  GA4DateRange,
  GA4FilterExpression,
  GA4InsightRow,
  GA4Property,
  GA4RunFunnelReportRequest,
  GA4RunReportRequest,
  GA4RunReportResponse,
} from "./types.js";
import { resolveDatePreset } from "./types.js";
import { getMetricByKey } from "./metric-catalog.js";
import { getDimensionByKey } from "./dimension-catalog.js";
import { registerGA4SurfaceTools } from "./surface-tools.js";
import { redactGA4AudienceExportResponse } from "./privacy.js";

const propertyIdSchema = z.string().describe("GA4 property ID (numeric, e.g., 123456789)");
const datePresetValues = ["today", "yesterday", "last7days", "last28days", "last30days", "last90days", "last12months", "thisMonth", "lastMonth", "thisYear"] as const;
const datePresetSchema = z.enum(datePresetValues);
const matchTypeSchema = z.enum(["EXACT", "BEGINS_WITH", "ENDS_WITH", "CONTAINS", "FULL_REGEXP", "PARTIAL_REGEXP"]);
const funnelStepSchema = z.object({
  name: z.string().optional().describe("Optional display name for this funnel step"),
  eventName: z.string().optional().describe("GA4 eventName to count for this step"),
  pagePath: z.string().optional().describe("GA4 pagePath to count for this step"),
  matchType: matchTypeSchema.optional().default("EXACT").describe("String match type for pagePath. eventName always uses EXACT."),
}).refine((step) => Boolean(step.eventName || step.pagePath), {
  message: "Each funnel step must include eventName or pagePath",
});
const advancedFunnelStepSchema = z.object({
  name: z.string().optional().describe("Optional display name for this funnel step"),
  eventName: z.string().optional().describe("GA4 event name matched by a FunnelEventFilter"),
  pagePath: z.string().optional().describe("Shortcut for fieldName=pagePath string filter"),
  fieldName: z.string().optional().describe("Optional GA4 field name for a FunnelFieldFilter, e.g. pagePath, pageTitle, deviceCategory"),
  fieldValue: z.string().optional().describe("String value to match for fieldName"),
  matchType: matchTypeSchema.optional().default("EXACT").describe("String match type for pagePath or fieldName"),
  isDirectlyFollowedBy: z.boolean().optional().describe("Require this step to directly follow the previous step"),
  withinSecondsFromPriorStep: z.number().int().min(1).max(60 * 60 * 24 * 30).optional().describe("Maximum seconds from the prior step"),
}).refine((step) => Boolean(step.eventName || step.pagePath || (step.fieldName && step.fieldValue)), {
  message: "Each advanced funnel step must include eventName, pagePath, or fieldName plus fieldValue",
});
const funnelVisualizationTypeSchema = z.enum(["STANDARD_FUNNEL", "TRENDED_FUNNEL"]);
const GA4_RESPONSE_API_VERSION = "data_api_v1beta/admin_api_v1beta_v1alpha";

type MetadataKind = "dimensions" | "metrics";

type MetadataField = {
  apiName: string;
  uiName?: string;
  description?: string;
  category?: string;
  customDefinition?: boolean;
  type?: string;
  deprecatedApiNames?: string[];
};

type MetadataSummary = {
  dimensions: MetadataField[];
  metrics: MetadataField[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwnField(value: Record<string, unknown>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, field);
}

function getDebugRecord(payload: Record<string, unknown>): Record<string, unknown> {
  return isRecord(payload["debug"]) ? payload["debug"] : {};
}

function getRequestCount(payload: Record<string, unknown>): number {
  const debug = getDebugRecord(payload);
  const requestCount = debug["requestCount"];
  return typeof requestCount === "number" ? requestCount : 1;
}

function getWarnings(payload: Record<string, unknown>): unknown[] {
  if (Array.isArray(payload["warnings"])) return payload["warnings"];

  const debug = getDebugRecord(payload);
  return Array.isArray(debug["warnings"]) ? debug["warnings"] : [];
}

function withAgentResponseContract(data: unknown): unknown {
  if (!isRecord(data)) return data;

  return {
    ...data,
    warnings: hasOwnField(data, "warnings") ? data["warnings"] : getWarnings(data),
    limitations: hasOwnField(data, "limitations") ? data["limitations"] : [],
    nextActions: hasOwnField(data, "nextActions") ? data["nextActions"] : [],
    debug: {
      ...getDebugRecord(data),
      source: "ga4",
      apiVersion: GA4_RESPONSE_API_VERSION,
      requestCount: getRequestCount(data),
    },
  };
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(withAgentResponseContract(data), null, 2) }] };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArrayOrUndefined(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function normalizeMetadataField(value: unknown): MetadataField | null {
  if (!isRecord(value) || typeof value["apiName"] !== "string") {
    return null;
  }

  return {
    apiName: value["apiName"],
    uiName: stringOrUndefined(value["uiName"]),
    description: stringOrUndefined(value["description"]),
    category: stringOrUndefined(value["category"]),
    customDefinition: value["customDefinition"] === true,
    type: stringOrUndefined(value["type"]),
    deprecatedApiNames: stringArrayOrUndefined(value["deprecatedApiNames"]),
  };
}

function extractMetadataFields(metadata: Record<string, unknown>, kind: MetadataKind): MetadataField[] {
  const raw = Array.isArray(metadata[kind]) ? metadata[kind] : [];
  return raw
    .map(normalizeMetadataField)
    .filter((field): field is MetadataField => field !== null);
}

function summarizeMetadata(metadata: Record<string, unknown>): MetadataSummary {
  return {
    dimensions: extractMetadataFields(metadata, "dimensions"),
    metrics: extractMetadataFields(metadata, "metrics"),
  };
}

function inferCustomScope(apiName: string): string {
  if (apiName.startsWith("customEvent:")) return "event";
  if (apiName.startsWith("customUser:")) return "user";
  if (apiName.startsWith("customItem:")) return "item";
  return "custom";
}

function serializeMetadataField(field: MetadataField) {
  return {
    apiName: field.apiName,
    uiName: field.uiName,
    description: field.description,
    category: field.category,
    type: field.type,
    customDefinition: field.customDefinition === true,
    scope: inferCustomScope(field.apiName),
    ...(field.deprecatedApiNames && field.deprecatedApiNames.length > 0 && { deprecatedApiNames: field.deprecatedApiNames }),
  };
}

function getCustomDefinitions(summary: MetadataSummary) {
  const isCustom = (field: MetadataField) =>
    field.customDefinition === true
    || field.apiName.startsWith("customEvent:")
    || field.apiName.startsWith("customUser:")
    || field.apiName.startsWith("customItem:");

  return {
    customDimensions: summary.dimensions.filter(isCustom).map(serializeMetadataField),
    customMetrics: summary.metrics.filter(isCustom).map(serializeMetadataField),
  };
}

function fieldMatchesCandidate(field: MetadataField, candidate: string): boolean {
  return field.apiName === candidate || Boolean(field.deprecatedApiNames?.includes(candidate));
}

function pickAvailableField(summary: MetadataSummary | undefined, kind: MetadataKind, candidates: string[]): string | undefined {
  if (!summary || summary[kind].length === 0) {
    return candidates[0];
  }

  for (const candidate of candidates) {
    const match = summary[kind].find((field) => fieldMatchesCandidate(field, candidate));
    if (match) return match.apiName;
  }

  return undefined;
}

function filterAvailableFields(summary: MetadataSummary | undefined, kind: MetadataKind, candidates: string[]): string[] {
  if (!summary || summary[kind].length === 0) {
    return candidates;
  }

  return candidates.flatMap((candidate) => {
    const match = summary[kind].find((field) => fieldMatchesCandidate(field, candidate));
    return match ? [match.apiName] : [];
  });
}

function toMetrics(metrics: string[]) {
  return metrics.map((metric) => ({ name: getMetricByKey(metric)?.apiField ?? metric }));
}

function toDimensions(dimensions: string[]) {
  return dimensions.map((dimension) => ({ name: getDimensionByKey(dimension)?.apiField ?? dimension }));
}

function resolveInputDateRange(startDate?: string, endDate?: string, datePreset?: typeof datePresetValues[number]): GA4DateRange {
  if (startDate || endDate) {
    return {
      startDate: startDate ?? "28daysAgo",
      endDate: endDate ?? "today",
    };
  }

  return resolveDatePreset(datePreset ?? "last28days");
}

function buildStringFilter(fieldName: string, value: string, matchType: z.infer<typeof matchTypeSchema> = "EXACT"): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType,
        value,
        caseSensitive: false,
      },
    },
  };
}

function buildInListFilter(fieldName: string, values: string[]): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      inListFilter: {
        values,
        caseSensitive: false,
      },
    },
  };
}

function buildMetricGreaterThanFilter(fieldName: string, value: number): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      numericFilter: {
        operation: "GREATER_THAN",
        value: { doubleValue: value },
      },
    },
  };
}

function combineFilters(expressions: GA4FilterExpression[]): GA4FilterExpression | undefined {
  if (expressions.length === 0) return undefined;
  if (expressions.length === 1) return expressions[0];
  return { andGroup: { expressions } };
}

function numericValue(row: GA4InsightRow | undefined, fieldNames: string[]): number {
  if (!row) return 0;

  for (const fieldName of fieldNames) {
    const value = row[fieldName];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return 0;
}

function numericValueOrNull(row: GA4InsightRow | undefined, fieldNames: string[]): number | null {
  if (!row) return null;

  for (const fieldName of fieldNames) {
    if (!Object.prototype.hasOwnProperty.call(row, fieldName)) continue;
    const value = row[fieldName];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }

  return null;
}

function stringValue(row: GA4InsightRow, fieldName: string): string {
  const value = row[fieldName];
  return value === null || value === undefined ? "" : String(value);
}

function isTruthyGA4Flag(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value !== "string") return false;
  return ["true", "yes", "1", "key event", "conversion"].includes(value.trim().toLowerCase());
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runReportRows(client: GA4Client, propertyId: string, request: GA4RunReportRequest) {
  const response = await client.runReport(propertyId, request);
  return {
    response,
    rows: client.flattenResponse(response),
  };
}

type AdvancedFunnelStep = z.infer<typeof advancedFunnelStepSchema>;

function recordString(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === "string" ? value[key] : undefined;
}

function recordNumber(value: Record<string, unknown>, key: string): number | undefined {
  return typeof value[key] === "number" ? value[key] : undefined;
}

function countByStringField(records: Record<string, unknown>[], fieldName: string): Record<string, number> {
  return records.reduce<Record<string, number>>((acc, record) => {
    const value = recordString(record, fieldName) ?? "UNKNOWN";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function summarizeAudienceExport(exportRecord: Record<string, unknown>) {
  const dimensions = Array.isArray(exportRecord["dimensions"]) ? exportRecord["dimensions"] : [];
  return {
    name: recordString(exportRecord, "name"),
    audience: recordString(exportRecord, "audience"),
    audienceDisplayName: recordString(exportRecord, "audienceDisplayName"),
    state: recordString(exportRecord, "state"),
    rowCount: recordNumber(exportRecord, "rowCount"),
    percentageCompleted: recordNumber(exportRecord, "percentageCompleted"),
    beginCreatingTime: recordString(exportRecord, "beginCreatingTime"),
    errorMessage: recordString(exportRecord, "errorMessage"),
    dimensions,
    dimensionCount: dimensions.length,
    creationQuotaTokensCharged: recordNumber(exportRecord, "creationQuotaTokensCharged"),
  };
}

function summarizeAudience(audience: Record<string, unknown>, includeDefinition: boolean) {
  const filterClauses = Array.isArray(audience["filterClauses"]) ? audience["filterClauses"] : [];
  const eventTrigger = isRecord(audience["eventTrigger"]) ? audience["eventTrigger"] : undefined;
  const summary = {
    name: recordString(audience, "name"),
    displayName: recordString(audience, "displayName"),
    description: recordString(audience, "description"),
    membershipDurationDays: recordNumber(audience, "membershipDurationDays"),
    adsPersonalizationEnabled: audience["adsPersonalizationEnabled"],
    filterClauseCount: filterClauses.length,
    hasEventTrigger: Boolean(eventTrigger),
    eventTrigger: eventTrigger ? {
      eventName: recordString(eventTrigger, "eventName"),
      logCondition: recordString(eventTrigger, "logCondition"),
    } : undefined,
  };

  return includeDefinition ? { ...summary, definition: audience } : summary;
}

function summarizeRecurringAudienceList(list: Record<string, unknown>) {
  const dimensions = Array.isArray(list["dimensions"]) ? list["dimensions"] : [];
  return {
    name: recordString(list, "name"),
    audience: recordString(list, "audience"),
    audienceDisplayName: recordString(list, "audienceDisplayName"),
    dimensions,
    dimensionCount: dimensions.length,
    audienceLists: stringArrayOrUndefined(list["audienceLists"]) ?? [],
    activeDaysRemaining: recordNumber(list, "activeDaysRemaining"),
    hasWebhookNotification: isRecord(list["webhookNotification"]),
  };
}

function summarizeBigQueryLink(link: Record<string, unknown>) {
  return {
    name: recordString(link, "name"),
    project: recordString(link, "project"),
    datasetLocation: recordString(link, "datasetLocation"),
    createTime: recordString(link, "createTime"),
    dailyExportEnabled: link["dailyExportEnabled"] === true,
    streamingExportEnabled: link["streamingExportEnabled"] === true,
    freshDailyExportEnabled: link["freshDailyExportEnabled"] === true,
    includeAdvertisingId: link["includeAdvertisingId"] === true,
    exportStreams: stringArrayOrUndefined(link["exportStreams"]) ?? [],
    excludedEvents: stringArrayOrUndefined(link["excludedEvents"]) ?? [],
  };
}

function summarizeDataStream(stream: Record<string, unknown>) {
  const webStreamData = isRecord(stream["webStreamData"]) ? stream["webStreamData"] : undefined;
  const androidAppStreamData = isRecord(stream["androidAppStreamData"]) ? stream["androidAppStreamData"] : undefined;
  const iosAppStreamData = isRecord(stream["iosAppStreamData"]) ? stream["iosAppStreamData"] : undefined;

  return {
    name: recordString(stream, "name"),
    type: recordString(stream, "type"),
    displayName: recordString(stream, "displayName"),
    createTime: recordString(stream, "createTime"),
    updateTime: recordString(stream, "updateTime"),
    webStreamData: webStreamData ? {
      measurementId: recordString(webStreamData, "measurementId"),
      defaultUri: recordString(webStreamData, "defaultUri"),
    } : undefined,
    androidAppStreamData: androidAppStreamData ? {
      packageName: recordString(androidAppStreamData, "packageName"),
      firebaseAppId: recordString(androidAppStreamData, "firebaseAppId"),
    } : undefined,
    iosAppStreamData: iosAppStreamData ? {
      bundleId: recordString(iosAppStreamData, "bundleId"),
      firebaseAppId: recordString(iosAppStreamData, "firebaseAppId"),
    } : undefined,
  };
}

function buildFunnelFieldFilter(fieldName: string, value: string, matchType: z.infer<typeof matchTypeSchema>) {
  return {
    funnelFieldFilter: {
      fieldName,
      stringFilter: {
        matchType,
        value,
        caseSensitive: false,
      },
    },
  };
}

function buildAdvancedFunnelFilterExpression(step: AdvancedFunnelStep): Record<string, unknown> {
  const expressions: Record<string, unknown>[] = [];

  if (step.eventName) {
    expressions.push({ funnelEventFilter: { eventName: step.eventName } });
  }
  if (step.pagePath) {
    expressions.push(buildFunnelFieldFilter("pagePath", step.pagePath, step.matchType ?? "EXACT"));
  }
  if (step.fieldName && step.fieldValue) {
    expressions.push(buildFunnelFieldFilter(step.fieldName, step.fieldValue, step.matchType ?? "EXACT"));
  }

  return expressions.length === 1 ? expressions[0] : { andGroup: { expressions } };
}

function buildAdvancedFunnelReportFilter(step: AdvancedFunnelStep): GA4FilterExpression | undefined {
  const expressions: GA4FilterExpression[] = [];

  if (step.eventName) {
    expressions.push(buildStringFilter("eventName", step.eventName, "EXACT"));
  }
  if (step.pagePath) {
    expressions.push(buildStringFilter("pagePath", step.pagePath, step.matchType ?? "EXACT"));
  }
  if (step.fieldName && step.fieldValue) {
    expressions.push(buildStringFilter(step.fieldName, step.fieldValue, step.matchType ?? "EXACT"));
  }

  return combineFilters(expressions);
}

function flattenFunnelSubReport(client: GA4Client, subReport: GA4RunReportResponse | undefined): GA4InsightRow[] {
  return subReport ? client.flattenResponse(subReport) : [];
}

async function runAdvancedFunnelStepCountFallback(
  client: GA4Client,
  propertyId: string,
  dateRange: GA4DateRange,
  steps: AdvancedFunnelStep[]
) {
  const rows: Array<{
    index: number;
    name: string;
    value: number;
    conversionRateFromPrevious: number | null;
    conversionRateFromFirst: number | null;
  }> = [];

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index];
    const report = await runReportRows(client, propertyId, {
      dateRanges: [dateRange],
      metrics: toMetrics(["activeUsers"]),
      dimensionFilter: buildAdvancedFunnelReportFilter(step),
      keepEmptyRows: true,
      limit: 1,
    });

    const value = numericValue(report.rows[0], ["activeUsers"]);
    const previousValue = rows[index - 1]?.value ?? null;
    const firstValue = rows[0]?.value ?? value;

    rows.push({
      index: index + 1,
      name: step.name ?? step.eventName ?? step.pagePath ?? step.fieldName ?? `Step ${index + 1}`,
      value,
      conversionRateFromPrevious: previousValue && previousValue > 0 ? value / previousValue : null,
      conversionRateFromFirst: firstValue > 0 ? value / firstValue : null,
    });
  }

  return rows;
}

export function registerGA4Tools(server: McpServer, config: GA4Config): void {
  const client = new GA4Client({ clientId: config.clientId, clientSecret: config.clientSecret, refreshToken: config.refreshToken });

  // 1. ga4_health_check
  server.tool(
    "ga4_health_check",
    "Read-only GA4 health check. Verifies configured credentials, accessible properties, and metadata/property access without exposing OAuth tokens.",
    { propertyId: propertyIdSchema.optional().describe("Optional property ID to check metadata and property details for") },
    async ({ propertyId }) => {
      const warnings: string[] = [];
      const actions: string[] = [];
      const checks: Array<{ name: string; status: "ok" | "warning" | "error"; detail?: string }> = [];

      try {
        checks.push({
          name: "credentials_configured",
          status: config.clientId && config.clientSecret && config.refreshToken ? "ok" : "error",
          detail: "Presence checked only; credential values are never returned.",
        });

        let properties: GA4Property[] = [];
        try {
          properties = await client.listProperties();
          checks.push({ name: "list_properties", status: "ok", detail: `${properties.length} properties accessible` });
          if (properties.length === 0) {
            warnings.push("No GA4 properties were returned for these credentials.");
            actions.push("Grant the authenticated Google user Viewer access to at least one GA4 property.");
          }
        } catch (error) {
          checks.push({ name: "list_properties", status: "error", detail: errorMessage(error) });
          actions.push("Verify GA4_CLIENT_ID, GA4_CLIENT_SECRET, GA4_REFRESH_TOKEN, and Analytics Admin API access.");
          return ok({
            status: "error",
            checks,
            warnings,
            actions,
          credentials: {
            clientIdConfigured: Boolean(config.clientId),
            clientSecretConfigured: Boolean(config.clientSecret),
            refreshTokenConfigured: Boolean(config.refreshToken),
          },
          debug: { requestCount: 1 },
          tokenExposure: "No access token or refresh token is returned by this tool.",
        });
        }

        const configuredDefaultPropertyId = config.defaultPropertyId;
        const selectedPropertyId = propertyId ?? configuredDefaultPropertyId ?? properties[0]?.propertyId;
        if (configuredDefaultPropertyId && !propertyId) {
          const foundConfiguredDefault = properties.some((property) => property.propertyId === configuredDefaultPropertyId);
          if (foundConfiguredDefault) {
            checks.push({ name: "default_property_configured", status: "ok", detail: `Using GA4_PROPERTY_ID=${configuredDefaultPropertyId}` });
          } else {
            warnings.push(`GA4_PROPERTY_ID ${configuredDefaultPropertyId} was not present in accountSummaries; direct property/metadata checks will still be attempted.`);
            checks.push({ name: "default_property_configured", status: "warning", detail: `GA4_PROPERTY_ID=${configuredDefaultPropertyId} not found in account summaries` });
          }
        }
        if (propertyId && properties.length > 0 && !properties.some((property) => property.propertyId === propertyId)) {
          warnings.push(`Property ${propertyId} was not present in accountSummaries; direct property/metadata checks will still be attempted.`);
        }

        let propertyDetail: Record<string, unknown> | null = null;
        let metadataSummary: MetadataSummary | null = null;

        if (selectedPropertyId) {
          try {
            propertyDetail = await client.getProperty(selectedPropertyId);
            checks.push({ name: "get_property", status: "ok", detail: `Property ${selectedPropertyId} is readable` });
          } catch (error) {
            checks.push({ name: "get_property", status: "warning", detail: errorMessage(error) });
            warnings.push(`Could not read Admin API property details for ${selectedPropertyId}.`);
            actions.push("Confirm the authenticated user can access the GA4 property in Google Analytics Admin.");
          }

          try {
            metadataSummary = summarizeMetadata(await client.getMetadata(selectedPropertyId));
            checks.push({
              name: "get_metadata",
              status: "ok",
              detail: `${metadataSummary.dimensions.length} dimensions, ${metadataSummary.metrics.length} metrics`,
            });
          } catch (error) {
            checks.push({ name: "get_metadata", status: "warning", detail: errorMessage(error) });
            warnings.push(`Could not read Data API metadata for ${selectedPropertyId}.`);
            actions.push("Enable the Google Analytics Data API and verify property-level Viewer access.");
          }
        } else {
          checks.push({ name: "get_property", status: "warning", detail: "Skipped because no property was available." });
          checks.push({ name: "get_metadata", status: "warning", detail: "Skipped because no property was available." });
        }

        const customDefinitions = metadataSummary ? getCustomDefinitions(metadataSummary) : null;
        const status = checks.some((check) => check.status === "error")
          ? "error"
          : warnings.length > 0 ? "warning" : "ok";

        return ok({
          status,
          checks,
          warnings,
          actions,
          credentials: {
            clientIdConfigured: Boolean(config.clientId),
            clientSecretConfigured: Boolean(config.clientSecret),
            refreshTokenConfigured: Boolean(config.refreshToken),
            defaultPropertyIdConfigured: Boolean(config.defaultPropertyId),
          },
          properties: {
            count: properties.length,
            sample: properties.slice(0, 10).map((property) => ({
              propertyId: property.propertyId,
              displayName: property.displayName,
              timeZone: property.timeZone,
              currencyCode: property.currencyCode,
              propertyType: property.propertyType,
              parent: property.parent,
            })),
          },
          selectedPropertyId,
          defaultPropertyId: configuredDefaultPropertyId ?? null,
          property: propertyDetail,
          metadata: metadataSummary ? {
            dimensions: metadataSummary.dimensions.length,
            metrics: metadataSummary.metrics.length,
            customDimensions: customDefinitions?.customDimensions.length ?? 0,
            customMetrics: customDefinitions?.customMetrics.length ?? 0,
          } : null,
          debug: { requestCount: 1 + (propertyDetail ? 1 : 0) + (metadataSummary ? 1 : 0) },
          tokenExposure: "No access token or refresh token is returned by this tool.",
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 2. ga4_list_properties
  server.tool(
    "ga4_list_properties",
    "List all GA4 properties accessible with the current credentials. Returns property ID, display name, timezone, and currency.",
    {},
    async () => {
      try {
        const properties = await client.listProperties();
        return ok({ properties, count: properties.length });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 3. ga4_run_report
  server.tool(
    "ga4_run_report",
    `Run a GA4 analytics report with intelligent query planning. Supports 52 metrics, 63 dimensions, auto-pagination.
Use ga4://metrics and ga4://dimensions resources for available fields. Max 9 dimensions + 10 metrics per request.`,
    {
      propertyId: propertyIdSchema,
      metrics: z.array(z.string()).min(1).describe("Metric keys (e.g., sessions, activeUsers, totalRevenue)"),
      dimensions: z.array(z.string()).optional().describe("Dimension keys (e.g., date, sessionSource, country)"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: z.enum(["today", "yesterday", "last7days", "last28days", "last30days", "last90days", "last12months", "thisMonth", "lastMonth", "thisYear"]).optional(),
      orderBy: z.string().optional().describe("Metric or dimension key to sort by"),
      orderDirection: z.enum(["ASC", "DESC"]).optional().default("DESC"),
      limit: z.number().int().min(1).max(250000).optional().default(1000),
      offset: z.number().int().min(0).optional().describe("Optional 0-based row offset for explicit pagination."),
      autoPaginate: z.boolean().optional().default(false).describe("When true, omit the limit so the GA4 client paginates through all rows using offset."),
    },
    async ({ propertyId, metrics, dimensions, startDate, endDate, datePreset, orderBy, orderDirection, limit, offset, autoPaginate }) => {
      try {
        const startTime = Date.now();
        const plan = planGA4Query({
          propertyId,
          metrics,
          dimensions,
          dateRange: startDate && endDate ? { startDate, endDate } : undefined,
          datePreset,
          orderBy,
          orderDirection,
          limit: autoPaginate ? undefined : limit,
        });
        if (typeof offset === "number") plan.request.offset = offset;

        if (plan.errors.length > 0) {
          return ok({ error: "Query validation failed", errors: plan.errors, warnings: plan.warnings });
        }

        const response = await client.runReport(propertyId, plan.request);
        let data = client.flattenResponse(response);

        if (plan.calculatedMetrics.length > 0) {
          data = enrichWithCalculatedMetrics(data, plan.calculatedMetrics);
        }

        return ok({
          data,
          rowCount: data.length,
          totalRowCount: response.rowCount,
          debug: {
            requestCount: 1,
            executionTimeMs: Date.now() - startTime,
            warnings: plan.warnings,
            calculatedMetrics: plan.calculatedMetrics,
            apiMetrics: plan.apiMetrics,
            pagination: {
              mode: autoPaginate ? "auto_offset" : "single_page",
              autoPaginate,
              offset: offset ?? 0,
              limit: autoPaginate ? null : limit,
              totalRowCount: response.rowCount,
            },
          },
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 4. ga4_run_realtime_report
  server.tool(
    "ga4_run_realtime_report",
    "Run a read-only GA4 Data API realtime report. Realtime supports only a limited subset of dimensions and metrics.",
    {
      propertyId: propertyIdSchema,
      metrics: z.array(z.string()).min(1).max(10).optional().default(["activeUsers"]).describe("Realtime metric API names, e.g. activeUsers, eventCount"),
      dimensions: z.array(z.string()).max(9).optional().describe("Realtime dimension API names, e.g. eventName, city, deviceCategory"),
      dimensionFilter: z.record(z.unknown()).optional().describe("Native realtime-compatible GA4 FilterExpression JSON."),
      metricFilter: z.record(z.unknown()).optional().describe("Native realtime-compatible GA4 FilterExpression JSON."),
      minuteRanges: z.array(z.object({
        name: z.string().optional(),
        startMinutesAgo: z.number().int().min(0).max(59).optional(),
        endMinutesAgo: z.number().int().min(0).max(59).optional(),
      })).max(2).optional().describe("Optional named realtime minute ranges; zero is the current minute."),
      orderBys: z.array(z.record(z.unknown())).max(10).optional().describe("Native GA4 OrderBy JSON."),
      limit: z.number().int().min(1).max(10000).optional().default(100),
      keepEmptyRows: z.boolean().optional().default(false),
    },
    async ({ propertyId, metrics, dimensions, dimensionFilter, metricFilter, minuteRanges, orderBys, limit, keepEmptyRows }) => {
      try {
        const response = await client.runRealtimeReport(propertyId, {
          metrics: toMetrics(metrics),
          ...(dimensions && dimensions.length > 0 && { dimensions: toDimensions(dimensions) }),
          ...(dimensionFilter && { dimensionFilter: dimensionFilter as GA4FilterExpression }),
          ...(metricFilter && { metricFilter: metricFilter as GA4FilterExpression }),
          ...(minuteRanges && { minuteRanges }),
          ...(orderBys && { orderBys: orderBys as import("./types.js").GA4OrderBy[] }),
          limit,
          keepEmptyRows,
          returnPropertyQuota: true,
        });

        const data = client.flattenResponse(response);
        return ok({
          data,
          rowCount: data.length,
          totalRowCount: response.rowCount,
          warnings: [
            "GA4 realtime reports support a limited subset of dimensions and metrics. If a field fails, check ga4_get_metadata or retry with core realtime fields such as activeUsers, eventCount, eventName, city, and deviceCategory.",
          ],
          propertyQuota: response.propertyQuota,
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 5. ga4_get_metadata
  server.tool(
    "ga4_get_metadata",
    "Get the complete list of dimensions and metrics available for a specific GA4 property. Useful for discovering custom dimensions/metrics.",
    { propertyId: propertyIdSchema },
    async ({ propertyId }) => {
      try {
        const metadata = await client.getMetadata(propertyId);
        return ok(metadata);
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 6. ga4_get_custom_definitions
  server.tool(
    "ga4_get_custom_definitions",
    "List custom dimensions and custom metrics exposed by GA4 Data API metadata. Read-only fallback for custom definition inventory.",
    { propertyId: propertyIdSchema },
    async ({ propertyId }) => {
      try {
        const metadata = await client.getMetadata(propertyId);
        const summary = summarizeMetadata(metadata);
        const customDefinitions = getCustomDefinitions(summary);

        return ok({
          propertyId,
          source: "data_api_metadata",
          customDimensions: customDefinitions.customDimensions,
          customMetrics: customDefinitions.customMetrics,
          counts: {
            customDimensions: customDefinitions.customDimensions.length,
            customMetrics: customDefinitions.customMetrics.length,
            metadataDimensions: summary.dimensions.length,
            metadataMetrics: summary.metrics.length,
          },
          limitations: [
            "This server does not call Admin API mutate endpoints.",
            "Data API metadata exposes reportable custom definitions but may omit Admin-only details such as archived state or exact creation metadata.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 7. ga4_get_key_events
  server.tool(
    "ga4_get_key_events",
    "Inventory GA4 key events/conversions using metadata-aware Data API reports. Returns best-effort event names and counts.",
    {
      propertyId: propertyIdSchema,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
      limit: z.number().int().min(1).max(1000).optional().default(100),
    },
    async ({ propertyId, startDate, endDate, datePreset, limit }) => {
      try {
        const warnings: string[] = [];
        const attempts: string[] = [];
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);

        let metadataSummary: MetadataSummary | undefined;
        try {
          metadataSummary = summarizeMetadata(await client.getMetadata(propertyId));
        } catch (error) {
          warnings.push(`Metadata lookup failed; continuing with standard key event fields. ${errorMessage(error)}`);
        }

        const eventNameField = pickAvailableField(metadataSummary, "dimensions", ["eventName"]) ?? "eventName";
        const flagField = pickAvailableField(metadataSummary, "dimensions", ["isKeyEvent", "isConversionEvent"]);
        const metricField = pickAvailableField(metadataSummary, "metrics", ["keyEvents", "conversions"]);
        let rows: GA4InsightRow[] = [];
        let source = "none";

        if (flagField && metricField) {
          attempts.push(`eventName + ${flagField} + ${metricField}`);
          try {
            const report = await runReportRows(client, propertyId, {
              dateRanges: [dateRange],
              dimensions: toDimensions([eventNameField, flagField]),
              metrics: toMetrics([metricField]),
              orderBys: [{ metric: { metricName: metricField }, desc: true }],
              limit,
            });
            rows = report.rows.filter((row) => isTruthyGA4Flag(row[flagField]) || numericValue(row, [metricField]) > 0);
            source = `report:${eventNameField}+${flagField}+${metricField}`;
          } catch (error) {
            warnings.push(`Could not report with key event flag (${flagField}). ${errorMessage(error)}`);
          }
        }

        if (rows.length === 0 && metricField) {
          attempts.push(`eventName + ${metricField} > 0`);
          try {
            const report = await runReportRows(client, propertyId, {
              dateRanges: [dateRange],
              dimensions: toDimensions([eventNameField]),
              metrics: toMetrics([metricField]),
              metricFilter: buildMetricGreaterThanFilter(metricField, 0),
              orderBys: [{ metric: { metricName: metricField }, desc: true }],
              limit,
            });
            rows = report.rows.filter((row) => numericValue(row, [metricField]) > 0);
            source = `report:${eventNameField}+${metricField}`;
          } catch (error) {
            warnings.push(`Could not report key event metric (${metricField}). ${errorMessage(error)}`);
          }
        }

        if (!metricField) {
          warnings.push("No keyEvents or conversions metric was found in metadata. Key event inventory cannot be determined from Data API reports.");
        }

        const keyEvents = rows.map((row) => {
          const count = metricField ? numericValue(row, [metricField]) : 0;
          return {
            eventName: stringValue(row, eventNameField),
            ...(flagField && { flagField, flagValue: row[flagField], isKeyEvent: isTruthyGA4Flag(row[flagField]) }),
            ...(metricField && { metric: metricField, value: count }),
          };
        }).filter((event) => event.eventName);

        return ok({
          propertyId,
          dateRange,
          source,
          attempts,
          keyEvents,
          count: keyEvents.length,
          warnings,
          limitations: [
            "This is a read-only Data API inventory. Admin-only key event configuration details may require Admin API support.",
            "If the property uses the newer key events naming, keyEvents is preferred; conversions is used as a fallback.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 8. ga4_get_ecommerce_diagnostics
  server.tool(
    "ga4_get_ecommerce_diagnostics",
    "Read-only ecommerce coverage diagnostics for core ecommerce events, revenue metrics, and item-level reporting over a date range.",
    {
      propertyId: propertyIdSchema,
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
      limit: z.number().int().min(1).max(1000).optional().default(100),
    },
    async ({ propertyId, startDate, endDate, datePreset, limit }) => {
      try {
        const warnings: string[] = [];
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);
        const coreEvents = ["view_item", "add_to_cart", "begin_checkout", "purchase"];
        const diagnosticEvents = [...coreEvents, "view_item_list", "select_item", "add_shipping_info", "add_payment_info"];

        let metadataSummary: MetadataSummary | undefined;
        try {
          metadataSummary = summarizeMetadata(await client.getMetadata(propertyId));
        } catch (error) {
          warnings.push(`Metadata lookup failed; continuing with standard ecommerce fields. ${errorMessage(error)}`);
        }

        const eventNameField = pickAvailableField(metadataSummary, "dimensions", ["eventName"]) ?? "eventName";
        const eventCountMetric = pickAvailableField(metadataSummary, "metrics", ["eventCount"]) ?? "eventCount";
        let eventRows: GA4InsightRow[] = [];

        try {
          const report = await runReportRows(client, propertyId, {
            dateRanges: [dateRange],
            dimensions: toDimensions([eventNameField]),
            metrics: toMetrics([eventCountMetric]),
            dimensionFilter: buildInListFilter(eventNameField, diagnosticEvents),
            orderBys: [{ metric: { metricName: eventCountMetric }, desc: true }],
            limit,
          });
          eventRows = report.rows;
        } catch (error) {
          warnings.push(`Could not read ecommerce event coverage. ${errorMessage(error)}`);
        }

        const totalMetrics = filterAvailableFields(metadataSummary, "metrics", [
          "totalRevenue",
          "purchaseRevenue",
          "itemRevenue",
          "transactions",
          "ecommercePurchases",
          "addToCarts",
          "checkouts",
          "itemsPurchased",
          "itemsViewed",
          "itemsAddedToCart",
          "itemsCheckedOut",
        ]);
        let totalsRow: GA4InsightRow | undefined;
        if (totalMetrics.length > 0) {
          totalsRow = {};
          for (const metric of totalMetrics) {
            try {
              const report = await runReportRows(client, propertyId, {
                dateRanges: [dateRange],
                metrics: toMetrics([metric]),
                limit: 1,
              });
              totalsRow = { ...totalsRow, ...(report.rows[0] ?? {}) };
            } catch (error) {
              warnings.push(`Could not read ecommerce aggregate metric ${metric}. ${errorMessage(error)}`);
            }
          }
        }

        const itemDimensions = filterAvailableFields(metadataSummary, "dimensions", ["itemId", "itemName"]);
        const itemMetrics = filterAvailableFields(metadataSummary, "metrics", [
          "itemsViewed",
          "itemsAddedToCart",
          "itemsCheckedOut",
          "itemsPurchased",
          "itemRevenue",
        ]);
        let itemRows: GA4InsightRow[] = [];
        if (itemDimensions.length > 0 && itemMetrics.length > 0) {
          try {
            const report = await runReportRows(client, propertyId, {
              dateRanges: [dateRange],
              dimensions: toDimensions(itemDimensions.slice(0, 2)),
              metrics: toMetrics(itemMetrics),
              orderBys: [{ metric: { metricName: itemMetrics[0] }, desc: true }],
              limit,
            });
            itemRows = report.rows;
          } catch (error) {
            warnings.push(`Could not read item-level ecommerce report. ${errorMessage(error)}`);
          }
        } else {
          warnings.push("Item-level dimensions or metrics were not available in metadata.");
        }

        const eventCoverage = diagnosticEvents.map((eventName) => {
          const row = eventRows.find((candidate) => stringValue(candidate, eventNameField) === eventName);
          const eventCount = numericValue(row, [eventCountMetric]);
          return {
            eventName,
            present: eventCount > 0,
            eventCount,
          };
        });
        const missingCoreEvents = eventCoverage.filter((event) => coreEvents.includes(event.eventName) && !event.present).map((event) => event.eventName);
        const totalRevenue = numericValueOrNull(totalsRow, ["totalRevenue"]);
        const purchaseRevenue = numericValueOrNull(totalsRow, ["purchaseRevenue"]);
        const purchases = numericValueOrNull(totalsRow, ["ecommercePurchases", "transactions"]);
        const purchaseEventCount = eventCoverage.find((event) => event.eventName === "purchase")?.eventCount ?? 0;

        if (missingCoreEvents.length > 0) {
          warnings.push(`Missing core ecommerce event coverage: ${missingCoreEvents.join(", ")}.`);
        }
        if (purchaseEventCount > 0 && purchases === null) {
          warnings.push("Purchase events are present but aggregate purchase metrics were unavailable; summary.purchases is null rather than inferred as 0.");
        }
        if (purchases !== null && purchases > 0 && totalRevenue === 0 && purchaseRevenue === 0) {
          warnings.push("Purchase events are present but revenue metrics are zero; verify value/currency ecommerce parameters.");
        }
        if (itemRows.length === 0) {
          warnings.push("No item-level rows returned; verify items array parameters such as item_id and item_name.");
        }

        return ok({
          propertyId,
          dateRange,
          summary: {
            coreEventsPresent: coreEvents.filter((eventName) => eventCoverage.some((event) => event.eventName === eventName && event.present)),
            missingCoreEvents,
            totalRevenue,
            purchaseRevenue,
            purchases,
            itemRows: itemRows.length,
          },
          eventCoverage,
          aggregateMetrics: totalsRow ?? {},
          itemBreakdown: itemRows,
          warnings,
          limitations: [
            "Diagnostics are based on reportable Data API fields and do not inspect raw event payloads.",
            "Use BigQuery export or DebugView to validate unregistered ecommerce parameters at event ingestion time.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 9. ga4_get_event_parameters
  server.tool(
    "ga4_get_event_parameters",
    "Best-effort event parameter inventory from GA4 metadata plus event reports. Documents Data API limitations for raw parameters.",
    {
      propertyId: propertyIdSchema,
      eventNames: z.array(z.string()).optional().describe("Optional event names to sample, e.g. purchase, add_to_cart"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
      limit: z.number().int().min(1).max(1000).optional().default(50),
    },
    async ({ propertyId, eventNames, startDate, endDate, datePreset, limit }) => {
      try {
        const warnings: string[] = [];
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);
        const metadata = await client.getMetadata(propertyId);
        const summary = summarizeMetadata(metadata);
        const customDefinitions = getCustomDefinitions(summary);
        const eventNameField = pickAvailableField(summary, "dimensions", ["eventName"]) ?? "eventName";
        const eventCountMetric = pickAvailableField(summary, "metrics", ["eventCount"]) ?? "eventCount";

        let eventRows: GA4InsightRow[] = [];
        try {
          const report = await runReportRows(client, propertyId, {
            dateRanges: [dateRange],
            dimensions: toDimensions([eventNameField]),
            metrics: toMetrics([eventCountMetric]),
            ...(eventNames && eventNames.length > 0 && { dimensionFilter: buildInListFilter(eventNameField, eventNames) }),
            orderBys: [{ metric: { metricName: eventCountMetric }, desc: true }],
            limit,
          });
          eventRows = report.rows;
        } catch (error) {
          warnings.push(`Could not sample events for parameter context. ${errorMessage(error)}`);
        }

        const registeredEventParameters = [
          ...customDefinitions.customDimensions,
          ...customDefinitions.customMetrics,
        ].filter((definition) => definition.scope === "event").map((definition) => ({
          ...definition,
          parameterName: definition.apiName.includes(":") ? definition.apiName.split(":").slice(1).join(":") : definition.apiName,
        }));

        if (registeredEventParameters.length === 0) {
          warnings.push("No registered event-scoped custom dimensions or metrics were exposed by metadata.");
        }

        return ok({
          propertyId,
          dateRange,
          registeredEventParameters,
          eventSamples: eventRows,
          warnings,
          limitations: [
            "GA4 Data API metadata only exposes parameters registered as reportable custom dimensions or metrics.",
            "Unregistered raw event parameters and parameter values are not enumerable through this read-only Data API path.",
            "For exhaustive raw parameter discovery, use GA4 BigQuery export or instrumentation logs.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 10. ga4_run_funnel_recipe
  server.tool(
    "ga4_run_funnel_recipe",
    "Run a read-only configurable funnel recipe using one GA4 report per eventName/pagePath step and return simple step counts.",
    {
      propertyId: propertyIdSchema,
      steps: z.array(funnelStepSchema).min(2).max(10).describe("Ordered funnel steps. Each step needs eventName or pagePath."),
      metric: z.enum(["activeUsers", "totalUsers", "sessions", "eventCount", "screenPageViews"]).optional().default("activeUsers"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
    },
    async ({ propertyId, steps, metric, startDate, endDate, datePreset }) => {
      try {
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);
        const metricField = getMetricByKey(metric)?.apiField ?? metric;
        const results: Array<{
          index: number;
          name: string;
          filter: { eventName?: string; pagePath?: string; matchType?: string };
          value: number;
          conversionRateFromPrevious: number | null;
          conversionRateFromFirst: number | null;
          dropoffFromPrevious: number | null;
        }> = [];

        for (let index = 0; index < steps.length; index++) {
          const step = steps[index];
          const filters: GA4FilterExpression[] = [];
          if (step.eventName) {
            filters.push(buildStringFilter("eventName", step.eventName, "EXACT"));
          }
          if (step.pagePath) {
            filters.push(buildStringFilter("pagePath", step.pagePath, step.matchType ?? "EXACT"));
          }

          const report = await runReportRows(client, propertyId, {
            dateRanges: [dateRange],
            metrics: toMetrics([metricField]),
            dimensionFilter: combineFilters(filters),
            keepEmptyRows: true,
            limit: 1,
          });

          const value = numericValue(report.rows[0], [metricField]);
          const previousValue = results[index - 1]?.value ?? null;
          const firstValue = results[0]?.value ?? value;

          results.push({
            index: index + 1,
            name: step.name ?? step.eventName ?? step.pagePath ?? `Step ${index + 1}`,
            filter: {
              ...(step.eventName && { eventName: step.eventName }),
              ...(step.pagePath && { pagePath: step.pagePath, matchType: step.matchType ?? "EXACT" }),
            },
            value,
            conversionRateFromPrevious: previousValue && previousValue > 0 ? value / previousValue : null,
            conversionRateFromFirst: firstValue > 0 ? value / firstValue : null,
            dropoffFromPrevious: previousValue === null ? null : Math.max(previousValue - value, 0),
          });
        }

        return ok({
          propertyId,
          dateRange,
          metric: metricField,
          steps: results,
          recipe: {
            type: "simple_step_counts",
            readOnly: true,
            reportsRun: results.length,
          },
          limitations: [
            "This is a simple read-only funnel recipe, not GA4 Explore funnel semantics.",
            "Each step is counted independently with one runReport call; counts are not user-sequenced or deduplicated across steps.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 11. ga4_get_audience_export_diagnostics
  server.tool(
    "ga4_get_audience_export_diagnostics",
    "Read-only Audience Export diagnostics. Lists existing audience exports, state counts, and optionally samples rows from an existing export.",
    {
      propertyId: propertyIdSchema,
      audienceExportName: z.string().optional().describe("Optional resource name, e.g. properties/123456789/audienceExports/abc123"),
      pageSize: z.number().int().min(1).max(200).optional().default(100),
      includeRowSample: z.boolean().optional().default(false).describe("If true, query a small row sample from audienceExportName. Can include user-level export dimensions."),
      sampleLimit: z.number().int().min(1).max(10).optional().default(5),
      includePersonalIdentifiers: z.boolean().optional().default(false)
        .describe("Explicitly include user/device identifiers in the optional sample. False redacts them by default."),
    },
    async ({ propertyId, audienceExportName, pageSize, includeRowSample, sampleLimit, includePersonalIdentifiers }) => {
      try {
        const warnings: string[] = [];
        const exports = await client.listAudienceExports(propertyId, pageSize);
        const summarizedExports = exports.map(summarizeAudienceExport);
        const failedExports = summarizedExports.filter((exportRecord) => exportRecord.state === "FAILED");
        let selectedExport: Record<string, unknown> | null = null;
        let rowSample: Record<string, unknown> | null = null;

        if (audienceExportName) {
          try {
            selectedExport = summarizeAudienceExport(await client.getAudienceExport(audienceExportName));
          } catch (error) {
            warnings.push(`Could not get audience export ${audienceExportName}. ${errorMessage(error)}`);
          }

          if (includeRowSample) {
            try {
              const response = await client.queryAudienceExport(audienceExportName, { limit: String(sampleLimit), offset: "0" });
              rowSample = includePersonalIdentifiers
                ? response
                : redactGA4AudienceExportResponse(response);
              warnings.push(includePersonalIdentifiers
                ? "SENSITIVE PERSONAL IDENTIFIERS INCLUDED BY EXPLICIT OPT-IN: Audience Export sample user/device identifiers are present. Restrict storage, sharing, and model output."
                : "Audience Export sample user/device identifiers were redacted by default. Set includePersonalIdentifiers=true only with explicit authorization.");
            } catch (error) {
              warnings.push(`Could not query row sample for ${audienceExportName}. ${errorMessage(error)}`);
            }
          }
        } else if (includeRowSample) {
          warnings.push("includeRowSample was ignored because audienceExportName was not provided.");
        }

        if (exports.length === 0) {
          warnings.push("No existing Audience Exports were found. This server intentionally does not create new exports.");
        }
        if (failedExports.length > 0) {
          warnings.push(`${failedExports.length} Audience Export(s) are FAILED. Inspect errorMessage for root cause.`);
        }

        return ok({
          propertyId,
          source: "data_api_v1beta_audienceExports_list",
          count: exports.length,
          stateCounts: countByStringField(exports, "state"),
          audienceExports: summarizedExports,
          selectedExport,
          rowSample,
          warnings,
          limitations: [
            "This tool only lists/gets/queries existing Audience Exports; it never calls audienceExports.create.",
            "Row sampling is disabled by default, and identifier values are redacted unless includePersonalIdentifiers=true is explicitly supplied.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 12. ga4_get_audience_diagnostics
  server.tool(
    "ga4_get_audience_diagnostics",
    "Read-only audience diagnostics from Admin API audiences, Data API recurring audience lists, and observed audienceName report fallback.",
    {
      propertyId: propertyIdSchema,
      recurringAudienceListName: z.string().optional().describe("Optional resource name, e.g. properties/123456789/recurringAudienceLists/abc123"),
      includeDefinitions: z.boolean().optional().default(false).describe("Include full Admin API audience definitions when available"),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
      limit: z.number().int().min(1).max(1000).optional().default(100),
    },
    async ({ propertyId, recurringAudienceListName, includeDefinitions, startDate, endDate, datePreset, limit }) => {
      try {
        const warnings: string[] = [];
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);
        let audiences: Record<string, unknown>[] = [];
        let recurringAudienceLists: Record<string, unknown>[] = [];
        let selectedRecurringAudienceList: Record<string, unknown> | null = null;
        let observedAudienceRows: GA4InsightRow[] = [];

        try {
          audiences = await client.listAudiences(propertyId);
        } catch (error) {
          warnings.push(`Admin API audiences.list was unavailable. ${errorMessage(error)}`);
        }

        try {
          recurringAudienceLists = await client.listRecurringAudienceLists(propertyId);
        } catch (error) {
          warnings.push(`Data API recurringAudienceLists.list was unavailable. ${errorMessage(error)}`);
        }

        if (recurringAudienceListName) {
          try {
            selectedRecurringAudienceList = summarizeRecurringAudienceList(await client.getRecurringAudienceList(recurringAudienceListName));
          } catch (error) {
            warnings.push(`Could not get recurring audience list ${recurringAudienceListName}. ${errorMessage(error)}`);
          }
        }

        try {
          const summary = summarizeMetadata(await client.getMetadata(propertyId));
          const audienceNameField = pickAvailableField(summary, "dimensions", ["audienceName"]);
          const activeUsersMetric = pickAvailableField(summary, "metrics", ["activeUsers"]) ?? "activeUsers";

          if (audienceNameField) {
            const report = await runReportRows(client, propertyId, {
              dateRanges: [dateRange],
              dimensions: toDimensions([audienceNameField]),
              metrics: toMetrics([activeUsersMetric]),
              orderBys: [{ metric: { metricName: activeUsersMetric }, desc: true }],
              limit,
            });
            observedAudienceRows = report.rows;
          } else {
            warnings.push("audienceName was not available in Data API metadata, so observed audience membership fallback was skipped.");
          }
        } catch (error) {
          warnings.push(`Observed audienceName report fallback failed. ${errorMessage(error)}`);
        }

        return ok({
          propertyId,
          dateRange,
          adminAudiences: audiences.map((audience) => summarizeAudience(audience, includeDefinitions)),
          recurringAudienceLists: recurringAudienceLists.map(summarizeRecurringAudienceList),
          selectedRecurringAudienceList,
          observedAudienceRows,
          counts: {
            adminAudiences: audiences.length,
            recurringAudienceLists: recurringAudienceLists.length,
            observedAudienceRows: observedAudienceRows.length,
          },
          warnings,
          limitations: [
            "Admin API audiences.list is alpha and may omit pre-2020 or default audience filter definitions.",
            "Recurring Audience Lists are listed read-only; this server never calls recurringAudienceLists.create.",
            "The observed audienceName report is a traffic fallback, not an Admin configuration inventory.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 13. ga4_get_bigquery_export_diagnostics
  server.tool(
    "ga4_get_bigquery_export_diagnostics",
    "Detect GA4 BigQuery export links and diagnose export modes, stream coverage, excluded events, and dataset location.",
    {
      propertyId: propertyIdSchema,
      includeDataStreams: z.boolean().optional().default(true).describe("Include data stream summaries to compare against BigQuery exportStreams"),
    },
    async ({ propertyId, includeDataStreams }) => {
      try {
        const warnings: string[] = [];
        let links: Record<string, unknown>[] = [];
        let streams: Record<string, unknown>[] = [];

        try {
          links = await client.listBigQueryLinks(propertyId);
        } catch (error) {
          warnings.push(`Admin API bigQueryLinks.list was unavailable. ${errorMessage(error)}`);
        }

        if (includeDataStreams) {
          try {
            streams = await client.listDataStreams(propertyId);
          } catch (error) {
            warnings.push(`Admin API dataStreams.list was unavailable. ${errorMessage(error)}`);
          }
        }

        const bigQueryLinks = links.map(summarizeBigQueryLink);
        const exportedStreamNames = new Set(bigQueryLinks.flatMap((link) => link.exportStreams));
        const dataStreams = streams.map(summarizeDataStream);
        const streamsNotExplicitlyExported = exportedStreamNames.size > 0
          ? dataStreams.filter((stream) => stream.name && !exportedStreamNames.has(stream.name))
          : [];

        if (bigQueryLinks.length === 0) {
          warnings.push("No BigQuery links were detected for this property.");
        }
        if (bigQueryLinks.some((link) => !link.dailyExportEnabled && !link.streamingExportEnabled && !link.freshDailyExportEnabled)) {
          warnings.push("At least one BigQuery link has no daily, streaming, or fresh daily export mode enabled.");
        }
        if (streamsNotExplicitlyExported.length > 0) {
          warnings.push(`${streamsNotExplicitlyExported.length} stream(s) were not present in explicit BigQuery exportStreams.`);
        }

        return ok({
          propertyId,
          detected: bigQueryLinks.length > 0,
          bigQueryLinks,
          dataStreams,
          summary: {
            linkCount: bigQueryLinks.length,
            dailyExportLinks: bigQueryLinks.filter((link) => link.dailyExportEnabled).length,
            streamingExportLinks: bigQueryLinks.filter((link) => link.streamingExportEnabled).length,
            freshDailyExportLinks: bigQueryLinks.filter((link) => link.freshDailyExportEnabled).length,
            datasetLocations: Array.from(new Set(bigQueryLinks.map((link) => link.datasetLocation).filter(Boolean))),
            excludedEventCount: bigQueryLinks.reduce((total, link) => total + link.excludedEvents.length, 0),
            explicitExportStreamCount: exportedStreamNames.size,
            streamsNotExplicitlyExported: streamsNotExplicitlyExported.length,
          },
          warnings,
          limitations: [
            "This detects GA4 Admin API BigQueryLink configuration only; it does not query BigQuery datasets or table freshness.",
            "When exportStreams is empty, Google may apply property-level defaults; stream coverage should be confirmed in GA4 Admin UI or BigQuery.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 14. ga4_get_server_side_tagging_diagnostics
  server.tool(
    "ga4_get_server_side_tagging_diagnostics",
    "Best-effort read-only server-side tagging diagnostics from data streams, Measurement Protocol secrets, event rules, and stream settings.",
    {
      propertyId: propertyIdSchema,
      includeSettings: z.boolean().optional().default(true).describe("Fetch enhanced measurement and data redaction settings for web streams"),
      includeRules: z.boolean().optional().default(true).describe("Fetch event create/edit rules for web streams"),
    },
    async ({ propertyId, includeSettings, includeRules }) => {
      try {
        const warnings: string[] = [];
        const streams = await client.listDataStreams(propertyId);
        const streamDiagnostics: Array<Record<string, unknown>> = [];

        for (const stream of streams) {
          const streamName = recordString(stream, "name");
          const streamSummary = summarizeDataStream(stream);
          const streamWarnings: string[] = [];
          let measurementProtocolSecrets: Record<string, unknown>[] = [];
          let enhancedMeasurementSettings: Record<string, unknown> | null = null;
          let dataRedactionSettings: Record<string, unknown> | null = null;
          let eventCreateRules: Record<string, unknown>[] = [];
          let eventEditRules: Record<string, unknown>[] = [];

          if (streamName) {
            try {
              measurementProtocolSecrets = await client.listMeasurementProtocolSecrets(streamName);
            } catch (error) {
              streamWarnings.push(`measurementProtocolSecrets.list unavailable. ${errorMessage(error)}`);
            }

            if (includeSettings && streamSummary.type === "WEB_DATA_STREAM") {
              try {
                enhancedMeasurementSettings = await client.getEnhancedMeasurementSettings(streamName);
              } catch (error) {
                streamWarnings.push(`enhancedMeasurementSettings unavailable. ${errorMessage(error)}`);
              }

              try {
                dataRedactionSettings = await client.getDataRedactionSettings(streamName);
              } catch (error) {
                streamWarnings.push(`dataRedactionSettings unavailable. ${errorMessage(error)}`);
              }
            }

            if (includeRules && streamSummary.type === "WEB_DATA_STREAM") {
              try {
                eventCreateRules = await client.listEventCreateRules(streamName);
              } catch (error) {
                streamWarnings.push(`eventCreateRules.list unavailable. ${errorMessage(error)}`);
              }

              try {
                eventEditRules = await client.listEventEditRules(streamName);
              } catch (error) {
                streamWarnings.push(`eventEditRules.list unavailable. ${errorMessage(error)}`);
              }
            }
          }

          streamDiagnostics.push({
            ...streamSummary,
            measurementProtocolSecrets,
            measurementProtocolSecretCount: measurementProtocolSecrets.length,
            enhancedMeasurementSettings,
            dataRedactionSettings,
            eventCreateRuleCount: eventCreateRules.length,
            eventEditRuleCount: eventEditRules.length,
            eventCreateRules,
            eventEditRules,
            warnings: streamWarnings,
          });
        }

        const measurementProtocolSecretCount = streamDiagnostics.reduce((total, stream) => {
          return total + (typeof stream.measurementProtocolSecretCount === "number" ? stream.measurementProtocolSecretCount : 0);
        }, 0);
        const eventRuleCount = streamDiagnostics.reduce((total, stream) => {
          const createRules = typeof stream.eventCreateRuleCount === "number" ? stream.eventCreateRuleCount : 0;
          const editRules = typeof stream.eventEditRuleCount === "number" ? stream.eventEditRuleCount : 0;
          return total + createRules + editRules;
        }, 0);

        if (measurementProtocolSecretCount === 0) {
          warnings.push("No Measurement Protocol secrets were detected. This does not prove server-side tagging is absent.");
        }
        warnings.push("GA4 Admin API does not expose GTM server container routing or tagging server URLs; server-side tagging is inferred, not confirmed.");

        return ok({
          propertyId,
          streamDiagnostics,
          summary: {
            streamCount: streams.length,
            webStreamCount: streamDiagnostics.filter((stream) => stream.type === "WEB_DATA_STREAM").length,
            measurementProtocolSecretCount,
            eventRuleCount,
            possibleServerSideOrServerToServerSignals: measurementProtocolSecretCount > 0 || eventRuleCount > 0,
          },
          warnings,
          safety: {
            measurementProtocolSecretValues: "Redacted before returning tool output.",
          },
          limitations: [
            "Measurement Protocol secrets can support server-to-server collection, but are not proof of GTM server-side tagging.",
            "Direct GTM server container configuration is outside the GA4 Admin/Data APIs used by this read-only server.",
          ],
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 15. ga4_run_advanced_funnel_report
  server.tool(
    "ga4_run_advanced_funnel_report",
    "Run the GA4 Data API v1alpha runFunnelReport endpoint with optional breakdown/next-action, falling back to read-only step counts if unavailable.",
    {
      propertyId: propertyIdSchema,
      steps: z.array(advancedFunnelStepSchema).min(2).max(10).describe("Ordered funnel steps using eventName, pagePath, or fieldName+fieldValue"),
      isOpenFunnel: z.boolean().optional().default(false),
      visualizationType: funnelVisualizationTypeSchema.optional().default("STANDARD_FUNNEL"),
      breakdownDimension: z.string().optional().describe("Optional breakdown dimension, e.g. deviceCategory or sessionDefaultChannelGroup"),
      breakdownLimit: z.number().int().min(1).max(50).optional().default(10),
      nextActionDimension: z.string().optional().describe("Optional next action dimension, commonly eventName"),
      nextActionLimit: z.number().int().min(1).max(50).optional().default(10),
      startDate: z.string().optional().describe("Start date YYYY-MM-DD or relative (7daysAgo, yesterday)"),
      endDate: z.string().optional().describe("End date YYYY-MM-DD or relative (today, yesterday)"),
      datePreset: datePresetSchema.optional().default("last28days"),
      limit: z.number().int().min(1).max(250000).optional().default(10000),
      fallbackToStepCounts: z.boolean().optional().default(true),
    },
    async ({
      propertyId,
      steps,
      isOpenFunnel,
      visualizationType,
      breakdownDimension,
      breakdownLimit,
      nextActionDimension,
      nextActionLimit,
      startDate,
      endDate,
      datePreset,
      limit,
      fallbackToStepCounts,
    }) => {
      try {
        const dateRange = resolveInputDateRange(startDate, endDate, datePreset);
        const warnings: string[] = [];
        const request: GA4RunFunnelReportRequest = {
          dateRanges: [dateRange],
          funnel: {
            isOpenFunnel,
            steps: steps.map((step, index) => ({
              name: step.name ?? step.eventName ?? step.pagePath ?? step.fieldName ?? `Step ${index + 1}`,
              ...(step.isDirectlyFollowedBy !== undefined && { isDirectlyFollowedBy: step.isDirectlyFollowedBy }),
              ...(step.withinSecondsFromPriorStep !== undefined && index > 0 && { withinDurationFromPriorStep: `${step.withinSecondsFromPriorStep}s` }),
              filterExpression: buildAdvancedFunnelFilterExpression(step),
            })),
          },
          funnelVisualizationType: visualizationType,
          limit: String(limit),
          returnPropertyQuota: true,
          ...(breakdownDimension && {
            funnelBreakdown: {
              breakdownDimension: { name: getDimensionByKey(breakdownDimension)?.apiField ?? breakdownDimension },
              limit: String(breakdownLimit),
            },
          }),
          ...(nextActionDimension && {
            funnelNextAction: {
              nextActionDimension: { name: getDimensionByKey(nextActionDimension)?.apiField ?? nextActionDimension },
              limit: String(nextActionLimit),
            },
          }),
        };

        try {
          const response = await client.runFunnelReport(propertyId, request);
          return ok({
            propertyId,
            dateRange,
            source: "data_api_v1alpha_runFunnelReport",
            funnelTable: flattenFunnelSubReport(client, response.funnelTable),
            funnelVisualization: flattenFunnelSubReport(client, response.funnelVisualization),
            rawResponse: response,
            request,
            warnings,
            limitations: [
              "runFunnelReport is a Data API v1alpha read-only report endpoint and may have alpha limitations.",
              "Returned rows are report aggregates; this tool does not mutate GA4 Explore reports or property configuration.",
            ],
          });
        } catch (error) {
          if (!fallbackToStepCounts) {
            throw error;
          }

          warnings.push(`runFunnelReport failed; used independent step-count fallback. ${errorMessage(error)}`);
          const fallbackSteps = await runAdvancedFunnelStepCountFallback(client, propertyId, dateRange, steps);
          return ok({
            propertyId,
            dateRange,
            source: "data_api_runReport_step_count_fallback",
            steps: fallbackSteps,
            request,
            warnings,
            limitations: [
              "Fallback counts each step independently with activeUsers and does not reproduce GA4 Explore/runFunnelReport sequence semantics.",
              "Disable fallbackToStepCounts to surface runFunnelReport errors directly.",
            ],
          });
        }
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 16. ga4_get_channel_groups
  server.tool(
    "ga4_get_channel_groups",
    "List custom channel groups defined for a GA4 property.",
    { propertyId: propertyIdSchema },
    async ({ propertyId }) => {
      try {
        const groups = await client.listChannelGroups(propertyId);
        return ok({ channelGroups: groups });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  // 17. ga4_validate_query
  server.tool(
    "ga4_validate_query",
    "Validate a metric/dimension combination BEFORE executing. Checks max limits (9 dims, 10 metrics), ecommerce rules, and dimension compatibility.",
    {
      metrics: z.array(z.string()).min(1).describe("Metric keys to validate"),
      dimensions: z.array(z.string()).optional().describe("Dimension keys to validate"),
    },
    async ({ metrics, dimensions }) => {
      try {
        const result = validateGA4QuerySelection(metrics, dimensions ?? []);
        return ok({
          ...result,
          debug: {
            requestCount: 0,
          },
        });
      } catch (e) { return formatMcpToolError(e); }
    },
  );

  registerGA4SurfaceTools(server, client);
}
