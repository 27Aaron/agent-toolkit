import { mkdtempSync, rmSync } from 'node:fs'
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
})
