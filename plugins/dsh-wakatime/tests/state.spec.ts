import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HeartbeatRateLimiter, stateFileFor } from '../src/state.ts'

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function stateDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-state-'))
  directories.push(directory)
  return directory
}

describe('HeartbeatRateLimiter', () => {
  it('commits a successful lease and rate-limits the next process', async () => {
    const directory = stateDir()
    const limiter = new HeartbeatRateLimiter(directory)
    const first = await limiter.acquire('/repo', 60_000, false)
    expect(first.lease).toBeDefined()
    first.lease?.finish(true)

    const second = await limiter.acquire('/repo', 60_000, false)
    expect(second.lease).toBeUndefined()
    expect(second.retryAfterMs).toBeGreaterThan(0)
  })

  it('does not consume the interval after a failed dispatch', async () => {
    const limiter = new HeartbeatRateLimiter(stateDir())
    const first = await limiter.acquire('/repo', 60_000, false)
    first.lease?.finish(false)
    const second = await limiter.acquire('/repo', 60_000, false)
    expect(second.lease).toBeDefined()
    second.lease?.finish(false)
  })

  it('serializes concurrent processes and lets force bypass time', async () => {
    const limiter = new HeartbeatRateLimiter(stateDir())
    const held = await limiter.acquire('/repo', 60_000, false)
    const blocked = await limiter.acquire('/repo', 60_000, false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    const forcedWhileHeld = await limiter.acquire('/repo', 60_000, true)
    expect(forcedWhileHeld.lease).toBeDefined()
    forcedWhileHeld.lease?.finish(false)
    held.lease?.finish(true)

    const forced = await limiter.acquire('/repo', 60_000, true, 50)
    expect(forced.lease).toBeDefined()
    forced.lease?.finish(false)
  })

  it('uses a stable non-identifying project hash', () => {
    const directory = stateDir()
    const file = stateFileFor('/private/project', directory)
    expect(file).toMatch(new RegExp(`^${directory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\\\][0-9a-f]{24}\\.json$`))
    expect(file).not.toContain('private/project')
    writeFileSync(file, '{}')
  })
})
