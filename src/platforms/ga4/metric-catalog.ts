/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GOOGLE ANALYTICS 4 DATA API METRIC CATALOG
// Complete catalog of ~60 GA4 metrics
// Based on GA4 Data API v1beta metric fields
// ============================================

import type { GA4MetricDefinition } from "./types.js";

// ============================================
// TRAFFIC METRICS
// ============================================

const TRAFFIC_METRICS: GA4MetricDefinition[] = [
  {
    key: "sessions",
    name: "Sessions",
    description:
      "The number of sessions that began on your site or app.",
    category: "traffic",
    format: "number",
    apiField: "sessions",
    type: "api",
  },
  {
    key: "activeUsers",
    name: "Active Users",
    description:
      "The number of distinct users who visited your site or app.",
    category: "traffic",
    format: "number",
    apiField: "activeUsers",
    type: "api",
  },
  {
    key: "newUsers",
    name: "New Users",
    description:
      "The number of users who interacted with your site or app for the first time.",
    category: "traffic",
    format: "number",
    apiField: "newUsers",
    type: "api",
  },
  {
    key: "totalUsers",
    name: "Total Users",
    description:
      "The total number of unique users who logged an event.",
    category: "traffic",
    format: "number",
    apiField: "totalUsers",
    type: "api",
  },
  {
    key: "screenPageViews",
    name: "Page Views",
    description:
      "The number of app screens or web pages your users viewed. Includes repeated views of a single page or screen.",
    category: "traffic",
    format: "number",
    apiField: "screenPageViews",
    type: "api",
  },
  {
    key: "bounceRate",
    name: "Bounce Rate",
    description:
      "The percentage of sessions that were not engaged (lasted less than 10 seconds, had no conversion events, and had fewer than 2 page/screen views).",
    category: "traffic",
    format: "percent",
    apiField: "bounceRate",
    type: "api",
  },
  {
    key: "sessionsPerUser",
    name: "Sessions per User",
    description:
      "The average number of sessions per user.",
    category: "traffic",
    format: "ratio",
    apiField: "sessionsPerUser",
    type: "api",
  },
  {
    key: "engagedSessions",
    name: "Engaged Sessions",
    description:
      "The number of sessions that lasted 10 seconds or longer, had a conversion event, or had 2 or more page/screen views.",
    category: "traffic",
    format: "number",
    apiField: "engagedSessions",
    type: "api",
  },
  {
    key: "crashAffectedUsers",
    name: "Crash Affected Users",
    description:
      "The number of users who experienced a crash in your app.",
    category: "traffic",
    format: "number",
    apiField: "crashAffectedUsers",
    type: "api",
  },
];

// ============================================
// ENGAGEMENT METRICS
// ============================================

const ENGAGEMENT_METRICS: GA4MetricDefinition[] = [
  {
    key: "averageSessionDuration",
    name: "Avg. Session Duration",
    description:
      "The average duration (in seconds) of users' sessions.",
    category: "engagement",
    format: "duration",
    apiField: "averageSessionDuration",
    type: "api",
  },
  {
    key: "engagementRate",
    name: "Engagement Rate",
    description:
      "The percentage of engaged sessions (sessions that lasted 10 seconds or longer, had a conversion event, or had 2 or more page/screen views).",
    category: "engagement",
    format: "percent",
    apiField: "engagementRate",
    type: "api",
  },
  {
    key: "screenPageViewsPerSession",
    name: "Pages per Session",
    description:
      "The average number of pages viewed per session.",
    category: "engagement",
    format: "ratio",
    apiField: "screenPageViewsPerSession",
    type: "api",
  },
  {
    key: "eventCount",
    name: "Event Count",
    description:
      "The total number of events triggered by users.",
    category: "engagement",
    format: "number",
    apiField: "eventCount",
    type: "api",
  },
  {
    key: "eventsPerSession",
    name: "Events per Session",
    description:
      "The average number of events triggered per session.",
    category: "engagement",
    format: "ratio",
    apiField: "eventsPerSession",
    type: "api",
  },
  {
    key: "userEngagementDuration",
    name: "User Engagement Duration",
    description:
      "The total amount of time (in seconds) your app was in the foreground or your website had focus in the browser.",
    category: "engagement",
    format: "duration",
    apiField: "userEngagementDuration",
    type: "api",
  },
  {
    key: "scrolledUsers",
    name: "Scrolled Users",
    description:
      "The number of unique users who scrolled down at least 90% of the page.",
    category: "engagement",
    format: "number",
    apiField: "scrolledUsers",
    type: "api",
  },
];

// ============================================
// REVENUE METRICS
// ============================================

const REVENUE_METRICS: GA4MetricDefinition[] = [
  {
    key: "totalRevenue",
    name: "Total Revenue",
    description:
      "The sum of revenue from purchases, subscriptions, and advertising (purchase revenue plus subscription revenue plus ad revenue).",
    category: "revenue",
    format: "currency",
    apiField: "totalRevenue",
    type: "api",
  },
  {
    key: "purchaseRevenue",
    name: "Purchase Revenue",
    description:
      "The sum of revenue from purchases made on your site or app.",
    category: "revenue",
    format: "currency",
    apiField: "purchaseRevenue",
    type: "api",
  },
  {
    key: "ecommercePurchases",
    name: "Purchases",
    description:
      "The number of times users completed a purchase.",
    category: "revenue",
    format: "number",
    apiField: "ecommercePurchases",
    type: "api",
  },
  {
    key: "transactions",
    name: "Transactions",
    description:
      "The count of transaction events with purchase revenue.",
    category: "revenue",
    format: "number",
    apiField: "transactions",
    type: "api",
  },
  {
    key: "averagePurchaseRevenue",
    name: "Avg. Purchase Revenue",
    description:
      "The average revenue per purchase (total purchase revenue divided by the number of purchases).",
    category: "revenue",
    format: "currency",
    apiField: "averagePurchaseRevenue",
    type: "api",
  },
  {
    key: "averageRevenuePerUser",
    name: "ARPU",
    description:
      "Average revenue per user (total revenue divided by total users).",
    category: "revenue",
    format: "currency",
    apiField: "averageRevenuePerUser",
    type: "api",
  },
  {
    key: "itemRevenue",
    name: "Item Revenue",
    description:
      "The total revenue from items only (product sales revenue).",
    category: "revenue",
    format: "currency",
    apiField: "itemRevenue",
    type: "api",
  },
  {
    key: "itemsPurchased",
    name: "Items Purchased",
    description:
      "The number of units purchased across all items.",
    category: "revenue",
    format: "number",
    apiField: "itemsPurchased",
    type: "api",
  },
  {
    key: "refundAmount",
    name: "Refund Amount",
    description:
      "The total amount of refunds issued.",
    category: "revenue",
    format: "currency",
    apiField: "refundAmount",
    type: "api",
  },
  {
    key: "shippingAmount",
    name: "Shipping Amount",
    description:
      "The total shipping amount associated with transactions.",
    category: "revenue",
    format: "currency",
    apiField: "shippingAmount",
    type: "api",
  },
  {
    key: "taxAmount",
    name: "Tax Amount",
    description:
      "The total tax amount associated with transactions.",
    category: "revenue",
    format: "currency",
    apiField: "taxAmount",
    type: "api",
  },
];

// ============================================
// ECOMMERCE METRICS
// ============================================

const ECOMMERCE_METRICS: GA4MetricDefinition[] = [
  {
    key: "addToCarts",
    name: "Add to Carts",
    description:
      "The number of times users added items to their shopping carts.",
    category: "ecommerce",
    format: "number",
    apiField: "addToCarts",
    type: "api",
  },
  {
    key: "checkouts",
    name: "Checkouts",
    description:
      "The number of times users started the checkout process.",
    category: "ecommerce",
    format: "number",
    apiField: "checkouts",
    type: "api",
  },
  {
    key: "itemsViewed",
    name: "Items Viewed",
    description:
      "The number of items viewed by users.",
    category: "ecommerce",
    format: "number",
    apiField: "itemsViewed",
    type: "api",
  },
  {
    key: "itemsAddedToCart",
    name: "Items Added to Cart",
    description:
      "The number of units added to cart across all items.",
    category: "ecommerce",
    format: "number",
    apiField: "itemsAddedToCart",
    type: "api",
  },
  {
    key: "itemsCheckedOut",
    name: "Items Checked Out",
    description:
      "The number of units included in checkout across all items.",
    category: "ecommerce",
    format: "number",
    apiField: "itemsCheckedOut",
    type: "api",
  },
  {
    key: "cartToViewRate",
    name: "Cart-to-View Rate",
    description:
      "The percentage of users who added items to their cart after viewing them.",
    category: "ecommerce",
    format: "percent",
    apiField: "cartToViewRate",
    type: "api",
  },
  {
    key: "purchaseToViewRate",
    name: "Purchase-to-View Rate",
    description:
      "The percentage of users who purchased items after viewing them.",
    category: "ecommerce",
    format: "percent",
    apiField: "purchaseToViewRate",
    type: "api",
  },
  {
    key: "itemViewEvents",
    name: "Item View Events",
    description:
      "The number of times item details were viewed (view_item events).",
    category: "ecommerce",
    format: "number",
    apiField: "itemViewEvents",
    type: "api",
  },
  {
    key: "itemListClickEvents",
    name: "Item List Click Events",
    description:
      "The number of times users clicked an item in an item list (select_item events).",
    category: "ecommerce",
    format: "number",
    apiField: "itemListClickEvents",
    type: "api",
  },
  {
    key: "itemListViewEvents",
    name: "Item List View Events",
    description:
      "The number of times an item list was viewed (view_item_list events).",
    category: "ecommerce",
    format: "number",
    apiField: "itemListViewEvents",
    type: "api",
  },
  {
    key: "itemListClickThroughRate",
    name: "Item List CTR",
    description:
      "The percentage of users who clicked through after viewing an item list.",
    category: "ecommerce",
    format: "percent",
    apiField: "itemListClickThroughRate",
    type: "api",
  },
  {
    key: "itemPromotionClickThroughRate",
    name: "Promotion CTR",
    description:
      "The percentage of users who clicked through after viewing an item promotion.",
    category: "ecommerce",
    format: "percent",
    apiField: "itemPromotionClickThroughRate",
    type: "api",
  },
];

// ============================================
// CONVERSION METRICS
// ============================================

const CONVERSION_METRICS: GA4MetricDefinition[] = [
  {
    key: "conversions",
    name: "Conversions",
    description:
      "The total count of conversion events.",
    category: "conversions",
    format: "number",
    apiField: "conversions",
    type: "api",
  },
  {
    key: "keyEvents",
    name: "Key Events",
    description:
      "The count of key events (formerly conversions) triggered by users.",
    category: "conversions",
    format: "number",
    apiField: "keyEvents",
    type: "api",
  },
  {
    key: "firstTimePurchasers",
    name: "First-time Purchasers",
    description:
      "The number of users who completed their first purchase.",
    category: "conversions",
    format: "number",
    apiField: "firstTimePurchasers",
    type: "api",
  },
  {
    key: "firstTimePurchaserRate",
    name: "First-time Purchaser Rate",
    description:
      "The percentage of active users who made their first purchase.",
    category: "conversions",
    format: "percent",
    apiField: "firstTimePurchaserConversionRate",
    type: "api",
  },
];

// ============================================
// ADS METRICS
// ============================================

const ADS_METRICS: GA4MetricDefinition[] = [
  {
    key: "publisherAdClicks",
    name: "Publisher Ad Clicks",
    description:
      "The number of times users clicked on an ad served by a publisher on your site or app.",
    category: "ads",
    format: "number",
    apiField: "publisherAdClicks",
    type: "api",
  },
  {
    key: "publisherAdImpressions",
    name: "Publisher Ad Impressions",
    description:
      "The number of ad impressions served by a publisher on your site or app.",
    category: "ads",
    format: "number",
    apiField: "publisherAdImpressions",
    type: "api",
  },
  {
    key: "totalAdRevenue",
    name: "Total Ad Revenue",
    description:
      "The total revenue earned from ads served on your site or app.",
    category: "ads",
    format: "currency",
    apiField: "totalAdRevenue",
    type: "api",
  },
  {
    key: "returnOnAdSpend",
    name: "Return on Ad Spend",
    description:
      "The return on ad spend (total revenue divided by advertiser ad cost).",
    category: "ads",
    format: "ratio",
    apiField: "returnOnAdSpend",
    type: "api",
  },
];

// ============================================
// USER METRICS
// ============================================

const USER_METRICS: GA4MetricDefinition[] = [
  {
    key: "dauPerMau",
    name: "DAU/MAU",
    description:
      "The rolling ratio of daily active users to monthly active users. A measure of user stickiness.",
    category: "user",
    format: "ratio",
    apiField: "dauPerMau",
    type: "api",
  },
  {
    key: "dauPerWau",
    name: "DAU/WAU",
    description:
      "The rolling ratio of daily active users to weekly active users.",
    category: "user",
    format: "ratio",
    apiField: "dauPerWau",
    type: "api",
  },
  {
    key: "wauPerMau",
    name: "WAU/MAU",
    description:
      "The rolling ratio of weekly active users to monthly active users.",
    category: "user",
    format: "ratio",
    apiField: "wauPerMau",
    type: "api",
  },
  {
    key: "crashFreeUsersRate",
    name: "Crash-free Users Rate",
    description:
      "The percentage of users who did not experience a crash during the selected time period.",
    category: "user",
    format: "percent",
    apiField: "crashFreeUsersRate",
    type: "api",
  },
];

// ============================================
// COMBINE ALL METRICS
// ============================================

export const GA4_METRIC_CATALOG: GA4MetricDefinition[] = [
  ...TRAFFIC_METRICS,
  ...ENGAGEMENT_METRICS,
  ...REVENUE_METRICS,
  ...ECOMMERCE_METRICS,
  ...CONVERSION_METRICS,
  ...ADS_METRICS,
  ...USER_METRICS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find a metric definition by its key or apiField name.
 */
export function getMetricByKey(
  key: string,
): GA4MetricDefinition | undefined {
  return GA4_METRIC_CATALOG.find((m) => m.key === key || m.apiField === key);
}
