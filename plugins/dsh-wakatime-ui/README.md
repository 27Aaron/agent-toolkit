# DSH WakaTime UI

[中文](README.zh.md)

Web dashboard and settings page for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) on top of [`@27aaron/dsh-wakatime`](../dsh-wakatime). Install this bundle instead of the core package when you want tracking **and** the GUI; it installs the core transitively and re-exports its plugin, so host-side behavior is identical to [`@27aaron/dsh-wakatime`](../dsh-wakatime)'s. See that package for the full configuration reference.

## Highlights

- Adds **Settings → Plugins → WakaTime** with a dashboard following the official WakaTime structure: activity overview, AI Coding, models, editors, languages, operating systems, machines, and AI-versus-human trends.
- The Projects page contains project/category charts, today's activity breakdown, and project cards with AI details; AI and Insights provide prompt, token, model, weekday, and daily AI-share detail.
- Insights defaults to the last year and uses WakaTime's read-only `stats`, `days`, `ai_days`, and `weekdays` endpoints for long-range heatmaps; it does not use team, billing, or other paid-only APIs.
- Writes the API key to WakaTime's standard `.wakatime.cfg` with restrictive local permissions. UI-managed plugin options are stored under the WakaTime data directory shared with the core package.
- The page only receives a boolean indicating whether an API key is configured; it never reads the existing key back into the browser.
- Usage requests are made by the Host process and cached briefly to avoid repeated API calls. Summaries supply range-level data, and the selected end date is also queried through WakaTime's durations endpoint for a focused “today” breakdown; if that endpoint is unavailable, the page falls back to summary data.
- Host-side background refresh starts only after the first dashboard interaction; nothing polls WakaTime before then.

## Requirements

Same as the core package: DeepSeek Harness `>= 0.1.1-rc.2 < 0.2`, Node.js `^22.19.0 || >=24.0.0`, and a WakaTime API key configured as described there. Only meaningful in web profiles; headless profiles simply never load the browser half.

## Install from this repository

```sh
pnpm install
pnpm build
dsh plugin --profile web add ./plugins/dsh-wakatime-ui
dsh --profile web --dump-config
dsh web
```

For a registry-backed tarball, publish the matching `@27aaron/dsh-wakatime` version first, then run `pnpm --filter @27aaron/dsh-wakatime-ui pack` and install the tarball with `dsh plugin --profile <name> add <file.tgz>`. The UI tarball keeps the core as a normal dependency rather than embedding it; use the local-directory command above while the core version is not available from your configured registry.

Pick one wakatime variant per profile. Installing both composes two rows; the first row activated owns tracking and the second stands down quietly, but the duplication is best avoided. Switching variants keeps settings because both share the same persisted configuration paths.

## Configuration

The bundle inserts a row with id `wakatime-ui`. It re-exports the exact Schemastery schema of `@27aaron/dsh-wakatime`, so the full option table lives in [that README](../dsh-wakatime#configuration). Override this id in `$DSH_HOME/profiles/<name>/cordis.patch.yml`, `$DSH_HOME/cordis.patch.yml`, or a later `--patch` layer:

```yaml
- id: wakatime-ui
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

Harness replaces a row's whole `config` value when applying a later layer; omitted keys are filled from the schema rather than merged from the bundle patch.

Standard WakaTime network settings (`proxy`, `no_ssl_verify`, `debug`) keep coming from `.wakatime.cfg`.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

The browser bundle imports its RPC contract from `@27aaron/dsh-wakatime/ui-contract`; the client build inlines that subpath (`deps.alwaysBundle`) because the browser module table cannot resolve cross-package requires at runtime.
