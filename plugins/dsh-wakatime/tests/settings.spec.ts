import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getPluginDataDir,
  getWakatimeConfigFilePath,
  getWakatimeResourcesDir,
} from '../src/paths.ts'
import {
  DEFAULT_WAKATIME_API_URL,
  readIniSection,
  readWakatimeSettings,
  writeWakatimeApiKey,
  writeWakatimeApiUrl,
} from '../src/settings.ts'

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
      apiUrl: DEFAULT_WAKATIME_API_URL,
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

  it('reads and writes a custom API base URL', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-api-url-'))
    directories.push(directory)
    const file = join(directory, '.wakatime.cfg')
    writeFileSync(file, '[settings]\napi_key = waka_test_key\n')

    writeWakatimeApiUrl('https://wakapi.example.com/api/', file)
    expect(readWakatimeSettings(file).apiUrl).toBe('https://wakapi.example.com/api')
    expect(readFileSync(file, 'utf8')).toContain('api_url = https://wakapi.example.com/api')
    expect(() => writeWakatimeApiUrl('not-a-url', file)).toThrow(/Base URL/)
  })

  it('reports an invalid configured api_url via the callback while falling back', () => {
    const directory = mkdtempSync(join(tmpdir(), 'wakatime-settings-'))
    directories.push(directory)
    const file = join(directory, '.wakatime.cfg')
    writeFileSync(file, '[settings]\napi_key = waka_test_key\napi_url = not a url at all\n')

    const reports: Array<{ configured: string; error: string }> = []
    const settings = readWakatimeSettings(file, (configured, error) => {
      reports.push({ configured, error: error instanceof Error ? error.message : String(error) })
    })

    expect(settings.apiUrl).toBe(DEFAULT_WAKATIME_API_URL)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ configured: 'not a url at all' })
    expect(reports[0]?.error).toMatch(/Base URL/)
  })
})
