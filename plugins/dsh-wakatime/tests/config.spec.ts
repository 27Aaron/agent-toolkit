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
})
