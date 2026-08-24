import type { WakatimeCategory } from './config.ts'

export const WAKATIME_RPC_CHANNEL = '/dsh-wakatime'

export const UI_CATEGORIES: readonly WakatimeCategory[] = [
  'coding',
  'ai coding',
  'building',
  'indexing',
  'debugging',
  'learning',
  'notes',
  'meeting',
  'planning',
  'researching',
  'communicating',
  'supporting',
  'advising',
  'running tests',
  'writing tests',
  'manual testing',
  'writing docs',
  'code reviewing',
  'browsing',
  'translating',
  'designing',
]

export interface WakatimeUiConfig {
  category: WakatimeCategory
  trackReads: boolean
  autoInstall: boolean
  cliPath?: string
  debug: boolean
  heartbeatIntervalMs: number
}

export interface WakatimeCliStatus {
  state: 'ready' | 'missing' | 'invalid'
  source: 'configured' | 'path' | 'managed' | 'none'
  path?: string
  version?: string
  managedPath: string
}

export interface WakatimeTrackingStatus {
  projectCount: number
  pendingFiles: number
  pendingProjects: Array<{ projectFolder: string; pendingFiles: number }>
  lastAttemptAt?: number
  lastSuccessAt?: number
  lastError?: string
}

export interface WakatimeUiStatus {
  config: WakatimeUiConfig
  apiKeyConfigured: boolean
  cli: WakatimeCliStatus
  tracking: WakatimeTrackingStatus
  paths: {
    config: string
    log: string
    data: string
  }
}

export interface WakatimeDailyUsage {
  date: string
  text?: string
  totalSeconds: number
  aiSeconds: number
  aiAdditions: number
  aiDeletions: number
  humanAdditions: number
  humanDeletions: number
  aiInputTokens: number
  aiCachedInputTokens: number
  aiOutputTokens: number
  aiPromptLengthSum: number
  aiPromptEvents: number
  aiSessions: number
  projectCount: number
  projectBreakdown: WakatimeUsageBucket[]
  categoryBreakdown: WakatimeUsageBucket[]
  topProject?: string
}

export interface WakatimeUsageTotals {
  totalSeconds: number
  aiSeconds: number
  aiAdditions: number
  aiDeletions: number
  humanAdditions: number
  humanDeletions: number
  aiInputTokens: number
  aiCachedInputTokens: number
  aiOutputTokens: number
  aiPromptLengthSum: number
  aiPromptEvents: number
  aiSessions: number
  aiModelTotalCost: number
  aiReviewPercent?: number
  aiReviewSessions?: number
  aiFollowUpPercent?: number
  aiFollowUpEdits?: number
}

export interface WakatimeUsageBucket {
  name: string
  totalSeconds: number
  percent: number
  aiAdditions: number
  aiDeletions: number
  humanAdditions: number
  humanDeletions: number
  aiInputTokens: number
  aiCachedInputTokens: number
  aiOutputTokens: number
  aiPromptEvents: number
  aiSessions: number
  aiCost: number
  aiDetailsAvailable?: boolean
}

export interface WakatimeAiModelUsage {
  name: string
  lines: number
  cost: number
}

export interface WakatimeUsageData {
  available: boolean
  start: string
  end: string
  timezone?: string
  fetchedAt?: number
  isUpToDate?: boolean
  message?: string
  days: WakatimeDailyUsage[]
  totals: WakatimeUsageTotals
  projects: WakatimeUsageBucket[]
  categories: WakatimeUsageBucket[]
  languages: WakatimeUsageBucket[]
  editors: WakatimeUsageBucket[]
  machines: WakatimeUsageBucket[]
  operatingSystems: WakatimeUsageBucket[]
  aiModels: WakatimeAiModelUsage[]
  todayBreakdown: {
    date: string
    projects: WakatimeUsageBucket[]
    languages: WakatimeUsageBucket[]
    categories: WakatimeUsageBucket[]
  }
  dashboard: {
    cumulativeSeconds: number
    cumulativeText?: string
    dailyAverageSeconds: number
    dailyAverageText?: string
    dailyAverageIncludingOtherSeconds: number
    dailyAverageIncludingOtherText?: string
    bestDay?: { date: string; totalSeconds: number; text?: string }
    todaySeconds: number
    todayText?: string
  }
}

export interface WakatimeUiRpcResult<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

export type WakatimeUiRpcCall = (
  endpoint: string,
  payload?: unknown,
  signal?: AbortSignal,
) => Promise<WakatimeUiRpcResult<unknown>>
