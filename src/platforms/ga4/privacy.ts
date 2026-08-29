/**
 * google-analytics-mcp-server: an open-source MCP server for Google Analytics 4.
 * Copyright 2026 GetMCPAds. https://www.getmcpads.com
 * SPDX-License-Identifier: Apache-2.0
 */
const REDACTED = "[REDACTED]";

const PERSONAL_IDENTIFIER_KEYS = new Set([
  "user",
  "userid",
  "user_id",
  "email",
  "emailaddress",
  "email_address",
  "username",
  "deviceid",
  "device_id",
  "mobiledeviceid",
  "mobile_device_id",
  "googlesignalspseudonymousid",
  "google_signals_pseudonymous_id",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedKey(value: string): string {
  return value.replace(/[-\s]/g, "").toLowerCase();
}

function isSensitiveAudienceDimension(name: string): boolean {
  const normalized = normalizedKey(name);
  return PERSONAL_IDENTIFIER_KEYS.has(normalized)
    || /(?:user|device|pseudonymous|email|username).*id$/.test(normalized)
    || /^(?:user|device).*identifier$/.test(normalized);
}

/** Redact direct user/device identity fields while retaining roles and resource metadata. */
export function redactGA4PersonalIdentifiers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactGA4PersonalIdentifiers);
  if (!isRecord(value)) return value;

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    PERSONAL_IDENTIFIER_KEYS.has(normalizedKey(key))
      ? REDACTED
      : redactGA4PersonalIdentifiers(nested),
  ]));
}

/**
 * Audience Export rows are positional. Use the returned dimension metadata to
 * redact user/device identifier columns. If metadata is absent, redact every
 * row value so the default remains privacy-safe instead of guessing.
 */
export function redactGA4AudienceExportResponse(response: Record<string, unknown>): Record<string, unknown> {
  const redacted = redactGA4PersonalIdentifiers(response) as Record<string, unknown>;
  const audienceExport = isRecord(response.audienceExport) ? response.audienceExport : undefined;
  const dimensions = Array.isArray(audienceExport?.dimensions) ? audienceExport.dimensions : [];
  const names = dimensions.map((dimension) =>
    isRecord(dimension) && typeof dimension.dimensionName === "string"
      ? dimension.dimensionName
      : ""
  );
  const sensitiveIndexes = new Set<number>();
  if (names.length === 0) {
    sensitiveIndexes.add(-1);
  } else {
    names.forEach((name, index) => {
      if (!name || isSensitiveAudienceDimension(name)) sensitiveIndexes.add(index);
    });
  }

  if (!Array.isArray(redacted.audienceRows)) return redacted;
  return {
    ...redacted,
    audienceRows: redacted.audienceRows.map((row) => {
      if (!isRecord(row) || !Array.isArray(row.dimensionValues)) return row;
      return {
        ...row,
        dimensionValues: row.dimensionValues.map((dimensionValue, index) => {
          if (!sensitiveIndexes.has(-1) && !sensitiveIndexes.has(index)) return dimensionValue;
          return isRecord(dimensionValue)
            ? { ...dimensionValue, value: REDACTED }
            : REDACTED;
        }),
      };
    }),
  };
}

export const GA4_REDACTION_MARKER = REDACTED;
