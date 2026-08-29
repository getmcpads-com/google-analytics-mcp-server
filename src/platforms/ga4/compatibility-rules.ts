/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GA4 COMPATIBILITY RULES
// Validation logic for metric/dimension combinations
// ============================================

// ============================================
// DIMENSION-METRIC COMPATIBILITY
// ============================================

/**
 * Ecommerce dimensions that only work with ecommerce metrics.
 * Using these dimensions without ecommerce metrics returns empty rows.
 */
export const ECOMMERCE_ONLY_DIMENSIONS = new Set([
  "itemId",
  "itemName",
  "itemBrand",
  "itemCategory",
  "itemCategory2",
  "itemCategory3",
  "itemVariant",
  "itemListName",
  "itemListId",
  "itemPromotionName",
  "itemPromotionId",
  "orderCoupon",
  "shippingTier",
  "itemAffiliation",
  "transactionId",
]);

/**
 * Ecommerce metrics that work with ecommerce dimensions.
 */
export const ECOMMERCE_METRICS = new Set([
  "addToCarts",
  "checkouts",
  "ecommercePurchases",
  "itemRevenue",
  "itemsPurchased",
  "itemsViewed",
  "itemsAddedToCart",
  "itemsCheckedOut",
  "cartToViewRate",
  "purchaseToViewRate",
  "itemViewEvents",
  "itemListClickEvents",
  "itemListViewEvents",
  "itemListClickThroughRate",
  "itemPromotionClickThroughRate",
  "totalRevenue",
  "purchaseRevenue",
  "averagePurchaseRevenue",
  "transactions",
  "refundAmount",
  "shippingAmount",
  "taxAmount",
]);

/**
 * Dimensions that cannot be combined with each other (mutually exclusive groups).
 * GA4 is generally permissive, but some combinations produce empty results.
 */
export const INCOMPATIBLE_DIMENSION_PAIRS: Array<[string, string]> = [
  // Session-scoped vs user-scoped source dimensions
  ["sessionSource", "firstUserSource"],
  ["sessionMedium", "firstUserMedium"],
  ["sessionCampaignName", "firstUserCampaignName"],
  ["sessionDefaultChannelGroup", "firstUserDefaultChannelGroup"],
];

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface GA4ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a GA4 query selection (metrics + dimensions)
 */
export function validateGA4QuerySelection(
  metricKeys: string[],
  dimensionKeys: string[]
): GA4ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check ecommerce dimensions without ecommerce metrics
  const hasEcommerceDimensions = dimensionKeys.some((d) => ECOMMERCE_ONLY_DIMENSIONS.has(d));
  const hasEcommerceMetrics = metricKeys.some((m) => ECOMMERCE_METRICS.has(m));

  if (hasEcommerceDimensions && !hasEcommerceMetrics) {
    warnings.push(
      "Ecommerce dimensions (itemName, itemBrand, etc.) require ecommerce metrics to return data. Add metrics like itemRevenue, addToCarts, or ecommercePurchases."
    );
  }

  // 2. Check incompatible dimension pairs
  for (const [dim1, dim2] of INCOMPATIBLE_DIMENSION_PAIRS) {
    if (dimensionKeys.includes(dim1) && dimensionKeys.includes(dim2)) {
      warnings.push(
        `Dimensions "${dim1}" and "${dim2}" are session-scoped vs user-scoped. Using both may produce unexpected results.`
      );
    }
  }

  // 3. Warn about high-cardinality combinations
  const highCardinalityDims = ["pagePath", "pageTitle", "pagePathPlusQueryString", "landingPagePlusQueryString"];
  const hasHighCardinality = dimensionKeys.some((d) => highCardinalityDims.includes(d));
  if (hasHighCardinality && dimensionKeys.length > 2) {
    warnings.push(
      "High-cardinality dimensions (pagePath, pageTitle) combined with other dimensions may produce very large result sets."
    );
  }

  // 4. Must have at least one metric
  if (metricKeys.length === 0) {
    errors.push("At least one metric is required.");
  }

  // 5. GA4 limit: max 9 dimensions per request
  if (dimensionKeys.length > 9) {
    errors.push(
      `GA4 supports a maximum of 9 dimensions per request. You selected ${dimensionKeys.length}.`
    );
  }

  // 6. GA4 limit: max 10 metrics per request
  if (metricKeys.length > 10) {
    errors.push(
      `GA4 supports a maximum of 10 metrics per request. You selected ${metricKeys.length}.`
    );
  }

  // 7. No time dimension selected
  const timeDimensions = ["date", "dateHour", "dayOfWeek", "month", "year", "hour", "nthDay", "isoWeek", "yearMonth"];
  if (!dimensionKeys.some((d) => timeDimensions.includes(d))) {
    warnings.push(
      "No time dimension selected. Results will be aggregated over the entire date range."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
