import { requestWakatimeJson, type WakatimeRequestPolicy } from './cli.ts'
import { readWakatimeApiKey, type WakatimeSettings } from './settings.ts'
import type {
  WakatimeAiModelUsage,
  WakatimeInsightDay,
  WakatimeInsightRange,
  WakatimeInsightsData,
  WakatimeInsightSummary,
  WakatimeInsightWeekday,
  WakatimeUsageBucket,
  WakatimeUsageTotals,
} from './ui-contract.ts'

const INSIGHTS_URL = 'https://api.wakatime.com/api/v1/users/current/insights'
const API_TIMEOUT_MS = 15_000
const INSIGHT_RANGE_PATTERN = /^(?:last_7_days|last_30_days|last_6_months|last_year|all_time|\d{4}(?:-\d{2})?)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface RawRecord {
  [key: string]: unknown
}

function record(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RawRecord
    : undefined
}

function records(value: unknown): RawRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is RawRecord => item !== undefined)
    : []
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function firstNumber(value: RawRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const result = optionalNumber(value[key])
    if (result !== undefined) return result
  }
  return undefined
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function dateOnly(value: unknown): string | undefined {
  const text = string(value)
  if (text === undefined) return undefined
  const candidate = text.slice(0, 10)
  return DATE_PATTERN.test(candidate) ? candidate : undefined
}

function payloadOf(raw: unknown): RawRecord {
  const body = record(raw)
  const data = body?.data
  return record(data) ?? {}
}

function arrayOf(raw: unknown, key: string): RawRecord[] {
  const body = record(raw)
  const data = body?.data
  if (Array.isArray(data)) return records(data)
  const payload = record(data)
  const nested = payload?.[key] ?? payload?.data ?? body?.[key]
  return records(nested)
}

function blankTotals(): WakatimeUsageTotals {
  return {
    totalSeconds: 0,
    aiSeconds: 0,
    aiAdditions: 0,
    aiDeletions: 0,
    humanAdditions: 0,
    humanDeletions: 0,
    aiInputTokens: 0,
    aiCachedInputTokens: 0,
    aiOutputTokens: 0,
    aiPromptLengthSum: 0,
    aiPromptEvents: 0,
    aiSessions: 0,
    aiModelTotalCost: 0,
  }
}

function blankSummary(): WakatimeInsightSummary {
  return {
    totalSeconds: 0,
    totalSecondsIncludingOtherLanguage: 0,
    dailyAverageSeconds: 0,
    dailyAverageIncludingOtherSeconds: 0,
    activeDays: 0,
  }
}

function emptyInsights(range: WakatimeInsightRange, message?: string): WakatimeInsightsData {
  return {
    available: false,
    range,
    ...(message === undefined ? {} : { message }),
    days: [],
    aiDays: [],
    weekdays: [],
    totals: blankTotals(),
    summary: blankSummary(),
    projects: [],
    languages: [],
    editors: [],
    categories: [],
    machines: [],
    operatingSystems: [],
    aiModels: [],
  }
}

function readBucket(item: RawRecord): WakatimeUsageBucket | undefined {
  const name = string(item.name) ?? string(item.label)
  if (name === undefined) return undefined
  const seconds = firstNumber(item, ['total_seconds', 'total', 'seconds', 'average']) ?? number(record(item.average)?.seconds)
  const aiDetailsAvailable = [
    'ai_additions',
    'ai_deletions',
    'human_additions',
    'human_deletions',
    'ai_input_tokens',
    'ai_prompt_events_total',
    'ai_sessions',
    'ai_model_total_cost',
  ].some(key => key in item)
  return {
    name,
    totalSeconds: seconds,
    percent: number(item.percent),
    aiAdditions: number(item.ai_additions),
    aiDeletions: number(item.ai_deletions),
    humanAdditions: number(item.human_additions),
    humanDeletions: number(item.human_deletions),
    aiInputTokens: number(item.ai_input_tokens),
    aiCachedInputTokens: number(item.ai_cached_input_tokens),
    aiOutputTokens: number(item.ai_output_tokens),
    aiPromptEvents: number(item.ai_prompt_events_total),
    aiSessions: number(item.ai_sessions),
    aiCost: number(item.ai_model_total_cost),
    aiDetailsAvailable,
  }
}

function bucketsFrom(raw: unknown, totalSeconds: number): WakatimeUsageBucket[] {
  const map = new Map<string, WakatimeUsageBucket>()
  for (const item of records(raw)) {
    const bucket = readBucket(item)
    if (bucket === undefined) continue
    const current = map.get(bucket.name)
    if (current === undefined) {
      map.set(bucket.name, bucket)
      continue
    }
    current.totalSeconds += bucket.totalSeconds
    current.aiAdditions += bucket.aiAdditions
    current.aiDeletions += bucket.aiDeletions
    current.humanAdditions += bucket.humanAdditions
    current.humanDeletions += bucket.humanDeletions
    current.aiInputTokens += bucket.aiInputTokens
    current.aiCachedInputTokens += bucket.aiCachedInputTokens
    current.aiOutputTokens += bucket.aiOutputTokens
    current.aiPromptEvents += bucket.aiPromptEvents
    current.aiSessions += bucket.aiSessions
    current.aiCost += bucket.aiCost
  }
  return [...map.values()]
    .map(item => ({ ...item, percent: totalSeconds > 0 ? item.totalSeconds / totalSeconds * 100 : item.percent }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
}

function readModels(stats: RawRecord): WakatimeAiModelUsage[] {
  const map = new Map<string, WakatimeAiModelUsage>()
  const add = (name: string, lines: number, cost: number): void => {
    const current = map.get(name) ?? { name, lines: 0, cost: 0 }
    current.lines += lines
    current.cost += cost
    map.set(name, current)
  }
  const breakdown = records(stats.ai_model_breakdown)
  if (breakdown.length > 0) {
    for (const item of breakdown) {
      const name = string(item.name)
      if (name !== undefined) add(name, number(item.lines), number(item.cost))
    }
  } else {
    const lines = record(stats.ai_model_line_changes)
    const costs = record(stats.ai_model_costs)
    for (const [name, value] of Object.entries(lines ?? {})) add(name, number(value), number(costs?.[name]))
    if (lines === undefined) {
      for (const [name, value] of Object.entries(costs ?? {})) add(name, 0, number(value))
    }
  }
  return [...map.values()].sort((a, b) => Math.abs(b.lines) - Math.abs(a.lines) || b.cost - a.cost)
}

function dayFrom(item: RawRecord, aiPercentFallback = 0): WakatimeInsightDay | undefined {
  const date = string(item.date) ?? dateOnly(item.start) ?? dateOnly(record(item.range)?.date)
  if (date === undefined) return undefined
  const aiAdditions = firstNumber(item, ['ai_additions', 'ai_line_changes']) ?? 0
  const aiDeletions = firstNumber(item, ['ai_deletions']) ?? 0
  const humanAdditions = firstNumber(item, ['human_additions', 'human_line_changes']) ?? 0
  const humanDeletions = firstNumber(item, ['human_deletions']) ?? 0
  const changedLines = aiAdditions + aiDeletions + humanAdditions + humanDeletions
  const explicitAiPercent = firstNumber(item, ['ai_percent', 'ai_percentage', 'ai_share'])
  const aiPercent = explicitAiPercent === undefined
    ? firstNumber(item, ['percent']) ?? (changedLines > 0 ? (aiAdditions + aiDeletions) / changedLines * 100 : aiPercentFallback)
    : explicitAiPercent <= 1 ? explicitAiPercent * 100 : explicitAiPercent
  const totalSeconds = firstNumber(item, ['total_seconds', 'total', 'seconds'])
    ?? optionalNumber(record(item.total)?.seconds)
    ?? records(item.categories).reduce((sum, category) => sum + (firstNumber(category, ['total_seconds', 'total', 'seconds']) ?? 0), 0)
  return {
    date,
    totalSeconds,
    ...(string(item.text) === undefined ? {} : { text: item.text as string }),
    aiPercent: Math.max(0, Math.min(100, aiPercent)),
    aiAdditions,
    aiDeletions,
    humanAdditions,
    humanDeletions,
  }
}

function readDays(raw: unknown): WakatimeInsightDay[] {
  return arrayOf(raw, 'days')
    .map(item => dayFrom(item))
    .filter((item): item is WakatimeInsightDay => item !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function readAiDays(raw: unknown): WakatimeInsightDay[] {
  return arrayOf(raw, 'ai_days')
    .map(item => dayFrom(item))
    .filter((item): item is WakatimeInsightDay => item !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function mergeDays(days: WakatimeInsightDay[], aiDays: WakatimeInsightDay[]): WakatimeInsightDay[] {
  const map = new Map<string, WakatimeInsightDay>()
  for (const day of days) map.set(day.date, { ...day })
  for (const day of aiDays) {
    const current = map.get(day.date)
    if (current === undefined) map.set(day.date, { ...day })
    else {
      current.aiPercent = day.aiPercent
      current.aiAdditions ||= day.aiAdditions
      current.aiDeletions ||= day.aiDeletions
      current.humanAdditions ||= day.humanAdditions
      current.humanDeletions ||= day.humanDeletions
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function weekdayRecords(raw: unknown): RawRecord[] {
  const direct = arrayOf(raw, 'weekdays')
  if (direct.length > 0) return direct
  const payload = payloadOf(raw)
  const result: RawRecord[] = []
  for (const [name, value] of Object.entries(payload)) {
    if (record(value) !== undefined) result.push({ name, ...(value as RawRecord) })
  }
  return result
}

function readWeekdays(raw: unknown, days: WakatimeInsightDay[], totalSeconds: number): WakatimeInsightWeekday[] {
  const direct = weekdayRecords(raw).map(item => {
    const averageSeconds = firstNumber(item, ['average', 'average_seconds', 'total_seconds', 'total', 'seconds']) ?? number(record(item.average)?.seconds)
    const categories = bucketsFrom(records(item.categories).map(category => ({
      ...category,
      total_seconds: firstNumber(category, ['average', 'average_seconds', 'total_seconds', 'total', 'seconds']) ?? 0,
    })), averageSeconds)
    return {
      name: string(item.name) ?? string(item.weekday) ?? string(item.day) ?? '—',
      totalSeconds: averageSeconds,
      ...(string(item.human_readable_average) === undefined ? {} : { averageText: item.human_readable_average as string }),
      percent: number(item.percent),
      days: firstNumber(item, ['days', 'count', 'days_count']) ?? 0,
      categoryBreakdown: categories,
    }
  })
  if (direct.length > 0) return direct
  const fallback = Array.from({ length: 7 }, (_, index) => {
    const matching = days.filter(day => new Date(`${day.date}T12:00:00`).getDay() === index)
    const average = matching.length > 0 ? matching.reduce((sum, day) => sum + day.totalSeconds, 0) / matching.length : 0
    return {
      name: String(index),
      totalSeconds: average,
      percent: totalSeconds > 0 ? average / totalSeconds * 100 : 0,
      days: matching.length,
      categoryBreakdown: [],
    }
  })
  return fallback
}

function statsMeta(raw: unknown): RawRecord {
  return payloadOf(raw)
}

export function validateInsightRange(value: unknown): WakatimeInsightRange {
  if (typeof value !== 'string' || !INSIGHT_RANGE_PATTERN.test(value)) {
    throw new Error('insight range is not supported')
  }
  return value as WakatimeInsightRange
}

export function normalizeWakatimeInsights(
  statsRaw: unknown,
  daysRaw: unknown,
  aiDaysRaw: unknown,
  weekdaysRaw: unknown,
  range: WakatimeInsightRange,
  fetchedAt: number = Date.now(),
): WakatimeInsightsData {
  const stats = statsMeta(statsRaw)
  const days = readDays(daysRaw)
  const aiDays = readAiDays(aiDaysRaw)
  const mergedDays = mergeDays(days, aiDays)
  const totalSeconds = firstNumber(stats, ['total_seconds', 'seconds']) ?? 0
  const totalSecondsIncludingOtherLanguage = firstNumber(stats, ['total_seconds_including_other_language']) ?? totalSeconds
  const dailyAverageSeconds = firstNumber(stats, ['daily_average']) ?? number(record(stats.daily_average)?.seconds)
  const dailyAverageIncludingOtherSeconds = firstNumber(stats, ['daily_average_including_other_language']) ?? dailyAverageSeconds
  const bestDay = record(stats.best_day)
  const summary: WakatimeInsightSummary = {
    totalSeconds,
    totalSecondsIncludingOtherLanguage,
    dailyAverageSeconds,
    dailyAverageIncludingOtherSeconds,
    ...(string(stats.human_readable_total) === undefined ? {} : { totalText: stats.human_readable_total as string }),
    ...(string(stats.human_readable_total_including_other_language) === undefined ? {} : { totalIncludingOtherText: stats.human_readable_total_including_other_language as string }),
    ...(string(stats.human_readable_daily_average) === undefined ? {} : { dailyAverageText: stats.human_readable_daily_average as string }),
    ...(string(stats.human_readable_daily_average_including_other_language) === undefined ? {} : { dailyAverageIncludingOtherText: stats.human_readable_daily_average_including_other_language as string }),
    activeDays: firstNumber(stats, ['days_minus_holidays', 'active_days']) ?? mergedDays.filter(day => day.totalSeconds > 0).length,
    ...(bestDay === undefined || dateOnly(bestDay.date) === undefined ? {} : {
      bestDay: {
        date: dateOnly(bestDay.date) as string,
        totalSeconds: number(bestDay.total_seconds),
        ...(string(bestDay.text) === undefined ? {} : { text: bestDay.text as string }),
      },
    }),
  }
  const totals: WakatimeUsageTotals = {
    ...blankTotals(),
    totalSeconds,
    aiAdditions: number(stats.ai_additions),
    aiDeletions: number(stats.ai_deletions),
    humanAdditions: number(stats.human_additions),
    humanDeletions: number(stats.human_deletions),
    aiInputTokens: number(stats.ai_input_tokens),
    aiOutputTokens: number(stats.ai_output_tokens),
    aiPromptLengthSum: number(stats.ai_prompt_length_sum),
    aiPromptEvents: number(stats.ai_prompt_events_total),
    aiSessions: number(stats.ai_sessions),
    aiModelTotalCost: number(stats.ai_model_total_cost),
  }
  const start = dateOnly(stats.start)
  const end = dateOnly(stats.end)
  const percentCalculated = firstNumber(stats, ['percent_calculated'])
  const weekdays = readWeekdays(weekdaysRaw, mergedDays, totalSeconds)
  return {
    available: true,
    range,
    ...(string(stats.human_readable_range) === undefined ? {} : { humanReadableRange: stats.human_readable_range as string }),
    ...(start === undefined ? {} : { start }),
    ...(end === undefined ? {} : { end }),
    ...(string(stats.timezone) === undefined ? {} : { timezone: stats.timezone as string }),
    ...(typeof stats.is_up_to_date !== 'boolean' ? {} : { isUpToDate: stats.is_up_to_date as boolean }),
    ...(percentCalculated === undefined ? {} : { percentCalculated }),
    ...(stats.is_already_updating === true ? { isUpdating: true } : {}),
    fetchedAt,
    days: mergedDays,
    aiDays,
    weekdays,
    totals,
    summary,
    projects: bucketsFrom(stats.projects, totalSeconds),
    languages: bucketsFrom(stats.languages, totalSeconds),
    editors: bucketsFrom(stats.editors, totalSeconds),
    categories: bucketsFrom(stats.categories, totalSeconds),
    machines: bucketsFrom(stats.machines, totalSeconds),
    operatingSystems: bucketsFrom(stats.operating_systems, totalSeconds),
    aiModels: readModels(stats),
  }
}

async function fetchInsight(
  apiKey: string,
  type: string,
  range: WakatimeInsightRange,
  policy: WakatimeRequestPolicy,
): Promise<unknown> {
  const url = `${INSIGHTS_URL}/${type}/${encodeURIComponent(range)}`
  return requestWakatimeJson(url, policy, {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
  })
}

export async function fetchWakatimeInsights(
  settings: WakatimeSettings,
  range: WakatimeInsightRange,
): Promise<WakatimeInsightsData> {
  const apiKey = readWakatimeApiKey()
  if (apiKey === undefined) return emptyInsights(range, 'Configure an API key to load WakaTime insights.')
  const policy: WakatimeRequestPolicy = {
    timeoutMs: API_TIMEOUT_MS,
    noSSLVerify: settings.noSSLVerify,
    ...(settings.proxy === undefined ? {} : { proxy: settings.proxy }),
  }
  const stats = await fetchInsight(apiKey, 'stats', range, policy)
  const [days, aiDays, weekdays] = await Promise.all([
    fetchInsight(apiKey, 'days', range, policy).catch(() => undefined),
    fetchInsight(apiKey, 'ai_days', range, policy).catch(() => undefined),
    fetchInsight(apiKey, 'weekdays', range, policy).catch(() => undefined),
  ])
  return normalizeWakatimeInsights(stats, days, aiDays, weekdays, range)
}
