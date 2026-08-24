import * as fs from 'node:fs'
import * as path from 'node:path'
import { getPluginLogFilePath } from './paths.ts'

export interface HostLogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export class PluginLogger {
  constructor(
    private readonly host: HostLogger | undefined,
    private debugEnabled: boolean,
    private readonly logFile: string = getPluginLogFilePath(),
  ) {}

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled
  }

  debug(message: string): void {
    if (!this.debugEnabled) return
    this.write('DEBUG', message)
    this.host?.debug(`dsh-wakatime: ${message}`)
  }

  info(message: string): void {
    this.write('INFO', message)
    this.host?.info(`dsh-wakatime: ${message}`)
  }

  warn(message: string): void {
    this.write('WARN', message)
    this.host?.warn(`dsh-wakatime: ${message}`)
  }

  error(message: string): void {
    this.write('ERROR', message)
    this.host?.error(`dsh-wakatime: ${message}`)
  }

  exception(level: Exclude<Level, 'DEBUG' | 'INFO'>, error: unknown, prefix?: string): void {
    const detail = error instanceof Error ? error.message : String(error)
    const message = prefix === undefined ? detail : `${prefix}: ${detail}`
    if (level === 'ERROR') this.error(message)
    else this.warn(message)
  }

  private write(level: Level, message: string): void {
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true, mode: 0o700 })
      fs.appendFileSync(
        this.logFile,
        `[${new Date().toISOString()}][${level}] ${message.replace(/\0/g, '')}\n`,
        { encoding: 'utf8', mode: 0o600 },
      )
    } catch {
      // Metrics and logging are best-effort and must never break the harness.
    }
  }
}
