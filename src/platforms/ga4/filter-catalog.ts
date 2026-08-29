/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GA4 FILTER CATALOG
// Definitions for GA4 dimension and metric filters
// ============================================

import type { GA4FilterDefinition, GA4FilterExpression } from "./types.js";

// ============================================
// FILTER CATALOG
// ============================================

export const GA4_FILTER_CATALOG: GA4FilterDefinition[] = [
  // ========================================
  // TRAFFIC SOURCE FILTERS
  // ========================================
  {
    key: "sessionSource",
    name: "Session Source",
    description: "Filter by traffic source (e.g., google, facebook, direct)",
    apiField: "sessionSource",
    type: "string",
    category: "traffic_source",
  },
  {
    key: "sessionMedium",
    name: "Session Medium",
    description: "Filter by traffic medium (e.g., organic, cpc, referral)",
    apiField: "sessionMedium",
    type: "string",
    category: "traffic_source",
  },
  {
    key: "sessionCampaignName",
    name: "Session Campaign",
    description: "Filter by campaign name",
    apiField: "sessionCampaignName",
    type: "string",
    category: "traffic_source",
  },
  {
    key: "sessionDefaultChannelGroup",
    name: "Default Channel Group",
    description: "Filter by default channel group (e.g., Organic Search, Paid Social)",
    apiField: "sessionDefaultChannelGroup",
    type: "string",
    category: "traffic_source",
  },

  // ========================================
  // GEOGRAPHY FILTERS
  // ========================================
  {
    key: "country",
    name: "Country",
    description: "Filter by country name",
    apiField: "country",
    type: "string",
    category: "geography",
  },
  {
    key: "city",
    name: "City",
    description: "Filter by city name",
    apiField: "city",
    type: "string",
    category: "geography",
  },
  {
    key: "region",
    name: "Region",
    description: "Filter by region/state",
    apiField: "region",
    type: "string",
    category: "geography",
  },
  {
    key: "continent",
    name: "Continent",
    description: "Filter by continent",
    apiField: "continent",
    type: "string",
    category: "geography",
  },

  // ========================================
  // DEVICE FILTERS
  // ========================================
  {
    key: "deviceCategory",
    name: "Device Category",
    description: "Filter by device type (desktop, mobile, tablet)",
    apiField: "deviceCategory",
    type: "inList",
    category: "device",
  },
  {
    key: "operatingSystem",
    name: "Operating System",
    description: "Filter by OS (iOS, Android, Windows, Macintosh)",
    apiField: "operatingSystem",
    type: "string",
    category: "device",
  },
  {
    key: "browser",
    name: "Browser",
    description: "Filter by browser name (Chrome, Safari, Firefox)",
    apiField: "browser",
    type: "string",
    category: "device",
  },
  {
    key: "platform",
    name: "Platform",
    description: "Filter by platform (web, ios, android)",
    apiField: "platform",
    type: "string",
    category: "device",
  },

  // ========================================
  // PAGE FILTERS
  // ========================================
  {
    key: "pagePath",
    name: "Page Path",
    description: "Filter by page URL path",
    apiField: "pagePath",
    type: "string",
    category: "page",
  },
  {
    key: "pageTitle",
    name: "Page Title",
    description: "Filter by page title",
    apiField: "pageTitle",
    type: "string",
    category: "page",
  },
  {
    key: "landingPage",
    name: "Landing Page",
    description: "Filter by landing page path",
    apiField: "landingPage",
    type: "string",
    category: "page",
  },
  {
    key: "hostname",
    name: "Hostname",
    description: "Filter by hostname/domain",
    apiField: "hostname",
    type: "string",
    category: "page",
  },

  // ========================================
  // EVENT FILTERS
  // ========================================
  {
    key: "eventName",
    name: "Event Name",
    description: "Filter by event name (e.g., page_view, purchase, click)",
    apiField: "eventName",
    type: "string",
    category: "event",
  },

  // ========================================
  // ECOMMERCE FILTERS
  // ========================================
  {
    key: "itemName",
    name: "Item Name",
    description: "Filter by product/item name",
    apiField: "itemName",
    type: "string",
    category: "ecommerce",
  },
  {
    key: "itemBrand",
    name: "Item Brand",
    description: "Filter by product brand",
    apiField: "itemBrand",
    type: "string",
    category: "ecommerce",
  },
  {
    key: "itemCategory",
    name: "Item Category",
    description: "Filter by product category",
    apiField: "itemCategory",
    type: "string",
    category: "ecommerce",
  },
  {
    key: "transactionId",
    name: "Transaction ID",
    description: "Filter by transaction ID",
    apiField: "transactionId",
    type: "string",
    category: "ecommerce",
  },

  // ========================================
  // USER FILTERS
  // ========================================
  {
    key: "newVsReturning",
    name: "New vs Returning",
    description: "Filter by new or returning users",
    apiField: "newVsReturning",
    type: "inList",
    category: "user",
  },
  {
    key: "audienceName",
    name: "Audience Name",
    description: "Filter by GA4 audience name",
    apiField: "audienceName",
    type: "string",
    category: "user",
  },
];

// ============================================
// FILTER BUILDER HELPERS
// ============================================

/**
 * Build a GA4 string filter expression
 */
export function buildStringFilter(
  fieldName: string,
  matchType: string,
  value: string,
  caseSensitive: boolean = false
): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: matchType as GA4FilterExpression["filter"] extends { stringFilter?: { matchType: infer T } } ? T : never,
        value,
        caseSensitive,
      },
    },
  };
}

/**
 * Build a GA4 in-list filter expression
 */
export function buildInListFilter(
  fieldName: string,
  values: string[],
  caseSensitive: boolean = false
): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      inListFilter: {
        values,
        caseSensitive,
      },
    },
  };
}

/**
 * Build a GA4 numeric filter expression
 */
export function buildNumericFilter(
  fieldName: string,
  operation: string,
  value: number
): GA4FilterExpression {
  return {
    filter: {
      fieldName,
      numericFilter: {
        operation: operation as GA4FilterExpression["filter"] extends { numericFilter?: { operation: infer T } } ? T : never,
        value: { doubleValue: value },
      },
    },
  };
}

/**
 * Combine multiple filter expressions with AND
 */
export function buildAndFilter(expressions: GA4FilterExpression[]): GA4FilterExpression {
  if (expressions.length === 1) return expressions[0];
  return { andGroup: { expressions } };
}

/**
 * Combine multiple filter expressions with OR
 */
export function buildOrFilter(expressions: GA4FilterExpression[]): GA4FilterExpression {
  if (expressions.length === 1) return expressions[0];
  return { orGroup: { expressions } };
}

/**
 * Build a GA4 filter from simple copilot filter params
 */
export function buildFilterFromParams(
  filters: Array<{ field: string; operator: string; value: unknown }>
): GA4FilterExpression | undefined {
  if (filters.length === 0) return undefined;

  const expressions: GA4FilterExpression[] = filters.map((f) => {
    const op = f.operator.toUpperCase();

    if (op === "IN" && Array.isArray(f.value)) {
      return buildInListFilter(f.field, f.value.map(String));
    }

    if (["GREATER_THAN", "LESS_THAN", "EQUAL", "GREATER_THAN_OR_EQUAL", "LESS_THAN_OR_EQUAL"].includes(op)) {
      return buildNumericFilter(f.field, op, Number(f.value));
    }

    // Default: string filter
    const matchType = op === "CONTAINS" ? "CONTAINS"
      : op === "BEGINS_WITH" ? "BEGINS_WITH"
      : op === "ENDS_WITH" ? "ENDS_WITH"
      : op === "REGEXP" || op === "FULL_REGEXP" ? "FULL_REGEXP"
      : op === "PARTIAL_REGEXP" ? "PARTIAL_REGEXP"
      : "EXACT";

    return buildStringFilter(f.field, matchType, String(f.value));
  });

  return buildAndFilter(expressions);
}
