# DSH WakaTime

[中文](README.zh.md)

WakaTime integration for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It records successful agent file activity without changing tool behavior or blocking the tool execution pipeline.

This package is the **tracking core**. Configuration happens through `.wakatime.cfg` and the plugin config below — no UI required. The web dashboard and settings page live in the separate [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) bundle; install it instead of this package when you want the GUI. Both variants read and write the same WakaTime data directory, so switching between them keeps every setting.

| Package                     | What you get                                             |
| --------------------------- | -------------------------------------------------------- |
| `@27aaron/dsh-wakatime`     | Headless tracking; browser bundle absent entirely.        |
| `@27aaron/dsh-wakatime-ui`  | The same tracking plus the web dashboard and settings page. |

## Highlights

- Uses Harness's official `tools/result` Cordis event, covering native tools and Code Mode sub-dispatches.
- Tracks `read`, `read_image`, `edit`, `write`, and `str_replace_editor` operations.
- Uses final validated tool arguments and canonical results for exact net AI line changes when Harness exposes them.
- Batches files through WakaTime's `--extra-heartbeats` protocol and preserves each activity timestamp.
- Applies a per-project, cross-process rate limit with an exclusive state lock and retries pending data after transient failures.
- Uses an explicit CLI path, a global `wakatime-cli`, or a managed download in that order.
- Resolves the CLI lazily after tracked activity, so Harness startup never waits on the network; managed downloads require a settings-page action or explicit `autoInstall: true`.
- Makes no background WakaTime API requests of its own; dashboard data is fetched only after a dashboard or settings interaction asks for it.
- Reads WakaTime's standard HTTP(S) `proxy`, `no_ssl_verify`, and `debug` settings; the CLI continues to own filtering and project settings.
- Flushes pending activity on session disposal and plugin teardown, including one-shot headless runs.

## Requirements

- DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`.
- Node.js `^22.19.0 || >=24.0.0`, matching the current Harness requirement.
- A WakaTime API key in `~/.wakatime.cfg`, `$WAKATIME_HOME/.wakatime.cfg`, or `WAKATIME_API_KEY`.

```ini
[settings]
api_key = waka_your_api_key_here
```

## Install from this repository

Build the packages, add the variant you want as a Profile Bundle, inspect the composed layer, and restart the profile:

```sh
pnpm install
pnpm build

# Tracking only:
dsh plugin --profile web add ./plugins/dsh-wakatime

# Tracking plus the web dashboard:
dsh plugin --profile web add ./plugins/dsh-wakatime-ui
```

Install the bundle separately in every profile that should report activity:

```sh
dsh plugin --profile headless add ./plugins/dsh-wakatime
```

For a portable core artifact, run `pnpm --filter @27aaron/dsh-wakatime pack` and install the tarball with `dsh plugin --profile <name> add <file.tgz>`. The UI tarball keeps this core as a normal registry dependency, so publish the matching core version before distributing `@27aaron/dsh-wakatime-ui`; use the local-directory commands above for an unpublished checkout.

Pick **one variant per profile**. Both declare `dsh.bundle` patches, so installing both into one profile composes two wakatime rows; the first row to activate owns tracking and the second stands down with a warning, so nothing is tracked twice — but the ambiguity is best avoided. The UI bundle installs this core transitively, so switching later means removing one package and adding the other; settings persist in the WakaTime data directory.

## Configuration

### Web dashboard

The dashboard and settings page are provided by the [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) bundle; see its README for the feature tour. This core exposes the same RPC endpoints either way, keeps serving cached data to any installed dashboard, and starts background refresh only after that first interaction. Both variants read the API key from `.wakatime.cfg` and keep UI-managed options under the WakaTime data directory, so moving between variants never loses settings.

### Plugin config

The bundle inserts a row with id `wakatime` (the UI variant inserts `wakatime-ui` and re-exports the same schema). Override that id in `$DSH_HOME/profiles/<name>/cordis.patch.yml`, `$DSH_HOME/cordis.patch.yml`, or a later `--patch` layer:

```yaml
- id: wakatime
  config:
    heartbeatIntervalMs: 60000
    heartbeatTimeoutMs: 30000
    cliUpdateCheckIntervalMs: 14400000
    cliDownloadTimeoutMs: 120000
    autoInstall: false
    trackReads: true
    category: "ai coding"
    client: dsh
    debug: false
    maxPendingFiles: 5000
```

All keys are optional because defaults live in the exported Schemastery schema. Harness replaces a row's whole `config` value when applying a later layer; omitted keys are filled from that schema rather than copied from the bundle patch.

| Setting                    |     Default | Purpose                                                                |
| -------------------------- | ----------: | ---------------------------------------------------------------------- |
| `heartbeatIntervalMs`      |     `60000` | Minimum interval between batches for one project.                      |
| `heartbeatTimeoutMs`       |     `30000` | Maximum lifetime of one heartbeat process.                             |
| `cliUpdateCheckIntervalMs` |  `14400000` | Managed CLI update-check interval.                                     |
| `dashboardRefreshIntervalMs` | `300000` | Background Dashboard refresh interval; the settings page displays minutes. |
| `insightsRefreshIntervalMs` | `1800000` | Background Insights refresh interval; the settings page displays minutes. |
| `cliDownloadTimeoutMs`     |    `120000` | Timeout for each GitHub request or CLI download.                       |
| `cliPath`                  |       unset | Absolute CLI path; `~` is expanded. Disables discovery and management. |
| `autoInstall`              |     `false` | Allow background download/update of a managed CLI during heartbeats.   |
| `trackReads`               |      `true` | Include successful reads as zero-line-change AI activity.              |
| `category`                 | `ai coding` | WakaTime category for emitted heartbeats.                              |
| `client`                   |       `dsh` | Safe identifier added to the WakaTime plugin tag.                      |
| `debug`                    |     `false` | Enable debug logs independently of WakaTime settings.                  |
| `maxPendingFiles`          |      `5000` | Bound memory used by pending distinct files per project.               |

Standard WakaTime network settings are read from `.wakatime.cfg`:

```ini
[settings]
debug = true
proxy = https://user:pass@example.com:8080
# Avoid this unless a controlled network requires it.
no_ssl_verify = false
```

## CLI management and security

Resolution order is:

1. Configured `cliPath`.
2. `wakatime-cli` found on `PATH`.
3. Platform-specific managed CLI under `~/.wakatime/` or `$WAKATIME_HOME`.

By default the page only inspects the configured path, PATH, and WakaTime directory; it does not make network requests or write files. The settings page provides **Download WakaTime CLI** and **Check and update** actions: the former installs a managed copy only after an explicit click, while the latter only operates on the managed copy and never changes a system or package-manager installation. Managed downloads use HTTPS, honor standard HTTP(S) WakaTime proxy settings, validate ZIP structure, size, CRC-32, expected binary name, and the downloaded executable's `--version` output, then replace the prior binary atomically. Set `autoInstall: true` in Host configuration only when background management is desired.

## Data and privacy

The plugin invokes the user's local WakaTime CLI with file paths, project folder, timestamps, category, write state, and signed net AI line changes. WakaTime CLI owns API authentication, offline queuing, project detection, and privacy filters. Use standard WakaTime settings such as `hide_file_names`, `hide_project_names`, `exclude`, and `include` as required by your deployment policy.

Logs are written to `~/.wakatime/dsh-wakatime.log` or `$WAKATIME_HOME/dsh-wakatime.log`. API keys are never passed as process arguments or written by this plugin.

## Diagnostics

```sh
dsh --profile web --dump-config
grep -iE 'warn|error' ~/.wakatime/dsh-wakatime.log
grep -iE 'warn|error' ~/.wakatime/wakatime.log
```

Enable `debug = true` in `.wakatime.cfg` or `debug: true` in the plugin row when more detail is needed.

## Limitations

- Shell commands can modify arbitrary files, so `bash` and PowerShell activity is not guessed.
- A custom filesystem tool is tracked only after explicit support is added for its argument/result contract.
- Remote filesystem backends may expose model-visible paths that do not exist on the host; those paths are still reported with the session project folder.
- WakaTime's `ai_line_changes` value is a signed net line delta, not the number of touched or replaced lines.
- Prompt-only activity has no file entity and is not synthesized. Official Claude Code and Codex integrations can ask WakaTime CLI to parse their native logs; WakaTime CLI does not currently parse the Harness session format.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
