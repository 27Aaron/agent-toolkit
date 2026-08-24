import * as fs from 'node:fs'
import * as path from 'node:path'
import type { WakatimeCategory } from './config.ts'
import { getPluginDataDir, getPluginSettingsFilePath } from './paths.ts'

export interface PersistedWakatimeConfig {
  category?: WakatimeCategory
  trackReads?: boolean
  autoInstall?: boolean
  cliPath?: string
  debug?: boolean
  heartbeatIntervalMs?: number
}

const categories = new Set<WakatimeCategory>([
  'coding',
  'ai coding',
  'building',
  'indexing',
  'debugging',
  'learning',
  'notes',
  'meeting',
  'planning',
  'researching',
  'communicating',
  'supporting',
  'advising',
  'running tests',
  'writing tests',
  'manual testing',
  'writing docs',
  'code reviewing',
  'browsing',
  'translating',
  'designing',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1_000 && value <= 2_147_483_647
    ? value
    : undefined
}

function sanitize(value: unknown): PersistedWakatimeConfig {
  if (!isRecord(value)) return {}
  const result: PersistedWakatimeConfig = {}
  if (typeof value.category === 'string' && categories.has(value.category as WakatimeCategory)) {
    result.category = value.category as WakatimeCategory
  }
  if (typeof value.trackReads === 'boolean') result.trackReads = value.trackReads
  if (typeof value.autoInstall === 'boolean') result.autoInstall = value.autoInstall
  if (typeof value.cliPath === 'string' && value.cliPath.trim().length > 0) {
    const cliPath = value.cliPath.trim()
    if (path.isAbsolute(cliPath) || cliPath === '~' || cliPath.startsWith('~/') || cliPath.startsWith('~\\')) {
      result.cliPath = cliPath
    }
  }
  if (typeof value.debug === 'boolean') result.debug = value.debug
  const heartbeatIntervalMs = readNumber(value.heartbeatIntervalMs)
  if (heartbeatIntervalMs !== undefined) result.heartbeatIntervalMs = heartbeatIntervalMs
  return result
}

export function readPersistedWakatimeConfig(file: string = getPluginSettingsFilePath()): PersistedWakatimeConfig {
  try {
    return sanitize(JSON.parse(fs.readFileSync(file, 'utf8')))
  } catch {
    return {}
  }
}

export function writePersistedWakatimeConfig(
  patch: PersistedWakatimeConfig,
  file: string = getPluginSettingsFilePath(),
): PersistedWakatimeConfig {
  const merged = { ...readPersistedWakatimeConfig(file), ...patch }
  if (patch.cliPath === '') delete merged.cliPath
  const next = sanitize(merged)
  const directory = path.dirname(file)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The rename normally consumed the temporary file.
    }
  }
  return next
}

export function getPersistedWakatimeConfigPath(): string {
  return getPluginSettingsFilePath()
}

export function getPersistedWakatimeDataDir(): string {
  return getPluginDataDir()
}
