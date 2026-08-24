import * as React from 'react'
import {
  WAKATIME_RPC_CHANNEL,
  UI_CATEGORIES,
  type WakatimeDailyUsage,
  type WakatimeUiConfig,
  type WakatimeUiRpcCall,
  type WakatimeUiStatus,
  type WakatimeUsageData,
} from './ui-contract.ts'

export const name = 'wakatime-settings'
export const inject = ['slots', 'connection', 'locale']

const NS = 'settings.wakatime'
const h = React.createElement

type Translator = (key: string) => string
type Tab = 'dashboard' | 'ai' | 'projects' | 'insights' | 'settings'

interface FormState {
  category: WakatimeUiConfig['category']
  trackReads: boolean
  autoInstall: boolean
  cliPath: string
  debug: boolean
  heartbeatIntervalMs: string
}

interface UsageRange {
  start: string
  end: string
}

const zh = {
  nav: 'WakaTime',
  title: 'WakaTime',
  subtitle: '每日活动与 AI 编程数据',
  dashboard: '仪表盘',
  ai: 'AI Coding',
  projects: '项目',
  insights: '洞察',
  settings: '配置',
  refresh: '刷新',
  configure: '去配置',
  today: '今天',
  last7Days: '近 7 天',
  last14Days: '近 14 天',
  loading: '加载中…',
  noApiKey: '还没有配置 WakaTime API Key',
  noApiKeyHint: '配置后，这里会显示每日编码时间、项目、语言以及 AI 编程数据。密钥只会在 Host 进程中使用。',
  noData: '这个时间范围还没有活动数据。',
  range: '时间范围',
  totalTime: '编码时间',
  todayTime: '今天',
  dailyAverage: '日均时间',
  dailyAverageOther: '含 Other 的日均',
  bestDay: '最活跃的一天',
  rangeSummary: '这段时间的活动概览',
  aiTime: 'AI 编程时间',
  aiLines: 'AI 改动行数',
  aiDriven: 'AI 驱动占比',
  aiAdditions: 'AI 新增行数',
  aiDeletions: 'AI 删除行数',
  humanAdditions: '人工新增行数',
  humanDeletions: '人工删除行数',
  activeDays: '活跃天数',
  days: '天',
  ofTotal: '占总时间',
  lines: '行',
  dailyActivity: '每日活动',
  dailyActivityHint: '柱高表示当天的编码时间；下方同时标出 AI 编程时间和行数。',
  aiDailyHint: '柱高表示当天 AI 改动的行数，下方显示 AI 编程时间。',
  aiActivity: 'AI 编程',
  aiActivityHint: '来自 WakaTime summaries 的 AI 行变更、会话、提示词和模型数据。',
  aiProjects: 'AI 辅助项目',
  aiProjectsHint: '按 AI 改动行数排序的项目。',
  aiSessions: 'AI 会话',
  prompts: '提示词次数',
  avgPromptLength: '平均提示词长度',
  tokens: '输入 / 输出 Token',
  cachedTokens: '缓存 Token',
  estimatedCost: '估算成本',
  models: '模型',
  languages: '语言',
  categories: '活动分类',
  editors: '编码工具',
  machines: '设备机器',
  operatingSystems: '操作系统',
  aiHuman: 'AI 与人工',
  aiHumanHint: '按代码行变更对比 AI 生成和人工输入。',
  human: '人工',
  topProjects: 'Top 10 项目',
  topProjectsHint: '只显示时间最多的 10 个项目。',
  todayBreakdown: '今天的活动分布',
  todayProjects: '项目',
  todayLanguages: '语言',
  todayCategories: '分类',
  weekdayAverage: '工作日平均',
  aiPercentage: 'AI 占比趋势',
  insightsHint: '从每日活动中提炼出的节奏与 AI 使用趋势。',
  workspaceHint: '编码工具、语言、设备和项目的时间占比。',
  noBreakdown: '暂无明细',
  apiKey: 'API Key',
  apiKeyConfigured: '已配置',
  apiKeyMissing: '未配置',
  clearApiKey: '清除',
  apiKeyHint: '从 WakaTime 账户设置中复制 API Key。现有密钥不会回传到页面。',
  cli: 'CLI',
  ready: '可用',
  missing: '未找到',
  invalid: '不可用',
  cliPath: 'CLI 路径',
  cliPathHint: '留空时按 PATH 或托管目录自动发现。',
  category: '活动分类',
  trackReads: '记录读取活动',
  trackReadsHint: '把成功的 read / read_image 作为零行变更活动记录。',
  autoInstall: '自动管理 CLI',
  autoInstallHint: '找不到本机 CLI 时，允许插件从 WakaTime GitHub 发布页下载。',
  debug: '调试日志',
  heartbeatInterval: 'Heartbeat 间隔（毫秒）',
  advanced: '高级选项',
  save: '保存配置',
  saving: '保存中…',
  saved: '已保存',
  security: '密钥只在本机 Host 中使用。',
  loadFailed: '无法读取 WakaTime 状态。请确认插件已在当前 profile 中启用。',
  saveFailed: '配置保存失败',
  usageFailed: '无法读取 WakaTime 数据',
  unavailable: '暂时无法获取数据',
  stale: 'WakaTime 正在更新这段数据，稍后刷新即可。',
}

const en = {
  nav: 'WakaTime',
  title: 'WakaTime',
  subtitle: 'Daily activity and AI coding data',
  dashboard: 'Dashboard',
  ai: 'AI Coding',
  projects: 'Projects',
  insights: 'Insights',
  settings: 'Settings',
  refresh: 'Refresh',
  configure: 'Configure',
  today: 'Today',
  last7Days: 'Last 7 days',
  last14Days: 'Last 14 days',
  loading: 'Loading…',
  noApiKey: 'WakaTime API key is not configured',
  noApiKeyHint: 'Configure it to see daily coding time, projects, languages, and AI coding data. The key stays in the Host process.',
  noData: 'There is no activity in this date range.',
  range: 'Date range',
  totalTime: 'Coding time',
  todayTime: 'Today',
  dailyAverage: 'Daily average',
  dailyAverageOther: 'Daily average incl. Other',
  bestDay: 'Most active day',
  rangeSummary: 'Activity overview for this range',
  aiTime: 'AI coding time',
  aiLines: 'AI line changes',
  aiDriven: 'AI-driven share',
  aiAdditions: 'AI additions',
  aiDeletions: 'AI deletions',
  humanAdditions: 'Human additions',
  humanDeletions: 'Human deletions',
  activeDays: 'active days',
  days: 'days',
  ofTotal: 'of total',
  lines: 'lines',
  dailyActivity: 'Daily activity',
  dailyActivityHint: 'Bar height represents coding time; AI time and line changes are shown below each day.',
  aiDailyHint: 'Bar height represents daily AI line changes; AI coding time is shown below.',
  aiActivity: 'AI coding',
  aiActivityHint: 'AI line changes, sessions, prompts, and model data from WakaTime summaries.',
  aiProjects: 'AI-assisted projects',
  aiProjectsHint: 'Projects ranked by AI line changes.',
  aiSessions: 'AI sessions',
  prompts: 'Prompt events',
  avgPromptLength: 'Avg. prompt length',
  tokens: 'Input / output tokens',
  cachedTokens: 'Cached tokens',
  estimatedCost: 'Estimated cost',
  models: 'Models',
  languages: 'Languages',
  categories: 'Activity categories',
  editors: 'Coding tools',
  machines: 'Machines',
  operatingSystems: 'Operating systems',
  aiHuman: 'AI vs human',
  aiHumanHint: 'AI-generated and human-typed line changes.',
  human: 'Human',
  topProjects: 'Top 10 projects',
  topProjectsHint: 'Only the 10 projects with the most time are shown.',
  todayBreakdown: 'Today’s activity breakdown',
  todayProjects: 'Projects',
  todayLanguages: 'Languages',
  todayCategories: 'Categories',
  weekdayAverage: 'Weekday average',
  aiPercentage: 'AI share trend',
  insightsHint: 'Patterns and AI usage trends derived from daily activity.',
  workspaceHint: 'Time share across coding tools, languages, machines, and projects.',
  noBreakdown: 'No breakdown yet',
  apiKey: 'API key',
  apiKeyConfigured: 'Configured',
  apiKeyMissing: 'Not configured',
  clearApiKey: 'Clear',
  apiKeyHint: 'Copy the API key from your WakaTime account settings. An existing key is never returned to the page.',
  cli: 'CLI',
  ready: 'Ready',
  missing: 'Missing',
  invalid: 'Unavailable',
  cliPath: 'CLI path',
  cliPathHint: 'Leave empty to discover a PATH or managed binary.',
  category: 'Activity category',
  trackReads: 'Track reads',
  trackReadsHint: 'Include successful read / read_image operations as zero-line-change activity.',
  autoInstall: 'Manage the CLI automatically',
  autoInstallHint: 'Allow downloads from WakaTime GitHub releases when no local CLI is found.',
  debug: 'Debug logging',
  heartbeatInterval: 'Heartbeat interval (ms)',
  advanced: 'Advanced options',
  save: 'Save settings',
  saving: 'Saving…',
  saved: 'Saved',
  security: 'The key is only used in the local Host process.',
  loadFailed: 'Could not read WakaTime status. Make sure the plugin is enabled in this profile.',
  saveFailed: 'Could not save settings',
  usageFailed: 'Could not read WakaTime data',
  unavailable: 'Data is temporarily unavailable',
  stale: 'WakaTime is updating this range. Refresh in a moment.',
}

const STYLE = `
.dshWakatimePage {
  box-sizing: border-box;
  width: 100%;
  max-width: 1080px;
  min-height: 100%;
  padding: 28px 32px 56px;
  color: inherit;
  font: inherit;
  container-type: inline-size;
}
.dshWakatimePage *, .dshWakatimePage *::before, .dshWakatimePage *::after { box-sizing: border-box; min-width: 0; }
.dshWakatimeButton { appearance: none; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 7px; padding: 8px 12px; color: inherit; background: transparent; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: border-color 140ms ease, background 140ms ease; }
.dshWakatimeButton:hover { border-color: currentColor; background: color-mix(in srgb, currentColor 6%, transparent); }
.dshWakatimeButton:disabled { opacity: .45; cursor: wait; }
.dshWakatimeButton[data-primary="true"] { border-color: currentColor; }
.dshWakatimeButton:focus-visible, .dshWakatimeTab:focus-visible, .dshWakatimeField input:focus-visible, .dshWakatimeField select:focus-visible, .dshWakatimeAdvanced summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.dshWakatimeTabs { display: flex; flex-wrap: wrap; gap: 14px 24px; margin-bottom: 20px; border-bottom: 1px solid color-mix(in srgb, currentColor 14%, transparent); }
.dshWakatimeTab { appearance: none; position: relative; border: 0; padding: 0 0 10px; color: inherit; opacity: .58; background: none; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
.dshWakatimeTab[aria-selected="true"] { opacity: 1; }
.dshWakatimeTab[aria-selected="true"]::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; border-radius: 2px; background: currentColor; content: ""; }
.dshWakatimeError { margin-bottom: 14px; border: 1px solid currentColor; border-radius: 7px; padding: 10px 12px; color: inherit; background: color-mix(in srgb, currentColor 6%, transparent); font-size: 12px; line-height: 1.45; }
.dshWakatimeNotice { color: inherit; opacity: .68; font-size: 12px; line-height: 1.45; }
.dshWakatimeToolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.dshWakatimeRange { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.dshWakatimeRangeLabel { margin-right: 4px; color: currentColor; opacity: .56; font-size: 12px; }
.dshWakatimeRangeButton { padding: 6px 9px; border-radius: 5px; font-size: 11px; font-weight: 600; }
.dshWakatimeRangeButton[aria-pressed="true"] { border-color: currentColor; background: color-mix(in srgb, currentColor 7%, transparent); }
.dshWakatimeMetrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 12px; }
.dshWakatimeMetric, .dshWakatimeCard { border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 10px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeMetric { min-height: 92px; padding: 14px 15px; }
.dshWakatimeMetricLabel { margin-bottom: 10px; color: currentColor; opacity: .58; font-size: 11px; font-weight: 650; }
.dshWakatimeMetricValue { overflow-wrap: anywhere; font-size: clamp(16px, 4vw, 21px); font-weight: 700; letter-spacing: -.02em; line-height: 1.15; }
.dshWakatimeMetricMeta { margin-top: 5px; color: currentColor; opacity: .55; font-size: 11px; }
.dshWakatimeCard { padding: 17px 18px; }
.dshWakatimeSectionHint { margin: 0 0 14px; color: currentColor; opacity: .62; font-size: 13px; line-height: 1.5; }
.dshWakatimeDashboardChart { margin-top: 12px; }
.dshWakatimeCardTitle { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 5px; font-size: 14px; letter-spacing: -.01em; }
.dshWakatimeCardHint { margin: 0 0 16px; color: currentColor; opacity: .56; font-size: 12px; line-height: 1.5; }
.dshWakatimeGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.dshWakatimeCard + .dshWakatimeGrid,
.dshWakatimeGrid + .dshWakatimeCard,
.dshWakatimeGrid + .dshWakatimeGrid { margin-top: 12px; }
.dshWakatimeOverviewGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px; }
.dshWakatimeOverviewCard { min-width: 0; }
.dshWakatimeMiniGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 10px; }
.dshWakatimeMiniSection { min-width: 0; }
.dshWakatimeMiniTitle { margin: 0; color: currentColor; opacity: .58; font-size: 11px; font-weight: 650; }
.dshWakatimeMiniSection .dshWakatimeBreakdown { margin-top: 8px; }
.dshWakatimeInsightChart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; min-height: 168px; align-items: end; }
.dshWakatimeInsightDay { display: grid; grid-template-rows: 112px auto auto; gap: 5px; min-width: 0; text-align: center; }
.dshWakatimeInsightBar { display: flex; align-items: end; justify-content: center; height: 112px; }
.dshWakatimeInsightBar span { display: block; width: min(22px, 60%); min-height: 3px; border-radius: 3px 3px 1px 1px; background: currentColor; opacity: .62; }
.dshWakatimeInsightLabel { overflow: hidden; color: currentColor; opacity: .58; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightValue { font-size: 11px; font-variant-numeric: tabular-nums; font-weight: 650; }
.dshWakatimeDailyChart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; min-height: 156px; align-items: end; }
.dshWakatimeDay { display: grid; min-width: 0; grid-template-rows: 104px auto auto; gap: 4px; text-align: center; }
.dshWakatimeDayBar { display: flex; height: 104px; align-items: end; justify-content: center; }
.dshWakatimeDayBar span { display: block; width: min(24px, 58%); min-height: 3px; border-radius: 3px 3px 1px 1px; background: currentColor; opacity: .64; }
.dshWakatimeDayLabel { overflow: hidden; color: currentColor; opacity: .58; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeDayTotal { font-size: 11px; font-weight: 650; }
.dshWakatimeDayAi { min-height: 14px; overflow-wrap: anywhere; color: currentColor; opacity: .56; font-size: 10px; line-height: 1.25; }
.dshWakatimeRows { display: grid; gap: 8px; }
.dshWakatimeRow { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding-bottom: 8px; border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent); }
.dshWakatimeRow:last-child { padding-bottom: 0; border-bottom: 0; }
.dshWakatimeRowLabel { color: currentColor; opacity: .6; font-size: 12px; }
.dshWakatimeRowValue { max-width: 68%; overflow-wrap: anywhere; font-size: 12px; font-variant-numeric: tabular-nums; font-weight: 620; line-height: 1.35; text-align: right; }
.dshWakatimeBreakdown { display: grid; gap: 10px; margin-top: 13px; }
.dshWakatimeBreakdownItem { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.dshWakatimeBreakdownHead { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 4px; font-size: 11px; }
.dshWakatimeBreakdownHead span:first-child { overflow: hidden; opacity: .72; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeBreakdownHead span:last-child { opacity: .58; }
.dshWakatimeTrack { height: 4px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 10%, transparent); }
.dshWakatimeTrack span { display: block; height: 100%; border-radius: inherit; background: currentColor; opacity: .58; }
.dshWakatimeBreakdownValue { color: currentColor; opacity: .68; font-size: 11px; white-space: nowrap; }
.dshWakatimeComparison { display: grid; gap: 12px; margin-top: 10px; }
.dshWakatimeComparisonRow { display: grid; gap: 5px; }
.dshWakatimeComparisonHead { display: flex; justify-content: space-between; gap: 10px; color: currentColor; font-size: 12px; }
.dshWakatimeComparisonHead span:first-child { opacity: .68; }
.dshWakatimeComparisonHead span:last-child { font-variant-numeric: tabular-nums; font-weight: 650; }
.dshWakatimeEmpty { border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 10px; padding: 28px 24px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeEmptyTitle { margin: 0 0 7px; font-size: 16px; font-weight: 700; }
.dshWakatimeEmpty p { max-width: 560px; margin: 0 0 16px; color: currentColor; opacity: .64; font-size: 13px; line-height: 1.55; }
.dshWakatimeConfigCard { max-width: 720px; }
.dshWakatimeForm { display: grid; gap: 17px; }
.dshWakatimeField { display: grid; gap: 7px; }
.dshWakatimeField label, .dshWakatimeCheck label { font-size: 12px; font-weight: 650; }
.dshWakatimeField small, .dshWakatimeCheck small { color: currentColor; opacity: .58; font-size: 11px; line-height: 1.45; }
.dshWakatimeField input, .dshWakatimeField select { width: 100%; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; padding: 9px 10px; color: inherit; background: transparent; font: inherit; font-size: 13px; }
.dshWakatimeField select { cursor: pointer; }
.dshWakatimeInlineActions { display: flex; align-items: center; gap: 8px; }
.dshWakatimeInlineActions input { flex: 1; min-width: 0; }
.dshWakatimeFormGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.dshWakatimeChecks { display: grid; gap: 12px; }
.dshWakatimeCheck { display: grid; grid-template-columns: 17px minmax(0, 1fr); gap: 9px; align-items: start; }
.dshWakatimeCheck input { width: 15px; height: 15px; margin: 1px 0 0; accent-color: currentColor; }
.dshWakatimeCheck small { display: block; margin-top: 4px; }
.dshWakatimeAdvanced { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); padding-top: 14px; }
.dshWakatimeAdvanced summary { width: fit-content; color: inherit; opacity: .7; font-size: 12px; font-weight: 650; cursor: pointer; }
.dshWakatimeAdvanced[open] summary { margin-bottom: 15px; opacity: 1; }
.dshWakatimeFormActions { display: flex; align-items: center; gap: 11px; padding-top: 2px; }
.dshWakatimeSaved { color: inherit; opacity: .68; font-size: 12px; font-weight: 650; }
@media (max-width: 820px) {
  .dshWakatimePage { padding: 24px 20px 42px; }
  .dshWakatimeToolbar { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 560px) {
  .dshWakatimePage { padding: 20px 15px 36px; }
  .dshWakatimeDailyChart { gap: 3px; }
  .dshWakatimeDayBar span { width: 16px; }
}
@container (max-width: 620px) {
  .dshWakatimePage { padding: 20px 18px 36px; }
  .dshWakatimeToolbar { margin-bottom: 16px; }
  .dshWakatimeTabs { gap: 12px 18px; }
  .dshWakatimeMetrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeCard { padding: 15px; }
  .dshWakatimeMiniGrid { grid-template-columns: 1fr; gap: 12px; }
  .dshWakatimeDailyChart { gap: 3px; }
  .dshWakatimeDayBar span { width: 16px; }
}
@media (prefers-reduced-motion: reduce) { .dshWakatimeButton { transition: none; } }
`

function tr(t: Translator, key: string, fallback: string): string {
  try {
    const value = t(key)
    return typeof value === 'string' && value.length > 0 ? value : fallback
  } catch {
    return fallback
  }
}

async function callValue<T>(
  rpcCall: WakatimeUiRpcCall,
  endpoint: string,
  payload?: unknown,
): Promise<T> {
  const result = await rpcCall(endpoint, payload)
  if (!result.ok) throw new Error(result.error?.message ?? 'RPC request failed')
  return result.value as T
}

function hydrateUsageData(value: WakatimeUsageData): WakatimeUsageData {
  const legacy = value as WakatimeUsageData & {
    categories?: WakatimeUsageData['categories']
    todayBreakdown?: WakatimeUsageData['todayBreakdown']
  }
  return {
    ...value,
    totals: {
      ...value.totals,
      aiPromptLengthSum: value.totals.aiPromptLengthSum ?? 0,
    },
    categories: legacy.categories ?? [],
    todayBreakdown: legacy.todayBreakdown ?? {
      date: value.end,
      projects: [],
      languages: [],
      categories: [],
    },
  }
}

function formFromStatus(status: WakatimeUiStatus): FormState {
  return {
    category: status.config.category,
    trackReads: status.config.trackReads,
    autoInstall: status.config.autoInstall,
    cliPath: status.config.cliPath ?? '',
    debug: status.config.debug,
    heartbeatIntervalMs: String(status.config.heartbeatIntervalMs),
  }
}

function localDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultRange(): UsageRange {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return { start: localDateInput(start), end: localDateInput(end) }
}

function rangeForDays(days: number): UsageRange {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  return { start: localDateInput(start), end: localDateInput(end) }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m'
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '<1m'
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours === 0) return `${remainder}m`
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(Math.round(value))
}

function formatCost(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `$${value.toFixed(2)}`
}

function dayLabel(day: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', weekday: 'short' })
      .format(new Date(`${day}T12:00:00`))
  } catch {
    return day.slice(5)
  }
}

function cliLabel(t: Translator, state: WakatimeUiStatus['cli']['state']): string {
  if (state === 'ready') return tr(t, 'ready', 'Ready')
  if (state === 'invalid') return tr(t, 'invalid', 'Unavailable')
  return tr(t, 'missing', 'Missing')
}

function Row({ label, value }: { label: string; value: string }) {
  return h('div', { className: 'dshWakatimeRow' },
    h('span', { className: 'dshWakatimeRowLabel' }, label),
    h('span', { className: 'dshWakatimeRowValue', title: value }, value),
  )
}

function Metric({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return h('div', { className: 'dshWakatimeMetric' },
    h('div', { className: 'dshWakatimeMetricLabel' }, label),
    h('div', { className: 'dshWakatimeMetricValue' }, value),
    meta === undefined ? null : h('div', { className: 'dshWakatimeMetricMeta' }, meta),
  )
}

function Breakdown({
  items,
  formatValue,
}: {
  items: Array<{ name: string; value: number; detail?: string }>
  formatValue: (value: number) => string
}) {
  const max = Math.max(1, ...items.map(item => item.value))
  if (items.length === 0) return h('p', { className: 'dshWakatimeNotice' }, '—')
  return h('div', { className: 'dshWakatimeBreakdown' }, items.map(item => h('div', { className: 'dshWakatimeBreakdownItem', key: item.name },
    h('div', null,
      h('div', { className: 'dshWakatimeBreakdownHead' },
        h('span', { title: item.name }, item.name),
        item.detail === undefined ? null : h('span', null, item.detail),
      ),
      h('div', { className: 'dshWakatimeTrack' }, h('span', { style: { width: `${Math.max(4, item.value / max * 100)}%` } })),
    ),
    h('span', { className: 'dshWakatimeBreakdownValue' }, formatValue(item.value)),
  )))
}

function DailyChart({ days, t }: { days: WakatimeDailyUsage[]; t: Translator }) {
  const max = Math.max(1, ...days.map(day => day.totalSeconds))
  return h('div', { className: 'dshWakatimeDailyChart', role: 'list', 'aria-label': tr(t, 'dailyActivity', 'Daily activity') },
    days.map(day => {
      const height = day.totalSeconds > 0 ? Math.max(5, day.totalSeconds / max * 100) : 2
      return h('div', {
        className: 'dshWakatimeDay',
        key: day.date,
        role: 'listitem',
        title: `${day.date} · ${day.text ?? formatDuration(day.totalSeconds)}`,
      },
      h('div', { className: 'dshWakatimeDayBar' }, h('span', { style: { height: `${height}%` } })),
      h('div', { className: 'dshWakatimeDayLabel' }, dayLabel(day.date)),
      h('div', { className: 'dshWakatimeDayTotal' }, day.text ?? formatDuration(day.totalSeconds)),
      h('div', { className: 'dshWakatimeDayAi' }, (() => {
        const parts = []
        if (day.aiSeconds > 0) parts.push(formatDuration(day.aiSeconds))
        const lines = day.aiAdditions + day.aiDeletions
        if (lines > 0) parts.push(`${formatNumber(lines)} ${tr(t, 'lines', 'lines')}`)
        return parts.length === 0 ? '—' : `AI ${parts.join(' · ')}`
      })()),
      )
    }),
  )
}

function AiDailyChart({ days, t }: { days: WakatimeDailyUsage[]; t: Translator }) {
  const values = days.map(day => day.aiAdditions + day.aiDeletions)
  const max = Math.max(1, ...values)
  return h('div', { className: 'dshWakatimeDailyChart', role: 'list', 'aria-label': tr(t, 'aiActivity', 'AI coding') },
    days.map((day, index) => {
      const lines = values[index] ?? 0
      const height = lines > 0 ? Math.max(5, lines / max * 100) : 2
      return h('div', { className: 'dshWakatimeDay', key: day.date, role: 'listitem', title: `${day.date} · ${formatNumber(lines)} ${tr(t, 'lines', 'lines')}` },
        h('div', { className: 'dshWakatimeDayBar' }, h('span', { style: { height: `${height}%` } })),
        h('div', { className: 'dshWakatimeDayLabel' }, dayLabel(day.date)),
        h('div', { className: 'dshWakatimeDayTotal' }, `${formatNumber(lines)} ${tr(t, 'lines', 'lines')}`),
        h('div', { className: 'dshWakatimeDayAi' }, day.aiSeconds > 0 ? formatDuration(day.aiSeconds) : '—'),
      )
    }),
  )
}

function OverviewCard({ title, children }: { title: string; children?: React.ReactNode }) {
  return h('section', { className: 'dshWakatimeCard dshWakatimeOverviewCard' },
    h('h2', { className: 'dshWakatimeCardTitle' }, title),
    children,
  )
}

function TodayBreakdownCard({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const today = usage.todayBreakdown
  return h(OverviewCard, { title: `${tr(t, 'todayBreakdown', 'Today’s activity breakdown')} · ${dayLabel(today.date)}` },
    h('div', { className: 'dshWakatimeMiniGrid' },
      h('div', { className: 'dshWakatimeMiniSection' },
        h('h3', { className: 'dshWakatimeMiniTitle' }, tr(t, 'todayProjects', 'Projects')),
        bucketBreakdown(today.projects, formatDuration, t),
      ),
      h('div', { className: 'dshWakatimeMiniSection' },
        h('h3', { className: 'dshWakatimeMiniTitle' }, tr(t, 'todayLanguages', 'Languages')),
        bucketBreakdown(today.languages, formatDuration, t),
      ),
      h('div', { className: 'dshWakatimeMiniSection' },
        h('h3', { className: 'dshWakatimeMiniTitle' }, tr(t, 'todayCategories', 'Categories')),
        bucketBreakdown(today.categories, formatDuration, t),
      ),
    ),
  )
}

function AiHumanComparison({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const aiLines = usage.totals.aiAdditions + usage.totals.aiDeletions
  const humanLines = usage.totals.humanAdditions + usage.totals.humanDeletions
  const max = Math.max(1, aiLines, humanLines)
  const row = (label: string, value: number) => h('div', { className: 'dshWakatimeComparisonRow', key: label },
    h('div', { className: 'dshWakatimeComparisonHead' },
      h('span', null, label),
      h('span', null, `${formatNumber(value)} ${tr(t, 'lines', 'lines')}`),
    ),
    h('div', { className: 'dshWakatimeTrack' }, h('span', { style: { width: `${Math.max(4, value / max * 100)}%` } })),
  )
  return h('div', { className: 'dshWakatimeComparison' },
    row(tr(t, 'ai', 'AI'), aiLines),
    row(tr(t, 'human', 'Human'), humanLines),
  )
}

function emptyBreakdown(t: Translator) {
  return h('p', { className: 'dshWakatimeNotice' }, tr(t, 'noBreakdown', 'No breakdown yet'))
}

function bucketBreakdown(
  items: WakatimeUsageData['projects'],
  formatValue: (value: number) => string,
  t: Translator,
) {
  return items.length === 0 ? emptyBreakdown(t) : h(Breakdown, {
    items: items.map(item => ({ name: item.name, value: item.totalSeconds, detail: `${item.percent.toFixed(0)}%` })),
    formatValue,
  })
}

function DashboardView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const dashboard = usage.dashboard
  const activeDays = usage.days.filter(day => day.totalSeconds > 0).length
  const bestDay = dashboard.bestDay
  const dailyAverage = dashboard.dailyAverageText ?? formatDuration(dashboard.dailyAverageSeconds)
  const dailyAverageOther = dashboard.dailyAverageIncludingOtherText ?? formatDuration(dashboard.dailyAverageIncludingOtherSeconds)
  const today = dashboard.todayText ?? formatDuration(dashboard.todaySeconds)
  return h(React.Fragment, null,
    h('p', { className: 'dshWakatimeSectionHint' }, tr(t, 'rangeSummary', 'Activity overview for this range')),
    h('div', { className: 'dshWakatimeMetrics' },
      h(Metric, { label: tr(t, 'totalTime', 'Coding time'), value: dashboard.cumulativeText ?? formatDuration(dashboard.cumulativeSeconds), meta: `${activeDays}/${usage.days.length} ${tr(t, 'activeDays', 'active days')}` }),
      h(Metric, { label: tr(t, 'todayTime', 'Today'), value: today, meta: usage.end }),
      h(Metric, { label: tr(t, 'dailyAverage', 'Daily average'), value: dailyAverage, meta: `${tr(t, 'dailyAverageOther', 'Daily average incl. Other')}: ${dailyAverageOther}` }),
      h(Metric, { label: tr(t, 'bestDay', 'Most active day'), value: bestDay === undefined ? '—' : bestDay.text ?? formatDuration(bestDay.totalSeconds), meta: bestDay === undefined ? '—' : dayLabel(bestDay.date) }),
    ),
    h('section', { className: 'dshWakatimeCard dshWakatimeDashboardChart' },
      h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'dailyActivity', 'Daily activity')),
      h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'dailyActivityHint', 'Bar height represents coding time.')),
      usage.days.every(day => day.totalSeconds === 0)
        ? h('p', { className: 'dshWakatimeNotice' }, tr(t, 'noData', 'There is no activity in this date range.'))
        : h(DailyChart, { days: usage.days, t }),
    ),
    h('div', { className: 'dshWakatimeOverviewGrid' },
      h(OverviewCard, { title: tr(t, 'topProjects', 'Top 10 projects') },
        bucketBreakdown(usage.projects.slice(0, 10), formatDuration, t),
      ),
      h(TodayBreakdownCard, { usage, t }),
      h(OverviewCard, { title: tr(t, 'models', 'Models') },
        usage.aiModels.length === 0 ? emptyBreakdown(t) : h(Breakdown, {
          items: usage.aiModels.map(model => ({ name: model.name, value: Math.abs(model.lines), detail: formatCost(model.cost) })),
          formatValue: value => `${formatNumber(value)} ${tr(t, 'lines', 'lines')}`,
        }),
      ),
      h(OverviewCard, { title: tr(t, 'editors', 'Coding tools') }, bucketBreakdown(usage.editors, formatDuration, t)),
      h(OverviewCard, { title: tr(t, 'languages', 'Languages') }, bucketBreakdown(usage.languages, formatDuration, t)),
      h(OverviewCard, { title: tr(t, 'categories', 'Activity categories') }, bucketBreakdown(usage.categories, formatDuration, t)),
      h(OverviewCard, { title: tr(t, 'operatingSystems', 'Operating systems') }, bucketBreakdown(usage.operatingSystems, formatDuration, t)),
      h(OverviewCard, { title: tr(t, 'machines', 'Machines') }, bucketBreakdown(usage.machines, formatDuration, t)),
      h(OverviewCard, { title: tr(t, 'aiHuman', 'AI vs human') },
        h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'aiHumanHint', 'AI-generated and human-typed line changes.')),
        h(AiHumanComparison, { usage, t }),
      ),
    ),
    usage.isUpToDate === false ? h('p', { className: 'dshWakatimeNotice', role: 'status' }, tr(t, 'stale', 'WakaTime is updating this range.')) : null,
  )
}

function AiView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const totals = usage.totals
  const aiLines = totals.aiAdditions + totals.aiDeletions
  const humanLines = totals.humanAdditions + totals.humanDeletions
  const changedLines = aiLines + humanLines
  const aiDriven = changedLines > 0 ? `${Math.round(aiLines / changedLines * 100)}%` : '—'
  const averagePromptLength = totals.aiPromptEvents > 0
    ? formatNumber(totals.aiPromptLengthSum / totals.aiPromptEvents)
    : '—'
  return h(React.Fragment, null,
    h('p', { className: 'dshWakatimeSectionHint' }, tr(t, 'aiActivityHint', 'AI line changes, sessions, prompts, and model data from WakaTime summaries.')),
    h('div', { className: 'dshWakatimeMetrics' },
      h(Metric, { label: tr(t, 'aiTime', 'AI coding time'), value: formatDuration(totals.aiSeconds), meta: totals.totalSeconds > 0 ? `${Math.round(totals.aiSeconds / totals.totalSeconds * 100)}% ${tr(t, 'ofTotal', 'of total')}` : '—' }),
      h(Metric, { label: tr(t, 'aiLines', 'AI line changes'), value: `${formatNumber(aiLines)} ${tr(t, 'lines', 'lines')}`, meta: `+${formatNumber(totals.aiAdditions)} / −${formatNumber(totals.aiDeletions)}` }),
      h(Metric, { label: tr(t, 'aiDriven', 'AI-driven share'), value: aiDriven, meta: `${formatNumber(humanLines)} ${tr(t, 'human', 'Human')} ${tr(t, 'lines', 'lines')}` }),
      h(Metric, { label: tr(t, 'estimatedCost', 'Estimated cost'), value: formatCost(totals.aiModelTotalCost), meta: tr(t, 'models', 'Models') }),
      h(Metric, { label: tr(t, 'aiSessions', 'AI sessions'), value: formatNumber(totals.aiSessions), meta: formatNumber(totals.aiPromptEvents) + ` ${tr(t, 'prompts', 'Prompt events')}` }),
      h(Metric, { label: tr(t, 'avgPromptLength', 'Avg. prompt length'), value: averagePromptLength, meta: tr(t, 'prompts', 'Prompt events') }),
    ),
    h('div', { className: 'dshWakatimeGrid' },
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'aiActivity', 'AI coding')),
        h('div', { className: 'dshWakatimeRows' },
          h(Row, { label: tr(t, 'aiAdditions', 'AI additions'), value: formatNumber(totals.aiAdditions) }),
          h(Row, { label: tr(t, 'aiDeletions', 'AI deletions'), value: formatNumber(totals.aiDeletions) }),
          h(Row, { label: tr(t, 'humanAdditions', 'Human additions'), value: formatNumber(totals.humanAdditions) }),
          h(Row, { label: tr(t, 'humanDeletions', 'Human deletions'), value: formatNumber(totals.humanDeletions) }),
          h(Row, { label: tr(t, 'tokens', 'Input / output tokens'), value: `${formatNumber(totals.aiInputTokens)} / ${formatNumber(totals.aiOutputTokens)}` }),
          h(Row, { label: tr(t, 'cachedTokens', 'Cached tokens'), value: formatNumber(totals.aiCachedInputTokens) }),
          h(Row, { label: tr(t, 'avgPromptLength', 'Avg. prompt length'), value: averagePromptLength }),
        ),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'models', 'Models')),
        usage.aiModels.length === 0 ? emptyBreakdown(t) : h(Breakdown, {
          items: usage.aiModels.map(model => ({ name: model.name, value: Math.abs(model.lines), detail: formatCost(model.cost) })),
          formatValue: value => `${formatNumber(value)} ${tr(t, 'lines', 'lines')}`,
        }),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'aiProjects', 'AI-assisted projects')),
        h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'aiProjectsHint', 'Projects ranked by AI line changes.')),
        (() => {
          const projects = usage.projects
            .map(project => ({
              name: project.name,
              value: project.aiAdditions + project.aiDeletions,
              detail: formatDuration(project.totalSeconds),
            }))
            .filter(project => project.value > 0)
            .sort((a, b) => b.value - a.value)
          return projects.length === 0 ? emptyBreakdown(t) : h(Breakdown, {
            items: projects,
            formatValue: value => `${formatNumber(value)} ${tr(t, 'lines', 'lines')}`,
          })
        })(),
      ),
    ),
    h('section', { className: 'dshWakatimeCard' },
      h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'aiLines', 'AI line changes')),
      h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'aiDailyHint', 'Bar height represents daily AI line changes.')),
      h(AiDailyChart, { days: usage.days, t }),
    ),
  )
}

function WorkspaceView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  return h(React.Fragment, null,
    h('p', { className: 'dshWakatimeSectionHint' }, tr(t, 'workspaceHint', 'Time share across coding tools, languages, machines, and projects.')),
    h('section', { className: 'dshWakatimeCard' },
      h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'topProjects', 'Top 10 projects')),
      h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'topProjectsHint', 'Only the 10 projects with the most time are shown.')),
      bucketBreakdown(usage.projects.slice(0, 10), formatDuration, t),
    ),
    h('div', { className: 'dshWakatimeGrid' },
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'editors', 'Coding tools')),
        bucketBreakdown(usage.editors, formatDuration, t),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'languages', 'Languages')),
        bucketBreakdown(usage.languages, formatDuration, t),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'categories', 'Activity categories')),
        bucketBreakdown(usage.categories, formatDuration, t),
      ),
    ),
    h('div', { className: 'dshWakatimeGrid' },
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'machines', 'Machines')),
        bucketBreakdown(usage.machines, formatDuration, t),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'operatingSystems', 'Operating systems')),
        bucketBreakdown(usage.operatingSystems, formatDuration, t),
      ),
    ),
    h(TodayBreakdownCard, { usage, t }),
  )
}

function weekdayLabel(index: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(2024, 0, 7 + index))
  } catch {
    return String(index + 1)
  }
}

function InsightsView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const weekdayItems = Array.from({ length: 7 }, (_, index) => {
    const days = usage.days.filter(day => new Date(`${day.date}T12:00:00`).getDay() === index)
    const average = days.length > 0
      ? days.reduce((sum, day) => sum + day.totalSeconds, 0) / days.length
      : 0
    return {
      name: weekdayLabel(index),
      value: average,
      ...(days.length > 0 ? { detail: `${days.length} ${tr(t, 'days', 'days')}` } : {}),
    }
  })
  const aiDays = usage.days.map(day => {
    const aiLines = day.aiAdditions + day.aiDeletions
    const humanLines = day.humanAdditions + day.humanDeletions
    const changedLines = aiLines + humanLines
    return { day, percent: changedLines > 0 ? aiLines / changedLines * 100 : 0 }
  })
  const maxAiPercent = Math.max(1, ...aiDays.map(item => item.percent))
  return h(React.Fragment, null,
    h('p', { className: 'dshWakatimeSectionHint' }, tr(t, 'insightsHint', 'Patterns and AI usage trends derived from daily activity.')),
    h('div', { className: 'dshWakatimeGrid' },
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'weekdayAverage', 'Weekday average')),
        h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'dailyActivityHint', 'Bar height represents coding time.')),
        h(Breakdown, { items: weekdayItems, formatValue: formatDuration }),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'aiHuman', 'AI vs human')),
        h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'aiPercentage', 'AI share trend')),
        aiDays.length === 0
          ? emptyBreakdown(t)
          : h('div', { className: 'dshWakatimeInsightChart', role: 'list', 'aria-label': tr(t, 'aiPercentage', 'AI share trend') }, aiDays.map(item => {
            const height = item.percent > 0 ? Math.max(5, item.percent / maxAiPercent * 100) : 2
            return h('div', { className: 'dshWakatimeInsightDay', key: item.day.date, role: 'listitem', title: `${item.day.date} · ${item.percent.toFixed(0)}%` },
              h('div', { className: 'dshWakatimeInsightBar' }, h('span', { style: { height: `${height}%` } })),
              h('div', { className: 'dshWakatimeInsightLabel' }, dayLabel(item.day.date)),
              h('div', { className: 'dshWakatimeInsightValue' }, `${item.percent.toFixed(0)}%`),
            )
          })),
      ),
    ),
    h('div', { className: 'dshWakatimeGrid' },
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'aiActivity', 'AI coding')),
        h('div', { className: 'dshWakatimeRows' },
          h(Row, { label: tr(t, 'aiTime', 'AI coding time'), value: formatDuration(usage.totals.aiSeconds) }),
          h(Row, { label: tr(t, 'aiLines', 'AI line changes'), value: formatNumber(usage.totals.aiAdditions + usage.totals.aiDeletions) }),
          h(Row, { label: tr(t, 'aiSessions', 'AI sessions'), value: formatNumber(usage.totals.aiSessions) }),
          h(Row, { label: tr(t, 'categories', 'Activity categories'), value: formatNumber(usage.categories.length) }),
        ),
      ),
      h('section', { className: 'dshWakatimeCard' },
        h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'models', 'Models')),
        usage.aiModels.length === 0 ? emptyBreakdown(t) : h(Breakdown, {
          items: usage.aiModels.map(model => ({ name: model.name, value: Math.abs(model.lines), detail: formatCost(model.cost) })),
          formatValue: value => `${formatNumber(value)} ${tr(t, 'lines', 'lines')}`,
        }),
      ),
    ),
  )
}

function WakatimeSettingsTab({ rpcCall, t }: { rpcCall: WakatimeUiRpcCall; t: Translator }) {
  const [tab, setTab] = React.useState<Tab>('dashboard')
  const [range, setRange] = React.useState<UsageRange>(defaultRange)
  const [status, setStatus] = React.useState<WakatimeUiStatus>()
  const [usage, setUsage] = React.useState<WakatimeUsageData>()
  const [form, setForm] = React.useState<FormState>()
  const [apiKey, setApiKey] = React.useState('')
  const [clearApiKey, setClearApiKey] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [usageLoading, setUsageLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [notice, setNotice] = React.useState('')
  const [error, setError] = React.useState('')

  const loadUsage = React.useCallback(async (nextRange: UsageRange = range) => {
    setUsageLoading(true)
    try {
      const next = await callValue<WakatimeUsageData>(rpcCall, 'usage', nextRange)
      setUsage(hydrateUsageData(next))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'usageFailed', 'Could not read WakaTime data'))
    } finally {
      setUsageLoading(false)
    }
  }, [range, rpcCall, t])

  const refresh = React.useCallback(async () => {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const next = await callValue<WakatimeUiStatus>(rpcCall, 'status')
      setStatus(next)
      setForm(current => current ?? formFromStatus(next))
      await loadUsage(range)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'loadFailed', 'Could not read WakaTime status.'))
    } finally {
      setLoading(false)
    }
  }, [loadUsage, range, rpcCall, t])

  React.useEffect(() => { void refresh() }, [])

  const save = async () => {
    if (form === undefined) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const next = await callValue<WakatimeUiStatus>(rpcCall, 'save', {
        config: {
          category: form.category,
          trackReads: form.trackReads,
          autoInstall: form.autoInstall,
          cliPath: form.cliPath,
          debug: form.debug,
          heartbeatIntervalMs: Number(form.heartbeatIntervalMs),
        },
        ...(clearApiKey
          ? { clearApiKey: true }
          : apiKey.trim().length === 0 ? {} : { apiKey: apiKey.trim() }),
      })
      setStatus(next)
      setForm(formFromStatus(next))
      setApiKey('')
      setClearApiKey(false)
      setNotice(tr(t, 'saved', 'Saved'))
      await loadUsage(range)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'saveFailed', 'Could not save settings'))
    } finally {
      setSaving(false)
    }
  }

  const input = (key: keyof FormState, value: string | boolean) => {
    setForm(current => current === undefined ? current : { ...current, [key]: value })
  }

  const setPreset = (days: number) => {
    const next = rangeForDays(days)
    setRange(next)
    void loadUsage(next)
  }
  const busy = loading || usageLoading || saving
  const config = form
  const state = status?.cli.state ?? 'missing'
  const hasUsage = status?.apiKeyConfigured === true && usage !== undefined

  const dataState = loading && usage === undefined
    ? h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'loading', 'Loading…'))
    : status?.apiKeyConfigured !== true
      ? h('div', { className: 'dshWakatimeEmpty' },
        h('h2', { className: 'dshWakatimeEmptyTitle' }, tr(t, 'noApiKey', 'WakaTime API key is not configured')),
        h('p', null, tr(t, 'noApiKeyHint', 'Configure it to load activity data.')),
        h('button', { className: 'dshWakatimeButton', 'data-primary': 'true', type: 'button', onClick: () => setTab('settings') }, tr(t, 'configure', 'Configure')),
      )
      : usageLoading && !hasUsage
        ? h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'loading', 'Loading…'))
        : usage === undefined
          ? h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'usageFailed', 'Could not read WakaTime data'))
          : null

  const data = usage === undefined || status?.apiKeyConfigured !== true || loading
    ? dataState
    : tab === 'dashboard'
      ? h(DashboardView, { usage, t })
      : tab === 'ai'
        ? h(AiView, { usage, t })
        : tab === 'projects'
          ? h(WorkspaceView, { usage, t })
          : h(InsightsView, { usage, t })

  const settings = config === undefined
    ? h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'loading', 'Loading…'))
    : h('section', { className: 'dshWakatimeCard dshWakatimeConfigCard' },
      h('div', { className: 'dshWakatimeForm' },
        h('div', { className: 'dshWakatimeField' },
          h('label', { htmlFor: 'dsh-wakatime-api-key' }, tr(t, 'apiKey', 'API key')),
          h('div', { className: 'dshWakatimeInlineActions' },
            h('input', {
              id: 'dsh-wakatime-api-key',
              type: 'password',
              autoComplete: 'off',
              value: apiKey,
              placeholder: status?.apiKeyConfigured ? '••••••••  (leave empty to keep)' : 'waka_…',
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setApiKey(event.target.value); setClearApiKey(false) },
            }),
            status?.apiKeyConfigured === true ? h('button', { className: 'dshWakatimeButton', type: 'button', disabled: busy, onClick: () => { setApiKey(''); setClearApiKey(true) } }, tr(t, 'clearApiKey', 'Clear')) : null,
          ),
          h('small', null, tr(t, 'apiKeyHint', 'Copy the API key from your WakaTime account settings.')),
        ),
        h('div', { className: 'dshWakatimeRows' },
          h(Row, { label: tr(t, 'apiKey', 'API key'), value: status?.apiKeyConfigured ? tr(t, 'apiKeyConfigured', 'Configured') : tr(t, 'apiKeyMissing', 'Not configured') }),
          h(Row, { label: tr(t, 'cli', 'CLI'), value: `${cliLabel(t, state)}${status?.cli.version === undefined ? '' : ` · ${status.cli.version}`}` }),
        ),
        h('p', { className: 'dshWakatimeNotice' }, tr(t, 'security', 'The key is only used in the local Host process.')),
        h('details', { className: 'dshWakatimeAdvanced' },
          h('summary', null, tr(t, 'advanced', 'Advanced options')),
          h('div', { className: 'dshWakatimeForm' },
            h('div', { className: 'dshWakatimeFormGrid' },
              h('div', { className: 'dshWakatimeField' },
                h('label', { htmlFor: 'dsh-wakatime-category' }, tr(t, 'category', 'Activity category')),
                h('select', { id: 'dsh-wakatime-category', value: config.category, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => input('category', event.target.value) }, UI_CATEGORIES.map(category => h('option', { key: category, value: category }, category))),
              ),
              h('div', { className: 'dshWakatimeField' },
                h('label', { htmlFor: 'dsh-wakatime-interval' }, tr(t, 'heartbeatInterval', 'Heartbeat interval (ms)')),
                h('input', { id: 'dsh-wakatime-interval', type: 'number', min: 1000, step: 1000, value: config.heartbeatIntervalMs, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('heartbeatIntervalMs', event.target.value) }),
              ),
            ),
            h('div', { className: 'dshWakatimeField' },
              h('label', { htmlFor: 'dsh-wakatime-cli-path' }, tr(t, 'cliPath', 'CLI path')),
              h('input', { id: 'dsh-wakatime-cli-path', type: 'text', value: config.cliPath, placeholder: '~/.wakatime/wakatime-cli-*', onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('cliPath', event.target.value) }),
              h('small', null, tr(t, 'cliPathHint', 'Leave empty to discover a PATH or managed binary.')),
            ),
            h('div', { className: 'dshWakatimeChecks' },
              h('div', { className: 'dshWakatimeCheck' }, h('input', { id: 'dsh-wakatime-track-reads', type: 'checkbox', checked: config.trackReads, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('trackReads', event.target.checked) }), h('div', null, h('label', { htmlFor: 'dsh-wakatime-track-reads' }, tr(t, 'trackReads', 'Track reads')), h('small', null, tr(t, 'trackReadsHint', 'Include successful read operations.')))),
              h('div', { className: 'dshWakatimeCheck' }, h('input', { id: 'dsh-wakatime-auto-install', type: 'checkbox', checked: config.autoInstall, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('autoInstall', event.target.checked) }), h('div', null, h('label', { htmlFor: 'dsh-wakatime-auto-install' }, tr(t, 'autoInstall', 'Manage the CLI automatically')), h('small', null, tr(t, 'autoInstallHint', 'Allow managed downloads when no local CLI is found.')))),
              h('div', { className: 'dshWakatimeCheck' }, h('input', { id: 'dsh-wakatime-debug', type: 'checkbox', checked: config.debug, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('debug', event.target.checked) }), h('div', null, h('label', { htmlFor: 'dsh-wakatime-debug' }, tr(t, 'debug', 'Debug logging')))),
            ),
          ),
        ),
        h('div', { className: 'dshWakatimeFormActions' },
          h('button', { className: 'dshWakatimeButton', 'data-primary': 'true', type: 'button', disabled: busy, onClick: () => { void save() } }, saving ? tr(t, 'saving', 'Saving…') : tr(t, 'save', 'Save settings')),
          notice.length > 0 ? h('span', { className: 'dshWakatimeSaved', role: 'status' }, notice) : null,
        ),
      ),
    )

  return h('main', { className: 'dshWakatimePage', 'aria-label': tr(t, 'title', 'WakaTime') },
    h('nav', { className: 'dshWakatimeTabs', role: 'tablist', 'aria-label': tr(t, 'nav', 'WakaTime') }, (['dashboard', 'ai', 'projects', 'insights', 'settings'] as const).map(item => h('button', {
      className: 'dshWakatimeTab',
      type: 'button',
      role: 'tab',
      id: `dsh-wakatime-tab-${item}`,
      'aria-controls': `dsh-wakatime-panel-${item}`,
      'aria-selected': tab === item,
      onClick: () => setTab(item),
      key: item,
    }, tr(t, item, item))),
    ),
    error.length > 0 ? h('div', { className: 'dshWakatimeError', role: 'alert' }, error) : null,
    tab !== 'settings'
      ? h('section', { id: `dsh-wakatime-panel-${tab}`, role: 'tabpanel', 'aria-labelledby': `dsh-wakatime-tab-${tab}` },
        h('div', { className: 'dshWakatimeToolbar' },
          h('div', { className: 'dshWakatimeRange' },
            h('span', { className: 'dshWakatimeRangeLabel' }, tr(t, 'range', 'Date range')),
            h('button', { className: 'dshWakatimeButton dshWakatimeRangeButton', type: 'button', 'aria-pressed': range.start === rangeForDays(1).start, onClick: () => setPreset(1) }, tr(t, 'today', 'Today')),
            h('button', { className: 'dshWakatimeButton dshWakatimeRangeButton', type: 'button', 'aria-pressed': range.start === rangeForDays(7).start, onClick: () => setPreset(7) }, tr(t, 'last7Days', 'Last 7 days')),
            h('button', { className: 'dshWakatimeButton dshWakatimeRangeButton', type: 'button', 'aria-pressed': range.start === rangeForDays(14).start, onClick: () => setPreset(14) }, tr(t, 'last14Days', 'Last 14 days')),
          ),
        ),
        data,
      )
      : h('section', { id: 'dsh-wakatime-panel-settings', role: 'tabpanel', 'aria-labelledby': 'dsh-wakatime-tab-settings' }, settings),
  )
}

export function apply(ctx: any): void {
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en }),
    'dsh-wakatime: client translations',
  )
  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-wakatime'
    tag.textContent = STYLE
    document.head.append(tag)
    return () => tag.remove()
  }, 'dsh-wakatime: client styles')

  const t = ctx.locale.bind(NS) as Translator
  const rpcCall: WakatimeUiRpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(WAKATIME_RPC_CHANNEL, endpoint, payload ?? {}, signal) as Promise<any>

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'wakatime',
    order: 30,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ rpcCall, t }),
  }, WakatimeSettingsTab))
}
