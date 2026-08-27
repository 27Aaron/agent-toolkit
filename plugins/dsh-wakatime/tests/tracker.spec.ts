import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PluginLogger } from '../src/logger.ts'
import { SyncRateLimiter } from '../src/state.ts'
import { WakatimeTracker, type TrackerConfig } from '../src/tracker.ts'

const directories: string[] = []
const config: TrackerConfig = {
  heartbeatIntervalMs: 60_000,
  heartbeatTimeoutMs: 1_000,
  cliDownloadTimeoutMs: 1_000,
}

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
  const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-tracker-'))
  directories.push(directory)
  return directory
}

function setup(sender: () => Promise<boolean>, directory = stateDir()) {
  const logger = new PluginLogger(undefined, true, join(directory, 'test.log'))
  const limiter = new SyncRateLimiter(join(directory, 'state'))
  const tracker = new WakatimeTracker(config, limiter, sender, logger)
  return { tracker, limiter, logger }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function tick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

describe('WakatimeTracker', () => {
  it('coalesces events into native scans and respects the shared interval', async () => {
    const send = vi.fn(async () => true)
    const { tracker } = setup(send)
    tracker.record()
    tracker.record()
    tracker.record()
    await tick()
    expect(send).toHaveBeenCalledExactlyOnceWith()
    expect(tracker.status()).toEqual({ pendingSync: false })

    tracker.record()
    await tick()
    expect(send).toHaveBeenCalledTimes(1)
    expect(tracker.status()).toEqual({ pendingSync: true })
    await vi.advanceTimersByTimeAsync(59_999)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('manual flush discovers activity even when idle and bypasses the interval', async () => {
    const send = vi.fn(async () => true)
    const { tracker, limiter } = setup(send)
    const acquire = vi.spyOn(limiter, 'acquire')
    await tracker.flush()
    await tracker.flush()
    expect(send).toHaveBeenCalledTimes(2)
    expect(acquire.mock.calls.every(call => call[1] === true)).toBe(true)
    await tracker.dispose()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not clear new events when an older in-flight scan succeeds', async () => {
    const first = deferred<boolean>()
    const send = vi.fn<() => Promise<boolean>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(true)
    const { tracker } = setup(send)
    tracker.record()
    await tick()
    tracker.record()
    tracker.record()
    await tick()
    expect(send).toHaveBeenCalledTimes(1)

    first.resolve(true)
    await tick()
    expect(tracker.status()).toEqual({ pendingSync: true })
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('flush waits for the current scan, then covers events at its settlement boundary', async () => {
    const first = deferred<boolean>()
    const send = vi.fn<() => Promise<boolean>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(true)
    const { tracker, limiter } = setup(send)
    const acquire = limiter.acquire.bind(limiter)
    let firstLease = true
    vi.spyOn(limiter, 'acquire').mockImplementation(async (...args) => {
      const attempt = await acquire(...args)
      if (attempt.lease !== undefined && firstLease) {
        firstLease = false
        const finish = attempt.lease.finish
        attempt.lease.finish = (success, now) => {
          finish(success, now)
          queueMicrotask(() => tracker.record())
        }
      }
      return attempt
    })
    tracker.record()
    await tick()
    const flushed = tracker.flush()
    first.resolve(true)
    await flushed
    expect(send).toHaveBeenCalledTimes(2)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('serializes concurrent manual flushes and includes events received in flight', async () => {
    const first = deferred<boolean>()
    const second = deferred<boolean>()
    let active = 0
    let peak = 0
    let calls = 0
    const send = vi.fn(async () => {
      active += 1
      peak = Math.max(peak, active)
      calls += 1
      const result = calls === 1 ? first.promise : calls === 2 ? second.promise : Promise.resolve(true)
      try {
        return await result
      } finally {
        active -= 1
      }
    })
    const { tracker } = setup(send)
    tracker.record()
    await tick()
    const flushedA = tracker.flush()
    const flushedB = tracker.flush()
    first.resolve(true)
    await tick()
    expect(send).toHaveBeenCalledTimes(2)
    tracker.record()
    second.resolve(true)
    await Promise.all([flushedA, flushedB])
    expect(send).toHaveBeenCalledTimes(3)
    expect(peak).toBe(1)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('retains failed work and does not let new events defeat the retry backoff', async () => {
    const send = vi.fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    const { tracker } = setup(send)
    tracker.record()
    await tick()
    expect(tracker.status()).toEqual({ pendingSync: true })
    await vi.advanceTimersByTimeAsync(10_000)
    tracker.record()
    await tick()
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(19_999)
    expect(send).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('releases the lease after a thrown dispatcher error and retries', async () => {
    const error = new Error('native sync unavailable')
    const send = vi.fn<() => Promise<boolean>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(true)
    const { tracker, logger } = setup(send)
    const exception = vi.spyOn(logger, 'exception')
    tracker.record()
    await tick()
    expect(exception).toHaveBeenCalledWith('WARN', error, 'native sync dispatcher failed')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).toHaveBeenCalledTimes(2)
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('retains dirty state when acquiring the shared state fails', async () => {
    const send = vi.fn(async () => true)
    const { tracker, limiter } = setup(send)
    vi.spyOn(limiter, 'acquire').mockRejectedValueOnce(new Error('state directory unavailable'))
    tracker.record()
    await tick()
    expect(send).not.toHaveBeenCalled()
    expect(tracker.status()).toEqual({ pendingSync: true })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(send).toHaveBeenCalledOnce()
    expect(tracker.status()).toEqual({ pendingSync: false })
    await tracker.dispose()
  })

  it('does not keep a pending retry timer referenced', async () => {
    const send = vi.fn(async () => false)
    const { tracker } = setup(send)
    const setTimer = vi.spyOn(globalThis, 'setTimeout')
    tracker.record()
    await tick()
    const timer = setTimer.mock.results[0]?.value as NodeJS.Timeout
    expect(timer.hasRef()).toBe(false)
    await tracker.dispose()
  })

  it('disposes idle trackers without creating work', async () => {
    const send = vi.fn(async () => true)
    const { tracker } = setup(send)
    await tracker.dispose()
    tracker.record()
    await tracker.flush()
    expect(send).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits for an in-flight scan and permits two bounded shutdown retries', async () => {
    const first = deferred<boolean>()
    const send = vi.fn<() => Promise<boolean>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true)
    const { tracker } = setup(send)
    tracker.record()
    await tick()
    const disposed = tracker.dispose()
    expect(tracker.dispose()).toBe(disposed)
    tracker.record()
    first.resolve(false)
    await disposed
    expect(send).toHaveBeenCalledTimes(3)
    expect(tracker.status()).toEqual({ pendingSync: false })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops retrying at shutdown without claiming durable activity was discarded', async () => {
    const send = vi.fn(async () => false)
    const { tracker, logger } = setup(send)
    const warn = vi.spyOn(logger, 'warn')
    tracker.record()
    await tick()
    await tracker.dispose()
    expect(send).toHaveBeenCalledTimes(3)
    expect(tracker.status()).toEqual({ pendingSync: true })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/transcripts remain available/))
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('shares serialization and cadence across independent tracker instances', async () => {
    const directory = stateDir()
    const first = deferred<boolean>()
    const sendA = vi.fn(() => first.promise)
    const sendB = vi.fn(async () => true)
    const { tracker: trackerA } = setup(sendA, directory)
    const { tracker: trackerB } = setup(sendB, directory)
    trackerA.record()
    await tick()
    trackerB.record()
    await tick()
    expect(sendA).toHaveBeenCalledOnce()
    expect(sendB).not.toHaveBeenCalled()

    first.resolve(true)
    await tick()
    await vi.advanceTimersByTimeAsync(250)
    expect(sendB).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(59_750)
    expect(sendB).toHaveBeenCalledOnce()
    expect(trackerB.status()).toEqual({ pendingSync: false })
    await Promise.all([trackerA.dispose(), trackerB.dispose()])
  })

  it('does not bypass another live scan during a forced flush', async () => {
    const directory = stateDir()
    const first = deferred<boolean>()
    const sendA = vi.fn(() => first.promise)
    const sendB = vi.fn(async () => true)
    const { tracker: trackerA } = setup(sendA, directory)
    const { tracker: trackerB } = setup(sendB, directory)
    trackerA.record()
    await tick()
    const flushed = trackerB.flush()
    await vi.advanceTimersByTimeAsync(2_000)
    await flushed
    expect(sendB).not.toHaveBeenCalled()
    expect(trackerB.status()).toEqual({ pendingSync: true })

    first.resolve(true)
    await tick()
    await trackerB.dispose()
    expect(sendB).toHaveBeenCalledOnce()
    await trackerA.dispose()
  })

  it('covers persistence, CLI installation, sync and queue-count processes in the lease', async () => {
    const send = vi.fn(async () => true)
    const { tracker, limiter } = setup(send)
    tracker.updateConfig({
      heartbeatIntervalMs: 5_000,
      heartbeatTimeoutMs: 30_000,
      cliDownloadTimeoutMs: 120_000,
    })
    const acquire = vi.spyOn(limiter, 'acquire')
    tracker.record()
    await tick()
    expect(acquire).toHaveBeenCalledWith(5_000, false, 0, 510_000)
    tracker.record()
    await tick()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(send).toHaveBeenCalledTimes(2)
    await tracker.dispose()
  })
})
