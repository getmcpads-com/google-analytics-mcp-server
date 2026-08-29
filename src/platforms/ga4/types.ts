/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GOOGLE ANALYTICS 4 DATA API TYPES
// Complete TypeScript interfaces for GA4 integration
// ============================================

// ============================================
// CORE ENUMS & TYPE ALIASES
// ============================================

export type GA4MetricCategory =
  | "traffic"
  | "engagement"
  | "revenue"
  | "ecommerce"
  | "conversions"
  | "ads"
  | "user"
  | "calculated";

export type GA4DimensionCategory =
  | "time"
  | "traffic_source"
  | "geography"
  | "device"
  | "page"
  | "event"
  | "ecommerce"
  | "user";

export type GA4MetricFormat =
  | "number"
  | "currency"
  | "percent"
  | "duration"
  | "ratio";

export type GA4FilterMatchType =
  | "EXACT"
  | "BEGINS_WITH"
  | "ENDS_WITH"
  | "CONTAINS"
  | "FULL_REGEXP"
  | "PARTIAL_REGEXP";

export type GA4NumericOperation =
  | "EQUAL"
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL";

export type GA4DatePreset =
  | "today"
  | "yesterday"
  | "last7days"
  | "last28days"
  | "last30days"
  | "last90days"
  | "last12months"
  | "thisMonth"
  | "lastMonth"
  | "thisYear";

// ============================================
// PROPERTY TYPES
// ============================================

export interface GA4Property {
  propertyId: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
  industryCategory?: string;
  propertyType?: string;
  parent?: string; // account resource name
}

export interface GA4AccountSummary {
  name: string; // e.g. "accountSummaries/123"
  account: string; // e.g. "accounts/123"
  displayName: string;
  propertySummaries?: Array<{
    property: string; // e.g. "properties/123"
    displayName: string;
    propertyType?: string;
    parent?: string;
  }>;
}

// ============================================
// CHANNEL GROUP TYPES
// ============================================

export interface GA4ChannelGroup {
  name: string;
  displayName: string;
  description?: string;
  primary?: boolean;
}

// ============================================
// QUERY REQUEST TYPES
// ============================================

export interface GA4DateRange {
  startDate: string; // "2026-01-01" or "7daysAgo", "yesterday", "today"
  endDate: string;
}

export interface GA4Dimension {
  name: string; // e.g. "date", "sessionSource", "city"
}

export interface GA4Metric {
  name: string; // e.g. "sessions", "activeUsers", "totalRevenue"
}

export interface GA4FilterExpression {
  andGroup?: { expressions: GA4FilterExpression[] };
  orGroup?: { expressions: GA4FilterExpression[] };
  notExpression?: GA4FilterExpression;
  filter?: {
    fieldName: string;
    stringFilter?: {
      matchType: GA4FilterMatchType;
      value: string;
      caseSensitive?: boolean;
    };
    inListFilter?: {
      values: string[];
      caseSensitive?: boolean;
    };
    numericFilter?: {
      operation: GA4NumericOperation;
      value: { int64Value?: string; doubleValue?: number };
    };
    betweenFilter?: {
      fromValue: { int64Value?: string; doubleValue?: number };
      toValue: { int64Value?: string; doubleValue?: number };
    };
  };
}

export interface GA4OrderBy {
  dimension?: { dimensionName: string; orderType?: string };
  metric?: { metricName: string };
  desc?: boolean;
}

export interface GA4RunReportRequest {
  property?: string;
  dateRanges?: GA4DateRange[];
  dimensions?: GA4Dimension[];
  metrics: GA4Metric[];
  dimensionFilter?: GA4FilterExpression;
  metricFilter?: GA4FilterExpression;
  orderBys?: GA4OrderBy[];
  limit?: number;
  offset?: number;
  keepEmptyRows?: boolean;
  metricAggregations?: Array<"TOTAL" | "MINIMUM" | "MAXIMUM" | "COUNT">;
  currencyCode?: string;
  returnPropertyQuota?: boolean;
  cohortSpec?: Record<string, unknown>;
  comparisons?: Array<Record<string, unknown>>;
}

export interface GA4Pivot {
  fieldNames: string[];
  orderBys?: GA4OrderBy[];
  offset?: number;
  limit: number;
  metricAggregations?: Array<"TOTAL" | "MINIMUM" | "MAXIMUM" | "COUNT">;
}

export interface GA4RunPivotReportRequest {
  property?: string;
  dateRanges?: GA4DateRange[];
  dimensions: GA4Dimension[];
  metrics: GA4Metric[];
  pivots: GA4Pivot[];
  dimensionFilter?: GA4FilterExpression;
  metricFilter?: GA4FilterExpression;
  currencyCode?: string;
  keepEmptyRows?: boolean;
  returnPropertyQuota?: boolean;
  cohortSpec?: Record<string, unknown>;
  comparisons?: Array<Record<string, unknown>>;
}

export interface GA4RunPivotReportResponse extends GA4RunReportResponse {
  pivotHeaders?: Array<Record<string, unknown>>;
  aggregates?: GA4Row[];
  kind?: string;
}

export interface GA4BatchRunReportsResponse {
  reports?: GA4RunReportResponse[];
  kind?: string;
}

export interface GA4BatchRunPivotReportsResponse {
  pivotReports?: GA4RunPivotReportResponse[];
  kind?: string;
}

export interface GA4MinuteRange {
  name?: string;
  startMinutesAgo?: number;
  endMinutesAgo?: number;
}

export interface GA4RunRealtimeReportRequest {
  dimensions?: GA4Dimension[];
  metrics: GA4Metric[];
  dimensionFilter?: GA4FilterExpression;
  metricFilter?: GA4FilterExpression;
  minuteRanges?: GA4MinuteRange[];
  orderBys?: GA4OrderBy[];
  limit?: number;
  keepEmptyRows?: boolean;
  returnPropertyQuota?: boolean;
}

export interface GA4RunFunnelReportRequest {
  dateRanges?: GA4DateRange[];
  funnel: Record<string, unknown>;
  funnelBreakdown?: Record<string, unknown>;
  funnelNextAction?: Record<string, unknown>;
  funnelVisualizationType?: "STANDARD_FUNNEL" | "TRENDED_FUNNEL";
  limit?: string;
  dimensionFilter?: GA4FilterExpression;
  returnPropertyQuota?: boolean;
}

export interface GA4QueryRequest {
  propertyId: string;
  dateRanges: GA4DateRange[];
  dimensions?: string[];
  metrics: string[];
  dimensionFilter?: GA4FilterExpression;
  metricFilter?: GA4FilterExpression;
  orderBys?: GA4OrderBy[];
  limit?: number;
  offset?: number;
  keepEmptyRows?: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface GA4Row {
  dimensionValues?: Array<{ value: string }>;
  metricValues?: Array<{ value: string }>;
}

export interface GA4RunReportResponse {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string; type: string }>;
  rows?: GA4Row[];
  rowCount?: number;
  metadata?: { currencyCode: string; timeZone: string };
  totals?: GA4Row[];
  minimums?: GA4Row[];
  maximums?: GA4Row[];
  propertyQuota?: Record<string, unknown>;
}

export interface GA4RunFunnelReportResponse {
  funnelTable?: GA4RunReportResponse;
  funnelVisualization?: GA4RunReportResponse;
  propertyQuota?: Record<string, unknown>;
  kind?: string;
}

export interface GA4InsightRow {
  [key: string]: string | number | null;
}

// ============================================
// METRIC CATALOG TYPES
// ============================================

export interface GA4MetricDefinition {
  key: string;
  name: string;
  description: string;
  category: GA4MetricCategory;
  format: GA4MetricFormat;
  apiField: string;
  type: "api" | "calculated";
  formula?: string;
  dependencies?: string[];
}

// ============================================
// DIMENSION CATALOG TYPES
// ============================================

export interface GA4DimensionDefinition {
  key: string;
  name: string;
  description: string;
  category: GA4DimensionCategory;
  apiField: string;
}

// ============================================
// FILTER CATALOG TYPES
// ============================================

export interface GA4FilterDefinition {
  key: string;
  name: string;
  description: string;
  apiField: string;
  type: "string" | "numeric" | "inList";
  category: GA4DimensionCategory;
}

// ============================================
// QUERY PLAN TYPES
// ============================================

export interface GA4QueryPlan {
  request: GA4RunReportRequest;
  propertyId: string;
  warnings: string[];
  errors: string[];
  calculatedMetrics: string[];
  apiMetrics: string[];
}

// ============================================
// API ERROR TYPES
// ============================================

export class GA4ApiException extends Error {
  code: number;
  status: string;

  constructor(message: string, code: number, status?: string) {
    super(message);
    this.name = "GA4ApiException";
    this.code = code;
    this.status = status || "UNKNOWN";
  }

  get isAuthError(): boolean {
    return this.code === 401 || this.code === 403;
  }

  get isRateLimitError(): boolean {
    return this.code === 429;
  }

  get isQuotaError(): boolean {
    return this.code === 429 || this.status === "RESOURCE_EXHAUSTED";
  }

  get suggestion(): string {
    if (this.isAuthError) return "Re-authenticate with Google Analytics";
    if (this.isRateLimitError) return "Rate limit exceeded, wait and retry";
    if (this.isQuotaError) return "Quota exceeded, reduce query frequency";
    return "Check the error details for more information";
  }
}

// ============================================
// CONSTANTS
// ============================================

export const GA4_DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";
export const GA4_DATA_API_ALPHA_BASE = "https://analyticsdata.googleapis.com/v1alpha";
export const GA4_ADMIN_API_BASE = "https://analyticsadmin.googleapis.com/v1beta";
export const GA4_ADMIN_API_ALPHA_BASE = "https://analyticsadmin.googleapis.com/v1alpha";

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Resolve a GA4 date preset to start/end date strings
 */
export function resolveDatePreset(preset: GA4DatePreset): GA4DateRange {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };

  switch (preset) {
    case "today": return { startDate: "today", endDate: "today" };
    case "yesterday": return { startDate: "yesterday", endDate: "yesterday" };
    case "last7days": return { startDate: "7daysAgo", endDate: "today" };
    case "last28days": return { startDate: "28daysAgo", endDate: "today" };
    case "last30days": return { startDate: "30daysAgo", endDate: "today" };
    case "last90days": return { startDate: "90daysAgo", endDate: "today" };
    case "last12months": return { startDate: daysAgo(365), endDate: today };
    case "thisMonth": {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      return { startDate: firstOfMonth, endDate: today };
    }
    case "lastMonth": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: first.toISOString().split("T")[0], endDate: last.toISOString().split("T")[0] };
    }
    case "thisYear": {
      const firstOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
      return { startDate: firstOfYear, endDate: today };
    }
    default: return { startDate: "28daysAgo", endDate: "today" };
  }
}
