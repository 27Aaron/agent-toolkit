import { mkdtempSync, rmSync, statSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PluginLogger } from '../src/logger.ts'
import { HeartbeatRateLimiter } from '../src/state.ts'
import { WakatimeTracker, type Heartbeat } from '../src/tracker.ts'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function setup(sender: (batch: Heartbeat[]) => Promise<boolean>, maxPendingFiles = 10) {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-tracker-'))
  directories.push(directory)
  const logger = new PluginLogger(undefined, true, join(directory, 'test.log'))
  return new WakatimeTracker(
    {
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 1_000,
      cliDownloadTimeoutMs: 1_000,
      maxPendingFiles,
    },
    new HeartbeatRateLimiter(join(directory, 'state')),
    sender,
    logger,
  )
}

function tick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

describe('WakatimeTracker', () => {
  it('aggregates pending changes and force-flushes inside the interval', async () => {
    const send = vi.fn(async (_batch: Heartbeat[]) => true)
    const tracker = setup(send)
    tracker.record('/repo', [{ file: '/repo/a.ts', lineChanges: 1, isWrite: false }], 10)
    await tick()
    expect(send).toHaveBeenCalledTimes(1)

    tracker.record('/repo', [{ file: '/repo/b.ts', lineChanges: -1, isWrite: true }], 20)
    await tick()
    expect(send).toHaveBeenCalledTimes(1)
    await tracker.flushProject('/repo')
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0]).toEqual([{
      entity: '/repo/b.ts',
      projectFolder: '/repo',
      lineChanges: -1,
      isWrite: true,
      time: 20,
    }])
    await tracker.dispose()
  })

  it('restores a failed batch before a forced retry', async () => {
    const send = vi.fn<(batch: Heartbeat[]) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const tracker = setup(send)
    tracker.record('/repo', [{ file: '/repo/a.ts', lineChanges: 2, isWrite: false }])
    await tick()
    expect(send).toHaveBeenCalledTimes(1)
    await tracker.flushProject('/repo')
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]![0][0]).toMatchObject({ entity: '/repo/a.ts', lineChanges: 2 })
    await tracker.dispose()
  })

  it('waits for an in-flight batch and retries it during disposal', async () => {
    let finishFirst: ((success: boolean) => void) | undefined
    const send = vi.fn<(batch: Heartbeat[]) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockResolvedValueOnce(true)
    const tracker = setup(send)
    tracker.record('/repo', [{ file: '/repo/a.ts', lineChanges: 1, isWrite: false }])
    await tick()
    const disposed = tracker.dispose()
    finishFirst?.(false)
    await disposed
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]?.[0]?.[0]).toMatchObject({ entity: '/repo/a.ts', lineChanges: 1 })
  })

  it('bounds distinct pending files while still merging an existing entity', async () => {
    const send = vi.fn(async (_batch: Heartbeat[]) => true)
    const tracker = setup(send, 1)
    tracker.record('/repo', [
      { file: '/repo/a.ts', lineChanges: 1, isWrite: false },
      { file: '/repo/a.ts', lineChanges: 2, isWrite: true },
      { file: '/repo/b.ts', lineChanges: 3, isWrite: false },
    ])
    await tick()
    expect(send.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ entity: '/repo/a.ts', lineChanges: 3, isWrite: true }),
    ])
    await tracker.dispose()
  })

  it('keeps a live lease that is still inside the install window', async () => {
    // Real production values: a flush can hold the lease across a full CLI
    // download (120s) plus one heartbeat process lifetime (30s). A lock aged
    // 140s therefore belongs to a live holder and must not be broken.
    const stateDir = mkdtempSync(join(tmpdir(), 'dsh-waka-stale-'))
    directories.push(stateDir)
    const config = {
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 30_000,
      cliDownloadTimeoutMs: 120_000,
      maxPendingFiles: 10,
    }
    let finishFirst: ((success: boolean) => void) | undefined
    const sendA = vi.fn<(batch: Heartbeat[]) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
      .mockResolvedValue(false)
    const sendB = vi.fn(async (_batch: Heartbeat[]) => false)
    const trackerA = new WakatimeTracker(
      config,
      new HeartbeatRateLimiter(join(stateDir, 'state')),
      sendA,
      new PluginLogger(undefined, true, join(stateDir, 'a.log')),
    )
    const trackerB = new WakatimeTracker(
      config,
      new HeartbeatRateLimiter(join(stateDir, 'state')),
      sendB,
      new PluginLogger(undefined, true, join(stateDir, 'b.log')),
    )

    trackerA.record('/repo', [{ file: '/repo/a.ts', lineChanges: 1, isWrite: false }], 10)
    await tick()
    expect(sendA).toHaveBeenCalledTimes(1)

    // Age the live lock to 140s — older than max(30s, 120s)+5s, younger than
    // 30s+120s+5s — then let a second session flush the same project.
    // utimesSync needs Date objects; plain numbers are interpreted as seconds.
    const { stateFileFor } = await import('../src/state.ts')
    const lockFile = `${stateFileFor('/repo', join(stateDir, 'state'))}.lock`
    const aged = new Date(Date.now() - 140_000)
    utimesSync(lockFile, aged, aged)
    expect(Date.now() - statSync(lockFile).mtimeMs).toBeGreaterThan(139_000)

    trackerB.record('/repo', [{ file: '/repo/b.ts', lineChanges: 1, isWrite: false }], 10)
    await tick()
    // The limiter returns a 250ms retry on EEXIST; with the too-low stale
    // threshold the old code has already broken the live lock, so B's retry
    // double-sends within the window below. The fixed threshold keeps the
    // lease alive across retries.
    await new Promise(resolve => setTimeout(resolve, 700))
    expect(sendB).not.toHaveBeenCalled()

    finishFirst?.(false)
    await trackerA.dispose()
    await trackerB.dispose()
  })

  it('warns when heartbeats are discarded after final disposal retries', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-discard-'))
    directories.push(directory)
    const logger = new PluginLogger(undefined, true, join(directory, 'test.log'))
    const warn = vi.spyOn(logger, 'warn')
    const send = vi.fn(async (_batch: Heartbeat[]) => false)
    const tracker = new WakatimeTracker(
      { heartbeatIntervalMs: 60_000, heartbeatTimeoutMs: 1_000, cliDownloadTimeoutMs: 1_000, maxPendingFiles: 10 },
      new HeartbeatRateLimiter(join(directory, 'state')),
      send,
      logger,
    )

    tracker.record('/repo', [{ file: '/repo/a.ts', lineChanges: 1, isWrite: false }], 10)
    await tick()
    await tracker.dispose()

    expect(send.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/discard/i))
  })
})
