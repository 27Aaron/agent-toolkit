import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
      category: 'ai coding',
      trackReads: false,
      cliPath: '/tmp/wakatime-cli',
      heartbeatIntervalMs: 60_000,
    }, file)).toEqual({
      category: 'ai coding',
      trackReads: false,
      cliPath: '/tmp/wakatime-cli',
      heartbeatIntervalMs: 60_000,
    })
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(readPersistedWakatimeConfig(file))

    expect(writePersistedWakatimeConfig({ cliPath: '' }, file)).toEqual({
      category: 'ai coding',
      trackReads: false,
      heartbeatIntervalMs: 60_000,
    })
  })
})
