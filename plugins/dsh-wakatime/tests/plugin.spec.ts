import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const syncMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>(async () => true))

vi.mock('../src/cli.ts', () => ({ CliManager: class {} }))
vi.mock('../src/sync.ts', () => ({ NativeSyncDispatcher: class { sync = syncMock } }))

import { apply, Config, name } from '../src/index.ts'

let directory: string
const disposers: Array<() => Promise<void>> = []

function tick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

function prompt(): SessionEvent {
  return { type: 'message', seq: 0, data: { role: 'user', content: 'Explain this project.' } } as unknown as SessionEvent
}

async function harness(initial: Session[] = []) {
  const ctx = new Context()
  const live = new Map<string, Session>(initial.map(session => [session.id, session]))
  const flush = vi.fn(async (session: Session) => {
    await ctx.parallel('session/flush', session)
    return true
  })
  const readFrom = vi.fn(async (_id: string, _seq: number): Promise<unknown> => ({ events: [] }))
  ctx.provide('sessions', { get: (id: string) => live.get(id), list: () => [...live.values()], flush })
  ctx.provide('sessionPersistence', { readFrom })
  const fiber = await ctx.plugin({ name, Config, apply }, {
    autoInstall: false, heartbeatIntervalMs: 1_000, heartbeatTimeoutMs: 1_000,
  })
  disposers.push(() => fiber.dispose())
  await tick()
  const session = { id: 'session-test', seq: 1, header: { cwd: directory } } as unknown as Session
  live.set(session.id, session)
  return { ctx, live, session, flush, readFrom, fiber }
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'dsh-waka-plugin-'))
  vi.stubEnv('WAKATIME_HOME', directory)
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  syncMock.mockReset().mockResolvedValue(true)
})

afterEach(async () => {
  for (const dispose of disposers.splice(0)) await dispose()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  rmSync(directory, { recursive: true, force: true })
})

describe('native sync plugin wiring', () => {
  it('rejects invalid deployment configuration before apply', async () => {
    const ctx = new Context()
    await expect(ctx.plugin({ name, Config, apply }, { heartbeatIntervalMs: 999 }))
      .rejects.toThrow(/heartbeatIntervalMs/)
  })

  it('catches up durable activity on startup without a file operation', async () => {
    await harness()
    expect(syncMock).toHaveBeenCalledOnce()
    expect(syncMock).toHaveBeenCalledWith()
  })

  it('ignores legacy tracking keys in existing Harness patch layers', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin({ name, Config, apply }, {
      category: 'coding', trackReads: false, maxPendingFiles: 1,
    } as Parameters<typeof apply>[1])
    disposers.push(() => fiber.dispose())
    expect(syncMock).not.toHaveBeenCalled()
  })

  it('does not wait for a nonexistent transcript when an empty session is abandoned', async () => {
    const empty = { id: 'empty', seq: 0, header: { cwd: directory } } as unknown as Session
    const { ctx, live, readFrom, flush } = await harness([empty])
    live.delete(empty.id)
    ctx.emit('session/disposed', empty)
    await tick()
    expect(readFrom).not.toHaveBeenCalled()
    expect(flush).not.toHaveBeenCalled()
    expect(syncMock).toHaveBeenCalledOnce()
  })

  it('syncs prompt-only sessions after awaiting the complete durability checkpoint', async () => {
    const { ctx, session, flush } = await harness()
    syncMock.mockClear()
    let persisted: (() => void) | undefined
    ctx.on('session/flush', () => new Promise<void>(resolve => { persisted = resolve }))
    ctx.emit('session/event', session, prompt())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(flush).toHaveBeenCalledWith(session)
    expect(syncMock).not.toHaveBeenCalled()
    persisted!()
    await tick()
    expect(syncMock).toHaveBeenCalledOnce()
  })

  it('does not sync an unpersisted snapshot and retries after storage recovers', async () => {
    const { ctx, session, flush } = await harness()
    syncMock.mockClear()
    flush.mockRejectedValueOnce(new Error('storage unavailable'))
    ctx.emit('session/event', session, prompt())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(syncMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(syncMock).toHaveBeenCalledOnce()
  })

  it('bounds a stuck durability checkpoint and retries without blocking the Harness', async () => {
    const { ctx, session, flush } = await harness()
    syncMock.mockClear()
    flush.mockImplementationOnce(() => new Promise<boolean>(() => {}))
    ctx.emit('session/event', session, prompt())
    await vi.advanceTimersByTimeAsync(2_000)
    expect(syncMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(flush).toHaveBeenCalledTimes(2)
    expect(syncMock).toHaveBeenCalledOnce()
  })

  it('retries durable transcripts without retaining or reflushing their session objects', async () => {
    const { ctx, session, flush } = await harness()
    syncMock.mockClear().mockResolvedValueOnce(false)
    ctx.emit('session/event', session, prompt())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(flush).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(syncMock).toHaveBeenCalledTimes(2)
    expect(flush).toHaveBeenCalledOnce()
  })

  it('waits for a disposed session retirement drain before its final sync', async () => {
    const { ctx, session, live, readFrom } = await harness()
    syncMock.mockClear()
    let retired: (() => void) | undefined
    readFrom.mockImplementationOnce(() => new Promise<void>(resolve => { retired = resolve }))
    ctx.emit('session/event', session, prompt())
    live.delete(session.id)
    ctx.emit('session/disposed', session)
    await tick()
    expect(readFrom).toHaveBeenCalledWith(session.id, Number.MAX_SAFE_INTEGER)
    expect(syncMock).not.toHaveBeenCalled()
    retired!()
    await tick()
    expect(syncMock).toHaveBeenCalledOnce()
  })

  it('keeps a newer event pending while an older snapshot syncs', async () => {
    const { ctx, session, flush } = await harness()
    syncMock.mockClear()
    let sent: ((value: boolean) => void) | undefined
    syncMock.mockImplementationOnce(() => new Promise<boolean>(resolve => { sent = resolve }))
    ctx.emit('session/event', session, prompt())
    await vi.advanceTimersByTimeAsync(1_000)
    expect(syncMock).toHaveBeenCalledOnce()
    ctx.emit('session/event', session, prompt())
    sent!(true)
    await tick()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(syncMock).toHaveBeenCalledTimes(2)
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('drains pending sessions when the plugin is disposed', async () => {
    const { ctx, session, fiber, flush } = await harness()
    syncMock.mockClear()
    ctx.emit('session/event', session, prompt())
    await fiber.dispose()
    expect(flush).toHaveBeenCalledWith(session)
    expect(syncMock).toHaveBeenCalledOnce()
  })
})
