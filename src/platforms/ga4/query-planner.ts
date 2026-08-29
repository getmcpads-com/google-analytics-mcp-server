/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GA4 QUERY PLANNER
// Converts copilot params to GA4RunReportRequest
// ============================================

import type {
  GA4QueryRequest,
  GA4QueryPlan,
  GA4RunReportRequest,
  GA4DateRange,
  GA4Dimension,
  GA4Metric,
  GA4OrderBy,
  GA4FilterExpression,
  GA4DatePreset,
} from "./types.js";
import { resolveDatePreset } from "./types.js";
import { getMetricByKey } from "./metric-catalog.js";
import { getDimensionByKey } from "./dimension-catalog.js";
import { validateGA4QuerySelection } from "./compatibility-rules.js";
import { isCalculatedMetric, getCalculatedMetricDependencies } from "./calculated-metrics.js";
import { buildFilterFromParams } from "./filter-catalog.js";

// ============================================
// MAIN PLANNER
// ============================================

/**
 * Build a GA4 report request from copilot-style params.
 *
 * This function:
 * 1. Separates calculated vs API metrics
 * 2. Resolves calculated metric dependencies
 * 3. Validates compatibility
 * 4. Builds the GA4 API request body
 */
export function planGA4Query(params: {
  propertyId: string;
  metrics: string[];
  dimensions?: string[];
  filters?: Array<{ field: string; operator: string; value: unknown }>;
  dateRange?: { startDate: string; endDate: string };
  datePreset?: string;
  orderBy?: string;
  orderDirection?: string;
  limit?: number;
}): GA4QueryPlan {
  const warnings: string[] = [];
  const errors: string[] = [];

  // --- 1. Separate calculated vs API metrics ---
  const calculatedMetrics: string[] = [];
  const apiMetricKeys: string[] = [];

  for (const key of params.metrics) {
    if (isCalculatedMetric(key)) {
      calculatedMetrics.push(key);
    } else {
      apiMetricKeys.push(key);
    }
  }

  // --- 2. Resolve calculated metric dependencies ---
  if (calculatedMetrics.length > 0) {
    const deps = getCalculatedMetricDependencies(calculatedMetrics);
    for (const dep of deps) {
      if (!apiMetricKeys.includes(dep)) {
        apiMetricKeys.push(dep);
      }
    }
  }

  // --- 3. Resolve metric API field names ---
  const apiMetrics: GA4Metric[] = [];
  for (const key of apiMetricKeys) {
    const def = getMetricByKey(key);
    if (def) {
      apiMetrics.push({ name: def.apiField });
    } else {
      // Assume the key IS the API field name
      apiMetrics.push({ name: key });
    }
  }

  // --- 4. Resolve dimension API field names ---
  const dimensionKeys = params.dimensions || [];
  const apiDimensions: GA4Dimension[] = [];
  for (const key of dimensionKeys) {
    const def = getDimensionByKey(key);
    if (def) {
      apiDimensions.push({ name: def.apiField });
    } else {
      apiDimensions.push({ name: key });
    }
  }

  // --- 5. Validate compatibility ---
  const validation = validateGA4QuerySelection(
    apiMetricKeys,
    dimensionKeys
  );
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  // --- 6. Resolve date range ---
  let dateRanges: GA4DateRange[];
  if (params.dateRange) {
    dateRanges = [{
      startDate: params.dateRange.startDate,
      endDate: params.dateRange.endDate,
    }];
  } else if (params.datePreset) {
    dateRanges = [resolveDatePreset(params.datePreset as GA4DatePreset)];
  } else {
    // Default: last 28 days
    dateRanges = [{ startDate: "28daysAgo", endDate: "today" }];
  }

  // --- 7. Build order by ---
  const orderBys: GA4OrderBy[] = [];
  if (params.orderBy) {
    const metricDef = getMetricByKey(params.orderBy);
    const dimDef = getDimensionByKey(params.orderBy);

    if (metricDef) {
      orderBys.push({
        metric: { metricName: metricDef.apiField },
        desc: params.orderDirection !== "ASC",
      });
    } else if (dimDef) {
      orderBys.push({
        dimension: { dimensionName: dimDef.apiField },
        desc: params.orderDirection !== "ASC",
      });
    } else {
      // Try as raw API field
      orderBys.push({
        metric: { metricName: params.orderBy },
        desc: params.orderDirection !== "ASC",
      });
    }
  }

  // --- 8. Build filters ---
  let dimensionFilter: GA4FilterExpression | undefined;
  if (params.filters && params.filters.length > 0) {
    dimensionFilter = buildFilterFromParams(params.filters);
  }

  // --- 9. Assemble request ---
  const request: GA4RunReportRequest = {
    dateRanges,
    metrics: apiMetrics,
    ...(apiDimensions.length > 0 && { dimensions: apiDimensions }),
    ...(dimensionFilter && { dimensionFilter }),
    ...(orderBys.length > 0 && { orderBys }),
    ...(params.limit && { limit: params.limit }),
    keepEmptyRows: false,
  };

  return {
    request,
    propertyId: params.propertyId,
    warnings,
    errors,
    calculatedMetrics,
    apiMetrics: apiMetricKeys,
  };
}

/**
 * Build a GA4 report request for direct use (without copilot abstraction)
 */
export function buildGA4Report(params: {
  propertyId: string;
  metrics: string[];
  dimensions?: string[];
  filters?: Array<{ field: string; operator: string; value: unknown }>;
  dateRange?: { startDate: string; endDate: string };
  datePreset?: string;
  orderBy?: string;
  limit?: number;
}): GA4QueryRequest {
  const dateRanges = params.dateRange
    ? [params.dateRange]
    : params.datePreset
      ? [resolveDatePreset(params.datePreset as GA4DatePreset)]
      : [{ startDate: "28daysAgo", endDate: "today" }];

  return {
    propertyId: params.propertyId,
    dateRanges,
    metrics: params.metrics,
    dimensions: params.dimensions,
    ...(params.filters && params.filters.length > 0 && {
      dimensionFilter: buildFilterFromParams(params.filters),
    }),
    ...(params.orderBy && {
      orderBys: [{
        metric: { metricName: params.orderBy },
        desc: true,
      }],
    }),
    ...(params.limit && { limit: params.limit }),
  };
}
