import { execFile } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as net from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as tls from 'node:tls'
import { inflateRawSync } from 'node:zlib'
import type { ResolvedConfig } from './config.ts'
import type { PluginLogger } from './logger.ts'
import { getPluginDataDir, getWakatimeResourcesDir } from './paths.ts'
import type { WakatimeSettings } from './settings.ts'
import type { WakatimeCliStatus, WakatimeCliUpdateCheck } from './ui-contract.ts'

const GITHUB_RELEASES_URL = 'https://api.github.com/repos/wakatime/wakatime-cli/releases/latest'
const GITHUB_DOWNLOAD_URL = 'https://github.com/wakatime/wakatime-cli/releases/latest/download'
const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
const MAX_JSON_BYTES = 1024 * 1024
const MAX_REDIRECTS = 5
const EXEC_TIMEOUT_MS = 10_000

const SUPPORTED_PLATFORMS = new Set([
  'android-amd64',
  'android-arm64',
  'darwin-amd64',
  'darwin-arm64',
  'freebsd-386',
  'freebsd-amd64',
  'freebsd-arm',
  'linux-386',
  'linux-amd64',
  'linux-arm',
  'linux-arm64',
  'netbsd-386',
  'netbsd-amd64',
  'netbsd-arm',
  'openbsd-386',
  'openbsd-amd64',
  'openbsd-arm',
  'openbsd-arm64',
  'windows-386',
  'windows-amd64',
  'windows-arm64',
])

interface CliState {
  lastCheckedAt?: number
  version?: string
}

export interface WakatimeRequestPolicy {
  timeoutMs: number
  noSSLVerify: boolean
  proxy?: string
}

function isWindows(): boolean {
  return os.platform() === 'win32'
}

function osName(): string {
  return isWindows() ? 'windows' : os.platform()
}

function architecture(): string {
  const arch = os.arch()
  if (arch === 'x64') return 'amd64'
  if (arch === 'ia32' || arch.includes('32')) return '386'
  return arch
}

export function platformName(): string {
  return `${osName()}-${architecture()}`
}

export function cliBinaryName(): string {
  const platform = platformName()
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`wakatime-cli does not publish a binary for ${platform}`)
  }
  return `wakatime-cli-${platform}${isWindows() ? '.exe' : ''}`
}

function executableOnPath(name: string): string | undefined {
  const pathValue = process.env.PATH
  if (pathValue === undefined) return undefined
  const names = isWindows()
    ? [name.endsWith('.exe') ? name : `${name}.exe`, name]
    : [name]
  for (const directory of pathValue.split(path.delimiter)) {
    const base = directory.length === 0 ? process.cwd() : directory
    for (const candidateName of names) {
      const candidate = path.join(base, candidateName)
      try {
        if (!fs.statSync(candidate).isFile()) continue
        fs.accessSync(candidate, isWindows() ? fs.constants.F_OK : fs.constants.X_OK)
        return candidate
      } catch {
        // Continue searching PATH.
      }
    }
  }
  return undefined
}

function proxyAuthorization(proxy: URL): string | undefined {
  if (proxy.username.length === 0 && proxy.password.length === 0) return undefined
  const user = decodeURIComponent(proxy.username)
  const password = decodeURIComponent(proxy.password)
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
}

function waitForSocket(socket: net.Socket, event: 'connect' | 'secureConnect', timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`proxy connection timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    const cleanup = (): void => {
      clearTimeout(timeout)
      socket.removeListener('error', onError)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    socket.once('error', onError)
    socket.once(event, () => {
      cleanup()
      resolve()
    })
  })
}

async function createProxyTunnel(
  proxy: URL,
  target: URL,
  policy: WakatimeRequestPolicy,
): Promise<net.Socket> {
  if (proxy.protocol !== 'http:' && proxy.protocol !== 'https:') {
    throw new Error(`unsupported proxy protocol ${proxy.protocol}`)
  }
  const port = proxy.port.length > 0
    ? Number.parseInt(proxy.port, 10)
    : proxy.protocol === 'https:' ? 443 : 80
  const socket: net.Socket = proxy.protocol === 'https:'
    ? tls.connect({
        host: proxy.hostname,
        port,
        servername: proxy.hostname,
        rejectUnauthorized: !policy.noSSLVerify,
      })
    : net.connect(port, proxy.hostname)
  await waitForSocket(socket, proxy.protocol === 'https:' ? 'secureConnect' : 'connect', policy.timeoutMs)

  return new Promise((resolve, reject) => {
    let response = ''
    const timeout = setTimeout(() => {
      cleanup()
      socket.destroy()
      reject(new Error(`proxy CONNECT timed out after ${policy.timeoutMs}ms`))
    }, policy.timeoutMs)
    const cleanup = (): void => {
      clearTimeout(timeout)
      socket.removeListener('error', onError)
      socket.removeListener('data', onData)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const onData = (chunk: Buffer): void => {
      response += chunk.toString('latin1')
      const headerEnd = response.indexOf('\r\n\r\n')
      if (headerEnd < 0) {
        if (response.length > 64 * 1024) {
          cleanup()
          socket.destroy()
          reject(new Error('proxy CONNECT response headers exceeded 64 KiB'))
        }
        return
      }
      cleanup()
      const status = response.slice(0, response.indexOf('\r\n'))
      if (!/^HTTP\/\d(?:\.\d)? 200(?: |$)/.test(status)) {
        socket.destroy()
        reject(new Error(`proxy CONNECT failed: ${status}`))
        return
      }
      resolve(socket)
    }
    socket.once('error', onError)
    socket.on('data', onData)
    const authorization = proxyAuthorization(proxy)
    const authority = `${target.hostname}:${target.port || '443'}`
    socket.write(
      `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n`
      + (authorization === undefined ? '' : `Proxy-Authorization: ${authorization}\r\n`)
      + 'Connection: keep-alive\r\n\r\n',
    )
  })
}

async function sendRequest(
  url: string,
  policy: WakatimeRequestPolicy,
  extraHeaders: Record<string, string> = {},
): Promise<http.IncomingMessage> {
  const target = new URL(url)
  if (target.protocol !== 'https:') throw new Error(`refusing non-HTTPS download URL: ${target.protocol}`)
  const proxy = policy.proxy === undefined ? undefined : new URL(policy.proxy)
  const headers = { 'User-Agent': 'github.com/27Aaron/agent-toolkit/dsh-wakatime', ...extraHeaders }

  if (proxy !== undefined) {
    const tunnel = await createProxyTunnel(proxy, target, policy)
    const secure = tls.connect({
      socket: tunnel,
      servername: target.hostname,
      rejectUnauthorized: !policy.noSSLVerify,
    })
    return new Promise((resolve, reject) => {
      const request = https.request({
        hostname: target.hostname,
        port: target.port.length > 0 ? Number.parseInt(target.port, 10) : 443,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        headers,
        agent: false,
        createConnection: () => secure,
      }, resolve)
      request.setTimeout(policy.timeoutMs, () => request.destroy(new Error(`request timed out after ${policy.timeoutMs}ms`)))
      request.once('error', reject)
      request.end()
    })
  }

  return new Promise((resolve, reject) => {
    const request = https.request(target, {
      method: 'GET',
      headers,
      rejectUnauthorized: !policy.noSSLVerify,
    }, resolve)
    request.setTimeout(policy.timeoutMs, () => request.destroy(new Error(`request timed out after ${policy.timeoutMs}ms`)))
    request.once('error', reject)
    request.end()
  })
}

async function requestWithRedirects(
  url: string,
  policy: WakatimeRequestPolicy,
  redirectsLeft: number = MAX_REDIRECTS,
  headers: Record<string, string> = {},
): Promise<http.IncomingMessage> {
  const response = await sendRequest(url, policy, headers)
  const status = response.statusCode ?? 0
  const location = response.headers.location
  if (status >= 300 && status < 400 && location !== undefined) {
    response.resume()
    if (redirectsLeft === 0) throw new Error('too many HTTP redirects')
    const nextUrl = new URL(location, url)
    const previousUrl = new URL(url)
    const nextHeaders = nextUrl.origin === previousUrl.origin
      ? headers
      : Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== 'authorization'))
    return requestWithRedirects(nextUrl.toString(), policy, redirectsLeft - 1, nextHeaders)
  }
  return response
}

/** Fetch a bounded JSON response using the same proxy and TLS policy as the CLI manager. */
export async function requestWakatimeJson(
  url: string,
  policy: WakatimeRequestPolicy,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const response = await requestWithRedirects(url, policy, MAX_REDIRECTS, headers)
  const status = response.statusCode ?? 0
  if (status < 200 || status >= 300) {
    response.resume()
    throw new Error(`WakaTime API returned HTTP ${status}`)
  }
  const chunks: Buffer[] = []
  let length = 0
  for await (const raw of response) {
    const chunk = typeof raw === 'string' ? Buffer.from(raw) : raw as Buffer
    length += chunk.length
    if (length > MAX_JSON_BYTES) throw new Error('WakaTime API response exceeded 1 MiB')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

class SizeLimitTransform extends Transform {
  private size = 0

  constructor(private readonly maximum: number) {
    super()
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null, data?: Buffer) => void): void {
    this.size += chunk.length
    if (this.size > this.maximum) {
      callback(new Error(`download exceeded ${this.maximum} bytes`))
      return
    }
    callback(null, chunk)
  }
}

async function downloadToFile(url: string, destination: string, policy: WakatimeRequestPolicy): Promise<void> {
  const response = await requestWithRedirects(url, policy)
  const status = response.statusCode ?? 0
  if (status < 200 || status >= 300) {
    response.resume()
    throw new Error(`download returned HTTP ${status}`)
  }
  const declared = Number(response.headers['content-length'] ?? 0)
  if (Number.isFinite(declared) && declared > MAX_ARCHIVE_BYTES) {
    response.resume()
    throw new Error(`download content length ${declared} exceeds safety limit`)
  }
  await pipeline(
    response,
    new SizeLimitTransform(MAX_ARCHIVE_BYTES),
    fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
  )
}

async function getLatestVersion(policy: WakatimeRequestPolicy): Promise<string | undefined> {
  const response = await requestWithRedirects(GITHUB_RELEASES_URL, policy)
  const status = response.statusCode ?? 0
  if (status !== 200) {
    response.resume()
    throw new Error(`GitHub releases API returned HTTP ${status}`)
  }
  const chunks: Buffer[] = []
  let length = 0
  for await (const raw of response) {
    const chunk = typeof raw === 'string' ? Buffer.from(raw) : raw as Buffer
    length += chunk.length
    if (length > MAX_JSON_BYTES) throw new Error('GitHub releases response exceeded 1 MiB')
    chunks.push(chunk)
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { tag_name?: unknown }
  return typeof parsed.tag_name === 'string' && parsed.tag_name.length > 0
    ? parsed.tag_name
    : undefined
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const earliest = Math.max(0, archive.length - 65_557)
  for (let offset = archive.length - 22; offset >= earliest; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset
  }
  return -1
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

export function extractCliBinary(archive: Buffer, expectedName: string): Buffer {
  const eocd = findEndOfCentralDirectory(archive)
  if (eocd < 0) throw new Error('invalid ZIP: end-of-central-directory record is missing')
  const entries = archive.readUInt16LE(eocd + 10)
  let offset = archive.readUInt32LE(eocd + 16)

  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > archive.length || archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('invalid ZIP: malformed central directory')
    }
    const method = archive.readUInt16LE(offset + 10)
    const expectedCrc = archive.readUInt32LE(offset + 16)
    const compressedSize = archive.readUInt32LE(offset + 20)
    const uncompressedSize = archive.readUInt32LE(offset + 24)
    const fileNameLength = archive.readUInt16LE(offset + 28)
    const extraLength = archive.readUInt16LE(offset + 30)
    const commentLength = archive.readUInt16LE(offset + 32)
    const localOffset = archive.readUInt32LE(offset + 42)
    const nameStart = offset + 46
    const nameEnd = nameStart + fileNameLength
    if (nameEnd > archive.length) throw new Error('invalid ZIP: truncated file name')
    const entryName = archive.toString('utf8', nameStart, nameEnd).replace(/\\/g, '/')
    offset = nameEnd + extraLength + commentLength

    if (path.posix.basename(entryName) !== expectedName) continue
    if (uncompressedSize > MAX_ARCHIVE_BYTES) throw new Error('wakatime-cli archive expands beyond safety limit')
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      throw new Error('invalid ZIP: malformed local file header')
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26)
    const localExtraLength = archive.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > archive.length) throw new Error('invalid ZIP: truncated file data')
    const compressed = archive.subarray(dataStart, dataEnd)
    const binary = method === 0
      ? Buffer.from(compressed)
      : method === 8
        ? inflateRawSync(compressed)
        : undefined
    if (binary === undefined) throw new Error(`unsupported ZIP compression method ${method}`)
    if (binary.length !== uncompressedSize) throw new Error('invalid ZIP: uncompressed size mismatch')
    if (crc32(binary) !== expectedCrc) throw new Error('invalid ZIP: CRC-32 mismatch')
    return binary
  }
  throw new Error(`wakatime-cli archive does not contain ${expectedName}`)
}

function execVersion(binary: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(binary, ['--version'], {
      encoding: 'utf8',
      timeout: EXEC_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(error)
        return
      }
      const version = `${stdout}${stderr}`.trim()
      if (version.length === 0) reject(new Error('wakatime-cli --version returned no output'))
      else resolve(version)
    })
  })
}

function readCliState(file: string): CliState {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as CliState
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCliState(file: string, state: CliState): void {
  const directory = path.dirname(file)
  const temporary = path.join(directory, `.cli-state.${process.pid}.${crypto.randomBytes(5).toString('hex')}.tmp`)
  try {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, file)
  } finally {
    try {
      fs.unlinkSync(temporary)
    } catch {
      // The rename normally consumed the temporary file.
    }
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export class CliManager {
  private readonly managedPath: string
  private readonly stateFile: string
  private readonly installLock: string
  private inflight: Promise<string | undefined> | undefined

  constructor(
    private config: ResolvedConfig,
    private settings: WakatimeSettings,
    private readonly logger: PluginLogger,
  ) {
    const dataDir = getPluginDataDir()
    this.managedPath = path.join(
      getWakatimeResourcesDir(),
      `wakatime-cli-${platformName()}${isWindows() ? '.exe' : ''}`,
    )
    this.stateFile = path.join(dataDir, 'cli-state.json')
    this.installLock = path.join(dataDir, 'cli-install.lock')
  }

  ensureInstalled(): Promise<string | undefined> {
    if (this.inflight !== undefined) return this.inflight
    const operation = this.resolveCli()
    this.inflight = operation
    const clear = (): void => {
      if (this.inflight === operation) this.inflight = undefined
    }
    void operation.then(clear, clear)
    return operation
  }

  updateConfig(config: ResolvedConfig): void {
    this.config = config
  }

  updateSettings(settings: WakatimeSettings): void {
    this.settings = settings
  }

  async inspect(): Promise<WakatimeCliStatus> {
    if (this.config.cliPath !== undefined) {
      try {
        return {
          state: 'ready',
          source: 'configured',
          path: this.config.cliPath,
          version: await execVersion(this.config.cliPath),
          managedPath: this.managedPath,
        }
      } catch {
        return {
          state: 'invalid',
          source: 'configured',
          path: this.config.cliPath,
          managedPath: this.managedPath,
        }
      }
    }

    const global = executableOnPath('wakatime-cli')
    if (global !== undefined) {
      try {
        return {
          state: 'ready',
          source: 'path',
          path: global,
          version: await execVersion(global),
          managedPath: this.managedPath,
        }
      } catch {
        return {
          state: 'invalid',
          source: 'path',
          path: global,
          managedPath: this.managedPath,
        }
      }
    }

    if (fs.existsSync(this.managedPath)) {
      try {
        return {
          state: 'ready',
          source: 'managed',
          path: this.managedPath,
          version: await execVersion(this.managedPath),
          managedPath: this.managedPath,
        }
      } catch {
        return {
          state: 'invalid',
          source: 'managed',
          path: this.managedPath,
          managedPath: this.managedPath,
        }
      }
    }

    return { state: 'missing', source: 'none', managedPath: this.managedPath }
  }

  async test(): Promise<WakatimeCliStatus> {
    const binary = await this.ensureInstalled()
    if (binary === undefined) return this.inspect()
    try {
      const inspected = await this.inspect()
      if (inspected.path === binary && inspected.state === 'ready') return inspected
      return {
        state: 'ready',
        source: this.sourceFor(binary),
        path: binary,
        version: await execVersion(binary),
        managedPath: this.managedPath,
      }
    } catch {
      return {
        state: 'invalid',
        source: this.sourceFor(binary),
        path: binary,
        managedPath: this.managedPath,
      }
    }
  }

  /**
   * Install the managed CLI only when the user explicitly asks for it.
   * System and explicitly configured binaries are never replaced.
   */
  async download(): Promise<WakatimeCliStatus> {
    const inspected = await this.inspect()
    if (inspected.source === 'configured' || inspected.source === 'path') return inspected
    await this.installManagedCli()
    const next = await this.inspect()
    if (next.state !== 'ready' || next.source !== 'managed') {
      throw new Error('wakatime-cli could not be installed in the WakaTime directory')
    }
    return next
  }

  /**
   * Check the managed CLI for an update without touching PATH or configured
   * installations. Manual checks bypass the normal update interval.
   */
  async update(): Promise<WakatimeCliStatus> {
    const inspected = await this.inspect()
    if (inspected.source !== 'managed' || inspected.state !== 'ready') return inspected
    await this.maybeUpdateManagedCli(true)
    return this.inspect()
  }

  /**
   * Check the managed CLI for an update without downloading or replacing it.
   * System and explicitly configured binaries are never checked or changed.
   */
  async checkUpdate(): Promise<Omit<WakatimeCliUpdateCheck, 'status'>> {
    const inspected = await this.inspect()
    if (inspected.source !== 'managed' || inspected.state !== 'ready' || inspected.version === undefined || inspected.version === '<local-build>') {
      return { updateAvailable: false }
    }
    const latestVersion = await getLatestVersion(this.requestPolicy())
    writeCliState(this.stateFile, { lastCheckedAt: Date.now(), version: inspected.version })
    if (latestVersion === undefined) return { updateAvailable: false }
    return { updateAvailable: latestVersion !== inspected.version, latestVersion }
  }

  private sourceFor(binary: string): WakatimeCliStatus['source'] {
    if (this.config.cliPath === binary) return 'configured'
    if (binary === this.managedPath) return 'managed'
    return 'path'
  }

  private async resolveCli(): Promise<string | undefined> {
    if (this.config.cliPath !== undefined) {
      try {
        await execVersion(this.config.cliPath)
        return this.config.cliPath
      } catch (error) {
        this.logger.exception('ERROR', error, `configured cliPath is not executable: ${this.config.cliPath}`)
        return undefined
      }
    }

    const global = executableOnPath('wakatime-cli')
    if (global !== undefined) {
      try {
        const version = await execVersion(global)
        this.logger.debug(`using wakatime-cli ${version} from PATH: ${global}`)
        return global
      } catch (error) {
        this.logger.exception('WARN', error, `ignoring unusable wakatime-cli on PATH: ${global}`)
      }
    }

    if (!fs.existsSync(this.managedPath)) {
      if (!this.config.autoInstall) {
        this.logger.warn('wakatime-cli is unavailable and autoInstall is disabled')
        return undefined
      }
      return this.installManagedCli()
    }

    if (this.config.autoInstall) await this.maybeUpdateManagedCli()
    return this.managedPath
  }

  private requestPolicy(): WakatimeRequestPolicy {
    return {
      timeoutMs: this.config.cliDownloadTimeoutMs,
      noSSLVerify: this.settings.noSSLVerify,
      ...(this.settings.proxy === undefined ? {} : { proxy: this.settings.proxy }),
    }
  }

  private async maybeUpdateManagedCli(force = false): Promise<void> {
    const state = readCliState(this.stateFile)
    if (!force && typeof state.lastCheckedAt === 'number'
      && Date.now() - state.lastCheckedAt < this.config.cliUpdateCheckIntervalMs) return

    let currentVersion: string
    try {
      currentVersion = await execVersion(this.managedPath)
    } catch {
      await this.installManagedCli()
      return
    }
    if (currentVersion === '<local-build>') {
      writeCliState(this.stateFile, { lastCheckedAt: Date.now(), version: currentVersion })
      return
    }

    try {
      const latest = await getLatestVersion(this.requestPolicy())
      writeCliState(this.stateFile, { lastCheckedAt: Date.now(), version: currentVersion })
      if (latest !== undefined && latest !== currentVersion) {
        this.logger.info(`updating managed wakatime-cli from ${currentVersion} to ${latest}`)
        await this.installManagedCli(true, latest)
      }
    } catch (error) {
      writeCliState(this.stateFile, { lastCheckedAt: Date.now(), version: currentVersion })
      this.logger.exception('WARN', error, 'could not check for wakatime-cli updates; keeping current binary')
    }
  }

  private async installManagedCli(
    forceReplace: boolean = false,
    expectedVersion?: string,
  ): Promise<string | undefined> {
    const release = await this.acquireInstallLock()
    if (release === undefined) {
      if (fs.existsSync(this.managedPath)) return this.managedPath
      this.logger.warn('timed out waiting for another process to install wakatime-cli')
      return undefined
    }

    const token = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`
    const archivePath = path.join(getPluginDataDir(), `wakatime-cli-${token}.zip`)
    const candidatePath = `${this.managedPath}.${token}.tmp`
    const backupPath = `${this.managedPath}.${token}.backup`
    try {
      if (forceReplace && expectedVersion !== undefined && fs.existsSync(this.managedPath)) {
        try {
          if (await execVersion(this.managedPath) === expectedVersion) return this.managedPath
        } catch {
          // Replace a broken binary below.
        }
      }
      if (!forceReplace && fs.existsSync(this.managedPath)) {
        try {
          await execVersion(this.managedPath)
          const state = readCliState(this.stateFile)
          if (typeof state.lastCheckedAt === 'number'
            && Date.now() - state.lastCheckedAt < this.config.cliUpdateCheckIntervalMs) {
            return this.managedPath
          }
        } catch {
          // Replace a broken binary below.
        }
      }

      fs.mkdirSync(getPluginDataDir(), { recursive: true, mode: 0o700 })
      fs.mkdirSync(path.dirname(this.managedPath), { recursive: true, mode: 0o700 })
      const expectedName = cliBinaryName()
      const url = `${GITHUB_DOWNLOAD_URL}/wakatime-cli-${platformName()}.zip`
      this.logger.info(`downloading managed wakatime-cli for ${platformName()}`)
      await downloadToFile(url, archivePath, this.requestPolicy())
      const binary = extractCliBinary(fs.readFileSync(archivePath), expectedName)
      fs.writeFileSync(candidatePath, binary, { flag: 'wx', mode: 0o755 })
      if (!isWindows()) fs.chmodSync(candidatePath, 0o755)
      const version = await execVersion(candidatePath)

      if (fs.existsSync(this.managedPath)) fs.renameSync(this.managedPath, backupPath)
      try {
        fs.renameSync(candidatePath, this.managedPath)
      } catch (error) {
        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, this.managedPath)
        throw error
      }
      try {
        fs.unlinkSync(backupPath)
      } catch {
        // There was no prior binary, or cleanup can be retried next update.
      }
      writeCliState(this.stateFile, { lastCheckedAt: Date.now(), version })
      this.logger.info(`managed wakatime-cli ${version} installed`)
      return this.managedPath
    } catch (error) {
      this.logger.exception('ERROR', error, 'failed to install wakatime-cli')
      return fs.existsSync(this.managedPath) ? this.managedPath : undefined
    } finally {
      for (const file of [archivePath, candidatePath]) {
        try {
          fs.unlinkSync(file)
        } catch {
          // Best-effort cleanup.
        }
      }
      release()
    }
  }

  private async acquireInstallLock(): Promise<(() => void) | undefined> {
    fs.mkdirSync(path.dirname(this.installLock), { recursive: true, mode: 0o700 })
    const deadline = Date.now() + this.config.cliDownloadTimeoutMs
    while (Date.now() <= deadline) {
      let descriptor: number | undefined
      const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`
      try {
        descriptor = fs.openSync(this.installLock, 'wx', 0o600)
        fs.writeFileSync(descriptor, token, 'utf8')
        const openedDescriptor = descriptor
        return () => {
          try {
            if (fs.readFileSync(this.installLock, 'utf8') === token) fs.unlinkSync(this.installLock)
          } catch {
            // Already removed.
          }
          try {
            fs.closeSync(openedDescriptor)
          } catch {
            // Already closed.
          }
        }
      } catch (error) {
        if (descriptor !== undefined) fs.closeSync(descriptor)
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? (error as NodeJS.ErrnoException).code
          : undefined
        if (code !== 'EEXIST') throw error
        try {
          const stat = fs.statSync(this.installLock)
          if (Date.now() - stat.mtimeMs > Math.max(this.config.cliDownloadTimeoutMs * 2, 300_000)) {
            fs.unlinkSync(this.installLock)
            continue
          }
        } catch {
          continue
        }
        await sleep(250)
      }
    }
    return undefined
  }
}
