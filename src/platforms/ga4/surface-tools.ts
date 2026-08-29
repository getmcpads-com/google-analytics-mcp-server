/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatMcpToolError } from "../../core/errors.js";
import {
  GA4_ADMIN_COLLECTIONS,
  type GA4AdminCollection,
  type GA4Client,
  type GA4PropertySetting,
} from "./client.js";
import type {
  GA4FilterExpression,
  GA4OrderBy,
  GA4RunPivotReportRequest,
  GA4RunReportRequest,
} from "./types.js";
import {
  redactGA4AudienceExportResponse,
  redactGA4PersonalIdentifiers,
} from "./privacy.js";

const propertyIdSchema = z.string().min(1).describe("Numeric GA4 property ID or properties/{id}.");
const dateRangeSchema = z.object({
  startDate: z.string().min(1).describe("YYYY-MM-DD or a GA4 relative date such as 28daysAgo."),
  endDate: z.string().min(1).describe("YYYY-MM-DD or a GA4 relative date such as today."),
});
const rawFilterSchema = z.record(z.unknown()).describe("Native GA4 FilterExpression JSON.");
const rawOrderBySchema = z.record(z.unknown()).describe("Native GA4 OrderBy JSON.");
const aggregationSchema = z.enum(["TOTAL", "MINIMUM", "MAXIMUM", "COUNT"]);

const reportSchema = z.object({
  dateRanges: z.array(dateRangeSchema).min(1).max(4).optional(),
  dimensions: z.array(z.string().min(1)).max(9).optional().default([]),
  metrics: z.array(z.string().min(1)).min(1).max(10),
  dimensionFilter: rawFilterSchema.optional(),
  metricFilter: rawFilterSchema.optional(),
  orderBys: z.array(rawOrderBySchema).max(10).optional(),
  limit: z.number().int().min(1).max(250_000).optional(),
  offset: z.number().int().min(0).optional(),
  keepEmptyRows: z.boolean().optional(),
  metricAggregations: z.array(aggregationSchema).max(4).optional(),
  currencyCode: z.string().length(3).optional(),
  returnPropertyQuota: z.boolean().optional().default(true),
  cohortSpec: z.record(z.unknown()).optional().describe("Native GA4 CohortSpec JSON. Omit dateRanges for cohort requests."),
  comparisons: z.array(z.record(z.unknown())).max(4).optional().describe("Native GA4 Comparison objects."),
}).refine((report) => Boolean(report.dateRanges?.length || report.cohortSpec), {
  message: "Provide dateRanges or cohortSpec.",
});

const pivotSchema = z.object({
  fieldNames: z.array(z.string().min(1)).min(1).max(9),
  orderBys: z.array(rawOrderBySchema).max(10).optional(),
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(250_000),
  metricAggregations: z.array(aggregationSchema).max(4).optional(),
});

const pivotReportSchema = z.object({
  dateRanges: z.array(dateRangeSchema).min(1).max(4).optional(),
  dimensions: z.array(z.string().min(1)).min(1).max(9),
  metrics: z.array(z.string().min(1)).min(1).max(10),
  pivots: z.array(pivotSchema).min(1).max(9),
  dimensionFilter: rawFilterSchema.optional(),
  metricFilter: rawFilterSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  keepEmptyRows: z.boolean().optional(),
  returnPropertyQuota: z.boolean().optional().default(true),
  cohortSpec: z.record(z.unknown()).optional().describe("Native GA4 CohortSpec JSON. Omit dateRanges for cohort requests."),
  comparisons: z.array(z.record(z.unknown())).max(4).optional().describe("Native GA4 Comparison objects."),
}).refine((report) => Boolean(report.dateRanges?.length || report.cohortSpec), {
  message: "Provide dateRanges or cohortSpec.",
});

function ok(data: unknown) {
  const body = typeof data === "object" && data !== null && !Array.isArray(data)
    ? {
        ...data,
        warnings: "warnings" in data ? (data as Record<string, unknown>).warnings : [],
        limitations: "limitations" in data ? (data as Record<string, unknown>).limitations : [],
        nextActions: "nextActions" in data ? (data as Record<string, unknown>).nextActions : [],
        debug: {
          source: "ga4",
          apiVersion: "data_api_v1beta/admin_api_v1beta_v1alpha",
          requestCount: 1,
          ...((data as Record<string, unknown>).debug as Record<string, unknown> | undefined),
        },
      }
    : data;
  return { content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }] };
}

function reportRequest(input: z.infer<typeof reportSchema>): GA4RunReportRequest {
  return {
    dateRanges: input.dateRanges,
    dimensions: input.dimensions.map((name) => ({ name })),
    metrics: input.metrics.map((name) => ({ name })),
    dimensionFilter: input.dimensionFilter as GA4FilterExpression | undefined,
    metricFilter: input.metricFilter as GA4FilterExpression | undefined,
    orderBys: input.orderBys as GA4OrderBy[] | undefined,
    limit: input.limit,
    offset: input.offset,
    keepEmptyRows: input.keepEmptyRows,
    metricAggregations: input.metricAggregations,
    currencyCode: input.currencyCode,
    returnPropertyQuota: input.returnPropertyQuota,
    cohortSpec: input.cohortSpec,
    comparisons: input.comparisons,
  };
}

function pivotReportRequest(input: z.infer<typeof pivotReportSchema>): GA4RunPivotReportRequest {
  return {
    dateRanges: input.dateRanges,
    dimensions: input.dimensions.map((name) => ({ name })),
    metrics: input.metrics.map((name) => ({ name })),
    pivots: input.pivots.map((pivot) => ({
      ...pivot,
      orderBys: pivot.orderBys as GA4OrderBy[] | undefined,
    })),
    dimensionFilter: input.dimensionFilter as GA4FilterExpression | undefined,
    metricFilter: input.metricFilter as GA4FilterExpression | undefined,
    currencyCode: input.currencyCode,
    keepEmptyRows: input.keepEmptyRows,
    returnPropertyQuota: input.returnPropertyQuota,
    cohortSpec: input.cohortSpec,
    comparisons: input.comparisons,
  };
}

function validatePivotRequest(request: GA4RunPivotReportRequest): string[] {
  const errors: string[] = [];
  const declared = new Set(request.dimensions.map(({ name }) => name));
  const seen = new Set<string>();
  let cellBudget = 1;

  for (const pivot of request.pivots) {
    cellBudget *= pivot.limit;
    for (const field of pivot.fieldNames) {
      if (!declared.has(field) && field !== "dateRange" && field !== "comparisons") {
        errors.push(`Pivot field '${field}' is not declared in dimensions.`);
      }
      if (seen.has(field)) errors.push(`Pivot field '${field}' appears in more than one pivot.`);
      seen.add(field);
    }
  }
  if (cellBudget > 250_000) {
    errors.push(`The product of pivot limits is ${cellBudget}; GA4 allows at most 250,000.`);
  }
  return errors;
}

function stripProperty(request: GA4RunReportRequest | GA4RunPivotReportRequest) {
  const { property: _property, ...body } = request;
  return body;
}

export function registerGA4SurfaceTools(server: McpServer, client: GA4Client): void {
  server.tool(
    "ga4_run_pivot_report",
    "Run a read-only GA4 Data API pivot report with native filters, ordering, quota state, multiple date ranges, and up to 250,000 pivot cells. Every pivot requires an explicit limit.",
    { propertyId: propertyIdSchema, report: pivotReportSchema },
    async ({ propertyId, report }) => {
      try {
        const request = pivotReportRequest(report);
        const errors = validatePivotRequest(request);
        if (errors.length) return ok({ error: "Pivot validation failed", errors });
        const response = await client.runPivotReport(propertyId, stripProperty(request) as GA4RunPivotReportRequest);
        return ok({
          report: response,
          data: client.flattenResponse(response),
          rowCount: response.rows?.length ?? 0,
          propertyQuota: response.propertyQuota,
        });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_batch_run_reports",
    "Run 1-5 independent read-only GA4 Core reports for the same property in one official Data API batch request.",
    { propertyId: propertyIdSchema, reports: z.array(reportSchema).min(1).max(5) },
    async ({ propertyId, reports }) => {
      try {
        const requests = reports.map((report) => stripProperty(reportRequest(report)) as GA4RunReportRequest);
        const response = await client.batchRunReports(propertyId, requests);
        const entries = (response.reports ?? []).map((report, index) => ({
          index,
          rowCount: report.rowCount ?? report.rows?.length ?? 0,
          data: client.flattenResponse(report),
          metadata: report.metadata,
          totals: report.totals,
          minimums: report.minimums,
          maximums: report.maximums,
          propertyQuota: report.propertyQuota,
        }));
        return ok({ reports: entries, reportCount: entries.length, kind: response.kind });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_batch_run_pivot_reports",
    "Run 1-5 independent read-only GA4 pivot reports for the same property in one official Data API batch request.",
    { propertyId: propertyIdSchema, reports: z.array(pivotReportSchema).min(1).max(5) },
    async ({ propertyId, reports }) => {
      try {
        const requests = reports.map(pivotReportRequest);
        const errors = requests.flatMap((request, index) => validatePivotRequest(request).map((error) => `Report ${index}: ${error}`));
        if (errors.length) return ok({ error: "Pivot validation failed", errors });
        const response = await client.batchRunPivotReports(
          propertyId,
          requests.map((request) => stripProperty(request) as GA4RunPivotReportRequest),
        );
        const entries = (response.pivotReports ?? []).map((report, index) => ({
          index,
          rowCount: report.rows?.length ?? 0,
          data: client.flattenResponse(report),
          report,
        }));
        return ok({ reports: entries, reportCount: entries.length, kind: response.kind });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_check_compatibility",
    "Ask the official GA4 Data API which dimensions and metrics are compatible with a proposed Core report selection.",
    {
      propertyId: propertyIdSchema,
      dimensions: z.array(z.string().min(1)).max(9).optional().default([]),
      metrics: z.array(z.string().min(1)).max(10).optional().default([]),
      dimensionFilter: rawFilterSchema.optional(),
      metricFilter: rawFilterSchema.optional(),
      compatibilityFilter: z.enum(["COMPATIBILITY_UNSPECIFIED", "COMPATIBLE", "INCOMPATIBLE"]).optional(),
    },
    async ({ propertyId, dimensions, metrics, dimensionFilter, metricFilter, compatibilityFilter }) => {
      try {
        const response = await client.checkCompatibility(propertyId, {
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          ...(dimensionFilter && { dimensionFilter }),
          ...(metricFilter && { metricFilter }),
          ...(compatibilityFilter && { compatibilityFilter }),
        });
        return ok(response);
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_get_property_quotas_snapshot",
    "Read the current GA4 Data API property quota snapshot from the official v1alpha endpoint. This does not run a report, but Google still charges one property-quota token to the category with the most remaining quota.",
    { propertyId: propertyIdSchema },
    async ({ propertyId }) => {
      try {
        const snapshot = await client.getPropertyQuotasSnapshot(propertyId);
        return ok({ propertyId, snapshot });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_list_accounts",
    "List raw GA4 Analytics Admin accounts accessible to the authenticated user (read-only, auto-paginated).",
    { pageSize: z.number().int().min(1).max(200).optional().default(200) },
    async ({ pageSize }) => {
      try {
        const accounts = await client.listAccounts(pageSize);
        return ok({ accounts, count: accounts.length });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  const adminCollectionNames = Object.keys(GA4_ADMIN_COLLECTIONS) as [GA4AdminCollection, ...GA4AdminCollection[]];
  server.tool(
    "ga4_list_admin_resources",
    "List an allowlisted GA4 Admin collection in read-only mode: streams, custom definitions, key events, audiences, product links, annotations, channel groups, expanded datasets, subproperty/rollup configuration, and access bindings.",
    {
      propertyId: propertyIdSchema,
      collection: z.enum(adminCollectionNames),
      pageSize: z.number().int().min(1).max(200).optional().default(200),
      includePersonalIdentifiers: z.boolean().optional().default(false)
        .describe("Access bindings only. Explicitly include user/email identifiers; false redacts them by default."),
    },
    async ({ propertyId, collection, pageSize, includePersonalIdentifiers }) => {
      try {
        const resources = await client.listAdminPropertyResources(propertyId, collection, pageSize);
        const exposesPersonalIdentifiers = collection === "accessBindings";
        const safeResources = exposesPersonalIdentifiers && !includePersonalIdentifiers
          ? redactGA4PersonalIdentifiers(resources)
          : resources;
        return ok({
          propertyId,
          collection,
          resources: safeResources,
          count: resources.length,
          warnings: exposesPersonalIdentifiers && includePersonalIdentifiers
            ? ["SENSITIVE PERSONAL IDENTIFIERS INCLUDED BY EXPLICIT OPT-IN: access-binding user/email values are present. Restrict storage, sharing, and model output."]
            : exposesPersonalIdentifiers
              ? ["Access-binding user/email identifiers were redacted by default. Set includePersonalIdentifiers=true only with explicit authorization."]
            : [],
        });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  const settingNames: [GA4PropertySetting, ...GA4PropertySetting[]] = [
    "attributionSettings",
    "dataRetentionSettings",
    "googleSignalsSettings",
    "reportingIdentitySettings",
    "userProvidedDataSettings",
  ];
  server.tool(
    "ga4_get_property_configuration",
    "Read GA4 property details plus selected singleton Admin settings (attribution, retention, Google Signals, reporting identity, or user-provided-data settings).",
    {
      propertyId: propertyIdSchema,
      settings: z.array(z.enum(settingNames)).max(settingNames.length).optional().default([]),
    },
    async ({ propertyId, settings }) => {
      try {
        const property = await client.getProperty(propertyId);
        const configuration: Record<string, unknown> = {};
        const warnings: string[] = [];
        for (const setting of [...new Set(settings)]) {
          try {
            configuration[setting] = await client.getPropertySetting(propertyId, setting);
          } catch (error) {
            warnings.push(`${setting}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        return ok({ property, configuration, warnings, debug: { requestCount: 1 + new Set(settings).size } });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_list_audience_exports",
    "List existing GA4 Audience Export snapshots and Recurring Audience Lists without creating new exports.",
    {
      propertyId: propertyIdSchema,
      includeRecurring: z.boolean().optional().default(true),
      pageSize: z.number().int().min(1).max(200).optional().default(100),
    },
    async ({ propertyId, includeRecurring, pageSize }) => {
      try {
        const audienceExports = await client.listAudienceExports(propertyId, pageSize);
        const recurringAudienceLists = includeRecurring
          ? await client.listRecurringAudienceLists(propertyId, Math.min(pageSize, 100))
          : [];
        return ok({
          audienceExports,
          recurringAudienceLists,
          counts: { audienceExports: audienceExports.length, recurringAudienceLists: recurringAudienceLists.length },
          debug: { requestCount: includeRecurring ? 2 : 1 },
        });
      } catch (error) { return formatMcpToolError(error); }
    },
  );

  server.tool(
    "ga4_query_audience_export",
    "Query rows from an existing GA4 Audience Export. User/device identifiers are redacted by default; include them only through explicit opt-in.",
    {
      audienceExportName: z.string().regex(/^properties\/[^/]+\/audienceExports\/[^/]+$/),
      offset: z.number().int().min(0).optional().default(0),
      limit: z.number().int().min(1).max(10_000).optional().default(100),
      includePersonalIdentifiers: z.boolean().optional().default(false)
        .describe("Explicitly return user/device identifiers. False redacts identifier columns by default."),
    },
    async ({ audienceExportName, offset, limit, includePersonalIdentifiers }) => {
      try {
        const response = await client.queryAudienceExport(audienceExportName, {
          offset: String(offset),
          limit: String(limit),
        });
        return ok({
          audienceExportName,
          response: includePersonalIdentifiers ? response : redactGA4AudienceExportResponse(response),
          warnings: includePersonalIdentifiers
            ? ["SENSITIVE PERSONAL IDENTIFIERS INCLUDED BY EXPLICIT OPT-IN: Audience Export user/device identifiers are present. Restrict storage, sharing, and model output."]
            : ["Audience Export user/device identifiers were redacted by default. Set includePersonalIdentifiers=true only with explicit authorization."],
        });
      } catch (error) { return formatMcpToolError(error); }
    },
  );
}
