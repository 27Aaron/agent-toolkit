import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readLastSyncAt, SyncRateLimiter, syncStateFile } from '../src/state.ts'

const directories: string[] = []

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-08-28T00:00:00Z'))
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function stateDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-state-'))
  directories.push(directory)
  return directory
}

describe('SyncRateLimiter', () => {
  it('commits a successful scan and rate-limits all other instances', async () => {
    const directory = stateDir()
    const first = await new SyncRateLimiter(directory).acquire(60_000, false)
    expect(first.lease).toBeDefined()
    first.lease?.finish(true)
    expect(readLastSyncAt(syncStateFile(directory))).toBe(Date.now())

    const peer = new SyncRateLimiter(directory)
    const blocked = await peer.acquire(60_000, false)
    expect(blocked).toEqual({ retryAfterMs: 60_000 })
    await vi.advanceTimersByTimeAsync(60_000)
    const next = await peer.acquire(60_000, false)
    expect(next.lease).toBeDefined()
    next.lease?.finish(false)
  })

  it('does not consume the interval after a failed scan', async () => {
    const limiter = new SyncRateLimiter(stateDir())
    const first = await limiter.acquire(60_000, false)
    first.lease?.finish(false)
    const second = await limiter.acquire(60_000, false)
    expect(second.lease).toBeDefined()
    second.lease?.finish(false)
  })

  it('allows force to bypass cadence but never an active lease', async () => {
    const directory = stateDir()
    const owner = new SyncRateLimiter(directory)
    const peer = new SyncRateLimiter(directory)
    const held = await owner.acquire(60_000, false)
    expect(await peer.acquire(60_000, false)).toEqual({ retryAfterMs: 250 })
    expect(await peer.acquire(60_000, true)).toEqual({ retryAfterMs: 250 })
    held.lease?.finish(true)

    const forced = await peer.acquire(60_000, true)
    expect(forced.lease).toBeDefined()
    forced.lease?.finish(false)
  })

  it('waits for a held lease to finish before granting a forced attempt', async () => {
    const limiter = new SyncRateLimiter(stateDir())
    const held = await limiter.acquire(60_000, false)
    const forced = limiter.acquire(60_000, true, 1_000)
    const settled = vi.fn()
    void forced.then(settled)
    await vi.advanceTimersByTimeAsync(250)
    expect(settled).not.toHaveBeenCalled()
    held.lease?.finish(true)
    await vi.advanceTimersByTimeAsync(250)
    const acquired = await forced
    expect(acquired.lease).toBeDefined()
    acquired.lease?.finish(false)
  })

  it('returns a retry after the bounded force wait expires', async () => {
    const limiter = new SyncRateLimiter(stateDir())
    const held = await limiter.acquire(60_000, false)
    const forced = limiter.acquire(60_000, true, 750)
    await vi.advanceTimersByTimeAsync(750)
    expect(await forced).toEqual({ retryAfterMs: 250 })
    held.lease?.finish(false)
  })

  it('uses one stable global filename without project state', () => {
    expect(syncStateFile('/data')).toBe(join('/data', 'native-sync.json'))
  })

  it('keeps a live owner even when its lock is older than the lease threshold', async () => {
    const directory = stateDir()
    const limiter = new SyncRateLimiter(directory)
    const held = await limiter.acquire(60_000, false)
    const lockFile = `${syncStateFile(directory)}.lock`
    const token = readFileSync(lockFile, 'utf8')
    const aged = new Date(Date.now() - 3_600_000)
    utimesSync(lockFile, aged, aged)

    expect(await new SyncRateLimiter(directory).acquire(60_000, true, 0, 1_000))
      .toEqual({ retryAfterMs: 250 })
    expect(readFileSync(lockFile, 'utf8')).toBe(token)
    held.lease?.finish(false)
  })

  it('reclaims an abandoned stale lock and acquires it in the same attempt', async () => {
    const directory = stateDir()
    const lockFile = `${syncStateFile(directory)}.lock`
    writeFileSync(lockFile, 'abandoned')
    const aged = new Date(Date.now() - 300_000)
    utimesSync(lockFile, aged, aged)

    const acquired = await new SyncRateLimiter(directory).acquire(60_000, false)
    expect(acquired.lease).toBeDefined()
    acquired.lease?.finish(false)
    expect(existsSync(lockFile)).toBe(false)
  })

  it('does not reclaim a young incomplete lock or one inside a long install window', async () => {
    const directory = stateDir()
    const lockFile = `${syncStateFile(directory)}.lock`
    const limiter = new SyncRateLimiter(directory)
    writeFileSync(lockFile, '')
    const now = new Date()
    utimesSync(lockFile, now, now)
    expect(await limiter.acquire(60_000, true)).toEqual({ retryAfterMs: 250 })

    const aged = new Date(Date.now() - 140_000)
    utimesSync(lockFile, aged, aged)
    expect(await limiter.acquire(60_000, true, 0, 450_000)).toEqual({ retryAfterMs: 250 })
  })

  it('finishes only once and does not release a peer lease', async () => {
    const directory = stateDir()
    const limiter = new SyncRateLimiter(directory)
    const first = await limiter.acquire(60_000, false)
    first.lease?.finish(true)
    const committed = readLastSyncAt(syncStateFile(directory))
    const second = await limiter.acquire(60_000, true)
    first.lease?.finish(true, committed + 10_000)
    expect(readLastSyncAt(syncStateFile(directory))).toBe(committed)
    expect(await limiter.acquire(60_000, true)).toEqual({ retryAfterMs: 250 })
    second.lease?.finish(false)
  })

  it('does not remove a replacement lock when releasing an older lease', async () => {
    const directory = stateDir()
    const limiter = new SyncRateLimiter(directory)
    const first = await limiter.acquire(60_000, false)
    const lockFile = `${syncStateFile(directory)}.lock`
    writeFileSync(lockFile, 'replacement')
    first.lease?.finish(false)
    expect(readFileSync(lockFile, 'utf8')).toBe('replacement')
  })

  it('clamps retry delays when the clock steps backwards', async () => {
    const directory = stateDir()
    writeFileSync(syncStateFile(directory), JSON.stringify({ lastSyncAt: Date.now() + 3_600_000 }))
    const attempt = await new SyncRateLimiter(directory).acquire(120_000, false)
    expect(attempt).toEqual({ retryAfterMs: 120_000 })
  })

  it.each(['{', 'null', '[]', '{}', '{"lastSyncAt":-1}', '{"lastSyncAt":"123"}'])(
    'tolerates invalid persisted state: %s',
    raw => {
      const file = syncStateFile(stateDir())
      writeFileSync(file, raw)
      expect(readLastSyncAt(file)).toBe(0)
    },
  )
})
