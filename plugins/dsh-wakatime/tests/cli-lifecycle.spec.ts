import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { claimStaleLock, recoverOrphanedCliBackup } from '../src/cli.ts'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-lifecycle-'))
  directories.push(directory)
  return directory
}

describe('install lock stale claiming', () => {
  it('claims and removes a stale lock', () => {
    const directory = tempDir()
    const lock = join(directory, 'install.lock')
    writeFileSync(lock, 'holder-token')
    // utimesSync needs Date objects; plain numbers are interpreted as seconds.
    const twoHoursAgo = new Date(Date.now() - 7_200_000)
    utimesSync(lock, twoHoursAgo, twoHoursAgo)

    expect(claimStaleLock(lock, 300_000)).toBe(true)
    expect(existsSync(lock)).toBe(false)
    // No claim litter left behind.
    expect(readdirSync(directory)).toEqual([])
  })

  it('leaves a fresh lock to its owner', () => {
    const directory = tempDir()
    const lock = join(directory, 'install.lock')
    writeFileSync(lock, 'holder-token')

    expect(claimStaleLock(lock, 300_000)).toBe(false)
    expect(existsSync(lock)).toBe(true)
    expect(readFileSync(lock, 'utf8')).toBe('holder-token')
  })
})

describe('orphaned backup recovery', () => {
  it('restores the newest-mtime backup when the managed binary is missing', () => {
    const directory = tempDir()
    const managed = join(directory, 'wakatime-cli')
    // Backup names embed a random token, not a timestamp: "newest" must
    // follow mtime, so the lexicographically-first name is the newer one.
    writeFileSync(`${managed}.111-aaa.backup`, 'mtime-newer-binary')
    writeFileSync(`${managed}.222-bbb.backup`, 'mtime-older-binary')
    utimesSync(`${managed}.111-aaa.backup`, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000))
    utimesSync(`${managed}.222-bbb.backup`, new Date(Date.now() - 600_000), new Date(Date.now() - 600_000))
    const warnings: string[] = []

    recoverOrphanedCliBackup(managed, message => warnings.push(message))

    expect(existsSync(managed)).toBe(true)
    expect(readFileSync(managed, 'utf8')).toBe('mtime-newer-binary')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/backup/)
    expect(readdirSync(directory)).toEqual(['wakatime-cli'])
  })

  it('drops orphaned backups when the managed binary is healthy', () => {
    const directory = tempDir()
    const managed = join(directory, 'wakatime-cli')
    writeFileSync(managed, 'live-binary')
    writeFileSync(`${managed}.333-ccc.backup`, 'orphan')
    const warnings: string[] = []

    recoverOrphanedCliBackup(managed, message => warnings.push(message))

    expect(readFileSync(managed, 'utf8')).toBe('live-binary')
    expect(warnings).toHaveLength(0)
    expect(readdirSync(directory)).toEqual(['wakatime-cli'])
  })
})
