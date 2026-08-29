/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GOOGLE ANALYTICS 4 DIMENSION CATALOG
// Complete catalog of GA4 dimensions
// Organized by category for the Data API
// ============================================

import type { GA4DimensionDefinition } from "./types.js";

// ============================================
// TIME DIMENSIONS
// ============================================

const TIME_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "date",
    name: "Date",
    description: "The date of the event (YYYYMMDD format)",
    category: "time",
    apiField: "date",
  },
  {
    key: "dateHour",
    name: "Date + Hour",
    description: "The combined date and hour of the event (YYYYMMDDHH format)",
    category: "time",
    apiField: "dateHour",
  },
  {
    key: "dayOfWeek",
    name: "Day of Week",
    description: "The day of the week as a number (0 = Sunday through 6 = Saturday)",
    category: "time",
    apiField: "dayOfWeek",
  },
  {
    key: "dayOfWeekName",
    name: "Day Name",
    description: "The name of the day of the week (e.g., Sunday, Monday)",
    category: "time",
    apiField: "dayOfWeekName",
  },
  {
    key: "month",
    name: "Month",
    description: "The month of the event (two-digit number, 01-12)",
    category: "time",
    apiField: "month",
  },
  {
    key: "year",
    name: "Year",
    description: "The four-digit year of the event (e.g., 2026)",
    category: "time",
    apiField: "year",
  },
  {
    key: "nthDay",
    name: "Nth Day",
    description: "The number of days since the start of the date range",
    category: "time",
    apiField: "nthDay",
  },
  {
    key: "hour",
    name: "Hour",
    description: "The hour of the event (two-digit number, 00-23)",
    category: "time",
    apiField: "hour",
  },
  {
    key: "isoWeek",
    name: "ISO Week",
    description: "The ISO week number of the year (01-53)",
    category: "time",
    apiField: "isoWeek",
  },
  {
    key: "isoYearIsoWeek",
    name: "Year + ISO Week",
    description: "The combined ISO year and ISO week number (e.g., 202610)",
    category: "time",
    apiField: "isoYearIsoWeek",
  },
  {
    key: "yearMonth",
    name: "Year + Month",
    description: "The combined year and month of the event (YYYYMM format)",
    category: "time",
    apiField: "yearMonth",
  },
];

// ============================================
// TRAFFIC SOURCE DIMENSIONS
// ============================================

const TRAFFIC_SOURCE_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "sessionSource",
    name: "Session Source",
    description: "The source that initiated the session (e.g., google, facebook, direct)",
    category: "traffic_source",
    apiField: "sessionSource",
  },
  {
    key: "sessionMedium",
    name: "Session Medium",
    description: "The medium of the session (e.g., organic, cpc, referral, email)",
    category: "traffic_source",
    apiField: "sessionMedium",
  },
  {
    key: "sessionCampaignName",
    name: "Session Campaign",
    description: "The campaign name associated with the session",
    category: "traffic_source",
    apiField: "sessionCampaignName",
  },
  {
    key: "sessionDefaultChannelGroup",
    name: "Session Default Channel Group",
    description: "The default channel grouping for the session (e.g., Organic Search, Paid Search, Direct)",
    category: "traffic_source",
    apiField: "sessionDefaultChannelGroup",
  },
  {
    key: "sessionPrimaryChannelGroup",
    name: "Session Primary Channel Group (Custom)",
    description: "The custom/primary channel group for the session. Uses custom channel group rules configured in GA4 Admin. Use this dimension (not sessionDefaultChannelGroup) when the user asks for custom or personalized channel groups.",
    category: "traffic_source",
    apiField: "sessionPrimaryChannelGroup",
  },
  {
    key: "sessionSourceMedium",
    name: "Session Source / Medium",
    description: "The combined source and medium of the session (e.g., google / organic)",
    category: "traffic_source",
    apiField: "sessionSourceMedium",
  },
  {
    key: "firstUserSource",
    name: "First User Source",
    description: "The source that first acquired the user",
    category: "traffic_source",
    apiField: "firstUserSource",
  },
  {
    key: "firstUserMedium",
    name: "First User Medium",
    description: "The medium that first acquired the user",
    category: "traffic_source",
    apiField: "firstUserMedium",
  },
  {
    key: "firstUserCampaignName",
    name: "First User Campaign",
    description: "The campaign that first acquired the user",
    category: "traffic_source",
    apiField: "firstUserCampaignName",
  },
  {
    key: "firstUserDefaultChannelGroup",
    name: "First User Default Channel Group",
    description: "The default channel grouping that first acquired the user",
    category: "traffic_source",
    apiField: "firstUserDefaultChannelGroup",
  },
  {
    key: "firstUserPrimaryChannelGroup",
    name: "First User Primary Channel Group (Custom)",
    description: "The custom/primary channel group that first acquired the user. Uses custom channel group rules configured in GA4 Admin.",
    category: "traffic_source",
    apiField: "firstUserPrimaryChannelGroup",
  },
  {
    key: "firstUserSourceMedium",
    name: "First User Source / Medium",
    description: "The combined source and medium that first acquired the user",
    category: "traffic_source",
    apiField: "firstUserSourceMedium",
  },
];

// ============================================
// GEOGRAPHY DIMENSIONS
// ============================================

const GEOGRAPHY_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "country",
    name: "Country",
    description: "The country from which the user activity originated",
    category: "geography",
    apiField: "country",
  },
  {
    key: "city",
    name: "City",
    description: "The city from which the user activity originated",
    category: "geography",
    apiField: "city",
  },
  {
    key: "region",
    name: "Region",
    description: "The geographic region (state/province) from which the user activity originated",
    category: "geography",
    apiField: "region",
  },
  {
    key: "continent",
    name: "Continent",
    description: "The continent from which the user activity originated",
    category: "geography",
    apiField: "continent",
  },
  {
    key: "countryId",
    name: "Country ID",
    description: "The ISO 3166 country code (e.g., US, GB, FR)",
    category: "geography",
    apiField: "countryId",
  },
  {
    key: "subContinent",
    name: "Sub Continent",
    description: "The sub-continent from which the user activity originated (e.g., Northern America, Western Europe)",
    category: "geography",
    apiField: "subContinent",
  },
];

// ============================================
// DEVICE DIMENSIONS
// ============================================

const DEVICE_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "deviceCategory",
    name: "Device Category",
    description: "The type of device (desktop, mobile, or tablet)",
    category: "device",
    apiField: "deviceCategory",
  },
  {
    key: "operatingSystem",
    name: "Operating System",
    description: "The operating system used by the visitor (e.g., Android, iOS, Windows, Macintosh)",
    category: "device",
    apiField: "operatingSystem",
  },
  {
    key: "browser",
    name: "Browser",
    description: "The browser used by the visitor (e.g., Chrome, Safari, Firefox, Edge)",
    category: "device",
    apiField: "browser",
  },
  {
    key: "screenResolution",
    name: "Screen Resolution",
    description: "The screen resolution of the user's device (e.g., 1920x1080)",
    category: "device",
    apiField: "screenResolution",
  },
  {
    key: "mobileDeviceModel",
    name: "Mobile Device Model",
    description: "The model name of the mobile device (e.g., iPhone 15, Pixel 8)",
    category: "device",
    apiField: "mobileDeviceModel",
  },
  {
    key: "mobileDeviceBranding",
    name: "Mobile Device Brand",
    description: "The brand or manufacturer of the mobile device (e.g., Apple, Samsung, Google)",
    category: "device",
    apiField: "mobileDeviceBranding",
  },
  {
    key: "platform",
    name: "Platform",
    description: "The platform on which the app or website was accessed (web, iOS, Android)",
    category: "device",
    apiField: "platform",
  },
  {
    key: "language",
    name: "Language",
    description: "The language setting of the user's browser or device (e.g., en-us, fr, de)",
    category: "device",
    apiField: "language",
  },
];

// ============================================
// PAGE DIMENSIONS
// ============================================

const PAGE_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "pagePath",
    name: "Page Path",
    description: "The URL path of the page (without query string or hostname)",
    category: "page",
    apiField: "pagePath",
  },
  {
    key: "pageTitle",
    name: "Page Title",
    description: "The title of the page as set in the HTML <title> tag",
    category: "page",
    apiField: "pageTitle",
  },
  {
    key: "landingPage",
    name: "Landing Page",
    description: "The page path of the first page viewed in a session",
    category: "page",
    apiField: "landingPage",
  },
  {
    key: "hostname",
    name: "Hostname",
    description: "The hostname of the URL (e.g., www.example.com)",
    category: "page",
    apiField: "hostname",
  },
  {
    key: "pageReferrer",
    name: "Page Referrer",
    description: "The full referring URL including hostname and path",
    category: "page",
    apiField: "pageReferrer",
  },
  {
    key: "landingPagePlusQueryString",
    name: "Landing Page + Query",
    description: "The landing page path including the query string parameters",
    category: "page",
    apiField: "landingPagePlusQueryString",
  },
  {
    key: "pagePathPlusQueryString",
    name: "Page Path + Query",
    description: "The page path including the query string parameters",
    category: "page",
    apiField: "pagePathPlusQueryString",
  },
];

// ============================================
// EVENT DIMENSIONS
// ============================================

const EVENT_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "eventName",
    name: "Event Name",
    description: "The name of the event (e.g., page_view, purchase, click, scroll)",
    category: "event",
    apiField: "eventName",
  },
  {
    key: "isConversionEvent",
    name: "Is Conversion Event",
    description: "Whether the event is marked as a conversion (true or false)",
    category: "event",
    apiField: "isConversionEvent",
  },
];

// ============================================
// ECOMMERCE DIMENSIONS
// ============================================

const ECOMMERCE_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "itemId",
    name: "Item ID",
    description: "The ID of the ecommerce item",
    category: "ecommerce",
    apiField: "itemId",
  },
  {
    key: "itemName",
    name: "Item Name",
    description: "The name of the ecommerce item",
    category: "ecommerce",
    apiField: "itemName",
  },
  {
    key: "itemBrand",
    name: "Item Brand",
    description: "The brand of the ecommerce item",
    category: "ecommerce",
    apiField: "itemBrand",
  },
  {
    key: "itemCategory",
    name: "Item Category",
    description: "The primary category of the ecommerce item",
    category: "ecommerce",
    apiField: "itemCategory",
  },
  {
    key: "itemCategory2",
    name: "Item Category 2",
    description: "The second-level category of the ecommerce item",
    category: "ecommerce",
    apiField: "itemCategory2",
  },
  {
    key: "itemCategory3",
    name: "Item Category 3",
    description: "The third-level category of the ecommerce item",
    category: "ecommerce",
    apiField: "itemCategory3",
  },
  {
    key: "itemVariant",
    name: "Item Variant",
    description: "The variant of the ecommerce item (e.g., size, color)",
    category: "ecommerce",
    apiField: "itemVariant",
  },
  {
    key: "itemListName",
    name: "Item List Name",
    description: "The name of the list in which the item was presented to the user",
    category: "ecommerce",
    apiField: "itemListName",
  },
  {
    key: "itemPromotionName",
    name: "Item Promotion Name",
    description: "The name of the promotion applied to the ecommerce item",
    category: "ecommerce",
    apiField: "itemPromotionName",
  },
  {
    key: "transactionId",
    name: "Transaction ID",
    description: "The unique identifier of the ecommerce transaction",
    category: "ecommerce",
    apiField: "transactionId",
  },
  {
    key: "orderCoupon",
    name: "Order Coupon",
    description: "The coupon code applied to the order",
    category: "ecommerce",
    apiField: "orderCoupon",
  },
  {
    key: "shippingTier",
    name: "Shipping Tier",
    description: "The shipping tier selected for the order (e.g., Ground, Express, Next Day)",
    category: "ecommerce",
    apiField: "shippingTier",
  },
];

// ============================================
// USER DIMENSIONS
// ============================================

const USER_DIMENSIONS: GA4DimensionDefinition[] = [
  {
    key: "newVsReturning",
    name: "New vs Returning",
    description: "Whether the user is new or returning to the property",
    category: "user",
    apiField: "newVsReturning",
  },
  {
    key: "userAgeBracket",
    name: "User Age Bracket",
    description: "The age bracket of the user (e.g., 18-24, 25-34, 35-44)",
    category: "user",
    apiField: "userAgeBracket",
  },
  {
    key: "userGender",
    name: "User Gender",
    description: "The gender of the user (male, female)",
    category: "user",
    apiField: "userGender",
  },
  {
    key: "audienceName",
    name: "Audience Name",
    description: "The name of the audience the user belongs to",
    category: "user",
    apiField: "audienceName",
  },
];

// ============================================
// COMBINE ALL DIMENSIONS
// ============================================

export const GA4_DIMENSION_CATALOG: GA4DimensionDefinition[] = [
  ...TIME_DIMENSIONS,
  ...TRAFFIC_SOURCE_DIMENSIONS,
  ...GEOGRAPHY_DIMENSIONS,
  ...DEVICE_DIMENSIONS,
  ...PAGE_DIMENSIONS,
  ...EVENT_DIMENSIONS,
  ...ECOMMERCE_DIMENSIONS,
  ...USER_DIMENSIONS,
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a dimension definition by its key or apiField
 */
export function getDimensionByKey(key: string): GA4DimensionDefinition | undefined {
  return GA4_DIMENSION_CATALOG.find((d) => d.key === key || d.apiField === key);
}
