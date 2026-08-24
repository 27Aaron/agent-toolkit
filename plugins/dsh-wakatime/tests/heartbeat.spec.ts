import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const spawnMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  spawn: spawnMock,
}))

import type { CliManager } from '../src/cli.ts'
import { HeartbeatDispatcher } from '../src/heartbeat.ts'
import { PluginLogger } from '../src/logger.ts'

function fakeChild() {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const stdinEnd = vi.fn()
  const child = {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    stdin: Object.assign(new EventEmitter(), { end: stdinEnd }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler)
      return child
    }),
    kill: vi.fn(),
    exitCode: null,
    signalCode: null,
  } as unknown as ChildProcess
  return {
    child,
    stdinEnd,
    close(code: number | null, signal: NodeJS.Signals | null = null) {
      ;(child as unknown as { exitCode: number | null }).exitCode = code
      handlers.get('close')?.(code, signal)
    },
  }
}

function dispatcher(cliPath: string | null = '/usr/local/bin/wakatime-cli') {
  const cli = { ensureInstalled: vi.fn(async () => cliPath ?? undefined) } as unknown as CliManager
  return new HeartbeatDispatcher(
    cli,
    'deepseek-harness/0.1.0 dsh-wakatime/0.1.0',
    'ai coding',
    5_000,
    new PluginLogger(undefined, true, '/dev/null'),
  )
}

beforeEach(() => {
  spawnMock.mockReset()
})

describe('HeartbeatDispatcher', () => {
  it('sends a primary heartbeat with explicit zero AI line changes', async () => {
    const process = fakeChild()
    spawnMock.mockReturnValue(process.child)
    const pending = dispatcher().send([{
      entity: '/repo/a.ts',
      projectFolder: '/repo',
      lineChanges: 0,
      isWrite: false,
      time: 123.5,
    }])
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
    process.close(0)
    await expect(pending).resolves.toBe(true)

    const args = spawnMock.mock.calls[0]![1] as string[]
    expect(args).toEqual(expect.arrayContaining([
      '--entity', '/repo/a.ts',
      '--project-folder', '/repo',
      '--time', '123.5',
      '--ai-line-changes', '0',
      '--category', 'ai coding',
    ]))
    expect(args).not.toContain('--write')
  })

  it('batches extra heartbeats over stdin and retains their timestamps', async () => {
    const process = fakeChild()
    spawnMock.mockReturnValue(process.child)
    const pending = dispatcher().send([
      { entity: '/repo/a.ts', projectFolder: '/repo', lineChanges: 2, isWrite: true, time: 10 },
      { entity: '/repo/b.ts', projectFolder: '/repo', lineChanges: -1, isWrite: false, time: 11 },
    ])
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
    process.close(0)
    await expect(pending).resolves.toBe(true)

    const args = spawnMock.mock.calls[0]![1] as string[]
    expect(args).toContain('--write')
    expect(args).toContain('--extra-heartbeats')
    const payload = JSON.parse(process.stdinEnd.mock.calls[0]![0] as string) as Array<Record<string, unknown>>
    expect(payload).toEqual([{
      ai_line_changes: -1,
      category: 'ai coding',
      entity: '/repo/b.ts',
      entity_type: 'file',
      time: 11,
    }])
  })

  it('returns false when the CLI is missing or exits nonzero', async () => {
    await expect(dispatcher(null).send([{
      entity: '/repo/a.ts', projectFolder: '/repo', lineChanges: 1, isWrite: false, time: 1,
    }])).resolves.toBe(false)
    expect(spawnMock).not.toHaveBeenCalled()

    const process = fakeChild()
    spawnMock.mockReturnValue(process.child)
    const pending = dispatcher().send([{
      entity: '/repo/a.ts', projectFolder: '/repo', lineChanges: 1, isWrite: false, time: 1,
    }])
    await vi.waitFor(() => expect(spawnMock).toHaveBeenCalledOnce())
    process.close(2)
    await expect(pending).resolves.toBe(false)
  })
})
