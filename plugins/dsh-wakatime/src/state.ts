import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getPluginDataDir } from './paths.ts'

interface PersistedState {
  lastSyncAt?: number
}

export interface RateLimitLease {
  finish(success: boolean, now?: number): void
}

export type RateLimitAttempt =
  | { lease: RateLimitLease; retryAfterMs?: never }
  | { lease?: never; retryAfterMs: number }

const LOCK_RETRY_MS = 250

/** One native CLI invocation scans all sessions, regardless of project. */
export function syncStateFile(stateDir: string = getPluginDataDir()): string {
  return path.join(stateDir, 'native-sync.json')
}

export function readLastSyncAt(stateFile: string): number {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as PersistedState
    return typeof parsed.lastSyncAt === 'number'
      && Number.isFinite(parsed.lastSyncAt)
      && parsed.lastSyncAt >= 0
      ? parsed.lastSyncAt
      : 0
  } catch {
    return 0
  }
}

function atomicWriteState(stateFile: string, lastSyncAt: number, token: string): void {
  const directory = path.dirname(stateFile)
  const temporary = path.join(directory, `.${path.basename(stateFile)}.${token}.tmp`)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    fs.writeFileSync(temporary, JSON.stringify({ lastSyncAt }), { flag: 'wx', mode: 0o600 })
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

function ownerIsAlive(token: string): boolean {
  const pid = Number(token.split('-', 1)[0])
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 0x7fff_ffff) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM and unexpected errors do not establish that the owner is dead.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

export class SyncRateLimiter {
  constructor(private readonly stateDir: string = getPluginDataDir()) {}

  async acquire(
    intervalMs: number,
    force: boolean,
    maxWaitMs: number = 0,
    leaseTimeoutMs: number = 60_000,
  ): Promise<RateLimitAttempt> {
    const stateFile = syncStateFile(this.stateDir)
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
        if (descriptor !== undefined) {
          fs.closeSync(descriptor)
          // Opening succeeded but writing failed; do not strand our new lock.
          try {
            fs.unlinkSync(lockFile)
          } catch {
            // Best-effort cleanup of a failed acquisition.
          }
        }
        if (!isAlreadyExists(error)) throw error
        if (this.removeStaleLock(lockFile, staleAfterMs)) continue
        // Force bypasses the interval, never another live native scan. The
        // transcript remains the retry source, so skipping is safe here.
        if (!force || Date.now() >= deadline) return { retryAfterMs: LOCK_RETRY_MS }
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
      const lastSyncAt = readLastSyncAt(stateFile)
      // A clock rollback must not turn a retry delay into hours.
      const elapsedMs = Math.max(0, now - lastSyncAt)
      if (!force && lastSyncAt > 0 && elapsedMs < intervalMs) {
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
                  // Shared cadence is best-effort; the CLI already synced.
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

  private removeStaleLock(lockFile: string, staleAfterMs: number): boolean {
    try {
      const token = fs.readFileSync(lockFile, 'utf8')
      const stat = fs.statSync(lockFile)
      if (Date.now() - stat.mtimeMs <= staleAfterMs || ownerIsAlive(token)) return false
      // Avoid removing a replacement that appeared during the stale check.
      if (fs.readFileSync(lockFile, 'utf8') !== token) return false
      fs.unlinkSync(lockFile)
      return true
    } catch {
      // Missing, unreadable, or concurrently removed locks are retried normally.
      return false
    }
  }
}
