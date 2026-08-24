import * as fs from 'node:fs'
import * as path from 'node:path'
import { getWakatimeConfigFilePath } from './paths.ts'

export interface WakatimeSettings {
  debug: boolean
  noSSLVerify: boolean
  apiKeyConfigured?: boolean
  proxy?: string
}

export function readIniSection(file: string, wantedSection: string): Map<string, string> {
  const values = new Map<string, string>()
  let content: string
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    return values
  }

  let section = ''
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\0/g, '')
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      section = trimmed.slice(1, -1).trim().toLowerCase()
      continue
    }
    if (section !== wantedSection.toLowerCase()) continue
    const separator = line.indexOf('=')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    if (key.length === 0 || values.has(key)) continue
    values.set(key, line.slice(separator + 1).trim())
  }
  return values
}

function isTrue(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true'
}

export function readWakatimeSettings(file: string = getWakatimeConfigFilePath()): WakatimeSettings {
  const settings = readIniSection(file, 'settings')
  const proxy = settings.get('proxy')?.trim()
  return {
    debug: isTrue(settings.get('debug')),
    noSSLVerify: isTrue(settings.get('no_ssl_verify')),
    apiKeyConfigured: (settings.get('api_key')?.trim().length ?? 0) > 0
      || (process.env.WAKATIME_API_KEY?.trim().length ?? 0) > 0,
    ...(proxy === undefined || proxy.length === 0 ? {} : { proxy }),
  }
}

/** Read the secret key for Host-only API requests without exposing it in UI state. */
export function readWakatimeApiKey(file: string = getWakatimeConfigFilePath()): string | undefined {
  const environment = process.env.WAKATIME_API_KEY?.trim()
  if (environment !== undefined && environment.length > 0) return environment
  const configured = readIniSection(file, 'settings').get('api_key')?.trim()
  return configured === undefined || configured.length === 0 ? undefined : configured
}

function isSectionHeader(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('[') && trimmed.endsWith(']')
}

function isSettingKey(line: string, key: string): boolean {
  const separator = line.indexOf('=')
  return separator >= 0 && line.slice(0, separator).trim().toLowerCase() === key
}

/** Update only WakaTime's API key while preserving the rest of the user's config. */
export function writeWakatimeApiKey(
  apiKey: string | null,
  file: string = getWakatimeConfigFilePath(),
): void {
  let content = ''
  try {
    content = fs.readFileSync(file, 'utf8')
  } catch {
    // Create the standard config below when it does not exist yet.
  }

  const lines = content.length === 0 ? [] : content.split(/\r?\n/)
  const settingsStart = lines.findIndex(line => line.trim().toLowerCase() === '[settings]')
  const sectionStart = settingsStart >= 0 ? settingsStart : lines.length
  const sectionEnd = settingsStart >= 0
    ? lines.findIndex((line, index) => index > settingsStart && isSectionHeader(line))
    : -1
  const end = sectionEnd >= 0 ? sectionEnd : lines.length
  const existing = lines.findIndex((line, index) => index > sectionStart && index < end && isSettingKey(line, 'api_key'))
  const value = apiKey?.trim() ?? ''

  if (existing >= 0) {
    if (value.length === 0) lines.splice(existing, 1)
    else lines[existing] = `api_key = ${value}`
  } else if (value.length > 0) {
    if (settingsStart >= 0) lines.splice(end, 0, `api_key = ${value}`)
    else lines.push('[settings]', `api_key = ${value}`)
  }

  const next = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()
  const directory = path.dirname(file)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporary, next.length === 0 ? '' : `${next}\n`, { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The rename normally consumed the temporary file.
    }
  }
}
