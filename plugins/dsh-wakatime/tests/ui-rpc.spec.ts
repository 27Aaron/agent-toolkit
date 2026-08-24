import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, Config, name } from '../src/index.ts'

const originalHome = process.env.WAKATIME_HOME
const originalApiKey = process.env.WAKATIME_API_KEY
const directories: string[] = []

afterEach(() => {
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  if (originalApiKey === undefined) delete process.env.WAKATIME_API_KEY
  else process.env.WAKATIME_API_KEY = originalApiKey
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('WakaTime settings RPC', () => {
  it('registers a loopback handler and returns a safe status snapshot', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-rpc-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    delete process.env.WAKATIME_API_KEY

    let handler: ((endpoint: string, payload: unknown, signal: { aborted: boolean }) => Promise<any>) | undefined
    let disposed = false
    const ctx = new Context()
    ctx.provide('connection', {
      rpc: {
        handle(_channel: string, next: typeof handler, _options: unknown) {
          handler = next
          return () => { disposed = true }
        },
      },
    })

    const fiber = await ctx.plugin({ name, Config, apply }, {
      autoInstall: false,
      cliPath: process.execPath,
    })
    expect(handler).toBeDefined()

    const result = await handler!('status', {}, { aborted: false })
    expect(result.ok).toBe(true)
    expect(result.value.apiKeyConfigured).toBe(false)
    expect(result.value.cli.state).toBe('ready')
    expect(result.value.paths.config).toBe(join(directory, '.wakatime.cfg'))

    const usage = await handler!('usage', {
      start: '2026-08-24',
      end: '2026-08-25',
    }, { aborted: false })
    expect(usage.ok).toBe(true)
    expect(usage.value.available).toBe(false)

    const saved = await handler!('save', {
      config: { category: 'coding', cliPath: '' },
      apiKey: 'waka_test_key',
    }, { aborted: false })
    expect(saved.ok).toBe(true)
    expect(saved.value.config.category).toBe('coding')
    expect(saved.value.config.cliPath).toBeUndefined()
    expect(saved.value.apiKeyConfigured).toBe(true)

    await fiber.dispose()
    expect(disposed).toBe(true)
  })
})
