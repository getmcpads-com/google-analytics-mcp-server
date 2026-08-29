/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
// ============================================
// GOOGLE ANALYTICS 4 DATA API CLIENT
// Client for GA4 Data API v1beta integration
// Standalone MCP server version with auto-refresh
// ============================================

import {
  GA4Property,
  GA4AccountSummary,
  GA4ChannelGroup,
  GA4RunReportRequest,
  GA4RunRealtimeReportRequest,
  GA4RunFunnelReportRequest,
  GA4RunPivotReportRequest,
  GA4RunReportResponse,
  GA4RunFunnelReportResponse,
  GA4RunPivotReportResponse,
  GA4BatchRunReportsResponse,
  GA4BatchRunPivotReportsResponse,
  GA4InsightRow,
  GA4ApiException,
  GA4_DATA_API_BASE,
  GA4_DATA_API_ALPHA_BASE,
  GA4_ADMIN_API_BASE,
  GA4_ADMIN_API_ALPHA_BASE,
} from "./types.js";
import { logger } from "../../core/logger.js";
import { RateLimiter } from "../../core/rate-limiter.js";

export { GA4ApiException } from "./types.js";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GA4_ADMIN_COLLECTIONS = {
  accessBindings: { version: "v1alpha", collectionKey: "accessBindings" },
  adSenseLinks: { version: "v1alpha", collectionKey: "adSenseLinks" },
  audiences: { version: "v1alpha", collectionKey: "audiences" },
  bigQueryLinks: { version: "v1alpha", collectionKey: "bigQueryLinks" },
  calculatedMetrics: { version: "v1alpha", collectionKey: "calculatedMetrics" },
  channelGroups: { version: "v1alpha", collectionKey: "channelGroups" },
  customDimensions: { version: "v1beta", collectionKey: "customDimensions" },
  customMetrics: { version: "v1beta", collectionKey: "customMetrics" },
  dataStreams: { version: "v1beta", collectionKey: "dataStreams" },
  displayVideo360AdvertiserLinkProposals: { version: "v1alpha", collectionKey: "displayVideo360AdvertiserLinkProposals" },
  displayVideo360AdvertiserLinks: { version: "v1alpha", collectionKey: "displayVideo360AdvertiserLinks" },
  expandedDataSets: { version: "v1alpha", collectionKey: "expandedDataSets" },
  firebaseLinks: { version: "v1beta", collectionKey: "firebaseLinks" },
  googleAdsLinks: { version: "v1beta", collectionKey: "googleAdsLinks" },
  keyEvents: { version: "v1beta", collectionKey: "keyEvents" },
  reportingDataAnnotations: { version: "v1alpha", collectionKey: "reportingDataAnnotations" },
  rollupPropertySourceLinks: { version: "v1alpha", collectionKey: "rollupPropertySourceLinks" },
  searchAds360Links: { version: "v1alpha", collectionKey: "searchAds360Links" },
  subpropertyEventFilters: { version: "v1alpha", collectionKey: "subpropertyEventFilters" },
  subpropertySyncConfigs: { version: "v1alpha", collectionKey: "subpropertySyncConfigs" },
} as const;

export type GA4AdminCollection = keyof typeof GA4_ADMIN_COLLECTIONS;

export type GA4PropertySetting =
  | "attributionSettings"
  | "dataRetentionSettings"
  | "googleSignalsSettings"
  | "reportingIdentitySettings"
  | "userProvidedDataSettings";

// ============================================
// GA4 CLIENT CLASS
// ============================================

export class GA4Client {
  private accessToken = "";
  private tokenExpiresAt = 0;
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private rateLimiter: RateLimiter;

  constructor(config: { clientId: string; clientSecret: string; refreshToken: string }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.rateLimiter = new RateLimiter();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Refresh access token using refresh token.
   * Google refresh tokens never expire.
   */
  private async refreshAccessToken(): Promise<void> {
    logger.debug("ga4", "Refreshing access token");

    const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as Record<string, string>;
      logger.error("ga4", "Token refresh failed", { status: response.status, error });
      throw new GA4ApiException(
        error.error_description || error.error || "Failed to refresh token",
        response.status,
        error.error
      );
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    // Expire 60 seconds early to avoid edge cases
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
    logger.debug("ga4", "Access token refreshed successfully");
  }

  /**
   * Ensure we have a valid access token before making API calls.
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.refreshAccessToken();
    }
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    await this.ensureValidToken();

    // 90-second timeout to prevent hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        // Forced after the spread: once a bearer token is attached, a redirect
        // must never be followed, or the credential would be forwarded to
        // whatever host the redirect names.
        redirect: "error",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorDetails = errorBody?.error as Record<string, string> | undefined;

        logger.error("ga4", "API Error", { status: response.status, error: errorBody });

        const detailedMessage = errorDetails?.message
          || `Request failed: ${response.statusText}`;

        throw new GA4ApiException(
          detailedMessage,
          response.status,
          errorDetails?.status
        );
      }

      return response.json() as Promise<T>;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new GA4ApiException(
          "GA4 API request timed out after 90 seconds",
          408,
          "TIMEOUT"
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private cleanPropertyId(propertyId: string): string {
    return propertyId.replace("properties/", "");
  }

  private cleanResourceName(resourceName: string): string {
    return resourceName.replace(/^\/+/, "");
  }

  private async listPagedRecords<T extends Record<string, unknown>>(
    baseUrl: string,
    collectionKey: string,
    pageSize: number,
    maxPages = 50
  ): Promise<T[]> {
    const records: T[] = [];
    let pageToken: string | undefined;
    let pagesRead = 0;

    do {
      const params = new URLSearchParams({ pageSize: String(pageSize) });
      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const separator = baseUrl.includes("?") ? "&" : "?";
      const response = await this.rateLimiter.execute(() =>
        this.request<Record<string, unknown>>(`${baseUrl}${separator}${params.toString()}`)
      );

      const collection = response[collectionKey];
      if (Array.isArray(collection)) {
        records.push(...collection.filter((item): item is T => typeof item === "object" && item !== null && !Array.isArray(item)) as T[]);
      }

      pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : undefined;
      pagesRead += 1;
    } while (pageToken && pagesRead < maxPages);

    return records;
  }

  private redactSecretRecord(record: Record<string, unknown>): Record<string, unknown> {
    const safeRecord = { ...record };
    if ("secretValue" in safeRecord) {
      safeRecord.secretValue = "[REDACTED]";
      safeRecord.secretValueRedacted = true;
    }
    return safeRecord;
  }

  // ============================================
  // PROPERTY MANAGEMENT
  // ============================================

  /**
   * List all GA4 properties accessible to the authenticated user
   * Calls GET /v1beta/accountSummaries with pagination
   * Returns flattened array of GA4Property
   */
  async listProperties(): Promise<GA4Property[]> {
    const properties: GA4Property[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ pageSize: "200" });
      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const url = `${GA4_ADMIN_API_BASE}/accountSummaries?${params.toString()}`;

      const response = await this.rateLimiter.execute(() =>
        this.request<{
          accountSummaries?: GA4AccountSummary[];
          nextPageToken?: string;
        }>(url)
      );

      if (response.accountSummaries) {
        for (const account of response.accountSummaries) {
          if (account.propertySummaries) {
            for (const prop of account.propertySummaries) {
              // Extract numeric property ID from "properties/123456" format
              const propertyId = prop.property.replace("properties/", "");

              properties.push({
                propertyId,
                displayName: prop.displayName,
                timeZone: "",
                currencyCode: "",
                propertyType: prop.propertyType,
                parent: account.account,
              });
            }
          }
        }
      }

      pageToken = response.nextPageToken;
    } while (pageToken);

    // Enrich properties with currency and timezone from the property detail endpoint
    // GET /v1beta/properties/{propertyId} returns currencyCode, timeZone, etc.
    await Promise.all(
      properties.map(async (prop) => {
        try {
          const detail = await this.rateLimiter.execute(() =>
            this.request<{
              currencyCode?: string;
              timeZone?: string;
              industryCategory?: string;
            }>(`${GA4_ADMIN_API_BASE}/properties/${prop.propertyId}`)
          );
          prop.currencyCode = detail.currencyCode || "";
          prop.timeZone = detail.timeZone || "";
          if (detail.industryCategory) {
            prop.industryCategory = detail.industryCategory;
          }
        } catch {
          // Non-critical, so keep empty values
          logger.warn("ga4", `Failed to enrich property ${prop.propertyId}`);
        }
      })
    );

    return properties;
  }

  // ============================================
  // REPORTING
  // ============================================

  /**
   * Run a GA4 report with automatic pagination
   * POST /v1beta/properties/{propertyId}:runReport
   * Handles pagination via offset, capped at 250,000 rows per request
   */
  async runReport(
    propertyId: string,
    request: GA4RunReportRequest
  ): Promise<GA4RunReportResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:runReport`;

    const MAX_ROWS_PER_REQUEST = 250000;

    // First request
    const firstResponse = await this.rateLimiter.execute(() =>
      this.request<GA4RunReportResponse>(url, {
        method: "POST",
        body: JSON.stringify({
          ...request,
          limit: request.limit ?? MAX_ROWS_PER_REQUEST,
          offset: request.offset ?? 0,
        }),
      })
    );

    // If no pagination needed, return as-is
    const totalRows = firstResponse.rowCount ?? 0;
    const returnedRows = firstResponse.rows?.length ?? 0;
    const startOffset = request.offset ?? 0;

    // If the caller specified a limit, respect it and skip auto-pagination
    if (request.limit) {
      return firstResponse;
    }

    // If all rows were returned in the first request, no pagination needed
    if (startOffset + returnedRows >= totalRows) {
      return firstResponse;
    }

    // Paginate to collect all rows
    const allRows = [...(firstResponse.rows ?? [])];
    let currentOffset = startOffset + returnedRows;

    while (currentOffset < totalRows) {
      const pageResponse = await this.rateLimiter.execute(() =>
        this.request<GA4RunReportResponse>(url, {
          method: "POST",
          body: JSON.stringify({
            ...request,
            limit: MAX_ROWS_PER_REQUEST,
            offset: currentOffset,
          }),
        })
      );

      if (pageResponse.rows) {
        allRows.push(...pageResponse.rows);
      }

      const pageRowCount = pageResponse.rows?.length ?? 0;
      if (pageRowCount === 0) break; // Safety: no more rows returned

      currentOffset += pageRowCount;
    }

    // Return merged response with all rows
    return {
      ...firstResponse,
      rows: allRows,
    };
  }

  /**
   * Run a GA4 realtime report.
   * POST /v1beta/properties/{propertyId}:runRealtimeReport
   */
  async runRealtimeReport(
    propertyId: string,
    request: GA4RunRealtimeReportRequest
  ): Promise<GA4RunReportResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:runRealtimeReport`;

    return this.rateLimiter.execute(() =>
      this.request<GA4RunReportResponse>(url, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  }

  /** POST /v1beta/properties/{propertyId}:batchRunReports (maximum five reports). */
  async batchRunReports(
    propertyId: string,
    requests: GA4RunReportRequest[]
  ): Promise<GA4BatchRunReportsResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:batchRunReports`;
    return this.rateLimiter.execute(() =>
      this.request<GA4BatchRunReportsResponse>(url, {
        method: "POST",
        body: JSON.stringify({ requests }),
      })
    );
  }

  /** POST /v1beta/properties/{propertyId}:runPivotReport. */
  async runPivotReport(
    propertyId: string,
    request: GA4RunPivotReportRequest
  ): Promise<GA4RunPivotReportResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:runPivotReport`;
    return this.rateLimiter.execute(() =>
      this.request<GA4RunPivotReportResponse>(url, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  }

  /** POST /v1beta/properties/{propertyId}:batchRunPivotReports (maximum five reports). */
  async batchRunPivotReports(
    propertyId: string,
    requests: GA4RunPivotReportRequest[]
  ): Promise<GA4BatchRunPivotReportsResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:batchRunPivotReports`;
    return this.rateLimiter.execute(() =>
      this.request<GA4BatchRunPivotReportsResponse>(url, {
        method: "POST",
        body: JSON.stringify({ requests }),
      })
    );
  }

  /** POST /v1beta/properties/{propertyId}:checkCompatibility for Core reports. */
  async checkCompatibility(
    propertyId: string,
    request: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}:checkCompatibility`;
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(url, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  }

  /** GET /v1alpha/properties/{propertyId}/propertyQuotasSnapshot. */
  async getPropertyQuotasSnapshot(propertyId: string): Promise<Record<string, unknown>> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(
        `${GA4_DATA_API_ALPHA_BASE}/properties/${cleanPropertyId}/propertyQuotasSnapshot`
      )
    );
  }

  /**
   * Run a GA4 funnel report.
   * POST /v1alpha/properties/{propertyId}:runFunnelReport
   */
  async runFunnelReport(
    propertyId: string,
    request: GA4RunFunnelReportRequest
  ): Promise<GA4RunFunnelReportResponse> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_ALPHA_BASE}/properties/${cleanPropertyId}:runFunnelReport`;

    return this.rateLimiter.execute(() =>
      this.request<GA4RunFunnelReportResponse>(url, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  }

  // ============================================
  // METADATA
  // ============================================

  /**
   * Get metadata for a GA4 property (available dimensions & metrics)
   * GET /v1beta/properties/{propertyId}/metadata
   */
  async getMetadata(propertyId: string): Promise<Record<string, unknown>> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}/metadata`;

    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(url)
    );
  }

  /**
   * Get Admin API property details.
   * GET /v1beta/properties/{propertyId}
   */
  async getProperty(propertyId: string): Promise<Record<string, unknown>> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const url = `${GA4_ADMIN_API_BASE}/properties/${cleanPropertyId}`;

    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(url)
    );
  }

  /** List raw Analytics Admin accounts accessible to the caller. */
  async listAccounts(pageSize = 200): Promise<Record<string, unknown>[]> {
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_BASE}/accounts`,
      "accounts",
      pageSize
    );
  }

  /**
   * List an allowlisted Analytics Admin collection for a property.
   * Every route in the allowlist is a GET-only list method.
   */
  async listAdminPropertyResources(
    propertyId: string,
    collection: GA4AdminCollection,
    pageSize = 200
  ): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const definition = GA4_ADMIN_COLLECTIONS[collection];
    const base = definition.version === "v1beta" ? GA4_ADMIN_API_BASE : GA4_ADMIN_API_ALPHA_BASE;
    return this.listPagedRecords<Record<string, unknown>>(
      `${base}/properties/${cleanPropertyId}/${collection}`,
      definition.collectionKey,
      pageSize
    );
  }

  /** Get an allowlisted property singleton setting through a GET-only Admin API method. */
  async getPropertySetting(propertyId: string, setting: GA4PropertySetting): Promise<Record<string, unknown>> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    const endpoints: Record<GA4PropertySetting, string> = {
      attributionSettings: `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/attributionSettings`,
      dataRetentionSettings: `${GA4_ADMIN_API_BASE}/properties/${cleanPropertyId}/dataRetentionSettings`,
      googleSignalsSettings: `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/googleSignalsSettings`,
      reportingIdentitySettings: `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/reportingIdentitySettings`,
      userProvidedDataSettings: `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/userProvidedDataSettings`,
    };
    return this.rateLimiter.execute(() => this.request<Record<string, unknown>>(endpoints[setting]));
  }

  // ============================================
  // AUDIENCES & AUDIENCE EXPORTS
  // ============================================

  /**
   * List Audience Export snapshots for a property.
   * GET /v1beta/properties/{propertyId}/audienceExports
   */
  async listAudienceExports(propertyId: string, pageSize = 100): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_DATA_API_BASE}/properties/${cleanPropertyId}/audienceExports`,
      "audienceExports",
      pageSize
    );
  }

  /**
   * Get Audience Export metadata.
   * GET /v1beta/properties/{propertyId}/audienceExports/{audienceExport}
   */
  async getAudienceExport(audienceExportName: string): Promise<Record<string, unknown>> {
    const resourceName = this.cleanResourceName(audienceExportName);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(`${GA4_DATA_API_BASE}/${resourceName}`)
    );
  }

  /**
   * Query rows from an existing Audience Export. This is read-only but can contain user identifiers.
   * POST /v1beta/properties/{propertyId}/audienceExports/{audienceExport}:query
   */
  async queryAudienceExport(
    audienceExportName: string,
    request: { offset?: string; limit?: string }
  ): Promise<Record<string, unknown>> {
    const resourceName = this.cleanResourceName(audienceExportName);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(`${GA4_DATA_API_BASE}/${resourceName}:query`, {
        method: "POST",
        body: JSON.stringify(request),
      })
    );
  }

  /**
   * List configured Admin API Audiences for a property.
   * GET /v1alpha/properties/{propertyId}/audiences
   */
  async listAudiences(propertyId: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/audiences`,
      "audiences",
      pageSize
    );
  }

  /**
   * List Recurring Audience Lists for a property.
   * GET /v1alpha/properties/{propertyId}/recurringAudienceLists
   */
  async listRecurringAudienceLists(propertyId: string, pageSize = 100): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_DATA_API_ALPHA_BASE}/properties/${cleanPropertyId}/recurringAudienceLists`,
      "recurringAudienceLists",
      pageSize
    );
  }

  /**
   * Get Recurring Audience List metadata.
   * GET /v1alpha/properties/{propertyId}/recurringAudienceLists/{recurringAudienceList}
   */
  async getRecurringAudienceList(recurringAudienceListName: string): Promise<Record<string, unknown>> {
    const resourceName = this.cleanResourceName(recurringAudienceListName);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(`${GA4_DATA_API_ALPHA_BASE}/${resourceName}`)
    );
  }

  // ============================================
  // EXPORTS & TAGGING DIAGNOSTICS
  // ============================================

  /**
   * List BigQuery links configured for a property.
   * GET /v1alpha/properties/{propertyId}/bigQueryLinks
   */
  async listBigQueryLinks(propertyId: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/bigQueryLinks`,
      "bigQueryLinks",
      pageSize
    );
  }

  /**
   * List data streams configured for a property.
   * GET /v1alpha/properties/{propertyId}/dataStreams
   */
  async listDataStreams(propertyId: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/properties/${cleanPropertyId}/dataStreams`,
      "dataStreams",
      pageSize
    );
  }

  /**
   * List Measurement Protocol secrets for a stream with secret values redacted.
   * GET /v1alpha/properties/{propertyId}/dataStreams/{dataStream}/measurementProtocolSecrets
   */
  async listMeasurementProtocolSecrets(dataStreamName: string, pageSize = 10): Promise<Record<string, unknown>[]> {
    const resourceName = this.cleanResourceName(dataStreamName);
    const secrets = await this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/${resourceName}/measurementProtocolSecrets`,
      "measurementProtocolSecrets",
      pageSize
    );
    return secrets.map((secret) => this.redactSecretRecord(secret));
  }

  /**
   * Get enhanced measurement settings for a web stream.
   * GET /v1alpha/properties/{propertyId}/dataStreams/{dataStream}/enhancedMeasurementSettings
   */
  async getEnhancedMeasurementSettings(dataStreamName: string): Promise<Record<string, unknown>> {
    const resourceName = this.cleanResourceName(dataStreamName);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(`${GA4_ADMIN_API_ALPHA_BASE}/${resourceName}/enhancedMeasurementSettings`)
    );
  }

  /**
   * Get data redaction settings for a web stream.
   * GET /v1alpha/properties/{propertyId}/dataStreams/{dataStream}/dataRedactionSettings
   */
  async getDataRedactionSettings(dataStreamName: string): Promise<Record<string, unknown>> {
    const resourceName = this.cleanResourceName(dataStreamName);
    return this.rateLimiter.execute(() =>
      this.request<Record<string, unknown>>(`${GA4_ADMIN_API_ALPHA_BASE}/${resourceName}/dataRedactionSettings`)
    );
  }

  /**
   * List event create rules for a web stream.
   * GET /v1alpha/properties/{propertyId}/dataStreams/{dataStream}/eventCreateRules
   */
  async listEventCreateRules(dataStreamName: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    const resourceName = this.cleanResourceName(dataStreamName);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/${resourceName}/eventCreateRules`,
      "eventCreateRules",
      pageSize
    );
  }

  /**
   * List event edit rules for a web stream.
   * GET /v1alpha/properties/{propertyId}/dataStreams/{dataStream}/eventEditRules
   */
  async listEventEditRules(dataStreamName: string, pageSize = 200): Promise<Record<string, unknown>[]> {
    const resourceName = this.cleanResourceName(dataStreamName);
    return this.listPagedRecords<Record<string, unknown>>(
      `${GA4_ADMIN_API_ALPHA_BASE}/${resourceName}/eventEditRules`,
      "eventEditRules",
      pageSize
    );
  }

  // ============================================
  // CHANNEL GROUPS
  // ============================================

  /**
   * List custom channel groups for a GA4 property
   * GET /v1alpha/properties/{propertyId}/channelGroups
   * NOTE: channelGroups endpoint is only available in v1alpha, not v1beta
   */
  async listChannelGroups(propertyId: string): Promise<GA4ChannelGroup[]> {
    const cleanPropertyId = this.cleanPropertyId(propertyId);
    // Channel groups are only in v1alpha of the Admin API
    const url = `https://analyticsadmin.googleapis.com/v1alpha/properties/${cleanPropertyId}/channelGroups`;

    const response = await this.rateLimiter.execute(() =>
      this.request<{
        channelGroups?: GA4ChannelGroup[];
      }>(url)
    );

    return response.channelGroups ?? [];
  }

  // ============================================
  // RESPONSE FLATTENING
  // ============================================

  /**
   * Convert a GA4RunReportResponse into flat GA4InsightRow[]
   * Maps dimension and metric headers to row values
   * Parses numeric strings to numbers for metric values
   *
   * Input:
   *   dimensionHeaders: [{ name: "date" }, { name: "sessionSource" }]
   *   metricHeaders: [{ name: "sessions", type: "TYPE_INTEGER" }, { name: "totalRevenue", type: "TYPE_CURRENCY" }]
   *   rows: [{ dimensionValues: [{ value: "20260301" }, { value: "google" }], metricValues: [{ value: "150" }, { value: "1234.56" }] }]
   *
   * Output:
   *   [{ date: "20260301", sessionSource: "google", sessions: 150, totalRevenue: 1234.56 }]
   */
  flattenResponse(response: GA4RunReportResponse): GA4InsightRow[] {
    if (!response.rows || response.rows.length === 0) {
      return [];
    }

    const dimensionHeaders = response.dimensionHeaders ?? [];
    const metricHeaders = response.metricHeaders ?? [];

    return response.rows.map((row) => {
      const flat: GA4InsightRow = {};

      // Map dimension values
      if (row.dimensionValues) {
        for (let i = 0; i < dimensionHeaders.length; i++) {
          const header = dimensionHeaders[i];
          const value = row.dimensionValues[i]?.value ?? null;
          flat[header.name] = value;
        }
      }

      // Map metric values, parsing numeric strings to numbers
      if (row.metricValues) {
        for (let i = 0; i < metricHeaders.length; i++) {
          const header = metricHeaders[i];
          const rawValue = row.metricValues[i]?.value ?? null;

          if (rawValue === null) {
            flat[header.name] = null;
          } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
            flat[header.name] = parseFloat(rawValue);
          } else {
            flat[header.name] = rawValue;
          }
        }
      }

      return flat;
    });
  }
}
