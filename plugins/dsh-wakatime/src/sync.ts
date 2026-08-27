import { type ChildProcess, type SpawnOptions, spawn } from 'node:child_process'
import type { CliManager } from './cli.ts'
import type { PluginLogger } from './logger.ts'
import { getHarnessHomeDir } from './paths.ts'
import type { WakatimeCliStatus } from './ui-contract.ts'

const KILL_GRACE_MS = 2_000
const FINAL_RESOLVE_GRACE_MS = 1_000
const MAX_COUNT_OUTPUT_BYTES = 1_024
const OFFLINE_SYNC_LIMIT = 1_000

interface CliRunResult {
  success: boolean
  stdout: string
}

interface SyncProcessState {
  activeChildren: Set<ChildProcess>
  exitHookInstalled: boolean
}

const processStateKey = Symbol.for('@27aaron/dsh-wakatime/sync-processes')
const processGlobals = globalThis as unknown as Record<symbol, SyncProcessState | undefined>
const processState = processGlobals[processStateKey] ??= {
  activeChildren: new Set<ChildProcess>(),
  exitHookInstalled: false,
}
const activeChildren = processState.activeChildren

export function killActiveSyncProcesses(): void {
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
  process.once('exit', killActiveSyncProcesses)
}

function spawnOptions(captureStdout: boolean): SpawnOptions {
  return {
    stdio: captureStdout ? ['ignore', 'pipe', 'ignore'] : 'ignore',
    windowsHide: true,
    // Harness expands ~ and relative DSH_HOME values; the Go parser does not.
    env: { ...process.env, DSH_HOME: getHarnessHomeDir() },
  }
}

export function formatArguments(binary: string, args: string[]): string {
  return [binary, ...args]
    .map(argument => argument.includes(' ')
      ? `"${argument.replace(/"/g, '\\"')}"`
      : argument)
    .join(' ')
}

export class NativeSyncDispatcher {
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

  async sync(): Promise<boolean> {
    this.lastAttemptAt = Date.now()
    let cli: WakatimeCliStatus
    try {
      cli = await this.cli.test()
    } catch (error) {
      this.lastError = 'could not verify wakatime-cli; native sync is pending'
      this.logger.exception('WARN', error, this.lastError)
      return false
    }
    if (cli.state !== 'ready' || cli.path === undefined) {
      this.lastError = 'wakatime-cli is unavailable; native sync is pending'
      this.logger.warn(this.lastError)
      return false
    }
    if (cli.nativeSync !== true) {
      this.lastError = `native sync requires a verified wakatime-cli >= v2.25.0 (found ${cli.version ?? 'unknown'})`
      this.logger.warn(this.lastError)
      return false
    }

    // These flags select different CLI commands, so they must not share one
    // invocation. AI sync can enqueue activity (even with exit 0); draining the
    // offline queue separately also retries earlier failed sends without any
    // new transcript events. Never manufacture a second set of file heartbeats.
    // The CLI defaults to a 120-second request timeout. Let its own request
    // handling fail and requeue before our process watchdog normally fires.
    // This is per HTTP request, not a total deadline across API destinations.
    const requestTimeoutSeconds = Math.max(1, Math.floor(this.timeoutMs / 3_000))
    const commonArgs = ['--plugin', this.pluginTag, '--timeout', String(requestTimeoutSeconds)]
    const ai = await this.run(cli.path, ['--sync-ai-activity', ...commonArgs])
    const offline = await this.run(cli.path, ['--sync-offline-activity', String(OFFLINE_SYNC_LIMIT), ...commonArgs])
    if (!ai.success || !offline.success) {
      this.lastError = ai.success ? 'wakatime-cli offline sync failed' : 'wakatime-cli AI sync failed'
      return false
    }

    // A bounded drain can succeed with activity still queued. Keep the
    // scheduler pending until a separate count confirms the queue is empty.
    const counted = await this.run(cli.path, ['--offline-count', '--plugin', this.pluginTag], true)
    if (!counted.success) {
      this.lastError = 'wakatime-cli offline count failed'
      return false
    }
    const output = counted.stdout.trim()
    const remaining = Number(output)
    if (!/^\d+$/.test(output) || !Number.isSafeInteger(remaining)) {
      this.lastError = 'wakatime-cli returned an invalid offline count'
      this.logger.warn(this.lastError)
      return false
    }

    this.lastError = undefined
    if (remaining > 0) {
      this.logger.debug(`native sync is pending with ${remaining} offline heartbeat(s) remaining`)
      return false
    }
    this.lastSuccessAt = Date.now()
    return true
  }

  private run(binary: string, args: string[], captureStdout = false): Promise<CliRunResult> {
    this.logger.debug(`syncing activity: ${formatArguments(binary, args)}`)
    return new Promise(resolve => {
      let child: ChildProcess
      try {
        child = spawn(binary, args, spawnOptions(captureStdout))
      } catch (error) {
        this.logger.exception('WARN', error, 'could not spawn wakatime-cli')
        resolve({ success: false, stdout: '' })
        return
      }
      activeChildren.add(child)

      let settled = false
      let timedOut = false
      let outputExceeded = false
      let terminating = false
      let stdout = ''
      let stdoutBytes = 0
      let timeoutTimer: NodeJS.Timeout | undefined
      let forceKillTimer: NodeJS.Timeout | undefined
      let finalTimer: NodeJS.Timeout | undefined

      const finish = (success: boolean): void => {
        if (settled) return
        settled = true
        if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
        if (forceKillTimer !== undefined) clearTimeout(forceKillTimer)
        if (finalTimer !== undefined) clearTimeout(finalTimer)
        child.stdout?.off('data', captureOutput)
        activeChildren.delete(child)
        resolve({ success, stdout })
      }

      const terminate = (): void => {
        if (settled || terminating) return
        terminating = true
        if (timeoutTimer !== undefined) clearTimeout(timeoutTimer)
        try {
          child.kill('SIGTERM')
        } catch {
          finish(false)
          return
        }
        if (settled) return
        forceKillTimer = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try {
              child.kill('SIGKILL')
            } catch {
              // The final timer still guarantees settlement.
            }
          }
          if (!settled) finalTimer = setTimeout(() => finish(false), FINAL_RESOLVE_GRACE_MS)
        }, KILL_GRACE_MS)
      }

      const captureOutput = (chunk: Buffer | string): void => {
        if (settled || outputExceeded) return
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        stdoutBytes += buffer.length
        if (stdoutBytes > MAX_COUNT_OUTPUT_BYTES) {
          outputExceeded = true
          this.logger.warn('wakatime-cli offline count output exceeded 1 KiB')
          terminate()
          return
        }
        stdout += buffer.toString('utf8')
      }

      child.once('error', error => {
        this.logger.exception('WARN', error, 'wakatime-cli process error')
        finish(false)
      })
      child.once('close', (code, signal) => {
        if (code !== 0 || timedOut || outputExceeded) {
          const outcome = timedOut ? 'timed out' : outputExceeded ? 'exceeded its output limit' : signal === null ? `exited with code ${code}` : `ended by ${signal}`
          this.logger.warn(`wakatime-cli ${outcome}`)
        }
        finish(code === 0 && !timedOut && !outputExceeded)
      })
      if (captureStdout) child.stdout?.on('data', captureOutput)
      timeoutTimer = setTimeout(() => {
        timedOut = true
        this.logger.warn(`wakatime-cli sync timed out after ${this.timeoutMs}ms`)
        terminate()
      }, this.timeoutMs)
      timeoutTimer.unref()
    })
  }
}
