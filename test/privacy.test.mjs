import assert from "node:assert/strict";
import { test } from "node:test";
import {
  redactGA4AudienceExportResponse,
  redactGA4PersonalIdentifiers,
} from "../src/platforms/ga4/privacy.ts";

test("GA4 access-binding identifiers are redacted without removing roles", () => {
  const output = redactGA4PersonalIdentifiers([{
    name: "properties/123/accessBindings/1",
    user: "person@example.com",
    roles: ["predefinedRoles/viewer"],
  }]);
  assert.deepEqual(output, [{
    name: "properties/123/accessBindings/1",
    user: "[REDACTED]",
    roles: ["predefinedRoles/viewer"],
  }]);
});

test("GA4 Audience Export redacts only identifier columns when metadata is available", () => {
  const output = redactGA4AudienceExportResponse({
    audienceExport: {
      dimensions: [{ dimensionName: "deviceId" }, { dimensionName: "country" }],
    },
    audienceRows: [{ dimensionValues: [{ value: "device-123" }, { value: "FR" }] }],
  });
  assert.equal(output.audienceRows[0].dimensionValues[0].value, "[REDACTED]");
  assert.equal(output.audienceRows[0].dimensionValues[1].value, "FR");
});

test("GA4 Audience Export redacts every row value if dimension metadata is missing", () => {
  const output = redactGA4AudienceExportResponse({
    audienceRows: [{ dimensionValues: [{ value: "unknown-user-value" }] }],
  });
  assert.equal(output.audienceRows[0].dimensionValues[0].value, "[REDACTED]");
});
