# DSH WakaTime

[中文](README.zh.md)

WakaTime integration for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It syncs session activity through upstream `wakatime-cli`, without changing tool behavior or maintaining a separate activity parser.

This package is the **tracking core**. Configuration happens through `.wakatime.cfg` and the plugin config below — no UI required. The web dashboard and settings page live in the separate [`@27aaron/dsh-wakatime-ui`](../dsh-wakatime-ui) bundle; install it instead of this package when you want the GUI. Both variants read and write the same WakaTime data directory, so switching between them keeps every setting.

| Package                     | What you get                                             |
| --------------------------- | -------------------------------------------------------- |
| `@27aaron/dsh-wakatime`     | Headless tracking; browser bundle absent entirely.        |
| `@27aaron/dsh-wakatime-ui`  | The same tracking plus the web dashboard and settings page. |

## Highlights

- Uses Harness's official `session/event` notification to schedule sync, then awaits `ctx.sessions.flush(session)` before the CLI reads local transcripts.
- Runs `--sync-ai-activity`, followed by separate `--sync-offline-activity 1000` and `--offline-count` invocations. A remaining offline backlog keeps sync pending for another attempt. The CLI owns prompt, token, model, file, and line-change accounting; the plugin does not emit its own file heartbeats.
- Syncs prompt-only sessions too, without waiting for tool activity or another editor's heartbeat.
- Coalesces pending sync requests across sessions, applies a global sync interval, and retries transient failures.
- Uses an explicit CLI path, a global `wakatime-cli`, or a managed download in that order.
- Resolves the CLI lazily for sync; managed downloads require a settings-page action or explicit `autoInstall: true`.
- Starts dashboard API refresh only after a dashboard or settings interaction; activity sync through the CLI is independent.
- Reads WakaTime's standard HTTP(S) `proxy`, `no_ssl_verify`, and `debug` settings; the CLI continues to own filtering and project settings.
- Flushes pending activity on session disposal and plugin teardown, including one-shot headless runs.

The two sync commands are intentionally separate: [upstream's command dispatcher](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/cmd/run.go#L153-L165) selects offline sync first if both flags are supplied. Offline sync alone does not parse AI transcripts.

## Requirements

- DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`.
- Node.js `^22.19.0 || >=24.0.0`, matching the current Harness requirement.
- A stable `wakatime-cli >= v2.25.0` with native DeepSeek Harness parsing.
- A WakaTime API key in `~/.wakatime.cfg`, `$WAKATIME_HOME/.wakatime.cfg`, or `WAKATIME_API_KEY`.

```ini
[settings]
api_key = waka_your_api_key_here
```

## Install from npm

Install the tracking-only bundle into profiles that should trigger activity sync:

```sh
dsh plugin --profile headless add @27aaron/dsh-wakatime
```

For tracking plus the Web dashboard, install `@27aaron/dsh-wakatime-ui` instead:

```sh
dsh plugin --profile web add @27aaron/dsh-wakatime-ui
```

Pick one variant per profile. Inspect the composed configuration and restart the profile after installation.

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

Install the bundle separately in each profile that should trigger sync:

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
    client: dsh
    debug: false
```

All keys are optional because defaults live in the exported Schemastery schema. Harness replaces a row's whole `config` value when applying a later layer; omitted keys are filled from that schema rather than copied from the bundle patch. The upstream DeepSeek parser assigns the `ai coding` category; the plugin has no category override.

| Setting                    |     Default | Purpose                                                                |
| -------------------------- | ----------: | ---------------------------------------------------------------------- |
| `heartbeatIntervalMs`      |     `60000` | Minimum interval between global native-sync runs, across sessions.      |
| `heartbeatTimeoutMs`       |     `30000` | Timeout for each CLI process or persistence checkpoint, not the whole sync run. |
| `cliUpdateCheckIntervalMs` |  `14400000` | Managed CLI update-check interval.                                     |
| `dashboardRefreshIntervalMs` | `300000` | Background Dashboard refresh interval; the settings page displays minutes. |
| `insightsRefreshIntervalMs` | `1800000` | Background Insights refresh interval; the settings page displays minutes. |
| `cliDownloadTimeoutMs`     |    `120000` | Timeout for each GitHub request or CLI download.                       |
| `cliPath`                  |       unset | Absolute CLI path; `~` is expanded. Disables discovery and management. |
| `autoInstall`              |     `false` | Allow background download/update of a managed CLI during sync.         |
| `client`                   |       `dsh` | Safe identifier used in the CLI's `--plugin` tag.                       |
| `debug`                    |     `false` | Enable debug logs independently of WakaTime settings.                  |

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

The update check follows GitHub's latest stable release, so pre-releases are never installed automatically. Sync requires a verified stable `wakatime-cli >= v2.25.0`. Older, prerelease, and unknown versions (including unversioned local builds) are not treated as supported; update or select a supported CLI. There is no fallback plugin parser. The settings page shows the resolved CLI's native-sync support.

## Data and privacy

The plugin invokes the user's local WakaTime CLI with sync flags and a `--plugin` tag, and passes Harness's session root as `DSH_HOME`. The CLI reads local session transcripts and derives heartbeat metadata; it also owns API authentication, offline queuing, project detection, and privacy filters. Use standard WakaTime settings such as `hide_file_names`, `hide_project_names`, `exclude`, and `include` as required by your deployment policy.

Enabling this plugin in a profile controls when it triggers sync, not which profiles are scanned. Native AI sync scans all supported local transcripts, including other Harness profiles and other supported AI tools, according to the CLI's settings.

Logs are written to `~/.wakatime/dsh-wakatime.log` or `$WAKATIME_HOME/dsh-wakatime.log`. API keys are never passed as process arguments or included in plugin logs.

## Diagnostics

```sh
dsh --profile web --dump-config
grep -iE 'warn|error' ~/.wakatime/dsh-wakatime.log
grep -iE 'warn|error' ~/.wakatime/wakatime.log
```

Enable `debug = true` in `.wakatime.cfg` or `debug: true` in the plugin row when more detail is needed.

## Limitations

- Native DeepSeek parsing reads local `session.jsonl` and `session.jsonl.zstd` files under `$DSH_HOME/sessions` (normally `~/.dsh/sessions`). Sessions kept only in memory or on a remote host must be persisted locally first. See [upstream's transcript discovery](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/pkg/ai/deepseek.go#L176-L237).
- File coverage and line-change accounting follow upstream. Arbitrary shell edits and unsupported custom tools are not inferred by this plugin.
- In v2.25.0, upstream does not parse Code Mode's `tool/code-dispatch` events, so those subcalls lack file/line-change details; session prompts and token usage can still be synced. This needs an upstream parser change, not a second local producer. See [the supported event branches](https://github.com/wakatime/wakatime-cli/blob/v2.25.0/pkg/ai/deepseek.go#L380-L395).
- Offline delivery and duplicate handling remain CLI responsibilities. A successful local sync invocation does not guarantee that the dashboard has already received every heartbeat.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```
