/**
 * The WakaTime UI wire contract, shared verbatim between the tracking plugin
 * (`@27aaron/dsh-wakatime`) and the dashboard bundle
 * (`@27aaron/dsh-wakatime-ui`). Activity accounting belongs to wakatime-cli's
 * native DeepSeek Harness parser, not this plugin.
 */

export const WAKATIME_RPC_CHANNEL = '/dsh-wakatime'

export interface WakatimeUiConfig {
  baseUrl: string
  cliPath?: string
  debug: boolean
  heartbeatIntervalMs: number
  dashboardRefreshIntervalMs: number
  insightsRefreshIntervalMs: number
}

export interface WakatimeCliStatus {
  state: 'ready' | 'missing' | 'invalid'
  source: 'configured' | 'path' | 'managed' | 'none'
  path?: string
  version?: string
  managedPath: string
  /**
   * Whether the resolved CLI parses DeepSeek Harness session transcripts
   * natively (stable wakatime-cli >= v2.25.0). Absent for unverified builds.
   */
  nativeSync?: boolean
}

export interface WakatimeCliUpdateCheck {
  status: WakatimeUiStatus
  updateAvailable: boolean
  latestVersion?: string
}

export interface WakatimeTrackingStatus {
  pendingSync: boolean
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

export type WakatimeInsightRange =
  | 'last_7_days'
  | 'last_30_days'
  | 'last_6_months'
  | 'last_year'
  | 'all_time'
  | `${number}`
  | `${number}-${number}`

export interface WakatimeInsightDay {
  date: string
  totalSeconds: number
  text?: string
  aiPercent: number
  aiAdditions: number
  aiDeletions: number
  humanAdditions: number
  humanDeletions: number
}

export interface WakatimeInsightWeekday {
  name: string
  totalSeconds: number
  averageText?: string
  percent: number
  days: number
  categoryBreakdown: WakatimeUsageBucket[]
}

export interface WakatimeInsightSummary {
  totalSeconds: number
  totalSecondsIncludingOtherLanguage: number
  dailyAverageSeconds: number
  dailyAverageIncludingOtherSeconds: number
  totalText?: string
  totalIncludingOtherText?: string
  dailyAverageText?: string
  dailyAverageIncludingOtherText?: string
  activeDays: number
  bestDay?: { date: string; totalSeconds: number; text?: string }
}

export interface WakatimeInsightsData {
  available: boolean
  range: WakatimeInsightRange | string
  humanReadableRange?: string
  start?: string
  end?: string
  timezone?: string
  fetchedAt?: number
  isUpToDate?: boolean
  percentCalculated?: number
  isUpdating?: boolean
  message?: string
  days: WakatimeInsightDay[]
  aiDays: WakatimeInsightDay[]
  weekdays: WakatimeInsightWeekday[]
  totals: WakatimeUsageTotals
  summary: WakatimeInsightSummary
  projects: WakatimeUsageBucket[]
  languages: WakatimeUsageBucket[]
  editors: WakatimeUsageBucket[]
  categories: WakatimeUsageBucket[]
  machines: WakatimeUsageBucket[]
  operatingSystems: WakatimeUsageBucket[]
  aiModels: WakatimeAiModelUsage[]
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
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export type WakatimeUiRpcCall = (
  endpoint: string,
  payload?: unknown,
  signal?: AbortSignal,
) => Promise<WakatimeUiRpcResult<unknown>>
