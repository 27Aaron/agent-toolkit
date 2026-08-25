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
    expect(result.value.config.baseUrl).toBe('https://api.wakatime.com/api/v1')
    expect(result.value.config.dashboardRefreshIntervalMs).toBe(300_000)
    expect(result.value.config.insightsRefreshIntervalMs).toBe(1_800_000)
    expect(result.value.cli.state).toBe('ready')
    expect(result.value.paths.config).toBe(join(directory, '.wakatime.cfg'))

    const usage = await handler!('usage', {
      start: '2026-08-24',
      end: '2026-08-25',
    }, { aborted: false })
    expect(usage.ok).toBe(true)
    expect(usage.value.available).toBe(false)

    const insights = await handler!('insights', { range: 'last_year' }, { aborted: false })
    expect(insights.ok).toBe(true)
    expect(insights.value.available).toBe(false)

    const unknown = await handler!('unknown', {}, { aborted: false })
    expect(unknown.ok).toBe(false)
    expect(unknown.error.code).toBe('internal')
    expect(unknown.error.details).toEqual({})

    const invalidConfig = await handler!('save', { baseUrl: 'not-a-url' }, { aborted: false })
    expect(invalidConfig.ok).toBe(false)
    expect(invalidConfig.error.code).toBe('bad-request')
    expect(invalidConfig.error.details).toEqual({ issues: [] })

    const downloaded = await handler!('download-cli', {}, { aborted: false })
    expect(downloaded.ok).toBe(true)
    expect(downloaded.value.cli.source).toBe('configured')

    const updated = await handler!('update-cli', {}, { aborted: false })
    expect(updated.ok).toBe(true)
    expect(updated.value.cli.source).toBe('configured')

    const saved = await handler!('save', {
      baseUrl: 'https://wakapi.example.com/api',
      config: {
        category: 'coding',
        cliPath: '',
        dashboardRefreshIntervalMs: 600_000,
        insightsRefreshIntervalMs: 3_600_000,
      },
      apiKey: 'waka_test_key',
    }, { aborted: false })
    expect(saved.ok).toBe(true)
    expect(saved.value.config.category).toBe('coding')
    expect(saved.value.config.baseUrl).toBe('https://wakapi.example.com/api')
    expect(saved.value.config.cliPath).toBeUndefined()
    expect(saved.value.config.dashboardRefreshIntervalMs).toBe(600_000)
    expect(saved.value.config.insightsRefreshIntervalMs).toBe(3_600_000)
    expect(saved.value.apiKeyConfigured).toBe(true)

    await fiber.dispose()
    expect(disposed).toBe(true)
  })
})
