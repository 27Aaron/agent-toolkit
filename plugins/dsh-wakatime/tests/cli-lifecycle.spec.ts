import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CliManager, claimStaleLock, recoverOrphanedCliBackup } from '../src/cli.ts'
import { resolveConfig } from '../src/config.ts'
import { PluginLogger } from '../src/logger.ts'
import type { WakatimeCliStatus } from '../src/ui-contract.ts'

const { execFileMock, requestMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
  requestMock: vi.fn(),
}))

vi.mock('node:child_process', async importOriginal => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFile: execFileMock,
}))

vi.mock('node:https', async importOriginal => ({
  ...await importOriginal<typeof import('node:https')>(),
  request: requestMock,
}))

const directories: string[] = []

beforeEach(() => {
  execFileMock.mockReset()
  requestMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
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

describe('managed CLI version lifecycle', () => {
  interface InstallableCli {
    installManagedCli(forceReplace?: boolean, expectedVersion?: string): Promise<string | undefined>
  }

  function managerForVersion(version: string): CliManager {
    const directory = tempDir()
    vi.stubEnv('WAKATIME_HOME', directory)
    execFileMock.mockImplementation((_file, _args, _options, callback) => {
      callback(null, version, '')
      return new EventEmitter()
    })
    return new CliManager(
      resolveConfig({ cliPath: process.execPath, autoInstall: false }),
      { debug: false, noSSLVerify: false },
      new PluginLogger(undefined, true, join(directory, 'test.log')),
    )
  }

  function respondWith(statusCode: number, body: unknown): (url: unknown, options: unknown, callback: (response: IncomingMessage) => void) => EventEmitter {
    return (_url, _options, callback) => {
      const response = Object.assign(Readable.from([JSON.stringify(body)]), { statusCode, headers: {} })
      return Object.assign(new EventEmitter(), {
        setTimeout: vi.fn(),
        end: () => callback(response as IncomingMessage),
      })
    }
  }

  async function managedUpdate(currentVersion: string, latestVersion: string) {
    const manager = managerForVersion(currentVersion)
    const initial = await manager.inspect()
    const status: WakatimeCliStatus = {
      state: 'ready', source: 'managed', version: currentVersion,
      path: initial.managedPath, managedPath: initial.managedPath,
    }
    vi.spyOn(manager, 'inspect').mockResolvedValue(status)
    requestMock.mockImplementation(respondWith(200, { tag_name: latestVersion }))
    const install = vi.spyOn(manager as unknown as InstallableCli, 'installManagedCli').mockImplementation(async () => {
      status.version = latestVersion
      execFileMock.mockImplementation((_file, _args, _options, callback) => {
        callback(null, latestVersion, '')
        return new EventEmitter()
      })
      return status.managedPath
    })
    return { manager, install }
  }

  it.each([
    ['v2.24.4', false],
    ['v2.25.0', true],
    ['<local-build>', undefined],
    ['v2.25.0-alpha.1', undefined],
    ['unrecognized-version', undefined],
  ] as const)('reports only verified native capability for %s', async (version, expected) => {
    const status = await managerForVersion(version).inspect()
    expect(status.version).toBe(version)
    if (expected === undefined) expect(status).not.toHaveProperty('nativeSync')
    else expect(status.nativeSync).toBe(expected)
  })

  it.each([
    ['v2.26.0-alpha.1', 'v2.25.0', false],
    ['v2.25.0', 'v2.24.4', false],
    ['2.25.0+distribution.1', 'v2.25.0', false],
    ['unrecognized-version', 'v2.25.0', false],
    ['v2.24.4', 'v2.25.0', true],
    ['v2.25.0-alpha.1', 'v2.25.0', true],
  ] as const)('checks and updates %s to %s only when newer', async (current, latest, updateAvailable) => {
    const { manager, install } = await managedUpdate(current, latest)
    await expect(manager.checkUpdate()).resolves.toEqual({ updateAvailable, latestVersion: latest })
    await manager.update()
    if (updateAvailable) expect(install).toHaveBeenCalledExactlyOnceWith(true, latest)
    else expect(install).not.toHaveBeenCalled()
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  it('does not replace a local build using the latest release endpoint', async () => {
    const { manager, install } = await managedUpdate('<local-build>', 'v2.25.0')
    await expect(manager.checkUpdate()).resolves.toEqual({ updateAvailable: false })
    await manager.update()
    expect(install).not.toHaveBeenCalled()
    expect(requestMock).not.toHaveBeenCalled()
  })

  it.each(['v2.26.0-alpha.1', '2.25.0+distribution.1', '<local-build>'])(
    'rechecks version %s under the install lock before replacing it',
    async currentVersion => {
      const manager = managerForVersion(currentVersion)
      const { managedPath } = await manager.inspect()
      writeFileSync(managedPath, 'already-installed-binary')

      await expect((manager as unknown as InstallableCli).installManagedCli(true, 'v2.25.0')).resolves.toBe(managedPath)
      expect(readFileSync(managedPath, 'utf8')).toBe('already-installed-binary')
      expect(requestMock).not.toHaveBeenCalled()
    },
  )

  it('reports a manual download failure instead of accepting the retained old binary', async () => {
    const { manager, install } = await managedUpdate('v2.24.4', 'v2.25.0')
    const { managedPath } = await manager.inspect()
    writeFileSync(managedPath, 'old-binary')
    install.mockRestore()
    requestMock.mockImplementationOnce(respondWith(200, { tag_name: 'v2.25.0' }))
      .mockImplementation(respondWith(503, {}))

    await expect(manager.update()).rejects.toThrow(/update to v2\.25\.0 did not complete; installed version is v2\.24\.4/)
    expect(readFileSync(managedPath, 'utf8')).toBe('old-binary')
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the existing CLI usable when the same download fails in the background', async () => {
    const { manager, install } = await managedUpdate('v2.24.4', 'v2.25.0')
    const { managedPath } = await manager.inspect()
    writeFileSync(managedPath, 'old-binary')
    install.mockRestore()
    requestMock.mockImplementationOnce(respondWith(200, { tag_name: 'v2.25.0' }))
      .mockImplementation(respondWith(503, {}))
    vi.stubEnv('PATH', '')
    manager.updateConfig(resolveConfig({ autoInstall: true }))

    await expect(manager.ensureInstalled()).resolves.toBe(managedPath)
    expect(readFileSync(managedPath, 'utf8')).toBe('old-binary')
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  it('propagates metadata request failures from manual updates', async () => {
    const { manager, install } = await managedUpdate('v2.24.4', 'v2.25.0')
    requestMock.mockImplementation(respondWith(503, {}))

    await expect(manager.update()).rejects.toThrow('GitHub releases API returned HTTP 503')
    expect(install).not.toHaveBeenCalled()
  })

  it.each(['v2.25.0', 'v2.26.0-alpha.1'])(
    'accepts a concurrent update to %s found after acquiring the install lock',
    async installedVersion => {
      const { manager, install } = await managedUpdate('v2.24.4', 'v2.25.0')
      const status = await manager.inspect()
      writeFileSync(status.managedPath, 'concurrently-installed-binary')
      install.mockRestore()
      vi.mocked(manager.inspect).mockResolvedValueOnce(status)
        .mockResolvedValue({ ...status, version: installedVersion })
      execFileMock.mockImplementationOnce((_file, _args, _options, callback) => {
        callback(null, 'v2.24.4', '')
        return new EventEmitter()
      }).mockImplementation((_file, _args, _options, callback) => {
        callback(null, installedVersion, '')
        return new EventEmitter()
      })

      await expect(manager.update()).resolves.toMatchObject({ version: installedVersion })
      expect(readFileSync(status.managedPath, 'utf8')).toBe('concurrently-installed-binary')
      expect(requestMock).toHaveBeenCalledTimes(1)
    },
  )
})
