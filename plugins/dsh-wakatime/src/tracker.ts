import type { PluginLogger } from './logger.ts'
import type { SyncRateLimiter } from './state.ts'

export type SyncSender = () => Promise<boolean>

export interface TrackerConfig {
  heartbeatIntervalMs: number
  heartbeatTimeoutMs: number
  cliDownloadTimeoutMs: number
}

export interface TrackerStatus {
  pendingSync: boolean
}

/** Schedules native transcript scans; the CLI owns every activity record. */
export class WakatimeTracker {
  private generation = 0
  private syncedGeneration = 0
  private accepting = true
  private worker: Promise<void> | undefined
  private retryTimer: NodeJS.Timeout | undefined
  private disposal: Promise<void> | undefined

  constructor(
    private config: TrackerConfig,
    private readonly limiter: SyncRateLimiter,
    private readonly send: SyncSender,
    private readonly logger: PluginLogger,
  ) {}

  updateConfig(config: TrackerConfig): void {
    this.config = config
  }

  status(): TrackerStatus {
    return { pendingSync: this.generation > this.syncedGeneration }
  }

  record(): void {
    if (!this.accepting) return
    this.generation += 1
    // New events must not defeat an existing cadence or failure backoff.
    if (this.worker === undefined && this.retryTimer === undefined) void this.start(false)
  }

  async flush(): Promise<void> {
    if (!this.accepting) return
    // A manual sync must also discover transcripts from other sessions, even
    // when this instance has not observed a new event itself.
    this.generation += 1
    await this.flushPending()
  }

  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal
    this.accepting = false
    this.clearRetry()
    this.disposal = this.flushPending().then(() => {
      if (this.status().pendingSync) {
        this.logger.warn('native sync is still pending after shutdown retries; transcripts remain available for the next wakatime-cli sync')
      }
    })
    return this.disposal
  }

  private async flushPending(): Promise<void> {
    this.clearRetry()
    // Await cleanup as well as the send. This covers events arriving while a
    // worker is settling, without starting a second concurrent CLI process.
    await this.worker
    for (let attempt = 0; attempt < 2 && this.status().pendingSync; attempt += 1) {
      await this.start(true)
    }
  }

  private start(force: boolean): Promise<void> {
    if (this.worker !== undefined) return this.worker
    if (!this.status().pendingSync) return Promise.resolve()
    this.clearRetry()

    const worker = this.syncOnce(force)
      .catch(error => {
        this.logger.exception('WARN', error, 'native sync worker failed')
        return this.failureRetryMs()
      })
      .then(retryAfterMs => {
        if (this.worker !== worker) return
        this.worker = undefined
        this.scheduleRetry(retryAfterMs)
      })
    this.worker = worker
    return worker
  }

  private async syncOnce(force: boolean): Promise<number> {
    const attempt = await this.limiter.acquire(
      this.config.heartbeatIntervalMs,
      force,
      force ? Math.min(this.config.heartbeatTimeoutMs, 5_000) : 0,
      // Cover the durability barrier, install-lock wait, release check,
      // download, version checks, AI/offline syncs and the queue-count check,
      // including their kill grace periods.
      this.config.cliDownloadTimeoutMs * 3 + this.config.heartbeatTimeoutMs * 4 + 30_000,
    )
    if (attempt.lease === undefined) return attempt.retryAfterMs

    const generation = this.generation
    let success = false
    try {
      success = await this.send()
      // Never acknowledge events that arrived after this scan started: their
      // durable transcript rows may not have been visible to the CLI yet.
      if (success) this.syncedGeneration = generation
    } catch (error) {
      this.logger.exception('WARN', error, 'native sync dispatcher failed')
    } finally {
      attempt.lease.finish(success)
    }
    return success ? this.config.heartbeatIntervalMs : this.failureRetryMs()
  }

  private failureRetryMs(): number {
    return Math.min(this.config.heartbeatIntervalMs, 30_000)
  }

  private clearRetry(): void {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer)
    this.retryTimer = undefined
  }

  private scheduleRetry(delayMs: number): void {
    if (!this.accepting || !this.status().pendingSync || this.retryTimer !== undefined) return
    const timer = setTimeout(() => {
      this.retryTimer = undefined
      if (this.accepting && this.status().pendingSync) void this.start(false)
    }, Math.max(1, delayMs))
    timer.unref()
    this.retryTimer = timer
  }
}
