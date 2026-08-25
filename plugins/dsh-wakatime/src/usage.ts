import { requestWakatimeJson, type WakatimeRequestPolicy } from './cli.ts'
import { DEFAULT_WAKATIME_API_URL, readWakatimeApiKey, type WakatimeSettings } from './settings.ts'
import type {
  WakatimeAiModelUsage,
  WakatimeDailyUsage,
  WakatimeUsageBucket,
  WakatimeUsageData,
  WakatimeUsageTotals,
} from './ui-contract.ts'

const API_TIMEOUT_MS = 15_000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface RawRecord {
  [key: string]: unknown
}

function record(value: unknown): RawRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RawRecord
    : undefined
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

function records(value: unknown): RawRecord[] {
  return Array.isArray(value)
    ? value.map(record).filter((item): item is RawRecord => item !== undefined)
    : []
}

function dayRange(start: string, end: string): string[] {
  const first = new Date(`${start}T12:00:00`)
  const last = new Date(`${end}T12:00:00`)
  const result: string[] = []
  for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + 1)) {
    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const day = String(cursor.getDate()).padStart(2, '0')
    result.push(`${year}-${month}-${day}`)
  }
  return result
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

function addModel(map: Map<string, WakatimeAiModelUsage>, name: string, lines: number, cost: number): void {
  if (name.length === 0) return
  const current = map.get(name) ?? { name, lines: 0, cost: 0 }
  current.lines += lines
  current.cost += cost
  map.set(name, current)
}

function readModels(summary: RawRecord, models: Map<string, WakatimeAiModelUsage>): number {
  const breakdown = records(summary.ai_model_breakdown)
  let cost = number(summary.ai_model_total_cost)
  if (breakdown.length > 0) {
    let breakdownCost = 0
    for (const item of breakdown) {
      const name = string(item.name)
      const itemCost = number(item.cost)
      breakdownCost += itemCost
      if (name !== undefined) addModel(models, name, number(item.lines), itemCost)
    }
    if (cost === 0) cost = breakdownCost
    return cost
  }

  const lineChanges = record(summary.ai_model_line_changes)
  const costs = record(summary.ai_model_costs)
  if (lineChanges !== undefined) {
    for (const [name, lines] of Object.entries(lineChanges)) {
      addModel(models, name, number(lines), number(costs?.[name]))
    }
  } else if (costs !== undefined) {
    for (const [name, value] of Object.entries(costs)) addModel(models, name, 0, number(value))
  }
  if (cost === 0 && costs !== undefined) cost = Object.values(costs).reduce<number>((sum, value) => sum + number(value), 0)
  return cost
}

function readBucket(item: RawRecord): WakatimeUsageBucket | undefined {
  const name = string(item.name)
  if (name === undefined) return undefined
  const aiDetailsAvailable = ['human_additions', 'human_deletions', 'ai_input_tokens', 'ai_prompt_events_total', 'ai_sessions', 'ai_model_total_cost']
    .some(key => key in item)
  return {
    name,
    totalSeconds: number(item.total_seconds),
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

function mergeBuckets(target: Map<string, WakatimeUsageBucket>, values: RawRecord[]): void {
  for (const item of values) {
    const bucket = readBucket(item)
    if (bucket === undefined) continue
    const existing = target.get(bucket.name)
    if (existing === undefined) {
      target.set(bucket.name, { ...bucket, percent: 0 })
      continue
    }
    const current = existing
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
    target.set(bucket.name, current)
  }
}

function sortBuckets(map: Map<string, WakatimeUsageBucket>, totalSeconds: number): WakatimeUsageBucket[] {
  return [...map.values()]
    .map(bucket => ({
      ...bucket,
      percent: totalSeconds > 0 ? bucket.totalSeconds / totalSeconds * 100 : 0,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
}

function durationName(item: RawRecord, key: string): string | undefined {
  return string(item[key]) ?? string(item.name)
}

function mergeDurationBuckets(target: Map<string, WakatimeUsageBucket>, values: RawRecord[], key: string): void {
  for (const item of values) {
    const name = durationName(item, key)
    if (name === undefined) continue
    const duration = number(item.duration)
    const bucket = {
      name,
      totalSeconds: duration > 0 ? duration : number(item.total_seconds),
      percent: 0,
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
      aiDetailsAvailable: false,
    }
    const current = target.get(name)
    if (current === undefined) target.set(name, bucket)
    else {
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
  }
}

async function fetchDurationBreakdown(
  apiKey: string,
  baseUrl: string,
  date: string,
  sliceBy: 'project' | 'language' | 'category',
  policy: WakatimeRequestPolicy,
): Promise<WakatimeUsageBucket[]> {
  const url = new URL(`${baseUrl}/users/current/durations`)
  url.searchParams.set('date', date)
  url.searchParams.set('slice_by', sliceBy)
  try {
    const raw = await requestWakatimeJson(url.toString(), policy, {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
    })
    const body = record(raw)
    const items = records(body?.data)
    const map = new Map<string, WakatimeUsageBucket>()
    mergeDurationBuckets(map, items, sliceBy)
    const totalSeconds = [...map.values()].reduce((sum, item) => sum + item.totalSeconds, 0)
    return sortBuckets(map, totalSeconds)
  } catch {
    // A durations request can be unavailable for older accounts or while the
    // selected day is still being processed. Summary data remains useful.
    return []
  }
}

function bucketsFromRecords(values: RawRecord[], totalSeconds: number): WakatimeUsageBucket[] {
  const map = new Map<string, WakatimeUsageBucket>()
  mergeBuckets(map, values)
  return sortBuckets(map, totalSeconds)
}

function emptyUsage(start: string, end: string, message?: string): WakatimeUsageData {
  return {
    available: false,
    start,
    end,
    ...(message === undefined ? {} : { message }),
    days: [],
    totals: blankTotals(),
    projects: [],
    categories: [],
    languages: [],
    editors: [],
    machines: [],
    operatingSystems: [],
    aiModels: [],
    todayBreakdown: { date: end, projects: [], languages: [], categories: [] },
    dashboard: {
      cumulativeSeconds: 0,
      dailyAverageSeconds: 0,
      dailyAverageIncludingOtherSeconds: 0,
      todaySeconds: 0,
    },
  }
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T12:00:00`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

export function normalizeWakatimeSummaries(
  raw: unknown,
  start: string,
  end: string,
  fetchedAt: number = Date.now(),
): WakatimeUsageData {
  const body = record(raw)
  const summaries = records(body?.data)
  const byDate = new Map<string, RawRecord>()
  let timezone: string | undefined
  for (const summary of summaries) {
    const range = record(summary.range)
    const date = string(range?.date)
    if (date !== undefined) byDate.set(date, summary)
    timezone ??= string(range?.timezone)
  }

  const projectMap = new Map<string, WakatimeUsageBucket>()
  const categoryMap = new Map<string, WakatimeUsageBucket>()
  const languageMap = new Map<string, WakatimeUsageBucket>()
  const editorMap = new Map<string, WakatimeUsageBucket>()
  const machineMap = new Map<string, WakatimeUsageBucket>()
  const operatingSystemMap = new Map<string, WakatimeUsageBucket>()
  const modelMap = new Map<string, WakatimeAiModelUsage>()
  const totals = blankTotals()
  const days: WakatimeDailyUsage[] = dayRange(start, end).map(date => {
    const summary = byDate.get(date)
    const grandTotal = record(summary?.grand_total) ?? {}
    const categories = records(summary?.categories)
    const aiSeconds = categories
      .filter(category => string(category.name)?.toLowerCase() === 'ai coding')
      .reduce((sum, category) => sum + number(category.total_seconds), 0)
    const projects = records(summary?.projects)
    const languages = records(summary?.languages)
    const editors = records(summary?.editors)
    const machines = records(summary?.machines)
    const operatingSystems = records(summary?.operating_systems)
    mergeBuckets(projectMap, projects)
    mergeBuckets(categoryMap, categories)
    mergeBuckets(languageMap, languages)
    mergeBuckets(editorMap, editors)
    mergeBuckets(machineMap, machines)
    mergeBuckets(operatingSystemMap, operatingSystems)
    const topProject = projects
      .map(readBucket)
      .filter((item): item is WakatimeUsageBucket => item !== undefined)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)[0]?.name
    const day: WakatimeDailyUsage = {
      date,
      ...(string(grandTotal.text) === undefined ? {} : { text: grandTotal.text as string }),
      totalSeconds: number(grandTotal.total_seconds),
      aiSeconds,
      aiAdditions: number(grandTotal.ai_additions),
      aiDeletions: number(grandTotal.ai_deletions),
      humanAdditions: number(grandTotal.human_additions),
      humanDeletions: number(grandTotal.human_deletions),
      aiInputTokens: number(grandTotal.ai_input_tokens),
      aiCachedInputTokens: number(grandTotal.ai_cached_input_tokens),
      aiOutputTokens: number(grandTotal.ai_output_tokens),
      aiPromptLengthSum: number(grandTotal.ai_prompt_length_sum),
      aiPromptEvents: number(grandTotal.ai_prompt_events_total),
      aiSessions: number(grandTotal.ai_sessions),
      projectCount: projects.length,
      projectBreakdown: bucketsFromRecords(projects, number(grandTotal.total_seconds)),
      categoryBreakdown: bucketsFromRecords(categories, number(grandTotal.total_seconds)),
      ...(topProject === undefined ? {} : { topProject }),
    }
    totals.totalSeconds += day.totalSeconds
    totals.aiSeconds += day.aiSeconds
    totals.aiAdditions += day.aiAdditions
    totals.aiDeletions += day.aiDeletions
    totals.humanAdditions += day.humanAdditions
    totals.humanDeletions += day.humanDeletions
    totals.aiInputTokens += day.aiInputTokens
    totals.aiCachedInputTokens += day.aiCachedInputTokens
    totals.aiOutputTokens += day.aiOutputTokens
    totals.aiPromptLengthSum += day.aiPromptLengthSum
    totals.aiPromptEvents += day.aiPromptEvents
    totals.aiSessions += day.aiSessions
    totals.aiModelTotalCost += readModels(grandTotal, modelMap)
    return day
  })

  const cumulative = record(body?.cumulative_total) ?? {}
  const dailyAverage = record(body?.daily_average) ?? {}
  const reviewPercent = firstNumber(cumulative, ['human_review_percent', 'ai_human_review_percent', 'ai_review_percent'])
  const reviewSessions = firstNumber(cumulative, ['human_review_sessions', 'ai_human_review_sessions', 'ai_review_sessions'])
  const followUpPercent = firstNumber(cumulative, ['human_follow_up_percent', 'ai_human_follow_up_percent', 'ai_follow_up_percent'])
  const followUpEdits = firstNumber(cumulative, ['human_follow_up_edits', 'ai_human_follow_up_edits', 'ai_follow_up_edits'])
  if (reviewPercent !== undefined) totals.aiReviewPercent = reviewPercent
  if (reviewSessions !== undefined) totals.aiReviewSessions = reviewSessions
  if (followUpPercent !== undefined) totals.aiFollowUpPercent = followUpPercent
  if (followUpEdits !== undefined) totals.aiFollowUpEdits = followUpEdits
  const activeBestDay = days
    .filter(day => day.totalSeconds > 0)
    .sort((a, b) => b.totalSeconds - a.totalSeconds)[0]
  const today = days.find(day => day.date === end)
  const averageFallback = days.length > 0 ? totals.totalSeconds / days.length : 0
  const bodyUpToDate = typeof body?.is_up_to_date === 'boolean' ? body.is_up_to_date : undefined
  const todaySummary = byDate.get(end)
  const todayCategories = records(todaySummary?.categories)
  const todayProjects = records(todaySummary?.projects)
  const todayLanguages = records(todaySummary?.languages)
  const todayTotalSeconds = number(record(todaySummary?.grand_total)?.total_seconds)
  const todayBreakdown = {
    date: end,
    projects: bucketsFromRecords(todayProjects, todayTotalSeconds),
    languages: bucketsFromRecords(todayLanguages, todayTotalSeconds),
    categories: bucketsFromRecords(todayCategories, todayTotalSeconds),
  }
  return {
    available: true,
    start,
    end,
    ...(timezone === undefined ? {} : { timezone }),
    fetchedAt,
    ...(bodyUpToDate === undefined ? {} : { isUpToDate: bodyUpToDate }),
    days,
    totals,
    projects: sortBuckets(projectMap, totals.totalSeconds),
    categories: sortBuckets(categoryMap, totals.totalSeconds),
    languages: sortBuckets(languageMap, totals.totalSeconds),
    editors: sortBuckets(editorMap, totals.totalSeconds),
    machines: sortBuckets(machineMap, totals.totalSeconds),
    operatingSystems: sortBuckets(operatingSystemMap, totals.totalSeconds),
    aiModels: [...modelMap.values()].sort((a, b) => Math.abs(b.lines) - Math.abs(a.lines)),
    todayBreakdown,
    dashboard: {
      cumulativeSeconds: number(cumulative.seconds) || totals.totalSeconds,
      ...(string(cumulative.text) === undefined ? {} : { cumulativeText: cumulative.text as string }),
      dailyAverageSeconds: number(dailyAverage.seconds) || averageFallback,
      dailyAverageIncludingOtherSeconds: number(dailyAverage.seconds_including_other_language) || averageFallback,
      ...(activeBestDay === undefined ? {} : {
        bestDay: {
          date: activeBestDay.date,
          totalSeconds: activeBestDay.totalSeconds,
          ...(activeBestDay.text === undefined ? {} : { text: activeBestDay.text }),
        },
      }),
      ...(string(dailyAverage.text) === undefined ? {} : { dailyAverageText: dailyAverage.text as string }),
      ...(string(dailyAverage.text_including_other_language) === undefined ? {} : { dailyAverageIncludingOtherText: dailyAverage.text_including_other_language as string }),
      todaySeconds: today?.totalSeconds ?? 0,
      ...(today?.text === undefined ? {} : { todayText: today.text }),
    },
  }
}

export function validateUsageRange(start: unknown, end: unknown): { start: string; end: string } {
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('usage range must use YYYY-MM-DD dates')
  const days = dayRange(start, end)
  if (days.length > 31) throw new Error('usage range cannot exceed 31 days')
  return { start, end }
}

export async function fetchWakatimeUsage(
  settings: WakatimeSettings,
  start: string,
  end: string,
): Promise<WakatimeUsageData> {
  const apiKey = readWakatimeApiKey()
  if (apiKey === undefined) return emptyUsage(start, end, 'Configure an API key to load WakaTime activity.')
  const policy: WakatimeRequestPolicy = {
    timeoutMs: API_TIMEOUT_MS,
    noSSLVerify: settings.noSSLVerify,
    allowInsecureHttp: true,
    ...(settings.proxy === undefined ? {} : { proxy: settings.proxy }),
  }
  const url = new URL(`${settings.apiUrl ?? DEFAULT_WAKATIME_API_URL}/users/current/summaries`)
  url.searchParams.set('start', start)
  url.searchParams.set('end', end)
  const raw = await requestWakatimeJson(url.toString(), policy, {
    Accept: 'application/json',
    Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
  })
  const usage = normalizeWakatimeSummaries(raw, start, end)
  const [projects, languages, categories] = await Promise.all([
    fetchDurationBreakdown(apiKey, settings.apiUrl ?? DEFAULT_WAKATIME_API_URL, end, 'project', policy),
    fetchDurationBreakdown(apiKey, settings.apiUrl ?? DEFAULT_WAKATIME_API_URL, end, 'language', policy),
    fetchDurationBreakdown(apiKey, settings.apiUrl ?? DEFAULT_WAKATIME_API_URL, end, 'category', policy),
  ])
  return {
    ...usage,
    todayBreakdown: {
      date: end,
      projects: projects.length > 0 ? projects : usage.todayBreakdown.projects,
      languages: languages.length > 0 ? languages : usage.todayBreakdown.languages,
      categories: categories.length > 0 ? categories : usage.todayBreakdown.categories,
    },
  }
}
