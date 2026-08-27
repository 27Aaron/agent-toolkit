import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawn: spawnMock,
}))

import type { CliManager } from '../src/cli.ts'
import { NativeSyncDispatcher, killActiveSyncProcesses } from '../src/sync.ts'
import { PluginLogger } from '../src/logger.ts'

function fakeChild() {
  const stdout = new PassThrough()
  const child = Object.assign(new EventEmitter(), {
    kill: vi.fn(), exitCode: null as number | null, signalCode: null as NodeJS.Signals | null,
    stdout,
  })
  return {
    child: child as unknown as ChildProcess,
    stdout,
    close(code: number | null, signal: NodeJS.Signals | null = null) {
      child.exitCode = code
      child.signalCode = signal
      child.emit('close', code, signal)
    },
  }
}

function dispatcher(kind: 'ready' | 'old' | 'unknown' | 'missing' = 'ready', timeoutMs = 5_000) {
  const nativeSync = kind === 'ready' ? true : kind === 'old' ? false : undefined
  const available = kind !== 'missing'
  const cli = {
    test: vi.fn(async () => ({
      state: available ? 'ready' : 'missing',
      path: available ? '/usr/local/bin/wakatime-cli' : undefined,
      version: nativeSync === true ? 'v2.25.0' : nativeSync === false ? 'v2.24.0' : '<local-build>',
      nativeSync,
    })),
  } as unknown as CliManager
  return new NativeSyncDispatcher(
    cli,
    'deepseek-harness/0.1.0 dsh-wakatime/0.3.1',
    timeoutMs,
    new PluginLogger(undefined, true, '/dev/null'),
  )
}

function autoCompleteCommands(countOutput: string | string[] = '0\n', countExitCode = 0): void {
  const counts = typeof countOutput === 'string' ? [countOutput] : [...countOutput]
  spawnMock.mockImplementation((_binary: string, args: string[]) => {
    const child = fakeChild()
    queueMicrotask(() => {
      if (args.includes('--offline-count')) {
        child.stdout.write(counts.shift() ?? '0\n')
        child.close(countExitCode)
      } else {
        child.close(0)
      }
    })
    return child.child
  })
}

beforeEach(() => { spawnMock.mockReset() })
afterEach(() => {
  killActiveSyncProcesses()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('NativeSyncDispatcher', () => {
  it('runs native AI parsing and offline draining as separate commands without synthetic heartbeats', async () => {
    const ai = fakeChild()
    const offline = fakeChild()
    const count = fakeChild()
    spawnMock.mockReturnValueOnce(ai.child).mockReturnValueOnce(offline.child).mockReturnValueOnce(count.child)
    const sender = dispatcher()
    const pending = sender.sync()
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
    expect(spawnMock.mock.calls[0]![1]).toEqual([
      '--sync-ai-activity', '--plugin', 'deepseek-harness/0.1.0 dsh-wakatime/0.3.1', '--timeout', '1',
    ])
    ai.close(0)
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2))
    expect(spawnMock.mock.calls[1]![1]).toEqual([
      '--sync-offline-activity', '1000', '--plugin', 'deepseek-harness/0.1.0 dsh-wakatime/0.3.1', '--timeout', '1',
    ])
    offline.close(0)
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(3))
    expect(spawnMock.mock.calls[2]![1]).toEqual([
      '--offline-count', '--plugin', 'deepseek-harness/0.1.0 dsh-wakatime/0.3.1',
    ])
    count.stdout.write('0\n')
    count.close(0)
    await expect(pending).resolves.toBe(true)
    expect(sender.status().lastSuccessAt).toBeGreaterThan(0)
    expect(sender.status().lastError).toBeUndefined()
    expect(spawnMock.mock.calls[0]![2].stdio).toBe('ignore')
    expect(spawnMock.mock.calls[2]![2].stdio).toEqual(['ignore', 'pipe', 'ignore'])
    expect(count.stdout.listenerCount('data')).toBe(0)
    const argumentsSent = spawnMock.mock.calls.flatMap(call => call[1] as string[])
    expect(argumentsSent).not.toContain('--entity')
    expect(argumentsSent).not.toContain('--extra-heartbeats')
    expect(argumentsSent).not.toContain('--ai-line-changes')
  })

  it('sets a shorter CLI request timeout for both sending phases', async () => {
    autoCompleteCommands()
    await expect(dispatcher('ready', 30_000).sync()).resolves.toBe(true)
    for (const call of spawnMock.mock.calls.slice(0, 2)) {
      const args = call[1] as string[]
      expect(args[args.indexOf('--timeout') + 1]).toBe('10')
    }
  })

  it.each(['old', 'unknown'] as const)('does not fall back to file heartbeats for unverified native support (%s)', async kind => {
    const sender = dispatcher(kind)
    await expect(sender.sync()).resolves.toBe(false)
    expect(spawnMock).not.toHaveBeenCalled()
    expect(sender.status().lastError).toMatch(/verified wakatime-cli >= v2\.25\.0/)
  })

  it('retains pending sync when the CLI is missing', async () => {
    await expect(dispatcher('missing').sync()).resolves.toBe(false)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('records CLI verification failures without spawning or rejecting', async () => {
    const sender = dispatcher()
    const cli = (sender as unknown as { cli: CliManager }).cli
    vi.mocked(cli.test).mockRejectedValue(new Error('version check failed'))
    await expect(sender.sync()).resolves.toBe(false)
    expect(spawnMock).not.toHaveBeenCalled()
    expect(sender.status().lastAttemptAt).toBeGreaterThan(0)
    expect(sender.status().lastError).toContain('could not verify wakatime-cli')
  })

  it.each([[2, 0, 'AI'], [0, 2, 'offline']])('reports failed phases and still drains the queue (%s, %s)', async (aiCode, offlineCode, phase) => {
    const ai = fakeChild()
    const offline = fakeChild()
    spawnMock.mockReturnValueOnce(ai.child).mockReturnValueOnce(offline.child)
    const sender = dispatcher()
    const pending = sender.sync()
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(1))
    ai.close(aiCode as number)
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledTimes(2))
    offline.close(offlineCode as number)
    await expect(pending).resolves.toBe(false)
    expect(sender.status().lastSuccessAt).toBeUndefined()
    expect(sender.status().lastError).toContain(`${phase} sync failed`)
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('keeps successful bounded drains pending until the remaining count reaches zero', async () => {
    autoCompleteCommands(['17\n', '7\n', '0\n'])
    const sender = dispatcher()
    await expect(sender.sync()).resolves.toBe(false)
    expect(sender.status().lastError).toBeUndefined()
    expect(sender.status().lastSuccessAt).toBeUndefined()
    await expect(sender.sync()).resolves.toBe(false)
    expect(sender.status().lastError).toBeUndefined()
    await expect(sender.sync()).resolves.toBe(true)
    expect(sender.status().lastSuccessAt).toBeGreaterThan(0)
    expect(spawnMock).toHaveBeenCalledTimes(9)
  })

  it.each(['', '-1\n', '1.5\n', '2\n0\n', 'NaN\n', '1e3\n', '9007199254740992\n'])(
    'retains pending sync for invalid offline count %j', async output => {
      autoCompleteCommands(output)
      const sender = dispatcher()
      await expect(sender.sync()).resolves.toBe(false)
      expect(sender.status().lastError).toContain('invalid offline count')
      expect(sender.status().lastSuccessAt).toBeUndefined()
    },
  )

  it('retains pending sync when offline count exits unsuccessfully', async () => {
    autoCompleteCommands('0\n', 2)
    const sender = dispatcher()
    await expect(sender.sync()).resolves.toBe(false)
    expect(sender.status().lastError).toBe('wakatime-cli offline count failed')
  })

  it('clears an earlier count error when a later bounded drain makes progress', async () => {
    autoCompleteCommands(['invalid\n', '4\n'])
    const sender = dispatcher()
    await expect(sender.sync()).resolves.toBe(false)
    expect(sender.status().lastError).toContain('invalid offline count')
    await expect(sender.sync()).resolves.toBe(false)
    expect(sender.status().lastError).toBeUndefined()
  })

  it.each(['~/custom-dsh', 'relative-dsh', '   '])('passes a normalized Harness home without rewriting WakaTime settings (%s)', async configured => {
    vi.stubEnv('DSH_HOME', configured)
    vi.stubEnv('WAKATIME_HOME', '/separate/wakatime')
    autoCompleteCommands()
    await expect(dispatcher().sync()).resolves.toBe(true)
    const expected = configured.startsWith('~/')
      ? path.join(os.homedir(), 'custom-dsh')
      : configured.trim() ? path.resolve(configured) : path.join(os.homedir(), '.dsh')
    expect(spawnMock.mock.calls[0]![2].env).toMatchObject({
      DSH_HOME: expected, WAKATIME_HOME: '/separate/wakatime',
    })
  })

  it('bounds a stuck child with TERM, KILL and final settlement', async () => {
    vi.useFakeTimers()
    const ai = fakeChild()
    const offline = fakeChild()
    spawnMock.mockReturnValueOnce(ai.child).mockReturnValueOnce(offline.child)
    const pending = dispatcher().sync()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(ai.child.kill).toHaveBeenCalledWith('SIGTERM')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(ai.child.kill).toHaveBeenCalledWith('SIGKILL')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(spawnMock).toHaveBeenCalledTimes(2)
    offline.close(0)
    await expect(pending).resolves.toBe(false)
    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('limits captured count output to 1 KiB and cleans up the child', async () => {
    vi.useFakeTimers()
    const count = fakeChild()
    spawnMock.mockImplementation((_binary: string, args: string[]) => {
      if (args.includes('--offline-count')) return count.child
      const child = fakeChild()
      queueMicrotask(() => child.close(0))
      return child.child
    })
    const sender = dispatcher()
    const pending = sender.sync()
    await vi.advanceTimersByTimeAsync(0)
    expect(spawnMock).toHaveBeenCalledTimes(3)
    count.stdout.write('0'.repeat(1_024))
    expect(count.child.kill).not.toHaveBeenCalled()
    count.stdout.write('0')
    expect(count.child.kill).toHaveBeenCalledWith('SIGTERM')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(count.child.kill).toHaveBeenCalledWith('SIGKILL')
    await vi.advanceTimersByTimeAsync(1_000)
    await expect(pending).resolves.toBe(false)
    expect(sender.status().lastError).toBe('wakatime-cli offline count failed')
    expect(count.stdout.listenerCount('data')).toBe(0)
    const killCalls = vi.mocked(count.child.kill).mock.calls.length
    killActiveSyncProcesses()
    expect(count.child.kill).toHaveBeenCalledTimes(killCalls)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains pending sync when the count process times out', async () => {
    vi.useFakeTimers()
    const count = fakeChild()
    spawnMock.mockImplementation((_binary: string, args: string[]) => {
      if (args.includes('--offline-count')) return count.child
      const child = fakeChild()
      queueMicrotask(() => child.close(0))
      return child.child
    })
    const sender = dispatcher()
    const pending = sender.sync()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(count.child.kill).toHaveBeenCalledWith('SIGTERM')
    count.close(null, 'SIGTERM')
    await expect(pending).resolves.toBe(false)
    expect(sender.status().lastError).toBe('wakatime-cli offline count failed')
    expect(count.stdout.listenerCount('data')).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
