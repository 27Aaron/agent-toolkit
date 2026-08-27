import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readPersistedWakatimeConfig,
  writePersistedWakatimeConfig,
} from '../src/ui-settings.ts'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('WakaTime UI settings persistence', () => {
  it('sanitizes persisted values and supports clearing the CLI path', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-ui-settings-'))
    directories.push(directory)
    const file = join(directory, 'settings.json')

    expect(writePersistedWakatimeConfig({
      cliPath: '/tmp/wakatime-cli',
      heartbeatIntervalMs: 60_000,
      dashboardRefreshIntervalMs: 300_000,
      insightsRefreshIntervalMs: 1_800_000,
    }, file)).toEqual({
      cliPath: '/tmp/wakatime-cli',
      heartbeatIntervalMs: 60_000,
      dashboardRefreshIntervalMs: 300_000,
      insightsRefreshIntervalMs: 1_800_000,
    })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(readPersistedWakatimeConfig(file))

    expect(writePersistedWakatimeConfig({ cliPath: '' }, file)).toEqual({
      heartbeatIntervalMs: 60_000,
      dashboardRefreshIntervalMs: 300_000,
      insightsRefreshIntervalMs: 1_800_000,
    })
  })

  it('drops legacy persisted keys that no longer exist', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-ui-settings-'))
    directories.push(directory)
    const file = join(directory, 'settings.json')
    writeFileSync(file, JSON.stringify({ autoInstall: true, category: 'coding', trackReads: true, debug: true }))

    expect(readPersistedWakatimeConfig(file)).toEqual({ debug: true })
  })
})
