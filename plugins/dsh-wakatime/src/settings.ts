import * as fs from 'node:fs'
import { getWakatimeConfigFilePath } from './paths.ts'

export interface WakatimeSettings {
  debug: boolean
  noSSLVerify: boolean
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
    ...(proxy === undefined || proxy.length === 0 ? {} : { proxy }),
  }
}
