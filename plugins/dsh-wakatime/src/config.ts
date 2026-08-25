import { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { expandUserPath } from './paths.ts'

export const name = 'wakatime'

export const WAKATIME_CATEGORIES = [
  'coding',
  'ai coding',
  'building',
  'indexing',
  'debugging',
  'learning',
  'notes',
  'meeting',
  'planning',
  'researching',
  'communicating',
  'supporting',
  'advising',
  'running tests',
  'writing tests',
  'manual testing',
  'writing docs',
  'code reviewing',
  'browsing',
  'translating',
  'designing',
] as const

export type WakatimeCategory = typeof WAKATIME_CATEGORIES[number]

export interface Config {
  /** Minimum interval between heartbeat batches for one project. */
  heartbeatIntervalMs?: number
  /** Maximum lifetime of one wakatime-cli heartbeat process. */
  heartbeatTimeoutMs?: number
  /** Minimum interval between managed CLI update checks. */
  cliUpdateCheckIntervalMs?: number
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
  cliDownloadTimeoutMs: number
  cliPath?: string
  autoInstall: boolean
  trackReads: boolean
  category: WakatimeCategory
  client: string
  debug: boolean
  maxPendingFiles: number
}

export function resolveConfig(config: Config): ResolvedConfig {
  const cliPath = config.cliPath === undefined ? undefined : expandUserPath(config.cliPath)
  if (cliPath !== undefined && !isAbsolute(cliPath)) {
    throw new Error('dsh-wakatime: cliPath must be absolute (a leading ~ is supported)')
  }
  return {
    heartbeatIntervalMs: config.heartbeatIntervalMs ?? 60_000,
    heartbeatTimeoutMs: config.heartbeatTimeoutMs ?? 30_000,
    cliUpdateCheckIntervalMs: config.cliUpdateCheckIntervalMs ?? 14_400_000,
    cliDownloadTimeoutMs: config.cliDownloadTimeoutMs ?? 120_000,
    ...(cliPath === undefined ? {} : { cliPath }),
    autoInstall: config.autoInstall ?? false,
    trackReads: config.trackReads ?? true,
    category: config.category ?? 'ai coding',
    client: config.client ?? 'dsh',
    debug: config.debug ?? false,
    maxPendingFiles: config.maxPendingFiles ?? 5_000,
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
