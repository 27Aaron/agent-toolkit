/**
 * WakaTime integration for DeepSeek Harness.
 *
 * The plugin observes the official `tools/result` Cordis event instead of
 * reconstructing calls from the durable session log. That gives it the final,
 * validated arguments and presentation metadata for both native tools and
 * Code Mode sub-dispatches without changing the agent execution pipeline.
 *
 * @module @27aaron/dsh-wakatime
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import { CliManager, WakatimeApiError } from './cli.ts'
import { extractFileChanges, resolveEntityPath } from './changes.ts'
import {
  buildPluginTag,
  Config,
  name,
  resolveConfig,
  WAKATIME_CATEGORIES,
  type Config as ConfigShape,
} from './config.ts'
import { HeartbeatDispatcher } from './heartbeat.ts'
import { PluginLogger } from './logger.ts'
import {
  DEFAULT_WAKATIME_API_URL,
  normalizeWakatimeApiUrl,
  readWakatimeSettings,
  writeWakatimeApiKey,
  writeWakatimeApiUrl,
} from './settings.ts'
import { HeartbeatRateLimiter } from './state.ts'
import { WakatimeTracker } from './tracker.ts'
import {
  getPersistedWakatimeConfigPath,
  readPersistedWakatimeConfig,
  writePersistedWakatimeConfig,
  type PersistedWakatimeConfig,
} from './ui-settings.ts'
import {
  WAKATIME_RPC_CHANNEL,
  type WakatimeCliUpdateCheck,
  type WakatimeUiConfig,
  type WakatimeUiRpcResult,
  type WakatimeUiStatus,
} from './ui-contract.ts'
import { getPluginLogFilePath, getWakatimeConfigFilePath } from './paths.ts'
import { fetchWakatimeInsights, validateInsightRange } from './insights.ts'
import { fetchWakatimeUsage, validateUsageRange } from './usage.ts'
import type { WakatimeInsightsData, WakatimeUsageData } from './ui-contract.ts'
import {
  readWakatimeCache,
  writeWakatimeCache,
  type WakatimeCache,
  type WakatimeCacheEntry,
} from './cache.ts'

export { Config, name }
export type { Config as WakatimeConfig, WakatimeCategory } from './config.ts'

interface RpcSignal {
  aborted?: boolean
  throwIfAborted?: () => void
}

interface RpcConnection {
  rpc: {
    handle: (
      channel: string,
      handler: (endpoint: string, payload: unknown, signal: RpcSignal) => Promise<WakatimeUiRpcResult<unknown>>,
      options?: { authority?: string },
    ) => unknown
    call?: (...args: unknown[]) => unknown
  }
}

interface RpcContext {
  connection?: RpcConnection
}

function publicError(code: string, message: string): WakatimeUiRpcResult<never> {
  // The shared client connection validates RPC errors against its wire-level
  // error union. Keep plugin-local validation failures on the generic
  // bad-request branch and always include the required details object.
  const wireCode = code === 'invalid_config' ? 'bad-request' : 'internal'
  return {
    ok: false,
    error: {
      code: wireCode,
      message,
      details: wireCode === 'bad-request' ? { issues: [] } : {},
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Settings reads happen before the plugin logger exists and again after save;
// route invalid-api_url fallbacks through a deferred reporter so the silent
// official-endpoint redirect is observable both on stderr (immediately) and
// in the plugin log file (once the logger exists).
const pendingInvalidApiUrlReports: string[] = []
let invalidApiUrlLogger: PluginLogger | undefined
function reportInvalidApiUrl(configured: string, error: unknown): void {
  const message = `invalid api_url ${JSON.stringify(configured)} in .wakatime.cfg (${error instanceof Error ? error.message : String(error)}); falling back to the official endpoint`
  if (pendingInvalidApiUrlReports.includes(message)) return
  pendingInvalidApiUrlReports.push(message)
  try {
    process.stderr.write(`dsh-wakatime: ${message}\n`)
  } catch {
    // Reporting is best-effort.
  }
  invalidApiUrlLogger?.warn(message)
}

function configPatch(value: unknown): PersistedWakatimeConfig {
  if (!isRecord(value)) return {}
  const patch: PersistedWakatimeConfig = {}
  if (typeof value.category === 'string'
    && WAKATIME_CATEGORIES.includes(value.category as typeof WAKATIME_CATEGORIES[number])) {
    patch.category = value.category as NonNullable<PersistedWakatimeConfig['category']>
  }
  if (typeof value.trackReads === 'boolean') patch.trackReads = value.trackReads
  if (typeof value.cliPath === 'string') patch.cliPath = value.cliPath
  if (typeof value.debug === 'boolean') patch.debug = value.debug
  if (typeof value.heartbeatIntervalMs === 'number') patch.heartbeatIntervalMs = value.heartbeatIntervalMs
  if (typeof value.dashboardRefreshIntervalMs === 'number') patch.dashboardRefreshIntervalMs = value.dashboardRefreshIntervalMs
  if (typeof value.insightsRefreshIntervalMs === 'number') patch.insightsRefreshIntervalMs = value.insightsRefreshIntervalMs
  return patch
}

function projectFolderOf(session: Session): string {
  return path.resolve(session.header.cwd ?? process.cwd())
}

function isDirectory(entity: string): boolean {
  try {
    return fs.statSync(entity).isDirectory()
  } catch {
    // Remote/sandbox display paths may not exist in the host filesystem.
    return false
  }
}

export function apply(ctx: Context, rawConfig: ConfigShape): void {
  let config = resolveConfig({ ...rawConfig, ...readPersistedWakatimeConfig() })
  let settings = readWakatimeSettings(undefined, reportInvalidApiUrl)
  const logger = new PluginLogger(ctx.logger, config.debug || settings.debug)
  invalidApiUrlLogger = logger
  for (const message of pendingInvalidApiUrlReports.splice(0)) logger.warn(message)
  const cli = new CliManager(config, settings, logger)
  const pluginTag = buildPluginTag(config.client)
  const dispatcher = new HeartbeatDispatcher(
    cli,
    pluginTag,
    config.category,
    config.heartbeatTimeoutMs,
    logger,
  )
  let persistedCache: WakatimeCache = readWakatimeCache()
  let usageCache: WakatimeCacheEntry<WakatimeUsageData> | undefined = persistedCache.usage
  let insightsCache: WakatimeCacheEntry<WakatimeInsightsData> | undefined = persistedCache.insights
  let usageRefresh: { key: string; promise: Promise<WakatimeUsageData> } | undefined
  let insightsRefresh: { key: string; promise: Promise<WakatimeInsightsData> } | undefined
  let usageBackoffUntil = 0
  let insightsBackoffUntil = 0
  let backgroundRefreshTimer: ReturnType<typeof setTimeout> | undefined
  let backgroundRefreshDisposed = false
  let cachePersistTimer: ReturnType<typeof setTimeout> | undefined
  const tracker = new WakatimeTracker(
    config,
    new HeartbeatRateLimiter(),
    heartbeats => dispatcher.send(heartbeats),
    logger,
  )
  logger.info(`initialized (${pluginTag})`)

  const uiConfig = (): WakatimeUiConfig => ({
    baseUrl: settings.apiUrl ?? DEFAULT_WAKATIME_API_URL,
    category: config.category,
    trackReads: config.trackReads,
    ...(config.cliPath === undefined ? {} : { cliPath: config.cliPath }),
    debug: config.debug,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    dashboardRefreshIntervalMs: config.dashboardRefreshIntervalMs,
    insightsRefreshIntervalMs: config.insightsRefreshIntervalMs,
  })

  interface UsageRange {
    start: string
    end: string
  }

  const localDateInput = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const defaultUsageRange = (): UsageRange => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    return { start: localDateInput(start), end: localDateInput(end) }
  }

  const usageKey = (range: UsageRange): string => `${settings.apiUrl ?? DEFAULT_WAKATIME_API_URL}|${range.start}:${range.end}`
  const insightsKey = (range: string): string => `${settings.apiUrl ?? DEFAULT_WAKATIME_API_URL}|${range}`

  const persistCache = (): void => {
    // Cache persistence contains the long-range Insights payload. Debounce it
    // and let the RPC response finish before JSON.stringify/writeFileSync runs
    // so a refresh cannot make the web connection wait on disk I/O.
    if (cachePersistTimer !== undefined) return
    cachePersistTimer = setTimeout(() => {
      cachePersistTimer = undefined
      try {
        writeWakatimeCache(persistedCache)
      } catch (error) {
        logger.exception('WARN', error, 'could not persist WakaTime dashboard cache')
      }
    }, 100)
    cachePersistTimer.unref?.()
  }

  const rateLimitBackoff = (error: unknown): number | undefined => {
    if (!(error instanceof WakatimeApiError) || error.statusCode !== 429) return undefined
    return Math.max(60_000, error.retryAfterMs ?? 5 * 60_000)
  }

  const refreshUsage = (range: UsageRange, force: boolean = false): Promise<WakatimeUsageData> => {
    const key = usageKey(range)
    if (!force && usageCache?.key === key && Date.now() - usageCache.fetchedAt < config.dashboardRefreshIntervalMs) {
      return Promise.resolve(usageCache.value)
    }
    if (Date.now() < usageBackoffUntil) {
      if (usageCache?.key === key) return Promise.resolve(usageCache.value)
      return Promise.reject(new WakatimeApiError(429, usageBackoffUntil - Date.now()))
    }
    if (usageRefresh?.key === key) return usageRefresh.promise
    const promise = fetchWakatimeUsage(settings, range.start, range.end).then(value => {
      usageBackoffUntil = 0
      usageCache = { key, fetchedAt: Date.now(), value }
      persistedCache.usage = usageCache
      persistCache()
      return value
    }).catch(error => {
      const backoff = rateLimitBackoff(error)
      if (backoff !== undefined) {
        usageBackoffUntil = Date.now() + backoff
        if (usageCache?.key === key) return usageCache.value
      }
      throw error
    }).finally(() => {
      if (usageRefresh?.key === key) usageRefresh = undefined
    })
    usageRefresh = { key, promise }
    return promise
  }

  const refreshInsights = (range: string, force: boolean = false): Promise<WakatimeInsightsData> => {
    const key = insightsKey(range)
    if (!force && insightsCache?.key === key && Date.now() - insightsCache.fetchedAt < config.insightsRefreshIntervalMs) {
      return Promise.resolve(insightsCache.value)
    }
    if (Date.now() < insightsBackoffUntil) {
      if (insightsCache?.key === key) return Promise.resolve(insightsCache.value)
      return Promise.reject(new WakatimeApiError(429, insightsBackoffUntil - Date.now()))
    }
    if (insightsRefresh?.key === key) return insightsRefresh.promise
    const promise = fetchWakatimeInsights(settings, range as Parameters<typeof fetchWakatimeInsights>[1]).then(value => {
      insightsBackoffUntil = 0
      insightsCache = { key, fetchedAt: Date.now(), value }
      persistedCache.insights = insightsCache
      persistCache()
      return value
    }).catch(error => {
      const backoff = rateLimitBackoff(error)
      if (backoff !== undefined) {
        insightsBackoffUntil = Date.now() + backoff
        if (insightsCache?.key === key) return insightsCache.value
      }
      throw error
    }).finally(() => {
      if (insightsRefresh?.key === key) insightsRefresh = undefined
    })
    insightsRefresh = { key, promise }
    return promise
  }

  const refreshBackgroundData = async (): Promise<void> => {
    if (settings.apiKeyConfigured !== true) return
    const usageRange = defaultUsageRange()
    const usageNeedsRefresh = usageCache?.key !== usageKey(usageRange)
      || Date.now() - (usageCache?.fetchedAt ?? 0) >= config.dashboardRefreshIntervalMs
    const insightsNeedsRefresh = insightsCache !== undefined
      && Date.now() - insightsCache.fetchedAt >= config.insightsRefreshIntervalMs
    await Promise.all([
      usageNeedsRefresh ? refreshUsage(usageRange, true) : undefined,
      insightsNeedsRefresh && insightsCache !== undefined ? refreshInsights(insightsCache.value.range, true) : undefined,
    ])
  }

  const scheduleBackgroundRefresh = (): void => {
    if (backgroundRefreshTimer !== undefined) clearTimeout(backgroundRefreshTimer)
    if (backgroundRefreshDisposed) return
    backgroundRefreshTimer = setTimeout(() => {
      void refreshBackgroundData().catch(error => logger.exception('WARN', error, 'background WakaTime refresh failed'))
        .finally(scheduleBackgroundRefresh)
    }, Math.max(60_000, Math.min(config.dashboardRefreshIntervalMs, config.insightsRefreshIntervalMs)))
  }

  const status = async (): Promise<WakatimeUiStatus> => ({
    config: uiConfig(),
    apiKeyConfigured: settings.apiKeyConfigured === true,
    cli: await cli.inspect(),
    tracking: {
      ...tracker.status(),
      ...dispatcher.status(),
    },
    paths: {
      config: getWakatimeConfigFilePath(),
      log: getPluginLogFilePath(),
      data: getPersistedWakatimeConfigPath(),
    },
  })

  const updateRuntimeConfig = (next: ReturnType<typeof resolveConfig>): void => {
    config = next
    logger.setDebugEnabled(config.debug || settings.debug)
    cli.updateConfig(config)
    cli.updateSettings(settings)
    dispatcher.updateConfig(config.category, config.heartbeatTimeoutMs)
    tracker.updateConfig(config)
  }

  const rpcHandler = async (
    endpoint: string,
    payload: unknown,
    signal: RpcSignal,
  ): Promise<WakatimeUiRpcResult<unknown>> => {
    try {
      signal.throwIfAborted?.()
      if (endpoint === 'status') return { ok: true, value: await status() }

      if (endpoint === 'usage') {
        const input = isRecord(payload) ? payload : {}
        const range = validateUsageRange(input.start, input.end)
        const key = usageKey(range)
        if (input.force !== true && usageCache?.key === key) {
          if (Date.now() - usageCache.fetchedAt >= config.dashboardRefreshIntervalMs) {
            void refreshUsage(range, true).catch(error => logger.exception('WARN', error, 'background WakaTime usage refresh failed'))
          }
          return { ok: true, value: usageCache.value }
        }
        return { ok: true, value: await refreshUsage(range, input.force === true) }
      }

      if (endpoint === 'insights') {
        const input = isRecord(payload) ? payload : {}
        const range = validateInsightRange(input.range)
        const key = insightsKey(range)
        if (input.force !== true && insightsCache?.key === key) {
          if (Date.now() - insightsCache.fetchedAt >= config.insightsRefreshIntervalMs) {
            void refreshInsights(range, true).catch(error => logger.exception('WARN', error, 'background WakaTime insights refresh failed'))
          }
          return { ok: true, value: insightsCache.value }
        }
        return { ok: true, value: await refreshInsights(range, input.force === true) }
      }

      if (endpoint === 'test-cli') {
        await cli.test()
        return { ok: true, value: await status() }
      }

      if (endpoint === 'download-cli') {
        await cli.download()
        return { ok: true, value: await status() }
      }

      if (endpoint === 'update-cli') {
        await cli.update()
        return { ok: true, value: await status() }
      }

      if (endpoint === 'check-cli-update') {
        const result = await cli.checkUpdate()
        const value: WakatimeCliUpdateCheck = { ...result, status: await status() }
        return { ok: true, value }
      }

      if (endpoint === 'flush') {
        await tracker.flushAll()
        return { ok: true, value: await status() }
      }

      if (endpoint === 'save') {
        const input = isRecord(payload) ? payload : {}
        const patch = configPatch(input.config)
        const { cliPath, ...patchWithoutCliPath } = patch
        const candidate = { ...config, ...patchWithoutCliPath }
        if (cliPath === '') delete candidate.cliPath
        else if (cliPath !== undefined) candidate.cliPath = cliPath
        let next
        try {
          next = resolveConfig(candidate)
        } catch (error) {
          return publicError('invalid_config', error instanceof Error ? error.message : String(error))
        }

        let baseUrl = settings.apiUrl ?? DEFAULT_WAKATIME_API_URL
        if (typeof input.baseUrl === 'string') {
          try {
            baseUrl = normalizeWakatimeApiUrl(input.baseUrl)
          } catch (error) {
            return publicError('invalid_config', error instanceof Error ? error.message : String(error))
          }
        }

        if (input.clearApiKey === true) writeWakatimeApiKey(null)
        else if (typeof input.apiKey === 'string' && input.apiKey.trim().length > 0) {
          writeWakatimeApiKey(input.apiKey)
        }
        if (typeof input.baseUrl === 'string') writeWakatimeApiUrl(baseUrl)
        writePersistedWakatimeConfig(patch)
        config = next
        settings = readWakatimeSettings(undefined, reportInvalidApiUrl)
        usageCache = undefined
        insightsCache = undefined
        usageBackoffUntil = 0
        insightsBackoffUntil = 0
        persistedCache = { version: persistedCache.version }
        persistCache()
        updateRuntimeConfig(next)
        scheduleBackgroundRefresh()
        return { ok: true, value: await status() }
      }

      // Keep the error code inside the host RPC error union so an old or
      // mismatched bundle returns a readable error instead of failing schema
      // validation in the surrounding connection layer.
      return publicError('internal', `Unknown WakaTime endpoint: ${endpoint}`)
    } catch (error) {
      if (signal.aborted) throw error
      return publicError('internal', error instanceof Error ? error.message : String(error))
    }
  }

  ctx.inject(['connection'], connectionContext => {
    const connection = (connectionContext as unknown as RpcContext).connection
    if (connection?.rpc?.handle === undefined) return
    const disposer = connection.rpc.handle(WAKATIME_RPC_CHANNEL, rpcHandler, { authority: 'loopback' })
    return () => {
      if (typeof disposer === 'function') disposer()
    }
  })

  ctx.on('tools/result', (exec, result) => {
    try {
      if (result.isError || exec.agent === undefined) return
      const projectFolder = projectFolderOf(exec.agent.session)
      const changes = extractFileChanges(
        exec.name,
        exec.arguments,
        result.meta,
        result.value,
        config.trackReads,
      )
        .map(change => ({
          ...change,
          file: resolveEntityPath(change.file, projectFolder),
        }))
        .filter(change => {
          if (!isDirectory(change.file)) return true
          logger.debug(`ignoring directory entity ${change.file}`)
          return false
        })
      tracker.record(projectFolder, changes)
    } catch (error) {
      // Observer work is isolated even on Harness versions predating
      // per-listener containment for tools/result.
      logger.exception('WARN', error, `could not process ${exec.name} result`)
    }
  })

  ctx.on('session/flush', session => {
    tracker.checkpoint(projectFolderOf(session))
  })

  ctx.on('session/disposed', session => {
    void tracker.flushProject(projectFolderOf(session))
  })

  ctx.effect(
    () => async () => tracker.dispose(),
    'dsh-wakatime: flush pending heartbeats',
  )

  ctx.effect(
    () => {
      const startupPrefetchTimer = setTimeout(() => {
        // A persisted cache is already useful at startup. Only refresh when
        // the normal freshness policy says it is needed instead of forcing a
        // request on every DSH launch.
        void refreshUsage(defaultUsageRange())
          .catch(error => logger.exception('WARN', error, 'startup WakaTime prefetch failed'))
      }, 2_000)
      scheduleBackgroundRefresh()
      return () => {
        backgroundRefreshDisposed = true
        clearTimeout(startupPrefetchTimer)
        if (backgroundRefreshTimer !== undefined) clearTimeout(backgroundRefreshTimer)
      }
    },
    'dsh-wakatime: prefetch dashboard data',
  )
}
