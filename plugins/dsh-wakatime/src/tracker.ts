import type { FileChange } from './changes.ts'
import type { PluginLogger } from './logger.ts'
import type { HeartbeatRateLimiter } from './state.ts'

export interface Heartbeat {
  entity: string
  projectFolder: string
  lineChanges: number
  isWrite: boolean
  time: number
}

export type HeartbeatSender = (heartbeats: Heartbeat[]) => Promise<boolean>

interface ProjectBuffer {
  pending: Map<string, Heartbeat>
  requested: boolean
  forceRequested: boolean
  worker: Promise<void> | undefined
  retryTimer: NodeJS.Timeout | undefined
  capWarningLogged: boolean
}

export interface TrackerConfig {
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
  cliDownloadTimeoutMs: number
  maxPendingFiles: number
}

export class WakatimeTracker {
  private readonly projects = new Map<string, ProjectBuffer>()
  private accepting = true

  constructor(
    private readonly config: TrackerConfig,
    private readonly limiter: HeartbeatRateLimiter,
    private readonly send: HeartbeatSender,
    private readonly logger: PluginLogger,
  ) {}

  record(projectFolder: string, changes: FileChange[], time: number = Date.now() / 1_000): void {
    if (!this.accepting || changes.length === 0) return
    const buffer = this.buffer(projectFolder)
    for (const change of changes) {
      const existing = buffer.pending.get(change.file)
      if (existing === undefined && buffer.pending.size >= this.config.maxPendingFiles) {
        if (!buffer.capWarningLogged) {
          buffer.capWarningLogged = true
          this.logger.warn(
            `pending file cap (${this.config.maxPendingFiles}) reached for ${projectFolder}; new entities are ignored until flush`,
          )
        }
        continue
      }
      buffer.pending.set(change.file, {
        entity: change.file,
        projectFolder,
        lineChanges: (existing?.lineChanges ?? 0) + change.lineChanges,
        isWrite: (existing?.isWrite ?? false) || change.isWrite,
        time: Math.max(existing?.time ?? 0, time),
      })
    }
    if (buffer.pending.size > 0) void this.request(projectFolder, false)
  }

  checkpoint(projectFolder: string): void {
    const buffer = this.projects.get(projectFolder)
    if (buffer !== undefined && buffer.pending.size > 0) void this.request(projectFolder, false)
  }

  async flushProject(projectFolder: string): Promise<void> {
    const buffer = this.projects.get(projectFolder)
    if (buffer === undefined || (buffer.pending.size === 0 && buffer.worker === undefined)) {
      return
    }
    await this.request(projectFolder, true)
    // Cover a result that arrived at the worker's settlement boundary, and
    // give one retained failed batch a final retry without looping forever.
    if (buffer.requested || buffer.pending.size > 0) await this.request(projectFolder, true)
  }

  async dispose(): Promise<void> {
    this.accepting = false
    for (const buffer of this.projects.values()) {
      if (buffer.retryTimer !== undefined) clearTimeout(buffer.retryTimer)
      buffer.retryTimer = undefined
    }
    await Promise.all([...this.projects.keys()].map(project => this.flushProject(project)))
  }

  private buffer(projectFolder: string): ProjectBuffer {
    let buffer = this.projects.get(projectFolder)
    if (buffer === undefined) {
      buffer = {
        pending: new Map(),
        requested: false,
        forceRequested: false,
        worker: undefined,
        retryTimer: undefined,
        capWarningLogged: false,
      }
      this.projects.set(projectFolder, buffer)
    }
    return buffer
  }

  private request(projectFolder: string, force: boolean): Promise<void> {
    const buffer = this.buffer(projectFolder)
    buffer.requested = true
    buffer.forceRequested ||= force
    if (buffer.retryTimer !== undefined) {
      clearTimeout(buffer.retryTimer)
      buffer.retryTimer = undefined
    }
    if (buffer.worker !== undefined) return buffer.worker

    const worker = this.drain(projectFolder, buffer).catch(error => {
      this.logger.exception('WARN', error, `heartbeat worker failed for ${projectFolder}`)
    })
    buffer.worker = worker
    void worker.finally(() => {
      if (buffer.worker !== worker) return
      buffer.worker = undefined
      if (buffer.requested) void this.request(projectFolder, false)
    })
    return worker
  }

  private async drain(projectFolder: string, buffer: ProjectBuffer): Promise<void> {
    while (buffer.requested) {
      const force = buffer.forceRequested
      buffer.requested = false
      buffer.forceRequested = false
      await this.flushOnce(projectFolder, buffer, force)
    }
  }

  private async flushOnce(projectFolder: string, buffer: ProjectBuffer, force: boolean): Promise<void> {
    if (buffer.pending.size === 0) return
    let attempt
    try {
      attempt = await this.limiter.acquire(
        projectFolder,
        this.config.heartbeatIntervalMs,
        force,
        force ? Math.min(this.config.heartbeatTimeoutMs, 5_000) : 0,
        Math.max(this.config.heartbeatTimeoutMs, this.config.cliDownloadTimeoutMs),
      )
    } catch (error) {
      this.logger.exception('WARN', error, 'failed to acquire heartbeat rate-limit state')
      if (!force) this.scheduleRetry(projectFolder, buffer, this.config.heartbeatIntervalMs)
      return
    }

    if (attempt.lease === undefined) {
      if (!force) this.scheduleRetry(projectFolder, buffer, attempt.retryAfterMs)
      return
    }

    const batch = [...buffer.pending.values()]
    buffer.pending.clear()
    buffer.capWarningLogged = false
    let success = false
    try {
      success = await this.send(batch)
    } catch (error) {
      this.logger.exception('WARN', error, 'heartbeat dispatcher failed')
    } finally {
      attempt.lease.finish(success)
    }

    if (!success) {
      this.restore(buffer, batch)
      if (!force) this.scheduleRetry(
        projectFolder,
        buffer,
        Math.min(this.config.heartbeatIntervalMs, 30_000),
      )
    }
  }

  private restore(buffer: ProjectBuffer, batch: Heartbeat[]): void {
    for (const heartbeat of batch) {
      const existing = buffer.pending.get(heartbeat.entity)
      buffer.pending.set(heartbeat.entity, {
        ...heartbeat,
        lineChanges: heartbeat.lineChanges + (existing?.lineChanges ?? 0),
        isWrite: heartbeat.isWrite || (existing?.isWrite ?? false),
        time: Math.max(heartbeat.time, existing?.time ?? 0),
      })
    }
  }

  private scheduleRetry(projectFolder: string, buffer: ProjectBuffer, delayMs: number): void {
    if (!this.accepting || buffer.retryTimer !== undefined) return
    const timer = setTimeout(() => {
      buffer.retryTimer = undefined
      if (this.accepting && buffer.pending.size > 0) void this.request(projectFolder, false)
    }, Math.max(1, delayMs))
    timer.unref()
    buffer.retryTimer = timer
  }
}
