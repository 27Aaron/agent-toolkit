import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildPluginTag, resolveConfig } from '../src/config.ts'

describe('configuration', () => {
  it('provides documented defaults', () => {
    expect(resolveConfig({})).toMatchObject({
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 30_000,
      cliUpdateCheckIntervalMs: 14_400_000,
      dashboardRefreshIntervalMs: 300_000,
      insightsRefreshIntervalMs: 1_800_000,
      cliDownloadTimeoutMs: 120_000,
      autoInstall: false,
      trackReads: true,
      category: 'ai coding',
      client: 'dsh',
      debug: false,
      maxPendingFiles: 5_000,
    })
  })

  it('expands an explicit CLI path and rejects relative paths', () => {
    expect(resolveConfig({ cliPath: '~/bin/wakatime-cli' }).cliPath)
      .toBe(path.join(os.homedir(), 'bin/wakatime-cli'))
    expect(() => resolveConfig({ cliPath: 'bin/wakatime-cli' })).toThrow(/must be absolute/)
  })

  it('builds a WakaTime-compatible plugin tag', () => {
    expect(buildPluginTag('dsh')).toMatch(/^deepseek-harness\/.+ dsh-wakatime\/.+$/)
    expect(buildPluginTag('web')).toMatch(/^deepseek-harness-web\/.+ dsh-wakatime\/.+$/)
  })

  it('clamps out-of-range timer values instead of passing them through', () => {
    // Above the 32-bit timer ceiling: clamped down so setInterval/setTimeout
    // cannot collapse the value to 1ms.
    expect(resolveConfig({ dashboardRefreshIntervalMs: 1e12 }).dashboardRefreshIntervalMs).toBe(2_147_483_647)
    expect(resolveConfig({ insightsRefreshIntervalMs: 5e12 }).insightsRefreshIntervalMs).toBe(2_147_483_647)
    // Below the documented minimum: clamped up to the minimum.
    expect(resolveConfig({ dashboardRefreshIntervalMs: 5 }).dashboardRefreshIntervalMs).toBe(60_000)
    expect(resolveConfig({ heartbeatIntervalMs: 10 }).heartbeatIntervalMs).toBe(1_000)
    // Non-finite values fall back to defaults.
    expect(resolveConfig({ heartbeatIntervalMs: Number.NaN }).heartbeatIntervalMs).toBe(60_000)
    expect(resolveConfig({ insightsRefreshIntervalMs: Number.POSITIVE_INFINITY }).insightsRefreshIntervalMs).toBe(1_800_000)
    // Fractional values are rounded to integers.
    expect(resolveConfig({ insightsRefreshIntervalMs: 90_000.6 }).insightsRefreshIntervalMs).toBe(90_001)
    // In-range values pass through unchanged.
    expect(resolveConfig({ dashboardRefreshIntervalMs: 120_000 }).dashboardRefreshIntervalMs).toBe(120_000)
    expect(resolveConfig({ maxPendingFiles: 1e9 }).maxPendingFiles).toBe(100_000)
  })
})
