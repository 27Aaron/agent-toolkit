import * as fs from 'node:fs'
import * as path from 'node:path'
import type { WakatimeInsightsData, WakatimeUsageData } from './ui-contract.ts'
import { getPluginDataDir } from './paths.ts'

const CACHE_VERSION = 1

export interface WakatimeCacheEntry<T> {
  key: string
  fetchedAt: number
  value: T
}

export interface WakatimeCache {
  version: number
  usage?: WakatimeCacheEntry<WakatimeUsageData>
  insights?: WakatimeCacheEntry<WakatimeInsightsData>
}

function cacheFilePath(): string {
  return path.join(getPluginDataDir(), 'cache.json')
}

function isCacheEntry(value: unknown): value is WakatimeCacheEntry<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<WakatimeCacheEntry<unknown>>
  return typeof entry.key === 'string'
    && typeof entry.fetchedAt === 'number'
    && Number.isFinite(entry.fetchedAt)
    && typeof entry.value === 'object'
    && entry.value !== null
}

export function readWakatimeCache(file: string = cacheFilePath()): WakatimeCache {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as WakatimeCache
    if (parsed.version !== CACHE_VERSION) return { version: CACHE_VERSION }
    return {
      version: CACHE_VERSION,
      ...(isCacheEntry(parsed.usage) ? { usage: parsed.usage as WakatimeCacheEntry<WakatimeUsageData> } : {}),
      ...(isCacheEntry(parsed.insights) ? { insights: parsed.insights as WakatimeCacheEntry<WakatimeInsightsData> } : {}),
    }
  } catch {
    return { version: CACHE_VERSION }
  }
}

export function writeWakatimeCache(cache: WakatimeCache, file: string = cacheFilePath()): void {
  const directory = path.dirname(file)
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporary, `${JSON.stringify({ ...cache, version: CACHE_VERSION }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The rename normally consumed the temporary file.
    }
  }
}
