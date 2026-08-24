import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getPluginDataDir,
  getWakatimeConfigFilePath,
  getWakatimeResourcesDir,
} from '../src/paths.ts'
import { readIniSection, readWakatimeSettings, writeWakatimeApiKey } from '../src/settings.ts'

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
    delete process.env.WAKATIME_API_KEY
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
      apiKeyConfigured: false,
      proxy: 'https://user:p=a=s=s@example.com:8080',
    })
    expect(readIniSection(file, 'other').get('debug')).toBe('false')
  })

  it('writes and clears only the standard API key setting', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-api-key-'))
    directories.push(directory)
    const file = join(directory, '.wakatime.cfg')
    writeFileSync(file, '[settings]\ndebug = true\n[other]\nvalue = keep\n')

    writeWakatimeApiKey('waka_test_key', file)
    expect(readWakatimeSettings(file).apiKeyConfigured).toBe(true)
    expect(readFileSync(file, 'utf8')).toContain('api_key = waka_test_key')
    expect(readFileSync(file, 'utf8')).toContain('value = keep')

    writeWakatimeApiKey(null, file)
    expect(readWakatimeSettings(file).apiKeyConfigured).toBe(false)
    expect(readFileSync(file, 'utf8')).not.toContain('api_key')
  })
})
