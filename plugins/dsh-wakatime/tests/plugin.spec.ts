import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Heartbeat } from '../src/tracker.ts'

const sendMock = vi.hoisted(() => vi.fn<(heartbeats: Heartbeat[]) => Promise<boolean>>(async () => true))

vi.mock('../src/cli.ts', () => ({
  CliManager: class {
    async ensureInstalled() {
      return '/fake/wakatime-cli'
    }
  },
}))

vi.mock('../src/heartbeat.ts', () => ({
  HeartbeatDispatcher: class {
    send = sendMock
  },
}))

import { apply, Config, name } from '../src/index.ts'

const originalHome = process.env.WAKATIME_HOME
let directory: string

function tick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

function execution(session: Session, name: string, args: Record<string, unknown>): ToolExecution {
  return {
    callId: 'call-1',
    rootCallId: 'call-1',
    name,
    arguments: args,
    agent: { session },
  } as unknown as ToolExecution
}

function success(value: unknown, meta?: unknown): ToolExecutionResult {
  return {
    isError: false,
    value,
    content: [],
    ...(meta === undefined ? {} : { meta }),
  } as ToolExecutionResult
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'dsh-waka-plugin-'))
  process.env.WAKATIME_HOME = directory
  sendMock.mockClear()
})

afterEach(() => {
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  rmSync(directory, { recursive: true, force: true })
})

describe('plugin wiring', () => {
  it('rejects invalid deployment configuration before apply', async () => {
    const ctx = new Context()
    await expect(ctx.plugin({ name, Config, apply }, { heartbeatIntervalMs: 999 }))
      .rejects.toThrow(/heartbeatIntervalMs/)
  })

  it('observes final tools/result values and force-flushes on session disposal', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin({ name, Config, apply }, {
      autoInstall: false,
      heartbeatIntervalMs: 60_000,
    })
    const session = { header: { cwd: directory } } as unknown as Session

    ctx.emit(
      'tools/result',
      execution(session, 'write', { file_path: join(directory, 'a.ts'), content: 'a\nb' }),
      success({ path: join(directory, 'a.ts'), before: null, after: 'a\nb' }),
    )
    await tick()
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]![0]).toEqual([
      expect.objectContaining({
        entity: join(directory, 'a.ts'),
        projectFolder: directory,
        lineChanges: 2,
        isWrite: true,
      }),
    ])

    ctx.emit(
      'tools/result',
      execution(session, 'edit', { file_path: join(directory, 'b.ts'), old_string: 'x', new_string: 'x\ny' }),
      success({ path: join(directory, 'b.ts'), before: 'x', after: 'x\ny' }),
    )
    await tick()
    expect(sendMock).toHaveBeenCalledTimes(1)

    ctx.emit('session/disposed', session)
    await tick()
    expect(sendMock).toHaveBeenCalledTimes(2)
    expect(sendMock.mock.calls[1]?.[0]?.[0]).toMatchObject({
      entity: join(directory, 'b.ts'),
      lineChanges: 1,
    })
    await fiber.dispose()
  })

  it('ignores failed tools, host-only calls, and directory reads', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin({ name, Config, apply }, {})
    const session = { header: { cwd: directory } } as unknown as Session
    const failed = {
      isError: true,
      error: { message: 'denied' },
      content: [],
    } as unknown as ToolExecutionResult
    ctx.emit('tools/result', execution(session, 'write', {
      file_path: join(directory, 'x.ts'), content: 'x',
    }), failed)
    ctx.emit('tools/result', {
      callId: 'host', rootCallId: 'host', name: 'write', arguments: { file_path: '/x', content: 'x' },
    } as unknown as ToolExecution, success({ path: '/x', before: null, after: 'x' }))
    ctx.emit('tools/result', execution(session, 'read', { file_path: directory }), success('ignored'))
    await tick()
    expect(sendMock).not.toHaveBeenCalled()
    await fiber.dispose()
  })
})
