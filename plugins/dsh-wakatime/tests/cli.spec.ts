import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CliManager, extractCliBinary, platformName } from '../src/cli.ts'
import { resolveConfig } from '../src/config.ts'
import { PluginLogger } from '../src/logger.ts'

const originalPath = process.env.PATH
const originalHome = process.env.WAKATIME_HOME
const directories: string[] = []

afterEach(() => {
  if (originalPath === undefined) delete process.env.PATH
  else process.env.PATH = originalPath
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function storedZip(name: string, data: Buffer): Buffer {
  const fileName = Buffer.from(name)
  const crc = crc32(data)
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(fileName.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(fileName.length, 28)

  const localRecord = Buffer.concat([local, fileName, data])
  const centralRecord = Buffer.concat([central, fileName])
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralRecord.length, 12)
  eocd.writeUInt32LE(localRecord.length, 16)
  return Buffer.concat([localRecord, centralRecord, eocd])
}

describe('managed CLI archive validation', () => {
  it('extracts only the expected binary and validates CRC', () => {
    const binary = Buffer.from('fake-wakatime-cli')
    const archive = storedZip('nested/wakatime-cli-test', binary)
    expect(extractCliBinary(archive, 'wakatime-cli-test')).toEqual(binary)
    expect(() => extractCliBinary(archive, 'other')).toThrow(/does not contain/)

    const corrupted = Buffer.from(archive)
    const dataOffset = 30 + Buffer.byteLength('nested/wakatime-cli-test')
    corrupted[dataOffset] = corrupted[dataOffset]! ^ 0xff
    expect(() => extractCliBinary(corrupted, 'wakatime-cli-test')).toThrow(/CRC-32/)
  })
})

describe('CliManager', () => {
  it('accepts an explicit executable after checking --version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-cli-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    const logger = new PluginLogger(undefined, true, join(directory, 'test.log'))
    const manager = new CliManager(
      resolveConfig({ cliPath: process.execPath, autoInstall: false }),
      { debug: false, noSSLVerify: false },
      logger,
    )
    await expect(manager.ensureInstalled()).resolves.toBe(process.execPath)
  })

  it('does not download when autoInstall is disabled', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-cli-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory
    process.env.PATH = ''
    const manager = new CliManager(
      resolveConfig({ autoInstall: false }),
      { debug: false, noSSLVerify: false },
      new PluginLogger(undefined, true, join(directory, 'test.log')),
    )
    await expect(manager.ensureInstalled()).resolves.toBeUndefined()
  })

  it('maps the current Node platform to a published WakaTime asset', () => {
    expect(platformName()).toMatch(/^(darwin|linux|windows|freebsd|netbsd|openbsd|android)-(amd64|arm64|arm|386)$/)
  })
})
