import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getPluginDataDir } from './paths.ts'

interface PersistedState {
  lastHeartbeatAt?: number
}

export interface RateLimitLease {
  finish(success: boolean, now?: number): void
}

export type RateLimitAttempt =
  | { lease: RateLimitLease; retryAfterMs?: never }
  | { lease?: never; retryAfterMs: number }

const LOCK_RETRY_MS = 250

function projectKey(projectFolder: string): string {
  return crypto.createHash('sha256').update(projectFolder).digest('hex').slice(0, 24)
}

export function stateFileFor(projectFolder: string, stateDir: string = getPluginDataDir()): string {
  return path.join(stateDir, `${projectKey(projectFolder)}.json`)
}

export function readLastHeartbeatAt(stateFile: string): number {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as PersistedState
    return typeof parsed.lastHeartbeatAt === 'number'
      && Number.isFinite(parsed.lastHeartbeatAt)
      && parsed.lastHeartbeatAt >= 0
      ? parsed.lastHeartbeatAt
      : 0
  } catch {
    return 0
  }
}

function atomicWriteState(stateFile: string, lastHeartbeatAt: number, token: string): void {
  const directory = path.dirname(stateFile)
  const temporary = path.join(directory, `.${path.basename(stateFile)}.${token}.tmp`)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    fs.writeFileSync(temporary, JSON.stringify({ lastHeartbeatAt }), { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, stateFile)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The rename normally consumed the temporary file.
    }
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST'
}

export class HeartbeatRateLimiter {
  constructor(private readonly stateDir: string = getPluginDataDir()) {}

  async acquire(
    projectFolder: string,
    intervalMs: number,
    force: boolean,
    maxWaitMs: number = 0,
    leaseTimeoutMs: number = 60_000,
  ): Promise<RateLimitAttempt> {
    const stateFile = stateFileFor(projectFolder, this.stateDir)
    const lockFile = `${stateFile}.lock`
    const deadline = Date.now() + (force ? Math.max(0, maxWaitMs) : 0)
    const staleAfterMs = Math.max(leaseTimeoutMs + 5_000, maxWaitMs * 2, 60_000)

    fs.mkdirSync(this.stateDir, { recursive: true, mode: 0o700 })

    while (true) {
      const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`
      let descriptor: number | undefined
      try {
        descriptor = fs.openSync(lockFile, 'wx', 0o600)
        fs.writeFileSync(descriptor, token, 'utf8')
      } catch (error) {
        if (descriptor !== undefined) fs.closeSync(descriptor)
        if (!isAlreadyExists(error)) throw error
        this.removeStaleLock(lockFile, staleAfterMs)
        if (!force) return { retryAfterMs: LOCK_RETRY_MS }
        if (Date.now() >= deadline) {
          // A final session flush owns activity that another process cannot
          // reproduce. Deliver it without changing shared cadence state rather
          // than dropping it behind a long-running peer.
          return { lease: { finish(): void {} } }
        }
        await sleep(Math.min(LOCK_RETRY_MS, Math.max(1, deadline - Date.now())))
        continue
      }

      const release = (): void => {
        try {
          if (fs.readFileSync(lockFile, 'utf8') === token) fs.unlinkSync(lockFile)
        } catch {
          // A concurrent cleanup or process shutdown may already have removed it.
        }
        try {
          fs.closeSync(descriptor)
        } catch {
          // The descriptor is best-effort cleanup only.
        }
      }

      const now = Date.now()
      const lastHeartbeatAt = readLastHeartbeatAt(stateFile)
      // A clock rollback (e.g. an NTP correction) must not inflate the retry
      // delay into hours: treat a future timestamp as elapsed-0, which caps
      // the retry at one full interval.
      const elapsedMs = Math.max(0, now - lastHeartbeatAt)
      if (!force && elapsedMs < intervalMs) {
        release()
        return { retryAfterMs: Math.min(intervalMs, Math.max(1, intervalMs - elapsedMs)) }
      }

      let finished = false
      return {
        lease: {
          finish(success: boolean, committedAt: number = Date.now()): void {
            if (finished) return
            finished = true
            try {
              if (success) {
                try {
                  atomicWriteState(stateFile, committedAt, token)
                } catch {
                  // Rate-limit state is a best-effort hint; delivery already succeeded.
                }
              }
            } finally {
              release()
            }
          },
        },
      }
    }
  }

  private removeStaleLock(lockFile: string, staleAfterMs: number): void {
    try {
      const stat = fs.statSync(lockFile)
      if (Date.now() - stat.mtimeMs <= staleAfterMs) return
      fs.unlinkSync(lockFile)
    } catch {
      // Missing, unreadable, or concurrently removed locks are retried normally.
    }
  }
}
