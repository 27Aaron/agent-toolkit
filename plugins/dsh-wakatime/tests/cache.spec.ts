import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readWakatimeCache, writeWakatimeCache } from '../src/cache.ts'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('WakaTime cache persistence', () => {
  it('writes a versioned cache with restrictive local permissions and reads it back', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-cache-'))
    directories.push(directory)
    const file = join(directory, 'cache.json')
    const cache = { version: 1, usage: { key: 'api|range', fetchedAt: 123, value: { available: true } as never } }

    writeWakatimeCache(cache, file)

    expect(readWakatimeCache(file)).toEqual(cache)
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(1)
  })

  it('ignores caches from an unknown schema version', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-cache-'))
    directories.push(directory)
    const file = join(directory, 'cache.json')

    writeFileSync(file, JSON.stringify({ version: 2 }))

    expect(readWakatimeCache(file)).toEqual({ version: 1 })
  })
})
