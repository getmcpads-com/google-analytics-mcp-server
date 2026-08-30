# google-analytics-mcp-server

[![CI](https://github.com/getmcpads-com/google-analytics-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/getmcpads-com/google-analytics-mcp-server/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)

An open-source [Model Context Protocol](https://modelcontextprotocol.io) server for
**Google Analytics 4**. It lets Claude, ChatGPT, Cursor or any MCP client query your
analytics data and inspect how your property is configured.

**Read-only, with no way to turn that off.** You run it, and your credentials stay on your
machine.

```bash
npx -y @getmcpads/google-analytics-mcp-server
```

Also listed in the [MCP Registry](https://registry.modelcontextprotocol.io) as **`com.getmcpads/google-analytics`**, so clients that read the registry can install it by name.

> **Prefer not to run it yourself?** [getmcpads.com](https://www.getmcpads.com) is the hosted
> version of this server, with Google Analytics alongside Meta Ads, Google Ads, TikTok Ads,
> Pinterest Ads and Search Console behind a single endpoint, hosted OAuth, and cross-platform
> reporting. Same tools, same safety model, no setup.

---

## What you get

| | |
|---|---|
| **27 read tools** | Reports, pivots, funnels, realtime, plus the Admin API: properties, data streams, custom definitions, key events, audiences |
| **Diagnostics** | Ecommerce, BigQuery export, server-side tagging, audience exports, quota snapshots |
| **51 metrics, 62 dimensions** | With a compatibility matrix that catches invalid combinations before they hit the API |
| **6 resources** | Live catalogues the model can read: metrics, dimensions, compatibility rules, 12 workflow recipes |
| **Identifier redaction** | User, email and device identifiers redacted by default on access bindings and audience exports, with explicit opt-in to see them |
| **No writes at all** | Not a flag, a property of the code. See below |

### Compatibility, checked before the call

GA4 rejects many metric and dimension combinations, and its errors rarely explain which pair
is at fault. This server carries the compatibility matrix, so `ga4_check_compatibility` and
`ga4_validate_query` let the model verify a combination before spending a call and a quota
token on it.

Quotas matter here more than on ad platforms: GA4 charges tokens per property per day, and a
few careless exploratory queries can exhaust them. `ga4_get_property_quotas_snapshot` shows
what is left.

---

## How this compares to Google's own MCP server

The Google Analytics team ships an official MCP server, and it is good. It is Apache-2.0,
runs locally, is read-only, and has a large community. Be clear about what differs.

| | Google's official server | This server | [getmcpads.com](https://www.getmcpads.com) |
|---|---|---|---|
| Tools | **7** | **27** | 27, plus 5 other platforms |
| Hosting | Local, via pipx | **Local**, via npx | Hosted for you |
| Read-only | ✅ | ✅ | ✅ |
| Reports | `run_report`, `run_funnel_report`, realtime | Same, plus **pivots, batch reports, advanced funnels** | Same |
| Admin API | Account summaries, property details, custom definitions | **Broader**: data streams, key events, channel groups, audiences, audience exports | Same |
| Diagnostics | ❌ | **Ecommerce, BigQuery export, server-side tagging, quotas** | Same |
| Metric compatibility | None | **Catalogue and matrix, checkable before the call** | Same |
| Identifier redaction | ❌ | **Default on, opt-in to disable** | Same |
| Language | Python | TypeScript | |
| Status | Labelled experimental by Google | 1.0 | |

**Neither is more private than the other.** Both run locally and read only. If the seven
official tools cover what you need, and your model writes clean GA4 report requests, use
Google's: it is maintained by the team that owns the API.

**Choose this one** when you want named metrics validated against a compatibility matrix
rather than raw request bodies, when you need the configuration and diagnostics surface, or
when you want identifiers redacted by default rather than by discipline.
**Choose [getmcpads.com](https://www.getmcpads.com)** if you want this server's capabilities
without running it, or you need analytics and ad platforms in the same conversation.

---

## Read-only, and why it stays that way

There are no write tools, and no environment variable that adds any. Every tool calls a read
method of the Data API or the Admin API.

This is not caution for its own sake. A misread report is a wrong answer you can spot. A
mistaken write to an analytics property, a deleted audience or an edited data stream, corrupts
the record you use to judge everything else, and often silently. The other servers we publish
do have write tools, guarded by a mandatory preview. This one has none.

Our ad platform servers with guarded writes:
[Meta Ads](https://github.com/getmcpads-com/meta-ads-mcp-server) ·
[Google Ads](https://github.com/getmcpads-com/google-ads-mcp-server) ·
[TikTok Ads](https://github.com/getmcpads-com/tiktok-ads-mcp-server)

---

## Personal data

Analytics data is not anonymous by default. A GA4 property can carry a `userId` you set
yourself, a device identifier, or a Google Signals pseudonymous ID. An MCP conversation sends
whatever a tool returns to a model.

**Identifiers are redacted by default wherever this server can return them**, and showing them
is an explicit opt-in, never the default.

| Tool | Behaviour |
|---|---|
| `ga4_list_admin_resources` | Access bindings have user and email identifiers redacted |
| `ga4_query_audience_export` | Identifier columns redacted, matched against the export's own dimension metadata |
| `ga4_get_audience_export_diagnostics` | Same redaction on the row sample |

Every one of these accepts `includePersonalIdentifiers: true` to return raw values, and
defaults to `false`.

Audience export rows are positional, so the redaction reads the export's dimension metadata to
find identifier columns. **If that metadata is missing, every value in the row is redacted**
rather than guessing which column is safe. Failing closed is the point.

**Report rows are not redacted.** `ga4_run_report` and the other reporting tools return what
you asked for. Altering the numbers a report returns would be worse than returning them.

So one decision stays yours: if your property carries a `userId` you consider personal, do not
request it as a report dimension in a conversation whose transcript leaves your machine.

---

## Getting credentials

Three values, obtained once.

### 1. OAuth client

In a [Google Cloud project](https://console.cloud.google.com/), enable the **Google Analytics
Data API** and the **Google Analytics Admin API**, then create an OAuth client under
**APIs & Services → Credentials**. Choose **Desktop app** for local use. Note the **client ID**
and **client secret**.

### 2. Refresh token

Run the OAuth consent flow once, signed in as a Google account with access to your GA4
properties, and keep the **refresh token**. The `analytics.readonly` scope is enough, and it
is the only one you should grant.

📖 [Google OAuth for installed apps](https://developers.google.com/identity/protocols/oauth2/native-app)

**The refresh token does not expire.** It is the sensitive value: anyone holding it can mint
access tokens indefinitely. Use an OAuth client dedicated to this server so you can revoke it
on its own.

### 3. Property ID, optional

Set `GA4_PROPERTY_ID` to avoid passing it on every call. Find it in GA4 under
**Admin → Property Settings**, or list them with `ga4_list_properties`.

Run **`ga4_health_check`** as your first call. It verifies the credentials and lists the
properties you can actually reach, without printing any secret.

---

## Setup

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "google-analytics": {
      "command": "npx",
      "args": ["-y", "@getmcpads/google-analytics-mcp-server"],
      "env": {
        "GA4_CLIENT_ID": "your-client-id",
        "GA4_CLIENT_SECRET": "your-client-secret",
        "GA4_REFRESH_TOKEN": "your-refresh-token"
      }
    }
  }
}
```

Restart Claude Desktop. Ask it: *"list my Google Analytics properties"*.

### Claude Code

```bash
claude mcp add google-analytics --env GA4_CLIENT_ID=... --env GA4_CLIENT_SECRET=... --env GA4_REFRESH_TOKEN=... -- npx -y @getmcpads/google-analytics-mcp-server
```

### Cursor

`.cursor/mcp.json` in your project, same shape as the Claude Desktop config above.

### From source

```bash
git clone https://github.com/getmcpads-com/google-analytics-mcp-server.git
cd google-analytics-mcp-server
npm install && npm run build
cp .env.example .env   # then fill in your credentials
npm start
```

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `GA4_CLIENT_ID` | none | **Required.** OAuth client ID |
| `GA4_CLIENT_SECRET` | none | **Required.** OAuth client secret |
| `GA4_REFRESH_TOKEN` | none | **Required.** From the consent flow |
| `GA4_PROPERTY_ID` | none | Optional default, saves passing it on every call |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

Check your setup at any time:

```bash
npm run doctor
```

---

## Tools

<details>
<summary><b>27 read tools</b></summary>

### Discovery and health
| Tool | Purpose |
|---|---|
| `ga4_health_check` | Validates credentials and lists reachable properties |
| `ga4_list_accounts` / `ga4_list_properties` | Accounts and properties you can reach |
| `ga4_get_property_configuration` | Timezone, currency, industry, data retention |
| `ga4_get_metadata` | Metrics and dimensions available on a given property |

### Reporting
| Tool | Purpose |
|---|---|
| `ga4_run_report` | The main reporting tool. Named metrics and dimensions |
| `ga4_run_pivot_report` | Pivot tables |
| `ga4_batch_run_reports` / `ga4_batch_run_pivot_reports` | Several reports in one call |
| `ga4_run_realtime_report` | The last 30 minutes |
| `ga4_run_advanced_funnel_report` | Funnel analysis with step conditions |
| `ga4_run_funnel_recipe` | Prebuilt funnels for common journeys |
| `ga4_validate_query` / `ga4_check_compatibility` | Check a combination *before* running it |

### Configuration
| Tool | Purpose |
|---|---|
| `ga4_list_admin_resources` | Data streams, users, links. Access-binding identifiers redacted |
| `ga4_get_custom_definitions` | Custom dimensions and metrics |
| `ga4_get_key_events` | Key events and their counting method |
| `ga4_get_channel_groups` | Default and custom channel groupings |
| `ga4_get_event_parameters` | Parameters actually collected on an event |

### Audiences
| Tool | Purpose |
|---|---|
| `ga4_get_audience_diagnostics` | Audience definitions and their health |
| `ga4_list_audience_exports` / `ga4_query_audience_export` | Audience exports and their rows |
| `ga4_get_audience_export_diagnostics` | Why an export is empty or stale |

### Diagnostics
| Tool | Purpose |
|---|---|
| `ga4_get_ecommerce_diagnostics` | Whether ecommerce events are complete and coherent |
| `ga4_get_bigquery_export_diagnostics` | BigQuery export configuration and freshness |
| `ga4_get_server_side_tagging_diagnostics` | Server-side tagging signals |
| `ga4_get_property_quotas_snapshot` | Remaining Data API quota tokens |

</details>

<details>
<summary><b>6 resources</b></summary>

| URI | Contents |
|---|---|
| `ga4://manifest` | What this server exposes, and which tool to run first |
| `ga4://metrics` | All 51 metrics with categories and formats |
| `ga4://dimensions` | All 62 dimensions and where they are valid |
| `ga4://compatibility` | The compatibility matrix |
| `ga4://recipes` | 12 step-by-step workflows |
| `ga4://p2-diagnostics` | Diagnostic playbooks |

</details>

---

## Security

- **The client secret and refresh token are never logged**, at any log level, or written to disk.
- **Three hosts are contacted, and only three**: `analyticsdata.googleapis.com`,
  `analyticsadmin.googleapis.com` and `oauth2.googleapis.com`. *A test fails the build if a
  fourth host appears in the source.*
- **No fetch follows a redirect.** Every outbound call sets `redirect: "error"`, so a redirect
  cannot forward a bearer token or client secret to another host. *A test fails the build if
  any fetch omits this.*
- **No telemetry.** The server makes no network call other than to Google.

Full policy, including how personal data is handled: [SECURITY.md](SECURITY.md).

---

## Looking for a managed, multi-platform version?

This server does one platform, on your machine, with your credentials. That is on purpose.

If you'd rather not run it yourself, or you need Google Analytics **alongside Meta Ads, Google
Ads, TikTok Ads, Pinterest Ads and Search Console** behind one endpoint, with hosted OAuth and
cross-platform reporting, that's what we build at **[getmcpads.com](https://www.getmcpads.com)**.

Same philosophy, less plumbing. This project stays open source and independently useful
either way.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
Please read [SECURITY.md](SECURITY.md) before reporting anything security-related.

## Licence

[Apache License 2.0](LICENSE). See also [NOTICE](NOTICE).

Google, Google Analytics and GA4 are trademarks of Google LLC.
**This project is not affiliated with, endorsed by, or sponsored by Google LLC.**
It is an independent client of a public API.
