import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { apply, Config, name } from '../src/index.ts'

type Plugin = { name: string; Config: typeof Config; apply: (ctx: never, config: never) => void }
type Fiber = { dispose: () => Promise<void> }

const originalHome = process.env.WAKATIME_HOME
const directories: string[] = []

function mountContext(): { ctx: Context; warnings: string[] } {
  const ctx = new Context()
  ctx.provide('connection', {
    rpc: {
      handle() {
        return () => {}
      },
    },
  })
  const warnings: string[] = []
  const logger = ctx.logger as unknown as { warn: (message: string) => void }
  const originalWarn = logger.warn.bind(logger)
  logger.warn = (message: string) => {
    warnings.push(message)
    originalWarn(message)
  }
  return { ctx, warnings }
}

async function mountRow(plugin: Plugin): Promise<Fiber> {
  const { ctx } = mountContext()
  return ctx.plugin(plugin, { autoInstall: false, cliPath: process.execPath }) as unknown as Fiber
}

afterEach(() => {
  if (originalHome === undefined) delete process.env.WAKATIME_HOME
  else process.env.WAKATIME_HOME = originalHome
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('duplicate dsh-wakatime rows', () => {
  it('elect the first activation and stand down afterwards', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-waka-ui-coexist-'))
    directories.push(directory)
    process.env.WAKATIME_HOME = directory

    const plugin = { name, Config, apply } as unknown as Plugin
    const first = await mountRow(plugin)

    const { ctx: secondCtx, warnings } = mountContext()
    const second = await secondCtx.plugin(plugin, { autoInstall: false, cliPath: process.execPath }) as unknown as Fiber
    expect(warnings.some(message => message.includes('stands down'))).toBe(true)

    await second.dispose()
    await first.dispose()
  })
})

describe('package manifest', () => {
  it('exports the browser bundle declared by dsh.client', () => {
    const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      dsh?: { client?: { platform?: string } }
      exports?: Record<string, unknown>
    }

    expect(manifest.dsh?.client?.platform).toBe('web')
    expect(manifest.exports?.['./client']).toEqual({
      types: './lib/types/client.d.ts',
      default: './lib/client.js',
    })
  })
})
