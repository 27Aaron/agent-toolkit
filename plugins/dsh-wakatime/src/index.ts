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
  type Config as ConfigShape,
} from './config.ts'
import { HeartbeatDispatcher } from './heartbeat.ts'
import { PluginLogger } from './logger.ts'
import { readWakatimeSettings } from './settings.ts'
import { HeartbeatRateLimiter } from './state.ts'
import { WakatimeTracker } from './tracker.ts'

export { Config, name }
export type { Config as WakatimeConfig, WakatimeCategory } from './config.ts'

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
  const config = resolveConfig(rawConfig)
  const settings = readWakatimeSettings()
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
  const tracker = new WakatimeTracker(
    config,
    new HeartbeatRateLimiter(),
    heartbeats => dispatcher.send(heartbeats),
    logger,
  )
  logger.info(`initialized (${pluginTag})`)

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
