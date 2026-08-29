/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GA4 CALCULATED METRICS
// Client-side metric computation
// ============================================

import type { GA4InsightRow, GA4MetricDefinition } from "./types.js";

// ============================================
// CALCULATED METRIC DEFINITIONS
// ============================================

export const GA4_CALCULATED_METRIC_DEFINITIONS: GA4MetricDefinition[] = [
  {
    key: "revenuePerSession",
    name: "Revenue per Session",
    description: "Total revenue divided by total sessions",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "totalRevenue / sessions",
    dependencies: ["totalRevenue", "sessions"],
  },
  {
    key: "conversionRate",
    name: "Conversion Rate",
    description: "Conversions divided by sessions (percentage)",
    category: "calculated",
    format: "percent",
    apiField: "",
    type: "calculated",
    formula: "(conversions / sessions) * 100",
    dependencies: ["conversions", "sessions"],
  },
  {
    key: "pagesPerSession",
    name: "Pages per Session",
    description: "Page views divided by sessions",
    category: "calculated",
    format: "ratio",
    apiField: "",
    type: "calculated",
    formula: "screenPageViews / sessions",
    dependencies: ["screenPageViews", "sessions"],
  },
  {
    key: "aov",
    name: "Average Order Value",
    description: "Purchase revenue divided by number of purchases",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "purchaseRevenue / ecommercePurchases",
    dependencies: ["purchaseRevenue", "ecommercePurchases"],
  },
  {
    key: "revenuePerUser",
    name: "Revenue per User",
    description: "Total revenue divided by total users",
    category: "calculated",
    format: "currency",
    apiField: "",
    type: "calculated",
    formula: "totalRevenue / totalUsers",
    dependencies: ["totalRevenue", "totalUsers"],
  },
  {
    key: "addToCartRate",
    name: "Add to Cart Rate",
    description: "Add to carts divided by sessions (percentage)",
    category: "calculated",
    format: "percent",
    apiField: "",
    type: "calculated",
    formula: "(addToCarts / sessions) * 100",
    dependencies: ["addToCarts", "sessions"],
  },
  {
    key: "checkoutRate",
    name: "Checkout Rate",
    description: "Checkouts divided by sessions (percentage)",
    category: "calculated",
    format: "percent",
    apiField: "",
    type: "calculated",
    formula: "(checkouts / sessions) * 100",
    dependencies: ["checkouts", "sessions"],
  },
  {
    key: "purchaseRate",
    name: "Purchase Rate",
    description: "Purchases divided by sessions (percentage)",
    category: "calculated",
    format: "percent",
    apiField: "",
    type: "calculated",
    formula: "(ecommercePurchases / sessions) * 100",
    dependencies: ["ecommercePurchases", "sessions"],
  },
  {
    key: "cartAbandonmentRate",
    name: "Cart Abandonment Rate",
    description: "Percentage of checkouts not completed as purchases",
    category: "calculated",
    format: "percent",
    apiField: "",
    type: "calculated",
    formula: "(1 - ecommercePurchases / checkouts) * 100",
    dependencies: ["ecommercePurchases", "checkouts"],
  },
];

// ============================================
// INDIVIDUAL METRIC CALCULATORS
// ============================================

function calcRevenuePerSession(row: GA4InsightRow): number | null {
  const revenue = row["totalRevenue"];
  const sessions = row["sessions"];
  if (typeof revenue !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return revenue / sessions;
}

function calcConversionRate(row: GA4InsightRow): number | null {
  const conversions = row["conversions"] ?? row["keyEvents"];
  const sessions = row["sessions"];
  if (typeof conversions !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return (conversions / sessions) * 100;
}

function calcPagesPerSession(row: GA4InsightRow): number | null {
  const pageViews = row["screenPageViews"];
  const sessions = row["sessions"];
  if (typeof pageViews !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return pageViews / sessions;
}

function calcAov(row: GA4InsightRow): number | null {
  const revenue = row["purchaseRevenue"] ?? row["totalRevenue"];
  const purchases = row["ecommercePurchases"] ?? row["transactions"];
  if (typeof revenue !== "number" || typeof purchases !== "number") return null;
  if (purchases <= 0) return null;
  return revenue / purchases;
}

function calcRevenuePerUser(row: GA4InsightRow): number | null {
  const revenue = row["totalRevenue"];
  const users = row["totalUsers"];
  if (typeof revenue !== "number" || typeof users !== "number") return null;
  if (users <= 0) return null;
  return revenue / users;
}

function calcAddToCartRate(row: GA4InsightRow): number | null {
  const addToCarts = row["addToCarts"];
  const sessions = row["sessions"];
  if (typeof addToCarts !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return (addToCarts / sessions) * 100;
}

function calcCheckoutRate(row: GA4InsightRow): number | null {
  const checkouts = row["checkouts"];
  const sessions = row["sessions"];
  if (typeof checkouts !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return (checkouts / sessions) * 100;
}

function calcPurchaseRate(row: GA4InsightRow): number | null {
  const purchases = row["ecommercePurchases"];
  const sessions = row["sessions"];
  if (typeof purchases !== "number" || typeof sessions !== "number") return null;
  if (sessions <= 0) return null;
  return (purchases / sessions) * 100;
}

function calcCartAbandonmentRate(row: GA4InsightRow): number | null {
  const purchases = row["ecommercePurchases"];
  const checkouts = row["checkouts"];
  if (typeof purchases !== "number" || typeof checkouts !== "number") return null;
  if (checkouts <= 0) return null;
  return (1 - purchases / checkouts) * 100;
}

// ============================================
// MAIN CALCULATION FUNCTION
// ============================================

/**
 * Calculate all custom metrics for a single row
 */
export function calculateMetrics(
  row: GA4InsightRow
): Record<string, number | null> {
  return {
    revenuePerSession: calcRevenuePerSession(row),
    conversionRate: calcConversionRate(row),
    pagesPerSession: calcPagesPerSession(row),
    aov: calcAov(row),
    revenuePerUser: calcRevenuePerUser(row),
    addToCartRate: calcAddToCartRate(row),
    checkoutRate: calcCheckoutRate(row),
    purchaseRate: calcPurchaseRate(row),
    cartAbandonmentRate: calcCartAbandonmentRate(row),
  };
}

/**
 * Enrich rows with calculated metrics
 */
export function enrichWithCalculatedMetrics(
  rows: GA4InsightRow[],
  requestedCalculated?: string[]
): GA4InsightRow[] {
  const requested = requestedCalculated ? new Set(requestedCalculated) : null;

  return rows.map((row) => {
    const all = calculateMetrics(row);
    const picked: Record<string, string | number | null> = {};

    for (const [key, value] of Object.entries(all)) {
      if (value === null) continue;
      if (requested && !requested.has(key)) continue;
      picked[key] = Math.round(value * 100) / 100;
    }

    return { ...row, ...picked };
  });
}

/**
 * Get dependencies for calculated metrics
 */
export function getCalculatedMetricDependencies(metricKeys: string[]): string[] {
  const deps = new Set<string>();

  for (const key of metricKeys) {
    const def = GA4_CALCULATED_METRIC_DEFINITIONS.find((m) => m.key === key);
    if (def?.dependencies) {
      for (const dep of def.dependencies) {
        deps.add(dep);
      }
    }
  }

  return Array.from(deps);
}

/**
 * Check if a metric key is a calculated metric
 */
export function isCalculatedMetric(key: string): boolean {
  return GA4_CALCULATED_METRIC_DEFINITIONS.some((m) => m.key === key);
}
