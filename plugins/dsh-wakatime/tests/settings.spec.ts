import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getPluginDataDir,
  getWakatimeConfigFilePath,
  getWakatimeResourcesDir,
} from '../src/paths.ts'
import { readIniSection, readWakatimeSettings } from '../src/settings.ts'

const originalHome = process.env.WAKATIME_HOME
const directories: string[] = []

afterEach(() => {
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('WakaTime paths and settings', () => {
  it('honors WAKATIME_HOME consistently', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-home-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    expect(getWakatimeResourcesDir()).toBe(directory)
    expect(getWakatimeConfigFilePath()).toBe(join(directory, '.wakatime.cfg'))
    expect(getPluginDataDir()).toBe(join(directory, 'dsh-wakatime'))
  })

  it('parses settings without truncating proxy credentials', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-settings-'))
    directories.push(directory)
    const file = join(directory, '.wakatime.cfg')
    writeFileSync(file, [
      '# comment',
      '[settings]',
      'debug = TRUE',
      'proxy = https://user:p=a=s=s@example.com:8080',
      'no_ssl_verify = false',
      'debug = false',
      '[other]',
      'debug = false',
    ].join('\n'))
    expect(readWakatimeSettings(file)).toEqual({
      debug: true,
      noSSLVerify: false,
      proxy: 'https://user:p=a=s=s@example.com:8080',
    })
    expect(readIniSection(file, 'other').get('debug')).toBe('false')
  })
})
