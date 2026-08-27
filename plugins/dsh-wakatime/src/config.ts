import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { expandUserPath } from './paths.ts'
import { WAKATIME_CATEGORIES, type WakatimeCategory } from './ui-contract.ts'

export const name = 'wakatime'

export { WAKATIME_CATEGORIES }
export type { WakatimeCategory }

export interface Config {
  /** Minimum interval between heartbeat batches for one project. */
  heartbeatIntervalMs?: number
  /** Maximum lifetime of one wakatime-cli heartbeat process. */
  heartbeatTimeoutMs?: number
  /** Minimum interval between managed CLI update checks. */
  cliUpdateCheckIntervalMs?: number
  /** Minimum interval between background Dashboard refreshes. */
  dashboardRefreshIntervalMs?: number
  /** Minimum interval between background Insights refreshes. */
  insightsRefreshIntervalMs?: number
  /** Timeout for each CLI download or GitHub metadata request. */
  cliDownloadTimeoutMs?: number
  /** Explicit absolute wakatime-cli path. Disables discovery and management. */
  cliPath?: string
  /** Opt in to background download/update when no explicit or PATH CLI exists. */
  autoInstall?: boolean
  /** Include successful read and read_image operations. */
  trackReads?: boolean
  /** WakaTime heartbeat category. */
  category?: WakatimeCategory
  /** Client qualifier in the WakaTime plugin tag. */
  client?: string
  /** Enable plugin debug logging in addition to ~/.wakatime.cfg. */
  debug?: boolean
  /** Maximum distinct pending files retained for one project. */
  maxPendingFiles?: number
}

const MAX_TIMER_MS = 2_147_483_647

export const Config: z<Config> = z.object({
  heartbeatIntervalMs: z.number().step(1).min(1_000).max(MAX_TIMER_MS).default(60_000),
  heartbeatTimeoutMs: z.number().step(1).min(1_000).max(MAX_TIMER_MS).default(30_000),
  cliUpdateCheckIntervalMs: z.number().step(1).min(60_000).max(MAX_TIMER_MS).default(14_400_000),
  dashboardRefreshIntervalMs: z.number().step(1).min(60_000).max(MAX_TIMER_MS).default(300_000),
  insightsRefreshIntervalMs: z.number().step(1).min(60_000).max(MAX_TIMER_MS).default(1_800_000),
  cliDownloadTimeoutMs: z.number().step(1).min(1_000).max(MAX_TIMER_MS).default(120_000),
  cliPath: z.string().min(1),
  // Downloads are opt-in. The settings page exposes explicit download and
  // update actions instead of managing executables in the background.
  autoInstall: z.boolean().default(false),
  trackReads: z.boolean().default(true),
  category: z.union([...WAKATIME_CATEGORIES]).default('ai coding'),
  client: z.string().min(1).pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).default('dsh'),
  debug: z.boolean().default(false),
  maxPendingFiles: z.number().step(1).min(1).max(100_000).default(5_000),
})

export interface ResolvedConfig {
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
  cliUpdateCheckIntervalMs: number
  dashboardRefreshIntervalMs: number
  insightsRefreshIntervalMs: number
  cliDownloadTimeoutMs: number
  cliPath?: string
  autoInstall: boolean
  trackReads: boolean
  category: WakatimeCategory
  client: string
  debug: boolean
  maxPendingFiles: number
}

/**
 * Clamp a numeric config value into [min, max], rounding to an integer.
 * Non-finite values fall back to the documented default so hostile or
 * corrupted input (NaN, Infinity) cannot reach setInterval/setTimeout —
 * values beyond the 32-bit timer ceiling collapse to 1ms in both browsers
 * and Node, which would turn refresh timers into busy loops.
 */
function clampInterval(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Upper bound shared with the persisted-settings sanitizer (2^31 - 1 ms). */
const MAX_INTERVAL_MS = 2_147_483_647

export function resolveConfig(config: Config): ResolvedConfig {
  const cliPath = config.cliPath === undefined ? undefined : expandUserPath(config.cliPath)
  if (cliPath !== undefined && !isAbsolute(cliPath)) {
    throw new Error('dsh-wakatime: cliPath must be absolute (a leading ~ is supported)')
  }
  return {
    heartbeatIntervalMs: clampInterval(config.heartbeatIntervalMs, 1_000, MAX_INTERVAL_MS, 60_000),
    heartbeatTimeoutMs: clampInterval(config.heartbeatTimeoutMs, 1_000, MAX_INTERVAL_MS, 30_000),
    cliUpdateCheckIntervalMs: clampInterval(config.cliUpdateCheckIntervalMs, 1_000, MAX_INTERVAL_MS, 14_400_000),
    dashboardRefreshIntervalMs: clampInterval(config.dashboardRefreshIntervalMs, 60_000, MAX_INTERVAL_MS, 300_000),
    insightsRefreshIntervalMs: clampInterval(config.insightsRefreshIntervalMs, 60_000, MAX_INTERVAL_MS, 1_800_000),
    cliDownloadTimeoutMs: clampInterval(config.cliDownloadTimeoutMs, 1_000, MAX_INTERVAL_MS, 120_000),
    ...(cliPath === undefined ? {} : { cliPath }),
    autoInstall: config.autoInstall ?? false,
    trackReads: config.trackReads ?? true,
    category: config.category ?? 'ai coding',
    client: config.client ?? 'dsh',
    debug: config.debug ?? false,
    maxPendingFiles: clampInterval(config.maxPendingFiles, 1, 100_000, 5_000),
  }
}

function packageVersion(specifier: string): string | undefined {
  try {
    const require = createRequire(import.meta.url)
    const value = require(specifier) as { version?: unknown }
    return typeof value.version === 'string' && value.version.length > 0
      ? value.version
      : undefined
  } catch {
    return undefined
  }
}

export const dshVersion = packageVersion('@deepseek-ai/dsh/package.json')
  ?? packageVersion('@deepseek-ai/dsh-session/package.json')
  ?? 'unknown'

export const pluginVersion = packageVersion('../package.json') ?? 'unknown'

export function buildPluginTag(client: string): string {
  const product = client === 'dsh' ? 'deepseek-harness' : `deepseek-harness-${client}`
  return `${product}/${dshVersion} dsh-wakatime/${pluginVersion}`
}
