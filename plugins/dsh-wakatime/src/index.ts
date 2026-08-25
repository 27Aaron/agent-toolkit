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
import { CliManager } from './cli.ts'
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
import { readWakatimeSettings } from './settings.ts'
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
import { writeWakatimeApiKey } from './settings.ts'
import { fetchWakatimeInsights, validateInsightRange } from './insights.ts'
import { fetchWakatimeUsage, validateUsageRange } from './usage.ts'
import type { WakatimeInsightsData, WakatimeUsageData } from './ui-contract.ts'

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
  return { ok: false, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  let settings = readWakatimeSettings()
  const logger = new PluginLogger(ctx.logger, config.debug || settings.debug)
  const cli = new CliManager(config, settings, logger)
  const pluginTag = buildPluginTag(config.client)
  const dispatcher = new HeartbeatDispatcher(
    cli,
    pluginTag,
    config.category,
    config.heartbeatTimeoutMs,
    logger,
  )
  let usageCache: { key: string; expiresAt: number; value: WakatimeUsageData } | undefined
  let insightsCache: { key: string; expiresAt: number; value: WakatimeInsightsData } | undefined
  const tracker = new WakatimeTracker(
    config,
    new HeartbeatRateLimiter(),
    heartbeats => dispatcher.send(heartbeats),
    logger,
  )
  logger.info(`initialized (${pluginTag})`)

  const uiConfig = (): WakatimeUiConfig => ({
    category: config.category,
    trackReads: config.trackReads,
    ...(config.cliPath === undefined ? {} : { cliPath: config.cliPath }),
    debug: config.debug,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
  })

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
        const key = `${range.start}:${range.end}`
        if (usageCache !== undefined && usageCache.key === key && usageCache.expiresAt > Date.now()) {
          return { ok: true, value: usageCache.value }
        }
        const value = await fetchWakatimeUsage(settings, range.start, range.end)
        usageCache = { key, expiresAt: Date.now() + 60_000, value }
        return { ok: true, value }
      }

      if (endpoint === 'insights') {
        const input = isRecord(payload) ? payload : {}
        const range = validateInsightRange(input.range)
        const key = range
        if (insightsCache !== undefined && insightsCache.key === key && insightsCache.expiresAt > Date.now()) {
          return { ok: true, value: insightsCache.value }
        }
        const value = await fetchWakatimeInsights(settings, range)
        insightsCache = { key, expiresAt: Date.now() + 5 * 60_000, value }
        return { ok: true, value }
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

        if (input.clearApiKey === true) writeWakatimeApiKey(null)
        else if (typeof input.apiKey === 'string' && input.apiKey.trim().length > 0) {
          writeWakatimeApiKey(input.apiKey)
        }
        writePersistedWakatimeConfig(patch)
        config = next
        settings = readWakatimeSettings()
        usageCache = undefined
        insightsCache = undefined
        updateRuntimeConfig(next)
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
}
