# Security Policy

This server reads analytics data, which can include behavioural detail about
identifiable people. We take reports seriously.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository:
[Report a vulnerability](https://github.com/getmcpads-com/google-analytics-mcp-server/security/advisories/new).

We aim to acknowledge a report within 3 business days and to ship a fix or a
documented mitigation within 30 days. We will credit you in the advisory unless
you ask us not to.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## This server cannot write

There are no write tools, and no flag that adds any. Every tool calls a read
method of the Data API or the Admin API. It cannot change a property, edit a
data stream, delete an audience, or modify anything in your Google Analytics
account. This is a property of the code, not a setting.

## What this server does with your credentials

- The OAuth client secret and refresh token are read once from the environment
  at startup and kept in memory. Neither is ever written to disk or logged, at
  any log level.
- The access token is refreshed from the refresh token and cached in memory
  until shortly before it expires.
- **Three hosts are contacted, and only three**: `analyticsdata.googleapis.com`,
  `analyticsadmin.googleapis.com` and `oauth2.googleapis.com`. *A test fails the
  build if a fourth host appears in the source.*
- **No fetch follows a redirect.** Every outbound call sets `redirect: "error"`,
  so a redirect cannot forward a bearer token or client secret to another host.
  *A test fails the build if any fetch omits this.*
- No telemetry, no analytics, no phone-home.

## Personal data, and what is redacted

Analytics data is not anonymous by default. A GA4 property can carry a
`userId` you set yourself, a `deviceId`, or a Google Signals pseudonymous ID.

**Redaction is the default wherever this server can return an identifier**, and
disabling it is an explicit opt-in:

- `ga4_list_admin_resources` redacts user and email identifiers from access
  bindings.
- `ga4_query_audience_export` and `ga4_get_audience_export_diagnostics` redact
  identifier columns from export rows.

Each accepts `includePersonalIdentifiers: true` to return raw values, and
defaults to `false`.

Audience export rows are positional, so the redaction matches columns against
the export's own dimension metadata. **When that metadata is missing, every
value in the row is redacted** rather than guessing which column is safe. It
fails closed, on purpose, and tests cover both paths.

**Report rows are not redacted.** `ga4_run_report` and the other reporting
tools return what was asked for. Silently altering the numbers a report returns
would be worse than returning them.

The practical consequence: **decide what you send to a model.** If your
property carries a `userId` you consider personal, do not request it as a
report dimension in a conversation whose transcript leaves your machine.

## Handling your credentials safely

- The refresh token does not expire and can mint access tokens indefinitely.
  Treat it like a password.
- Use an OAuth client dedicated to this server, so you can revoke it alone.
- `analytics.readonly` is the only scope needed. Do not grant more.
- Your MCP client config file is usually plain text on disk. Check its
  permissions, and never commit it.
- Revoke from [Google account permissions](https://myaccount.google.com/permissions)
  if you suspect exposure.

## Scope

Vulnerabilities in the Google Analytics APIs themselves are not in scope here;
report those to Google.
