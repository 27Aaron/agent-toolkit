import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_CLAIM_SYMBOL, apply, Config, name } from '../src/index.ts'

const originalHome = process.env.WAKATIME_HOME
const directories: string[] = []

function clearClaim(): void {
  delete (globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]
}

afterEach(() => {
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
  // Whatever a test left behind must not elect or suppress another file's rows.
  clearClaim()
})

describe('WakaTime activation claim', () => {
  it('stands down when another row already owns the process claim', () => {
    ;(globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL] = { token: 'foreign-row' }
    const ctx = new Context()
    const warnings: string[] = []
    const logger = ctx.logger as unknown as { warn: (message: string) => void }
    const originalWarn = logger.warn.bind(logger)
    logger.warn = (message: string) => {
      warnings.push(message)
      originalWarn(message)
    }

    apply(ctx, {})

    expect(warnings.some(message => message.includes('stands down'))).toBe(true)
    const claim = (globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL] as {
      token: string
      waiters?: Set<() => void>
    }
    expect(claim.token).toBe('foreign-row')
    expect(claim.waiters?.size).toBe(1)
  })

  it('does not retain a claim when synchronous initialization fails', () => {
    const ctx = new Context()

    expect(() => apply(ctx, { cliPath: 'relative/wakatime-cli' })).toThrow(/must be absolute/)
    expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).toBeUndefined()
  })

  it('claims activation while mounted and releases it on disposal', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-claim-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    clearClaim()

    const ctx = new Context()
    ctx.provide('connection', {
      rpc: {
        handle() {
          return () => {}
        },
      },
    })

    const fiber = await ctx.plugin({ name, Config, apply }, {
      autoInstall: false,
      cliPath: process.execPath,
    })
    expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).toBeDefined()

    await fiber.dispose()
    expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).toBeUndefined()

    // A released claim lets a later row take over instead of standing down.
    const revival = new Context()
    revival.provide('connection', {
      rpc: {
        handle() {
          return () => {}
        },
      },
    })
    const revived = await revival.plugin({ name, Config, apply }, { autoInstall: false, cliPath: process.execPath })
    expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).toBeDefined()
    await revived.dispose()
  })

  it('restarts a standing-by row after the active owner disposes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-standby-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    clearClaim()

    const ownerContext = new Context()
    ownerContext.provide('connection', {
      rpc: {
        handle() {
          return () => {}
        },
      },
    })
    const owner = await ownerContext.plugin({ name, Config, apply }, {
      autoInstall: false,
      cliPath: process.execPath,
    })
    const ownerClaim = (globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]

    let standbyRegistrations = 0
    const standbyContext = new Context()
    standbyContext.provide('connection', {
      rpc: {
        handle() {
          standbyRegistrations += 1
          return () => {}
        },
      },
    })
    const standby = await standbyContext.plugin({ name, Config, apply }, {
      autoInstall: false,
      cliPath: process.execPath,
    })
    expect(standbyRegistrations).toBe(0)

    await owner.dispose()
    await vi.waitFor(() => {
      expect(standbyRegistrations).toBe(1)
      expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).not.toBe(ownerClaim)
    })

    await standby.dispose()
    expect((globalThis as Record<symbol, unknown>)[ACTIVE_CLAIM_SYMBOL]).toBeUndefined()
  })
})
