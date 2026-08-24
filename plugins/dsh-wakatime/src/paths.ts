import * as os from 'node:os'
import * as path from 'node:path'

export function expandUserPath(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '~') return os.homedir()
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) {
    return path.join(os.homedir(), trimmed.slice(2))
  }
  return trimmed
}

function configuredHome(): string | undefined {
  const raw = process.env.WAKATIME_HOME
  if (raw === undefined || raw.trim().length === 0) return undefined
  const expanded = expandUserPath(raw)
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(expanded)
}

/** Directory containing .wakatime.cfg. */
export function getWakatimeHomeDir(): string {
  return configuredHome() ?? os.homedir()
}

/** Directory containing managed binaries, logs, and plugin state. */
export function getWakatimeResourcesDir(): string {
  return configuredHome() ?? path.join(os.homedir(), '.wakatime')
}

export function getWakatimeConfigFilePath(): string {
  return path.join(getWakatimeHomeDir(), '.wakatime.cfg')
}

export function getPluginDataDir(): string {
  return path.join(getWakatimeResourcesDir(), 'dsh-wakatime')
}

export function getPluginSettingsFilePath(): string {
  return path.join(getPluginDataDir(), 'settings.json')
}

export function getPluginLogFilePath(): string {
  return path.join(getWakatimeResourcesDir(), 'dsh-wakatime.log')
}
