import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process'
import * as os from 'node:os'
import type { CliManager } from './cli.ts'
import type { PluginLogger } from './logger.ts'
import type { Heartbeat } from './tracker.ts'

const KILL_GRACE_MS = 2_000
const FINAL_RESOLVE_GRACE_MS = 1_000

/**
 * wakatime-cli's DeepSeek Harness parser emits every parsed heartbeat with
 * the fixed `ai coding` category and forces the same category onto matching
 * plugin heartbeats, so the category is not configurable: sending anything
 * else here would split one session across two categories once native
 * parsing is active.
 */
const HEARTBEAT_CATEGORY = 'ai coding'

interface HeartbeatProcessState {
  activeChildren: Set<ChildProcess>
  exitHookInstalled: boolean
}

const processStateKey = Symbol.for('@27aaron/dsh-wakatime/heartbeat-processes')
const processGlobals = globalThis as unknown as Record<symbol, HeartbeatProcessState | undefined>
const processState = processGlobals[processStateKey] ??= {
  activeChildren: new Set<ChildProcess>(),
  exitHookInstalled: false,
}
const activeChildren = processState.activeChildren

export function killActiveHeartbeatProcesses(): void {
  for (const child of activeChildren) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    try {
      child.kill('SIGKILL')
    } catch {
      // The child may have exited between the status check and signal.
    }
  }
}

if (!processState.exitHookInstalled) {
  processState.exitHookInstalled = true
  process.once('exit', killActiveHeartbeatProcesses)
}

function childEnvironment(): NodeJS.ProcessEnv | undefined {
  if (os.platform() === 'win32' || process.env.HOME || process.env.WAKATIME_HOME) return undefined
  return { ...process.env, WAKATIME_HOME: os.homedir() }
}

function spawnOptions(): SpawnOptions {
  return {
    stdio: ['pipe', 'ignore', 'ignore'],
    windowsHide: true,
    ...(childEnvironment() === undefined ? {} : { env: childEnvironment() }),
  }
}

export function formatArguments(binary: string, args: string[]): string {
  return [binary, ...args]
    .map(argument => argument.includes(' ')
      ? `"${argument.replace(/"/g, '\\"')}"`
      : argument)
    .join(' ')
}

export class HeartbeatDispatcher {
  private timeoutMs: number
  private lastAttemptAt = 0
  private lastSuccessAt = 0
  private lastError: string | undefined

  constructor(
    private readonly cli: CliManager,
    private readonly pluginTag: string,
    timeoutMs: number,
    private readonly logger: PluginLogger,
  ) {
    this.timeoutMs = timeoutMs
  }

  updateConfig(timeoutMs: number): void {
    this.timeoutMs = timeoutMs
  }

  status(): { lastAttemptAt?: number; lastSuccessAt?: number; lastError?: string } {
    return {
      ...(this.lastAttemptAt === 0 ? {} : { lastAttemptAt: this.lastAttemptAt }),
      ...(this.lastSuccessAt === 0 ? {} : { lastSuccessAt: this.lastSuccessAt }),
      ...(this.lastError === undefined ? {} : { lastError: this.lastError }),
    }
  }

  async send(heartbeats: Heartbeat[]): Promise<boolean> {
    if (heartbeats.length === 0) return true
    this.lastAttemptAt = Date.now()
    const binary = await this.cli.ensureInstalled()
    if (binary === undefined) {
      this.lastError = 'wakatime-cli is unavailable'
      this.logger.warn('heartbeat retained because wakatime-cli is unavailable')
      return false
    }

    const primary = heartbeats[0]!
    const extra = heartbeats.slice(1)
    const args = [
      '--entity', primary.entity,
      '--entity-type', 'file',
      '--category', HEARTBEAT_CATEGORY,
      '--plugin', this.pluginTag,
      '--project-folder', primary.projectFolder,
      '--time', String(primary.time),
      '--ai-line-changes', String(primary.lineChanges),
    ]
    if (primary.isWrite) args.push('--write')
    if (extra.length > 0) args.push('--extra-heartbeats')

    const extraPayload = extra.map(heartbeat => ({
      ai_line_changes: heartbeat.lineChanges,
      category: HEARTBEAT_CATEGORY,
      entity: heartbeat.entity,
      entity_type: 'file',
      ...(heartbeat.isWrite ? { is_write: true } : {}),
      time: heartbeat.time,
    }))

    this.logger.debug(`sending ${heartbeats.length} heartbeat(s): ${formatArguments(binary, args)}`)
    const success = await this.run(binary, args, extraPayload)
    if (success) {
      this.lastSuccessAt = Date.now()
      this.lastError = undefined
    } else {
      this.lastError = 'wakatime-cli failed to send the heartbeat'
    }
    return success
  }

  private run(binary: string, args: string[], extraPayload: unknown[]): Promise<boolean> {
    return new Promise(resolve => {
      let child: ChildProcess
      try {
        child = spawn(binary, args, spawnOptions())
      } catch (error) {
        this.logger.exception('WARN', error, 'could not spawn wakatime-cli')
        resolve(false)
        return
      }
      activeChildren.add(child)

      let settled = false
      let timedOut = false
      let timeoutTimer: NodeJS.Timeout | undefined
      let forceKillTimer: NodeJS.Timeout | undefined
      let finalTimer: NodeJS.Timeout | undefined

      const finish = (success: boolean): void => {
        if (settled) return
        settled = true
        if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
        if (forceKillTimer !== undefined) clearTimeout(forceKillTimer)
        if (finalTimer !== undefined) clearTimeout(finalTimer)
        activeChildren.delete(child)
        resolve(success)
      }

      child.once('error', error => {
        this.logger.exception('WARN', error, 'wakatime-cli process error')
        finish(false)
      })
      child.once('close', (code, signal) => {
        if (code !== 0 || timedOut) {
          const outcome = timedOut ? 'timed out' : signal === null ? `exited with code ${code}` : `ended by ${signal}`
          this.logger.warn(`wakatime-cli ${outcome}`)
        }
        finish(code === 0 && !timedOut)
      })
      child.stdin?.once('error', error => {
        this.logger.exception('WARN', error, 'wakatime-cli stdin error')
      })
      child.stdin?.end(extraPayload.length === 0 ? undefined : `${JSON.stringify(extraPayload)}\n`)

      timeoutTimer = setTimeout(() => {
        timedOut = true
        this.logger.warn(`wakatime-cli heartbeat timed out after ${this.timeoutMs}ms`)
        try {
          child.kill('SIGTERM')
        } catch {
          finish(false)
          return
        }
        forceKillTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try {
              child.kill('SIGKILL')
            } catch {
              // The final timer still guarantees settlement.
            }
          }
          finalTimer = setTimeout(() => finish(false), FINAL_RESOLVE_GRACE_MS)
        }, KILL_GRACE_MS)
      }, this.timeoutMs)
      timeoutTimer.unref()
    })
  }
}
