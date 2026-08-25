import * as React from 'react'
import {
  WAKATIME_RPC_CHANNEL,
  UI_CATEGORIES,
  type WakatimeDailyUsage,
  type WakatimeInsightsData,
  type WakatimeUiConfig,
  type WakatimeUiRpcCall,
  type WakatimeUiStatus,
  type WakatimeUsageBucket,
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
  activityOverview: '活动概览',
  overLast7Days: '过去 7 天',
  rangeMeta: '统计范围：过去 7 天',
  totalCodingTime: '总编码时间',
  currentDay: '当前日期',
  topDay: '最活跃的一天',
  bestDayDuration: '当天 {time}',
  todayCodingTime: '今天编码时间',
  comparedWithPreviousDay: '与前一天相比',
  comparisonMeta: '较前一天',
  comparisonUnavailable: '至少需要两天数据',
  noComparison: '暂无对比',
  dailyAverageCoding: '日均编码时间',
  mostActiveDayShort: '最活跃日',
  noChange: '持平',
  openAiDashboard: '打开 AI 仪表盘',
  aiDrivenLabel: 'AI 驱动',
  aiLinesLabel: 'AI 行数',
  humanLinesLabel: '人工行数',
  aiPercent: 'AI 百分比',
  aiChanges: 'AI 改动',
  humanChanges: '人工改动',
  projectTokens: 'Token',
  aiSpend: 'AI 支出',
  aiPrompts: 'AI 提示词',
  cost: '成本',
  aiModelSpend: 'AI 模型支出',
  humanReview: '人工复核',
  reviewSessions: '复核会话',
  humanFollowUp: '人工后续修改',
  followUpEdits: '后续修改次数',
  projectsOverview: '项目',
  categoriesOverview: '分类',
  segmentHint: '按分类、语言、编辑器或操作系统拆分',
  decrease: '下降',
  increase: '上升',
  weekdays: '工作日',
  aiVsHumanByDay: '每日 AI 与人工',
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
  topProjects: '项目',
  weekdayAverage: '工作日平均',
  aiPercentage: 'AI 占比趋势',
  insightActivity: '活动',
  insightAiPercentage: 'AI 占比',
  insightHeatmapHint: '颜色越亮代表活动越多。',
  insightAiHeatmapHint: '颜色越亮代表 AI 代码占比越高。',
  insightLess: '少',
  insightMore: '多',
  insightAiDriven: 'AI 驱动',
  insightHuman: '人工',
  insightAiAdditions: 'AI 新增',
  insightAiDeletions: 'AI 删除',
  insightHumanAdditions: '人工新增',
  insightHumanDeletions: '人工删除',
  insightTotal: '总编码时间',
  insightActiveDays: '活跃天数',
  insightActiveDaysMeta: '共活跃 {days} 天',
  insightDailyAverage: '日均时间',
  insightRangeMeta: '过去 1 年',
  insightDurationMeta: '累计时长 {time}',
  insightBestDayMeta: '当天时长 {time}',
  insightTooltipAverage: '平均编码时间',
  insightTooltipDays: '{days} 个工作日',
  insightTooltipNoBreakdown: '暂无分类明细',
  insightTopLanguage: '主要语言',
  insightTopProject: '主要项目',
  insightTopOperatingSystem: '主要操作系统',
  insightMostActiveDay: '最活跃的一天',
  insightModelSummary: 'AI 模型共改动 {lines} 行，估算支出 {cost}。',
  insightUpdating: 'WakaTime 正在生成这段长期数据，当前显示的是缓存结果。',
  insightNoData: '这段时间还没有可用的洞察数据。',
  noBreakdown: '暂无明细',
  apiKey: 'API Key',
  apiKeyConfigured: '已配置',
  apiKeyMissing: '未配置',
  apiKeyPlaceholder: '请输入 API Key',
  clearApiKey: '清除',
  cli: 'CLI',
  ready: '可用',
  missing: '未找到',
  invalid: '不可用',
  cliPath: 'CLI 路径',
  cliSourceConfigured: '自定义路径',
  cliSourcePath: '系统 PATH',
  cliSourceManaged: 'WakaTime 目录',
  cliSourceNone: '未找到',
  cliDownload: '下载 WakaTime CLI',
  cliUpdate: '检查并更新',
  cliInvalidConfigured: '自定义 CLI 路径不可执行，请修正路径或清空路径。',
  cliInvalidPath: '系统 PATH 中的 CLI 不可执行，请通过包管理器修复。',
  cliDownloaded: 'CLI 已安装',
  cliChecked: '已完成检查',
  cliActionFailed: 'CLI 操作失败',
  category: '活动分类',
  trackReads: '记录读取活动',
  debug: '调试日志',
  heartbeatInterval: 'Heartbeat 间隔（毫秒）',
  advanced: '高级选项',
  save: '保存配置',
  saving: '保存中…',
  saved: '已保存',
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
  activityOverview: 'Activity Overview',
  overLast7Days: 'over the Last 7 Days',
  rangeMeta: 'Range: Last 7 Days',
  totalCodingTime: 'Total coding time',
  currentDay: 'Current day',
  topDay: 'top day',
  bestDayDuration: 'That day {time}',
  todayCodingTime: 'Today coding time',
  comparedWithPreviousDay: 'Compared with previous day',
  comparisonMeta: 'vs. previous day',
  comparisonUnavailable: 'At least two days are needed',
  noComparison: 'No comparison',
  dailyAverageCoding: 'Average coding time',
  mostActiveDayShort: 'Most active day',
  noChange: 'No change',
  openAiDashboard: 'Open AI dashboard',
  aiDrivenLabel: 'AI-driven',
  aiLinesLabel: 'AI lines',
  humanLinesLabel: 'Human lines',
  aiPercent: 'AI Percent',
  aiChanges: 'AI changes',
  humanChanges: 'Human changes',
  projectTokens: 'Tokens',
  aiSpend: 'AI spend',
  aiPrompts: 'AI prompts',
  cost: 'Cost',
  aiModelSpend: 'AI model spend',
  humanReview: 'Human review',
  reviewSessions: 'review sessions',
  humanFollowUp: 'Human follow-up',
  followUpEdits: 'follow-up edits',
  projectsOverview: 'Projects',
  categoriesOverview: 'Categories',
  segmentHint: 'Segment by category, language, editor, or operating system',
  decrease: 'Decrease',
  increase: 'Increase',
  weekdays: 'Weekdays',
  aiVsHumanByDay: 'AI vs Human by Day',
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
  topProjects: 'Projects',
  weekdayAverage: 'Weekday average',
  aiPercentage: 'AI share trend',
  insightActivity: 'Activity',
  insightAiPercentage: 'AI Percentage',
  insightHeatmapHint: 'Brighter cells indicate more activity.',
  insightAiHeatmapHint: 'Brighter cells indicate a higher share of AI line changes.',
  insightLess: 'Less',
  insightMore: 'More',
  insightAiDriven: 'AI-driven',
  insightHuman: 'Human',
  insightAiAdditions: 'AI additions',
  insightAiDeletions: 'AI deletions',
  insightHumanAdditions: 'Human additions',
  insightHumanDeletions: 'Human deletions',
  insightTotal: 'Total coding time',
  insightActiveDays: 'active days',
  insightActiveDaysMeta: '{days} active days',
  insightDailyAverage: 'Daily average',
  insightRangeMeta: 'over the last year',
  insightDurationMeta: 'Total time {time}',
  insightBestDayMeta: 'That day {time}',
  insightTooltipAverage: 'Average coding time',
  insightTooltipDays: '{days} weekdays',
  insightTooltipNoBreakdown: 'No category breakdown',
  insightTopLanguage: 'Top language',
  insightTopProject: 'Top project',
  insightTopOperatingSystem: 'Top operating system',
  insightMostActiveDay: 'Most active day',
  insightModelSummary: 'AI models changed {lines} lines with {cost} estimated spend.',
  insightUpdating: 'WakaTime is preparing this long-range data; cached results are shown for now.',
  insightNoData: 'There is no insight data for this range yet.',
  noBreakdown: 'No breakdown yet',
  apiKey: 'API key',
  apiKeyConfigured: 'Configured',
  apiKeyMissing: 'Not configured',
  apiKeyPlaceholder: 'Enter API key',
  clearApiKey: 'Clear',
  cli: 'CLI',
  ready: 'Ready',
  missing: 'Missing',
  invalid: 'Unavailable',
  cliPath: 'CLI path',
  cliSourceConfigured: 'Custom path',
  cliSourcePath: 'System PATH',
  cliSourceManaged: 'WakaTime directory',
  cliSourceNone: 'Not found',
  cliDownload: 'Download WakaTime CLI',
  cliUpdate: 'Check and update',
  cliInvalidConfigured: 'The configured CLI path is not executable. Fix or clear the path.',
  cliInvalidPath: 'The CLI found on PATH is not executable. Repair it with your package manager.',
  cliDownloaded: 'CLI installed',
  cliChecked: 'Check complete',
  cliActionFailed: 'CLI action failed',
  category: 'Activity category',
  trackReads: 'Track reads',
  debug: 'Debug logging',
  heartbeatInterval: 'Heartbeat interval (ms)',
  advanced: 'Advanced options',
  save: 'Save settings',
  saving: 'Saving…',
  saved: 'Saved',
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
  padding: 0 0 24px;
  color: inherit;
  font: inherit;
  --dsh-space-1: 4px;
  --dsh-space-2: 8px;
  --dsh-space-3: 12px;
  --dsh-space-4: 16px;
  --dsh-space-5: 20px;
  --dsh-radius: 8px;
  --dsh-border: color-mix(in srgb, currentColor 14%, transparent);
  --dsh-surface: color-mix(in srgb, currentColor 3%, transparent);
  container-type: inline-size;
}
.dshWakatimePage *, .dshWakatimePage *::before, .dshWakatimePage *::after { box-sizing: border-box; min-width: 0; }
.dshWakatimeButton { appearance: none; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 7px; padding: 8px 12px; color: inherit; background: transparent; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: border-color 140ms ease, background 140ms ease; }
.dshWakatimeButton:hover { border-color: currentColor; background: color-mix(in srgb, currentColor 6%, transparent); }
.dshWakatimeButton:disabled { opacity: .45; cursor: wait; }
.dshWakatimeButton[data-primary="true"] { border-color: currentColor; }
.dshWakatimeButton:focus-visible, .dshWakatimeTab:focus-visible, .dshWakatimeField input:focus-visible, .dshWakatimeField select:focus-visible, .dshWakatimeCategoryButton:focus-visible, .dshWakatimeCategoryPopover button:focus-visible, .dshWakatimeAdvanced summary:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
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
.dshWakatimeOfficialHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 16px; }
.dshWakatimeOfficialBrand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dshWakatimeOfficialMark { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border-radius: 7px; color: #fff; background: #5b7cff; font-size: 14px; font-weight: 800; }
.dshWakatimeOfficialEyebrow { margin: 0 0 4px; color: currentColor; opacity: .55; font-size: 11px; font-weight: 650; letter-spacing: .01em; }
.dshWakatimeOfficialTitle { margin: 0; font-size: clamp(19px, 4.5vw, 24px); letter-spacing: -.035em; line-height: 1.05; }
.dshWakatimeOfficialRange { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; }
.dshWakatimeOfficialRange .dshWakatimeRangeLabel { display: none; }
.dshWakatimeOfficialRange .dshWakatimeRangeButton { padding: 6px 8px; }
.dshWakatimeOfficialRangeSelect { appearance: none; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; padding: 7px 24px 7px 9px; color: inherit; background: color-mix(in srgb, currentColor 5%, transparent); color-scheme: dark; font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
.dshWakatimeOfficialRangeSelect option { color: #f4f5f7; background: #2e3137; }
.dshWakatimeOfficialRangeMenu { position: relative; }
.dshWakatimeOfficialRangeMenuButton { min-width: 72px; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; padding: 7px 10px; color: inherit; background: color-mix(in srgb, currentColor 5%, transparent); font: inherit; font-size: 11px; font-weight: 650; text-align: left; cursor: pointer; }
.dshWakatimeOfficialRangeMenuButton::after { float: right; margin-left: 9px; content: '⌄'; opacity: .62; }
.dshWakatimeOfficialRangePopover { position: absolute; z-index: 5; top: calc(100% + 5px); right: 0; display: grid; min-width: 112px; gap: 2px; padding: 4px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 7px; background: #2e3137; box-shadow: 0 10px 24px rgb(0 0 0 / 28%); }
.dshWakatimeOfficialRangePopover button { border: 0; border-radius: 5px; padding: 7px 8px; color: #f4f5f7; background: transparent; font: inherit; font-size: 11px; text-align: left; cursor: pointer; }
.dshWakatimeOfficialRangePopover button:hover, .dshWakatimeOfficialRangePopover button[aria-current="true"] { background: rgb(91 124 255 / 22%); }
.dshWakatimeOfficialMetrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.dshWakatimeOfficialOverview { display: grid; grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(0, 1fr)); gap: 10px; padding: 10px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 9px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialOverviewTotal { display: flex; min-width: 0; flex-direction: column; justify-content: center; padding: 12px 13px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricLabel { margin-bottom: 7px; }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricValue { font-size: clamp(22px, 6vw, 34px); }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricMeta { margin-top: 7px; }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricValue,
.dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricValue { white-space: nowrap; }
.dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricValue { font-size: 14px; letter-spacing: -.025em; }
.dshWakatimeOfficialMetric { min-width: 0; padding: 12px 13px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialMetricLabel { margin-bottom: 7px; color: currentColor; opacity: .58; font-size: 11px; }
.dshWakatimeOfficialMetricValue { overflow-wrap: anywhere; font-size: 17px; font-weight: 700; line-height: 1.15; }
.dshWakatimeOfficialMetricMeta { margin-top: 4px; color: currentColor; opacity: .55; font-size: 10px; line-height: 1.3; }
.dshWakatimeOfficialSection { margin-top: 18px; }
.dshWakatimeOfficialSectionHeading { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 10px; }
.dshWakatimeOfficialSectionHeading h2 { margin: 0; font-size: 15px; letter-spacing: -.015em; }
.dshWakatimeOfficialLink { border: 0; padding: 0; color: inherit; opacity: .62; background: transparent; font: inherit; font-size: 11px; text-decoration: none; cursor: pointer; }
.dshWakatimeOfficialLink:hover { opacity: 1; text-decoration: underline; }
.dshWakatimeOfficialAiGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.dshWakatimeOfficialAiBlock { padding: 14px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 9px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialAiBlock .dshWakatimeOfficialSectionHeading { margin-bottom: 10px; }
.dshWakatimeOfficialAiLayout { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; align-items: center; padding: 0; }
.dshWakatimeOfficialDonutFrame { display: grid; width: 142px; min-height: 142px; place-items: center; margin: auto; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialDonut { display: grid; width: 112px; height: 112px; place-items: center; border-radius: 50%; background: conic-gradient(#5b7cff var(--dsh-ai-percent), color-mix(in srgb, currentColor 12%, transparent) 0); }
.dshWakatimeOfficialDonut::after { display: grid; width: 76px; height: 76px; place-items: center; border-radius: 50%; background: color-mix(in srgb, currentColor 3%, transparent); content: attr(data-percent); font-size: 22px; font-weight: 750; }
.dshWakatimeOfficialDonutLabel { margin-top: -4px; color: currentColor; opacity: .68; font-size: 10px; text-align: center; }
.dshWakatimeOfficialAiMetric { min-width: 0; padding: 10px 11px; border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 7px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialAiMetricLabel { color: currentColor; opacity: .56; font-size: 10px; }
.dshWakatimeOfficialAiMetricValue { margin-top: 4px; overflow-wrap: anywhere; font-size: 16px; font-weight: 700; line-height: 1.1; }
.dshWakatimeOfficialAiMetricMeta { margin-top: 3px; overflow-wrap: anywhere; color: currentColor; opacity: .54; font-size: 10px; line-height: 1.25; }
.dshWakatimeOfficialSplit { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dshWakatimeOfficialSplitSingle { grid-template-columns: 1fr; }
.dshWakatimeOfficialPanel { min-width: 0; padding: 14px 15px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialPanel h3 { margin: 0 0 10px; font-size: 13px; }
.dshWakatimeOfficialList { display: grid; gap: 7px; }
.dshWakatimeOfficialListRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: baseline; min-width: 0; font-size: 11px; }
.dshWakatimeOfficialListRow span:first-child { overflow: hidden; color: currentColor; opacity: .72; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialListRow span:last-child { color: currentColor; opacity: .8; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshWakatimeOfficialChartGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.dshWakatimeOfficialChartGridSingle { grid-template-columns: 1fr; }
.dshWakatimeOfficialCategoryBlock > .dshWakatimeOfficialSplit { margin-top: 0; }
.dshWakatimeOfficialCategoryBlock > .dshWakatimeOfficialChartGrid { margin-top: 12px; }
.dshWakatimeOfficialChartPanel { min-width: 0; padding: 14px 15px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialChartPanel h3 { margin: 0 0 12px; font-size: 13px; }
.dshWakatimeOfficialProjectChartRows { display: grid; max-height: 212px; gap: 7px; overflow: auto; }
.dshWakatimeOfficialProjectChartRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.dshWakatimeOfficialProjectChartHead { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; color: currentColor; font-size: 10px; }
.dshWakatimeOfficialProjectChartHead span:first-child { overflow: hidden; opacity: .72; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialProjectChartHead span:last-child { opacity: .6; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeOfficialProjectChartTrack { height: 5px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 9%, transparent); }
.dshWakatimeOfficialProjectChartTrack span { display: block; height: 100%; border-radius: inherit; background: #5b7cff; opacity: .68; }
.dshWakatimeOfficialStackChart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; min-height: 120px; align-items: end; }
.dshWakatimeOfficialStackDay { display: grid; grid-template-rows: 90px auto; gap: 5px; min-width: 0; text-align: center; }
.dshWakatimeOfficialStackBar { display: flex; height: 90px; flex-direction: column-reverse; align-items: stretch; justify-content: flex-start; overflow: hidden; border-radius: 3px 3px 1px 1px; background: color-mix(in srgb, currentColor 7%, transparent); }
.dshWakatimeOfficialStackBar span { display: block; min-height: 1px; }
.dshWakatimeOfficialStackLabel { overflow: hidden; color: currentColor; opacity: .56; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialLegend { display: flex; max-height: 76px; flex-wrap: wrap; gap: 5px 9px; margin-top: 10px; overflow: auto; }
.dshWakatimeOfficialLegendItem { display: inline-flex; min-width: 0; align-items: center; gap: 4px; color: currentColor; opacity: .68; font-size: 9px; }
.dshWakatimeOfficialLegendItem i { display: block; width: 7px; height: 7px; flex: 0 0 auto; border-radius: 2px; }
.dshWakatimeOfficialTimelineRows { display: grid; gap: 8px; }
.dshWakatimeOfficialTimelineRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.dshWakatimeOfficialTimelineRowHead { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; color: currentColor; font-size: 10px; }
.dshWakatimeOfficialTimelineRowHead span:first-child { overflow: hidden; opacity: .72; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialTimelineRowHead span:last-child { opacity: .56; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeOfficialTimelineRowTrack { height: 5px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 9%, transparent); }
.dshWakatimeOfficialTimelineRowTrack span { display: block; height: 100%; border-radius: inherit; background: #5b7cff; opacity: .72; }
.dshWakatimeOfficialWeekdayBars { display: grid; gap: 9px; }
.dshWakatimeOfficialWeekdayRow { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 8px; align-items: center; }
.dshWakatimeOfficialWeekdayLabel { color: currentColor; opacity: .68; font-size: 10px; }
.dshWakatimeOfficialWeekdayTrack { height: 6px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 9%, transparent); }
.dshWakatimeOfficialWeekdayTrack span { display: block; height: 100%; border-radius: inherit; background: #5b7cff; opacity: .72; }
.dshWakatimeOfficialWeekdayValue { color: currentColor; opacity: .72; font-size: 10px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeOfficialTimeline { max-height: 260px; padding: 14px 15px; overflow: auto; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialTimelineHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.dshWakatimeOfficialTimelineTitle { margin: 0; font-size: 13px; }
.dshWakatimeOfficialSwitch { display: inline-flex; gap: 4px; }
.dshWakatimeOfficialSwitch button { appearance: none; border: 0; border-radius: 5px; padding: 5px 7px; color: inherit; opacity: .58; background: transparent; font: inherit; font-size: 10px; cursor: pointer; }
.dshWakatimeOfficialSwitch button[aria-pressed="true"] { opacity: 1; background: color-mix(in srgb, currentColor 10%, transparent); }
.dshWakatimeOfficialDays { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; align-items: end; min-height: 128px; }
.dshWakatimeOfficialDay { display: grid; grid-template-rows: 86px auto auto; gap: 4px; min-width: 0; text-align: center; }
.dshWakatimeOfficialDayBar { display: flex; height: 86px; align-items: end; justify-content: center; }
.dshWakatimeOfficialDayBar span { display: block; width: min(22px, 62%); min-height: 3px; border-radius: 3px 3px 1px 1px; background: currentColor; opacity: .62; }
.dshWakatimeOfficialDayLabel { overflow: hidden; color: currentColor; opacity: .55; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialDayValue { overflow-wrap: anywhere; font-size: 10px; font-variant-numeric: tabular-nums; font-weight: 650; line-height: 1.2; }
.dshWakatimeProjectGrid { display: grid; max-height: 320px; gap: 9px; overflow: auto; padding-right: 4px; }
.dshWakatimeProjectCard { display: grid; gap: 10px; padding: 13px 14px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeProjectHeader { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.dshWakatimeProjectHeaderButton { display: flex; width: 100%; align-items: baseline; justify-content: space-between; gap: 12px; border: 0; padding: 0; color: inherit; background: transparent; font: inherit; text-align: left; cursor: pointer; }
.dshWakatimeProjectHeaderButton:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
.dshWakatimeProjectChevron { color: currentColor; opacity: .56; font-size: 11px; }
.dshWakatimeProjectName { overflow: hidden; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeProjectTime { color: currentColor; opacity: .68; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeProjectPercent { color: currentColor; opacity: .58; font-size: 10px; }
.dshWakatimeProjectStats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.dshWakatimeProjectStat { min-width: 0; }
.dshWakatimeProjectStatLabel { color: currentColor; opacity: .55; font-size: 9px; line-height: 1.25; }
.dshWakatimeProjectStatValue { margin-top: 3px; overflow-wrap: anywhere; font-size: 11px; font-weight: 650; line-height: 1.2; }
.dshWakatimeProjectStatMeta { margin-top: 2px; color: currentColor; opacity: .52; font-size: 9px; line-height: 1.2; }
.dshWakatimeOfficialCompare { display: grid; gap: 9px; }
.dshWakatimeOfficialCompareRow { display: grid; gap: 4px; }
.dshWakatimeOfficialCompareHead { display: flex; justify-content: space-between; gap: 10px; color: currentColor; font-size: 10px; }
.dshWakatimeOfficialCompareHead span:first-child { opacity: .65; }
.dshWakatimeOfficialCompareHead span:last-child { font-variant-numeric: tabular-nums; font-weight: 650; }
.dshWakatimeOfficialCompareTrack { display: flex; height: 5px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 9%, transparent); }
.dshWakatimeOfficialCompareTrack span { display: block; height: 100%; }
.dshWakatimeOfficialCompareTrack .dshWakatimeAiPart { background: #5b7cff; opacity: .78; }
.dshWakatimeOfficialCompareTrack .dshWakatimeHumanPart { background: #d69a2e; opacity: .9; }
.dshWakatimeInsightsStatus { margin: 0 0 12px; border: 1px solid color-mix(in srgb, #d69a2e 42%, transparent); border-radius: 7px; padding: 9px 11px; color: inherit; background: color-mix(in srgb, #d69a2e 8%, transparent); font-size: 11px; line-height: 1.45; }
.dshWakatimeInsightsSummary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.dshWakatimeInsightsSummaryCard { min-width: 0; padding: 12px 13px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeInsightsSummaryCard:first-child { background: color-mix(in srgb, #5b7cff 11%, transparent); }
.dshWakatimeInsightsSummaryLabel { color: currentColor; opacity: .56; font-size: 10px; }
.dshWakatimeInsightsSummaryValue { margin-top: 6px; overflow: hidden; font-size: 15px; font-weight: 720; line-height: 1.1; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightsSummaryMeta { margin-top: 4px; overflow: hidden; color: currentColor; opacity: .52; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightsPanel { margin-top: 12px; padding: 14px 15px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeInsightsPanelHeader { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.dshWakatimeInsightsPanelHeader h2 { margin: 0; font-size: 14px; letter-spacing: -.015em; }
.dshWakatimeInsightsPanelHeader p { margin: 0; color: currentColor; opacity: .54; font-size: 10px; }
.dshWakatimeInsightsHeatmapScroll { overflow-x: auto; padding: 2px 0 5px; }
.dshWakatimeInsightsHeatmap { display: grid; grid-template-columns: max-content max-content; gap: 5px; min-width: max-content; }
.dshWakatimeInsightsHeatmapLabels { display: grid; grid-template-rows: repeat(7, 11px); gap: 3px; padding-top: 19px; }
.dshWakatimeInsightsHeatmapLabels span { color: currentColor; opacity: .55; font-size: 9px; line-height: 11px; white-space: nowrap; }
.dshWakatimeInsightsHeatmapBody { display: grid; gap: 5px; }
.dshWakatimeInsightsHeatmapMonths, .dshWakatimeInsightsHeatGrid { display: grid; grid-template-columns: repeat(var(--dsh-insight-weeks), 11px); column-gap: 3px; }
.dshWakatimeInsightsHeatmapMonths { height: 14px; }
.dshWakatimeInsightsHeatmapMonths span { overflow: visible; color: currentColor; opacity: .52; font-size: 9px; white-space: nowrap; }
.dshWakatimeInsightsHeatGrid { grid-template-rows: repeat(7, 11px); row-gap: 3px; grid-auto-flow: column; }
.dshWakatimeInsightsHeatCell { display: block; width: 11px; height: 11px; border: 1px solid color-mix(in srgb, currentColor 7%, transparent); border-radius: 2px; background: color-mix(in srgb, currentColor 6%, transparent); }
.dshWakatimeInsightsHeatCell:hover { outline: 2px solid currentColor; outline-offset: 1px; }
.dshWakatimeInsightsHeatCell[data-kind="activity"][data-level="1"] { background: #26385f; }
.dshWakatimeInsightsHeatCell[data-kind="activity"][data-level="2"] { background: #3d5da3; }
.dshWakatimeInsightsHeatCell[data-kind="activity"][data-level="3"] { background: #5b7cff; }
.dshWakatimeInsightsHeatCell[data-kind="activity"][data-level="4"] { background: #91aaff; }
.dshWakatimeInsightsHeatCell[data-kind="ai"][data-level="1"] { background: #324b7e; }
.dshWakatimeInsightsHeatCell[data-kind="ai"][data-level="2"] { background: #4e6fb8; }
.dshWakatimeInsightsHeatCell[data-kind="ai"][data-level="3"] { background: #758fe0; }
.dshWakatimeInsightsHeatCell[data-kind="ai"][data-level="4"] { background: #a8baff; }
.dshWakatimeInsightsLegend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 8px; color: currentColor; opacity: .55; font-size: 9px; }
.dshWakatimeInsightsLegend i { display: block; width: 10px; height: 10px; border-radius: 2px; background: color-mix(in srgb, currentColor 6%, transparent); }
.dshWakatimeInsightsLegend i:nth-of-type(2) { background: #3d5da3; }
.dshWakatimeInsightsLegend i:nth-of-type(3) { background: #5b7cff; }
.dshWakatimeInsightsLegend i:nth-of-type(4) { background: #91aaff; }
.dshWakatimeInsightsWeekdayChart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; min-height: 146px; align-items: end; }
.dshWakatimeInsightsWeekday { position: relative; display: grid; grid-template-rows: 106px auto auto; gap: 5px; min-width: 0; text-align: center; }
.dshWakatimeInsightsWeekdayBar { display: flex; height: 106px; flex-direction: column-reverse; justify-content: flex-start; overflow: hidden; border-radius: 3px 3px 1px 1px; background: color-mix(in srgb, currentColor 7%, transparent); }
.dshWakatimeInsightsWeekdayBar span { display: block; min-height: 1px; }
.dshWakatimeInsightsWeekdayLabel { overflow: hidden; color: currentColor; opacity: .55; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightsWeekdayValue { color: currentColor; opacity: .78; font-size: 10px; font-variant-numeric: tabular-nums; }
.dshWakatimeInsightsWeekdayTooltip { position: absolute; z-index: 5; bottom: calc(100% + 7px); left: 50%; display: grid; width: max-content; max-width: 220px; gap: 6px; transform: translate(-50%, 4px); border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 7px; padding: 9px 10px; color: #f4f5f7; background: #2e3137; box-shadow: 0 10px 24px rgb(0 0 0 / 30%); font-size: 10px; line-height: 1.3; opacity: 0; pointer-events: none; transition: opacity .12s ease, transform .12s ease; }
.dshWakatimeInsightsWeekday:hover .dshWakatimeInsightsWeekdayTooltip,
.dshWakatimeInsightsWeekday:focus-visible .dshWakatimeInsightsWeekdayTooltip { transform: translate(-50%, 0); opacity: 1; }
.dshWakatimeInsightsWeekday:first-child .dshWakatimeInsightsWeekdayTooltip { left: 0; transform: translate(0, 4px); }
.dshWakatimeInsightsWeekday:first-child:hover .dshWakatimeInsightsWeekdayTooltip,
.dshWakatimeInsightsWeekday:first-child:focus-visible .dshWakatimeInsightsWeekdayTooltip { transform: translate(0, 0); }
.dshWakatimeInsightsWeekday:last-child .dshWakatimeInsightsWeekdayTooltip { right: 0; left: auto; transform: translate(0, 4px); }
.dshWakatimeInsightsWeekday:last-child:hover .dshWakatimeInsightsWeekdayTooltip,
.dshWakatimeInsightsWeekday:last-child:focus-visible .dshWakatimeInsightsWeekdayTooltip { transform: translate(0, 0); }
.dshWakatimeInsightsWeekdayTooltipTitle { font-weight: 700; }
.dshWakatimeInsightsWeekdayTooltipMeta { color: rgb(244 245 247 / 65%); }
.dshWakatimeInsightsWeekdayTooltipRows { display: grid; gap: 3px; }
.dshWakatimeInsightsWeekdayTooltipRow { display: flex; justify-content: space-between; gap: 12px; white-space: nowrap; }
.dshWakatimeInsightsWeekdayTooltipRow span:first-child { color: rgb(244 245 247 / 72%); }
.dshWakatimeInsightsWeekdayTooltipRow span:last-child { font-variant-numeric: tabular-nums; }
.dshWakatimeInsightsWeekday:focus-visible { outline: 2px solid #5b7cff; outline-offset: 3px; border-radius: 4px; }
.dshWakatimeInsightsColumns { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 12px; margin-top: 12px; }
.dshWakatimeInsightsColumns > .dshWakatimeInsightsPanel { margin-top: 0; }
.dshWakatimeInsightsDonuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.dshWakatimeInsightsDonutCard { display: grid; min-width: 0; place-items: center; gap: 8px; padding: 12px 8px; border: 1px solid color-mix(in srgb, currentColor 11%, transparent); border-radius: 7px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeInsightsDonut { display: grid; width: 112px; height: 112px; place-items: center; border-radius: 50%; }
.dshWakatimeInsightsDonut::after { display: grid; width: 76px; height: 76px; place-items: center; border-radius: 50%; background: color-mix(in srgb, currentColor 3%, transparent); content: attr(data-value); font-size: 18px; font-weight: 750; }
.dshWakatimeInsightsDonutTitle { color: currentColor; opacity: .7; font-size: 10px; text-align: center; }
.dshWakatimeInsightsDonutLegend { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px 8px; color: currentColor; opacity: .62; font-size: 9px; }
.dshWakatimeInsightsDonutLegend span { display: inline-flex; align-items: center; gap: 4px; }
.dshWakatimeInsightsDonutLegendGrid { display: grid; width: auto; grid-template-columns: repeat(2, max-content); justify-content: center; gap: 5px 8px; }
.dshWakatimeInsightsDonutLegendGrid span { min-width: 0; justify-content: flex-start; white-space: nowrap; }
.dshWakatimeInsightsDonutLegend i { display: block; width: 7px; height: 7px; border-radius: 2px; }
.dshWakatimeInsightsDonutLegend i[data-tone="ai"] { background: #5b7cff; }
.dshWakatimeInsightsDonutLegend i[data-tone="human"] { background: #d69a2e; }
.dshWakatimeInsightsDonutLegend i[data-tone="ai-delete"] { background: #8a78d8; }
.dshWakatimeInsightsDonutLegend i[data-tone="human-delete"] { background: #d66f5e; }
.dshWakatimeInsightsModels { display: grid; gap: 9px; }
.dshWakatimeInsightsModelRow { display: grid; gap: 4px; }
.dshWakatimeInsightsModelHead { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: baseline; font-size: 10px; }
.dshWakatimeInsightsModelHead span:first-child { overflow: hidden; opacity: .74; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightsModelHead span:nth-child(2), .dshWakatimeInsightsModelHead span:last-child { opacity: .68; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeInsightsModelTrack { height: 5px; overflow: hidden; border-radius: 3px; background: color-mix(in srgb, currentColor 9%, transparent); }
.dshWakatimeInsightsModelTrack span { display: block; height: 100%; border-radius: inherit; background: #5b7cff; }
.dshWakatimeInsightsModelSummary { margin: 0 0 12px; color: currentColor; opacity: .62; font-size: 10px; line-height: 1.45; }
.dshWakatimeInsightsTwoCol { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.dshWakatimeInsightsList { display: grid; gap: 7px; }
.dshWakatimeInsightsListRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding-bottom: 7px; border-bottom: 1px solid color-mix(in srgb, currentColor 9%, transparent); font-size: 11px; }
.dshWakatimeInsightsListRow:last-child { padding-bottom: 0; border-bottom: 0; }
.dshWakatimeInsightsListRow span:first-child { overflow: hidden; opacity: .68; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeInsightsListRow span:last-child { opacity: .82; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshWakatimeGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
.dshWakatimeCard + .dshWakatimeGrid,
.dshWakatimeGrid + .dshWakatimeCard,
.dshWakatimeGrid + .dshWakatimeGrid { margin-top: 12px; }
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
.dshWakatimeTrack span { display: block; height: 100%; border-radius: inherit; background: #5b7cff; opacity: .72; }
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
.dshWakatimeField select { color-scheme: dark; cursor: pointer; }
.dshWakatimeField select option { color: #f4f5f7; background: #2e3137; }
.dshWakatimeCategoryMenu { position: relative; }
.dshWakatimeCategoryButton { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 10px; appearance: none; border: 1px solid color-mix(in srgb, currentColor 22%, transparent); border-radius: 6px; padding: 9px 10px; color: inherit; background: color-mix(in srgb, currentColor 4%, transparent); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
.dshWakatimeCategoryButton::after { content: '⌄'; opacity: .62; }
.dshWakatimeCategoryPopover { position: absolute; z-index: 20; top: calc(100% + 6px); right: 0; left: 0; display: grid; max-height: 220px; gap: 2px; overflow-y: auto; padding: 4px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 7px; background: #2e3137; box-shadow: 0 12px 28px rgb(0 0 0 / 32%); }
.dshWakatimeCategoryPopover button { border: 0; border-radius: 5px; padding: 7px 8px; color: #f4f5f7; background: transparent; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.dshWakatimeCategoryPopover button:hover, .dshWakatimeCategoryPopover button[aria-selected="true"] { color: #fff; background: rgb(91 124 255 / 22%); }
.dshWakatimeInlineActions { display: flex; align-items: center; gap: 8px; }
.dshWakatimeInlineActions input { flex: 1; min-width: 0; }
.dshWakatimeKeyRow { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 12px; align-items: center; }
.dshWakatimeKeyMeta { display: grid; gap: 4px; }
.dshWakatimeKeyMeta label { font-size: 12px; font-weight: 650; }
.dshWakatimeKeyStatus { color: currentColor; opacity: .56; font-size: 10px; }
.dshWakatimeCliPanel { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px 12px; padding: 13px 14px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeCliHeader { display: flex; align-items: baseline; justify-content: space-between; grid-column: 1 / -1; gap: 12px; }
.dshWakatimeCliTitle { margin: 0; font-size: 13px; font-weight: 700; }
.dshWakatimeCliBadge { color: currentColor; opacity: .72; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.dshWakatimeCliPath { overflow-wrap: anywhere; color: currentColor; opacity: .62; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.4; }
.dshWakatimeCliHint { margin: 0; color: currentColor; opacity: .62; font-size: 11px; line-height: 1.45; }
.dshWakatimeCliActions { display: flex; grid-column: 2; grid-row: 2; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.dshWakatimeFormGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
.dshWakatimeChecks { display: grid; gap: 12px; }
.dshWakatimeCheck { display: grid; grid-template-columns: 17px minmax(0, 1fr); gap: 9px; align-items: start; }
.dshWakatimeCheck input { width: 15px; height: 15px; margin: 1px 0 0; accent-color: currentColor; }
.dshWakatimeCheck small { display: block; margin-top: 4px; }
.dshWakatimeAdvanced { border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent); padding-top: 14px; }
.dshWakatimeAdvanced summary { width: fit-content; color: inherit; opacity: .7; font-size: 12px; font-weight: 650; cursor: pointer; }
.dshWakatimeAdvanced[open] summary { margin-bottom: 15px; opacity: 1; }
.dshWakatimeFormActions { display: flex; align-items: center; justify-content: flex-end; gap: 11px; padding-top: 2px; }
.dshWakatimeFormActions .dshWakatimeButton { margin-left: auto; }
.dshWakatimeSaved { color: inherit; opacity: .68; font-size: 12px; font-weight: 650; }

/* Keep the dashboard, insights, projects, and settings surfaces on one visual rhythm. */
.dshWakatimeTabs { gap: var(--dsh-space-3) 20px; margin-bottom: var(--dsh-space-4); }
.dshWakatimeToolbar { gap: var(--dsh-space-4); margin-bottom: var(--dsh-space-3); }
.dshWakatimeRange { gap: var(--dsh-space-1); }
.dshWakatimeMetrics { gap: var(--dsh-space-2); margin-bottom: var(--dsh-space-3); }
.dshWakatimeMetric,
.dshWakatimeCard,
.dshWakatimeOfficialMetric,
.dshWakatimeOfficialPanel,
.dshWakatimeOfficialChartPanel,
.dshWakatimeOfficialTimeline,
.dshWakatimeProjectCard,
.dshWakatimeInsightsSummaryCard,
.dshWakatimeInsightsPanel,
.dshWakatimeInsightsDonutCard { border-color: var(--dsh-border); border-radius: var(--dsh-radius); }
.dshWakatimeMetric,
.dshWakatimeOfficialMetric { padding: var(--dsh-space-3); }
.dshWakatimeMetricLabel { font-size: 10px; }
.dshWakatimeMetricValue { font-size: 16px; }
.dshWakatimeMetricMeta { font-size: 10px; }
.dshWakatimeCard,
.dshWakatimeOfficialPanel,
.dshWakatimeOfficialChartPanel,
.dshWakatimeOfficialTimeline,
.dshWakatimeInsightsPanel { padding: var(--dsh-space-3); }
.dshWakatimeSectionHint,
.dshWakatimeNotice,
.dshWakatimeField small,
.dshWakatimeCheck small { font-size: 11px; }
.dshWakatimeCardTitle { margin-bottom: var(--dsh-space-2); font-size: 13px; }
.dshWakatimeOfficialHeader { gap: var(--dsh-space-4); margin-bottom: var(--dsh-space-4); }
.dshWakatimeOfficialBrand { gap: var(--dsh-space-2); }
.dshWakatimeOfficialRange { gap: var(--dsh-space-1); }
.dshWakatimeOfficialMetrics,
.dshWakatimeOfficialSplit,
.dshWakatimeOfficialChartGrid { gap: var(--dsh-space-3); }
.dshWakatimeOfficialMetrics { gap: var(--dsh-space-2); }
.dshWakatimeOfficialOverview { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--dsh-space-2); padding: var(--dsh-space-2); }
.dshWakatimeOfficialOverviewTotal { padding: 10px 12px; border-color: var(--dsh-border); border-radius: var(--dsh-radius); }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricLabel { margin-bottom: 5px; }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricValue,
.dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricValue { font-size: 16px; }
.dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricMeta { margin-top: 4px; }
.dshWakatimeOfficialMetricLabel { font-size: 10px; }
.dshWakatimeOfficialMetricValue { font-size: 16px; }
.dshWakatimeOfficialSection { margin-top: var(--dsh-space-4); }
.dshWakatimeOfficialSectionHeading { gap: var(--dsh-space-3); margin-bottom: 10px; }
.dshWakatimeOfficialSectionHeading h2 { font-size: 14px; }
.dshWakatimeOfficialAiBlock { padding: var(--dsh-space-3); border-color: var(--dsh-border); border-radius: var(--dsh-radius); }
.dshWakatimeOfficialAiLayout { gap: var(--dsh-space-3); }
.dshWakatimeOfficialAiGrid { gap: var(--dsh-space-2); }
.dshWakatimeOfficialAiMetric { padding: var(--dsh-space-2) 10px; border-color: var(--dsh-border); border-radius: var(--dsh-radius); }
.dshWakatimeOfficialAiMetricValue { font-size: 16px; }
.dshWakatimeOfficialPanel h3,
.dshWakatimeOfficialChartPanel h3 { margin-bottom: 10px; font-size: 13px; }
.dshWakatimeOfficialList,
.dshWakatimeOfficialTimelineRows,
.dshWakatimeInsightsModels,
.dshWakatimeInsightsList { gap: var(--dsh-space-2); }
.dshWakatimeOfficialChartGrid { margin-top: var(--dsh-space-4); }
.dshWakatimeOfficialCategoryBlock > .dshWakatimeOfficialChartGrid { margin-top: var(--dsh-space-3); }
.dshWakatimeOfficialLegend { gap: var(--dsh-space-1) var(--dsh-space-3); margin-top: var(--dsh-space-3); }
.dshWakatimeOfficialProjectChartRows { gap: var(--dsh-space-2); }
.dshWakatimeOfficialTimelineRow,
.dshWakatimeOfficialWeekdayRow { gap: var(--dsh-space-2); }
.dshWakatimeOfficialTimelineHeader { gap: var(--dsh-space-3); margin-bottom: 10px; }
.dshWakatimeOfficialTimelineTitle { font-size: 13px; }
.dshWakatimeProjectGrid { gap: var(--dsh-space-2); }
.dshWakatimeProjectCard { gap: var(--dsh-space-3); padding: var(--dsh-space-3); }
.dshWakatimeProjectStats { gap: var(--dsh-space-2); }
.dshWakatimeRow,
.dshWakatimeRowLabel,
.dshWakatimeRowValue,
.dshWakatimeComparisonHead { font-size: 11px; }
.dshWakatimeInsightsSummary { gap: var(--dsh-space-2); }
.dshWakatimeInsightsColumns,
.dshWakatimeInsightsTwoCol { gap: var(--dsh-space-3); margin-top: var(--dsh-space-3); }
.dshWakatimeInsightsColumns > .dshWakatimeInsightsPanel { margin-top: 0; }
.dshWakatimeInsightsPanelHeader { gap: var(--dsh-space-3); margin-bottom: 10px; }
.dshWakatimeInsightsPanelHeader h2 { font-size: 14px; }
.dshWakatimeInsightsDonuts { gap: var(--dsh-space-2); }
.dshWakatimeInsightsDonutCard { gap: var(--dsh-space-2); padding: var(--dsh-space-3) var(--dsh-space-2); }
.dshWakatimeInsightsListRow { gap: var(--dsh-space-3); padding-bottom: var(--dsh-space-2); }
.dshWakatimeGrid { gap: var(--dsh-space-3); }
.dshWakatimeCard + .dshWakatimeGrid,
.dshWakatimeGrid + .dshWakatimeCard,
.dshWakatimeGrid + .dshWakatimeGrid { margin-top: var(--dsh-space-3); }
.dshWakatimeForm { gap: var(--dsh-space-4); }
.dshWakatimeField { gap: var(--dsh-space-2); }
.dshWakatimeFormGrid { gap: var(--dsh-space-3); }
.dshWakatimeChecks { gap: var(--dsh-space-3); }
.dshWakatimeCheck { gap: var(--dsh-space-2); }
.dshWakatimeAdvanced { padding-top: var(--dsh-space-3); }
.dshWakatimeAdvanced[open] summary { margin-bottom: var(--dsh-space-3); }
.dshWakatimeFormActions { gap: var(--dsh-space-3); }
@media (max-width: 820px) {
  .dshWakatimePage { padding: 0 0 24px; }
  .dshWakatimeToolbar { align-items: flex-start; flex-direction: column; }
}
@media (max-width: 560px) {
  .dshWakatimePage { padding: 0 0 24px; }
  .dshWakatimeDailyChart { gap: 3px; }
  .dshWakatimeDayBar span { width: 16px; }
}
@container (max-width: 620px) {
  .dshWakatimePage { padding: 0 0 24px; }
  .dshWakatimeToolbar { margin-bottom: 16px; }
  .dshWakatimeTabs { gap: 12px 18px; }
  .dshWakatimeMetrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeOfficialHeader { align-items: flex-start; gap: 8px; }
  .dshWakatimeOfficialRange { justify-content: flex-end; margin-left: auto; }
  .dshWakatimeOfficialMetrics { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .dshWakatimeOfficialOverview { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .dshWakatimeOfficialOverviewTotal { grid-column: auto; }
  .dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricValue { font-size: 14px; }
  .dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric,
  .dshWakatimeOfficialMetrics .dshWakatimeOfficialMetric { padding: 10px 12px; }
  .dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricLabel,
  .dshWakatimeOfficialMetrics .dshWakatimeOfficialMetricLabel { margin-bottom: 5px; font-size: 10px; }
  .dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricValue,
  .dshWakatimeOfficialMetrics .dshWakatimeOfficialMetricValue { font-size: 14px; }
  .dshWakatimeOfficialOverview > .dshWakatimeOfficialMetric .dshWakatimeOfficialMetricMeta,
  .dshWakatimeOfficialMetrics .dshWakatimeOfficialMetricMeta { font-size: 10px; }
  .dshWakatimeOfficialAiGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeOfficialChartGrid { grid-template-columns: 1fr; }
  .dshWakatimeOfficialSplit { grid-template-columns: 1fr; }
  .dshWakatimeProjectStats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeInsightsColumns, .dshWakatimeInsightsTwoCol { grid-template-columns: 1fr; }
  .dshWakatimeCard { padding: 15px; }
  .dshWakatimeDailyChart { gap: 3px; }
  .dshWakatimeDayBar span { width: 16px; }
}
@container (max-width: 390px) {
  .dshWakatimeKeyRow { grid-template-columns: 1fr; gap: 6px; }
  .dshWakatimeCliPanel { grid-template-columns: 1fr; }
  .dshWakatimeCliActions { grid-column: 1; grid-row: auto; justify-content: flex-start; }
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
  const hydrateBucket = (bucket: WakatimeUsageBucket): WakatimeUsageBucket => {
    const aiDetailsAvailable = bucket.aiDetailsAvailable
      ?? Object.prototype.hasOwnProperty.call(bucket, 'humanAdditions')
    return {
    ...bucket,
    humanAdditions: bucket.humanAdditions ?? 0,
    humanDeletions: bucket.humanDeletions ?? 0,
    aiInputTokens: bucket.aiInputTokens ?? 0,
    aiCachedInputTokens: bucket.aiCachedInputTokens ?? 0,
    aiOutputTokens: bucket.aiOutputTokens ?? 0,
    aiPromptEvents: bucket.aiPromptEvents ?? 0,
    aiSessions: bucket.aiSessions ?? 0,
    aiCost: bucket.aiCost ?? 0,
    aiDetailsAvailable,
    }
  }
  const bucketList = (items: WakatimeUsageBucket[] | undefined): WakatimeUsageBucket[] => (items ?? []).map(hydrateBucket)
  const days = value.days.map(day => ({
    ...day,
    projectBreakdown: bucketList(day.projectBreakdown),
    categoryBreakdown: bucketList(day.categoryBreakdown),
  }))
  const todayBreakdown = legacy.todayBreakdown ?? {
    date: value.end,
    projects: [],
    languages: [],
    categories: [],
  }
  return {
    ...value,
    days,
    totals: {
      ...value.totals,
      aiPromptLengthSum: value.totals.aiPromptLengthSum ?? 0,
    },
    projects: bucketList(value.projects),
    categories: bucketList(legacy.categories),
    languages: bucketList(value.languages),
    editors: bucketList(value.editors),
    machines: bucketList(value.machines),
    operatingSystems: bucketList(value.operatingSystems),
    todayBreakdown: {
      date: todayBreakdown.date,
      projects: bucketList(todayBreakdown.projects),
      languages: bucketList(todayBreakdown.languages),
      categories: bucketList(todayBreakdown.categories),
    },
  }
}

function formFromStatus(status: WakatimeUiStatus): FormState {
  return {
    category: status.config.category,
    trackReads: status.config.trackReads,
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

const WAKATIME_CATEGORY_COLORS: Record<string, string> = {
  'ai coding': '#5b7cff',
  browsing: '#d69a2e',
  coding: '#6fbf86',
  'writing docs': '#a58ce6',
  'writing tests': '#dd765f',
  debugging: '#55b8b0',
  'code reviewing': '#8a78d8',
  building: '#9aa4b2',
}
const WAKATIME_CATEGORY_FALLBACK_COLORS = ['#5b7cff', '#d69a2e', '#6fbf86', '#a58ce6', '#dd765f', '#55b8b0']

function categoryColor(name: string, fallbackIndex: number): string {
  return WAKATIME_CATEGORY_COLORS[name.trim().toLowerCase()]
    ?? WAKATIME_CATEGORY_FALLBACK_COLORS[fallbackIndex % WAKATIME_CATEGORY_FALLBACK_COLORS.length]!
}

function dayLabel(day: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', weekday: 'long' })
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

function cliSourceLabel(t: Translator, source: WakatimeUiStatus['cli']['source']): string {
  if (source === 'configured') return tr(t, 'cliSourceConfigured', 'Custom path')
  if (source === 'path') return tr(t, 'cliSourcePath', 'System PATH')
  if (source === 'managed') return tr(t, 'cliSourceManaged', 'WakaTime directory')
  return tr(t, 'cliSourceNone', 'Not found')
}

function Row({ label, value }: { label: string; value: string }) {
  return h('div', { className: 'dshWakatimeRow' },
    h('span', { className: 'dshWakatimeRowLabel' }, label),
    h('span', { className: 'dshWakatimeRowValue', title: value }, value),
  )
}

function CategoryMenu({
  id,
  value,
  onChange,
}: {
  id: string
  value: WakatimeUiConfig['category']
  onChange: (value: WakatimeUiConfig['category']) => void
}) {
  const [open, setOpen] = React.useState(false)
  const root = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return undefined
    const closeOnOutsideClick = (event: MouseEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return h('div', { ref: root, className: 'dshWakatimeCategoryMenu' },
    h('button', {
      id,
      className: 'dshWakatimeCategoryButton',
      type: 'button',
      role: 'combobox',
      'aria-labelledby': `${id}-label`,
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      'aria-controls': `${id}-options`,
      'aria-activedescendant': open ? `${id}-option-${value.replace(/\s+/g, '-')}` : undefined,
      onClick: () => setOpen(current => !current),
    }, value),
    open
      ? h('div', { id: `${id}-options`, className: 'dshWakatimeCategoryPopover', role: 'listbox' }, UI_CATEGORIES.map(category => h('button', {
        id: `${id}-option-${category.replace(/\s+/g, '-')}`,
        key: category,
        type: 'button',
        role: 'option',
        'aria-selected': value === category,
        onClick: () => { onChange(category); setOpen(false) },
      }, category)))
      : null,
  )
}

function Metric({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return h('div', { className: 'dshWakatimeMetric' },
    h('div', { className: 'dshWakatimeMetricLabel' }, label),
    h('div', { className: 'dshWakatimeMetricValue' }, value),
    meta === undefined ? null : h('div', { className: 'dshWakatimeMetricMeta' }, meta),
  )
}

function compactNumber(value: number): string {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return formatNumber(value)
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value > 0 && value < 1) return `${value.toFixed(2)}%`
  if (value < 10) return `${value.toFixed(1)}%`
  return `${Math.round(value)}%`
}

function bucketTokens(bucket: { aiInputTokens: number; aiCachedInputTokens: number; aiOutputTokens: number }): number {
  return bucket.aiInputTokens + bucket.aiCachedInputTokens + bucket.aiOutputTokens
}

function officialMetric({ label, value, meta }: { label: string; value: string; meta?: string | undefined }) {
  return h('div', { className: 'dshWakatimeOfficialMetric' },
    h('div', { className: 'dshWakatimeOfficialMetricLabel' }, label),
    h('div', { className: 'dshWakatimeOfficialMetricValue' }, value),
    meta === undefined ? null : h('div', { className: 'dshWakatimeOfficialMetricMeta' }, meta),
  )
}

function officialAiMetric({ label, value, meta }: { label: string; value: string; meta?: string | undefined }) {
  return h('div', { className: 'dshWakatimeOfficialAiMetric' },
    h('div', { className: 'dshWakatimeOfficialAiMetricLabel' }, label),
    h('div', { className: 'dshWakatimeOfficialAiMetricValue' }, value),
    meta === undefined ? null : h('div', { className: 'dshWakatimeOfficialAiMetricMeta' }, meta),
  )
}

function OfficialList({
  items,
  empty,
}: {
  items: Array<{ name: string; value: string }>
  empty: string
}) {
  return items.length === 0
    ? h('p', { className: 'dshWakatimeNotice' }, empty)
    : h('div', { className: 'dshWakatimeOfficialList' }, items.map(item => h('div', { className: 'dshWakatimeOfficialListRow', key: item.name },
      h('span', { title: item.name }, item.name),
      h('span', null, item.value),
    )))
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

function emptyBreakdown(t: Translator) {
  return h('p', { className: 'dshWakatimeNotice' }, tr(t, 'noBreakdown', 'No breakdown yet'))
}

type ActivityBreakdownMode = 'projects' | 'categories' | 'all'

function OfficialTimeline({ usage, t, mode = 'all', embedded = false }: { usage: WakatimeUsageData; t: Translator; mode?: ActivityBreakdownMode; embedded?: boolean }) {
  const today = usage.dashboard.todayText ?? formatDuration(usage.dashboard.todaySeconds)
  const renderRows = (items: WakatimeUsageBucket[]) => {
    const max = Math.max(1, ...items.map(item => item.totalSeconds))
    return items.length === 0
      ? h('p', { className: 'dshWakatimeNotice' }, tr(t, 'noBreakdown', 'No breakdown yet'))
      : h('div', { className: 'dshWakatimeOfficialTimelineRows' }, items.map(item => h('div', { className: 'dshWakatimeOfficialTimelineRow', key: item.name },
        h('div', null,
          h('div', { className: 'dshWakatimeOfficialTimelineRowHead' },
            h('span', { title: item.name }, item.name),
            h('span', null, formatDuration(item.totalSeconds)),
          ),
          h('div', { className: 'dshWakatimeOfficialTimelineRowTrack' }, h('span', { style: { width: `${Math.max(2, item.totalSeconds / max * 100)}%` } })),
        ),
        h('span', { className: 'dshWakatimeBreakdownValue' }, `${item.percent.toFixed(2)}%`),
      )))
  }
  const modes: Array<'projects' | 'categories'> = mode === 'all' ? ['projects', 'categories'] : [mode]
  const content = h('div', { className: `dshWakatimeOfficialSplit${modes.length === 1 ? ' dshWakatimeOfficialSplitSingle' : ''}` },
    ...modes.map(breakdownMode => h('div', { className: 'dshWakatimeOfficialTimeline', key: breakdownMode },
      h('div', { className: 'dshWakatimeOfficialTimelineHeader' },
        h('div', { className: 'dshWakatimeOfficialTimelineTitle' }, tr(t, breakdownMode === 'projects' ? 'projectsOverview' : 'categoriesOverview', breakdownMode === 'projects' ? 'Projects' : 'Categories')),
        h('div', { className: 'dshWakatimeOfficialTimelineTitle' }, `${today} · ${tr(t, 'today', 'Today')}`),
      ),
      renderRows(breakdownMode === 'projects' ? usage.todayBreakdown.projects : usage.todayBreakdown.categories),
    )),
  )
  return embedded ? content : h('section', { className: 'dshWakatimeOfficialSection' }, content)
}

function OfficialActivityCharts({ usage, t, mode = 'all', embedded = false }: { usage: WakatimeUsageData; t: Translator; mode?: ActivityBreakdownMode; embedded?: boolean }) {
  const renderChart = (chartMode: 'projects' | 'categories') => {
    const source = chartMode === 'projects' ? usage.projects : usage.categories
    if (chartMode === 'projects') {
      const max = Math.max(1, ...source.map(item => item.totalSeconds))
      return h('div', { className: 'dshWakatimeOfficialProjectChartRows' }, source.map(item => h('div', { className: 'dshWakatimeOfficialProjectChartRow', key: item.name },
        h('div', null,
          h('div', { className: 'dshWakatimeOfficialProjectChartHead' },
            h('span', { title: item.name }, item.name),
            h('span', null, formatDuration(item.totalSeconds)),
          ),
          h('div', { className: 'dshWakatimeOfficialProjectChartTrack' }, h('span', { style: { width: `${Math.max(2, item.totalSeconds / max * 100)}%` } })),
        ),
        h('span', { className: 'dshWakatimeBreakdownValue' }, `${item.percent.toFixed(2)}%`),
      )))
    }
    const names = source.map(item => item.name)
    const max = Math.max(1, ...usage.days.map(day => day.totalSeconds))
    const chart = h('div', { className: 'dshWakatimeOfficialStackChart', role: 'list' }, usage.days.map(day => {
      const items = day.categoryBreakdown
      return h('div', { className: 'dshWakatimeOfficialStackDay', key: day.date, role: 'listitem', title: day.date },
        h('div', { className: 'dshWakatimeOfficialStackBar' }, names.map((name, index) => {
          const seconds = items.find(item => item.name === name)?.totalSeconds ?? 0
          return h('span', { key: name, style: { height: `${seconds / max * 100}%`, background: categoryColor(name, index) } })
        })),
        h('div', { className: 'dshWakatimeOfficialStackLabel' }, dayLabel(day.date)),
      )
    }))
    const legend = h('div', { className: 'dshWakatimeOfficialLegend' }, source.map((item, index) => h('span', { className: 'dshWakatimeOfficialLegendItem', key: item.name },
      h('i', { style: { background: categoryColor(item.name, index) } }),
      h('span', { title: item.name }, item.name),
    )))
    return h(React.Fragment, null, chart, legend)
  }
  const modes: Array<'projects' | 'categories'> = mode === 'all' ? ['projects', 'categories'] : [mode]
  const content = h('div', { className: `dshWakatimeOfficialChartGrid${modes.length === 1 ? ' dshWakatimeOfficialChartGridSingle' : ''}` }, modes.map(chartMode => h('div', { className: 'dshWakatimeOfficialChartPanel', key: chartMode },
    h('h3', null, tr(t, chartMode === 'projects' ? 'projectsOverview' : 'categoriesOverview', chartMode === 'projects' ? 'Projects' : 'Categories')),
    renderChart(chartMode),
  )))
  return embedded ? content : h('section', { className: 'dshWakatimeOfficialSection' }, content)
}

function OfficialAiHumanByDay({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  return h('div', { className: 'dshWakatimeOfficialCompare' }, usage.days.map(day => {
    const aiLines = day.aiAdditions + day.aiDeletions
    const humanLines = day.humanAdditions + day.humanDeletions
    const total = aiLines + humanLines
    const aiPercent = total > 0 ? aiLines / total * 100 : 0
    return h('div', { className: 'dshWakatimeOfficialCompareRow', key: day.date },
      h('div', { className: 'dshWakatimeOfficialCompareHead' },
        h('span', null, dayLabel(day.date)),
        h('span', null, `${formatPercent(aiPercent)} AI · ${compactNumber(total)} ${tr(t, 'lines', 'lines')}`),
      ),
      h('div', { className: 'dshWakatimeOfficialCompareTrack' },
        h('span', { className: 'dshWakatimeAiPart', style: { width: `${aiPercent}%` } }),
        h('span', { className: 'dshWakatimeHumanPart', style: { width: `${Math.max(0, 100 - aiPercent)}%` } }),
      ),
    )
  }))
}

function OfficialWeekdays({ usage }: { usage: WakatimeUsageData }) {
  const items = Array.from({ length: 7 }, (_, index) => {
    const days = usage.days.filter(day => new Date(`${day.date}T12:00:00`).getDay() === index)
    const average = days.length > 0 ? days.reduce((sum, day) => sum + day.totalSeconds, 0) / days.length : 0
    return { name: weekdayLabel(index), average, days: days.length }
  })
  const maxSeconds = 24 * 60 * 60
  return h('div', { className: 'dshWakatimeOfficialWeekdayBars' }, items.map(item => h('div', { className: 'dshWakatimeOfficialWeekdayRow', key: item.name },
    h('span', { className: 'dshWakatimeOfficialWeekdayLabel' }, item.name),
    h('div', { className: 'dshWakatimeOfficialWeekdayTrack' }, h('span', { style: { width: `${Math.min(100, item.average / maxSeconds * 100)}%` } })),
    h('span', { className: 'dshWakatimeOfficialWeekdayValue' }, `${formatDuration(item.average)} (${item.average > 0 ? formatPercent(item.average / maxSeconds * 100) : '0%'})`),
  )))
}

function OfficialProjectCard({ project, t }: { project: WakatimeUsageBucket; t: Translator }) {
  const [expanded, setExpanded] = React.useState(false)
  const showAiDetails = project.aiDetailsAvailable !== false
  const aiLines = project.aiAdditions + project.aiDeletions
  const humanLines = project.humanAdditions + project.humanDeletions
  const changedLines = aiLines + humanLines
  const hasAiDetails = showAiDetails && (changedLines > 0 || project.aiPromptEvents > 0 || project.aiSessions > 0 || bucketTokens(project) > 0)
  const aiPercent = changedLines > 0 ? aiLines / changedLines * 100 : 0
  const stats = [
    { label: tr(t, 'aiPercent', 'AI Percent'), value: changedLines > 0 ? formatPercent(aiPercent) : '—', meta: changedLines > 0 ? `${compactNumber(aiLines)} of ${compactNumber(changedLines)} ${tr(t, 'lines', 'lines')}` : undefined },
    { label: tr(t, 'aiChanges', 'AI changes'), value: aiLines > 0 ? compactNumber(aiLines) : '—', meta: changedLines > 0 ? formatPercent(aiPercent) : undefined },
    { label: tr(t, 'humanChanges', 'Human changes'), value: humanLines > 0 ? compactNumber(humanLines) : '—', meta: changedLines > 0 ? formatPercent(100 - aiPercent) : undefined },
    { label: tr(t, 'aiPrompts', 'AI prompts'), value: project.aiPromptEvents > 0 ? formatNumber(project.aiPromptEvents) : '—' },
    { label: tr(t, 'aiSessions', 'AI sessions'), value: project.aiSessions > 0 ? formatNumber(project.aiSessions) : '—' },
    { label: tr(t, 'projectTokens', 'Tokens'), value: bucketTokens(project) > 0 ? compactNumber(bucketTokens(project)) : '—' },
    { label: tr(t, 'aiSpend', 'AI spend'), value: project.aiCost > 0 ? formatCost(project.aiCost) : '—' },
  ]
  return h('article', { className: 'dshWakatimeProjectCard' },
    hasAiDetails
      ? h('button', { className: 'dshWakatimeProjectHeaderButton', type: 'button', 'aria-expanded': expanded, onClick: () => setExpanded(current => !current) },
        h('div', { className: 'dshWakatimeProjectName', title: project.name }, project.name),
        h('div', { className: 'dshWakatimeProjectTime' }, formatDuration(project.totalSeconds), h('span', { className: 'dshWakatimeProjectChevron', 'aria-hidden': 'true' }, expanded ? ' ↑' : ' ↓')),
      )
      : h('div', { className: 'dshWakatimeProjectHeader' },
        h('div', { className: 'dshWakatimeProjectName', title: project.name }, project.name),
        h('div', { className: 'dshWakatimeProjectTime' }, formatDuration(project.totalSeconds)),
      ),
    !expanded || !hasAiDetails
      ? null
      : h('div', { className: 'dshWakatimeProjectStats' }, stats.map(stat => h('div', { className: 'dshWakatimeProjectStat', key: stat.label },
        h('div', { className: 'dshWakatimeProjectStatLabel' }, stat.label),
        h('div', { className: 'dshWakatimeProjectStatValue' }, stat.value),
        stat.meta === undefined ? null : h('div', { className: 'dshWakatimeProjectStatMeta' }, stat.meta),
      ))),
  )
}

function OfficialRangeMenu({ range, t, onPreset }: { range: UsageRange; t: Translator; onPreset: (days: number) => void }) {
  const [open, setOpen] = React.useState(false)
  const selected = range.start === rangeForDays(1).start ? 1 : range.start === rangeForDays(14).start ? 14 : 7
  const options = [
    { days: 1, label: tr(t, 'today', 'Today') },
    { days: 7, label: tr(t, 'last7Days', 'Last 7 Days') },
    { days: 14, label: tr(t, 'last14Days', 'Last 14 Days') },
  ]
  return h('div', { className: 'dshWakatimeOfficialRangeMenu' },
    h('button', { className: 'dshWakatimeOfficialRangeMenuButton', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': open, onClick: () => setOpen(current => !current) }, options.find(option => option.days === selected)?.label),
    open ? h('div', { className: 'dshWakatimeOfficialRangePopover', role: 'menu' }, options.map(option => h('button', { key: option.days, type: 'button', role: 'menuitem', 'aria-current': option.days === selected, onClick: () => { setOpen(false); onPreset(option.days) } }, option.label))) : null,
  )
}

function DashboardView({
  usage,
  t,
  range,
  onPreset,
  onOpenAi,
}: {
  usage: WakatimeUsageData
  t: Translator
  range: UsageRange
  onPreset: (days: number) => void
  onOpenAi: () => void
}) {
  const dashboard = usage.dashboard
  const bestDay = dashboard.bestDay
  const today = dashboard.todayText ?? formatDuration(dashboard.todaySeconds)
  const dailyAverage = dashboard.dailyAverageIncludingOtherText ?? formatDuration(dashboard.dailyAverageIncludingOtherSeconds)
  const rangeDayCount = Math.max(1, Math.round((Date.parse(`${range.end}T12:00:00`) - Date.parse(`${range.start}T12:00:00`)) / 86400000) + 1)
  const selectedRangeLabel = rangeDayCount <= 1
    ? tr(t, 'today', 'Today')
    : rangeDayCount >= 14
      ? tr(t, 'last14Days', 'Last 14 Days')
      : tr(t, 'last7Days', 'Last 7 Days')
  const bestDayMeta = bestDay === undefined
    ? undefined
    : tr(t, 'bestDayDuration', 'That day {time}').replace('{time}', bestDay.text ?? formatDuration(bestDay.totalSeconds))
  const aiLines = usage.totals.aiAdditions + usage.totals.aiDeletions
  const humanLines = usage.totals.humanAdditions + usage.totals.humanDeletions
  const changedLines = aiLines + humanLines
  const aiPercent = changedLines > 0 ? aiLines / changedLines * 100 : 0
  const totalInputTokens = usage.totals.aiInputTokens + usage.totals.aiCachedInputTokens
  const previousDay = usage.days.length > 1 ? usage.days[usage.days.length - 2] : undefined
  const todayDay = usage.days[usage.days.length - 1]
  const changePercent = previousDay !== undefined && previousDay.totalSeconds > 0 && todayDay !== undefined
    ? (todayDay.totalSeconds - previousDay.totalSeconds) / previousDay.totalSeconds * 100
    : undefined
  const modelLines = usage.aiModels.reduce((sum, model) => sum + Math.abs(model.lines), 0)
  const modelItems = usage.aiModels.map(model => ({
    name: model.name,
    value: `${formatNumber(Math.abs(model.lines))} ${tr(t, 'lines', 'lines')} (${(modelLines > 0 ? Math.abs(model.lines) / modelLines * 100 : 0).toFixed(2)}%)`,
  }))
  const bucketItems = (items: WakatimeUsageBucket[]) => items.map(item => ({
    name: item.name,
    value: `${formatDuration(item.totalSeconds)} (${item.percent.toFixed(2)}%)`,
  }))
  return h(React.Fragment, null,
    h('header', { className: 'dshWakatimeOfficialHeader' },
      h('div', { className: 'dshWakatimeOfficialBrand' },
        h('div', { className: 'dshWakatimeOfficialMark', 'aria-hidden': 'true' }, 'W'),
        h('h1', { className: 'dshWakatimeOfficialTitle' }, tr(t, 'activityOverview', 'Activity Overview')),
      ),
      h('div', { className: 'dshWakatimeOfficialRange' },
        h(OfficialRangeMenu, { range, t, onPreset }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialOverview' },
      h('div', { className: 'dshWakatimeOfficialOverviewTotal' },
        h('div', { className: 'dshWakatimeOfficialMetricLabel' }, tr(t, 'totalCodingTime', 'Total coding time')),
        h('div', { className: 'dshWakatimeOfficialMetricValue' }, dashboard.cumulativeText ?? formatDuration(dashboard.cumulativeSeconds)),
        h('div', { className: 'dshWakatimeOfficialMetricMeta' }, selectedRangeLabel),
      ),
      officialMetric({ label: tr(t, 'todayCodingTime', 'Today coding time'), value: today, meta: tr(t, 'today', 'Today') }),
      officialMetric({ label: tr(t, 'dailyAverageCoding', 'Average coding time'), value: dailyAverage, meta: selectedRangeLabel }),
      officialMetric({ label: tr(t, 'bestDay', 'Most active day'), value: bestDay === undefined ? '—' : dayLabel(bestDay.date), meta: bestDayMeta }),
    ),
    h('section', { className: 'dshWakatimeOfficialSection' },
      h('div', { className: 'dshWakatimeOfficialAiBlock' },
        h('div', { className: 'dshWakatimeOfficialSectionHeading' },
          h('h2', null, tr(t, 'aiActivity', 'AI Coding')),
          h('button', { className: 'dshWakatimeOfficialLink', type: 'button', onClick: onOpenAi }, tr(t, 'openAiDashboard', 'Open AI dashboard')),
        ),
        h('div', { className: 'dshWakatimeOfficialAiLayout' },
          h('div', null,
            h('div', { className: 'dshWakatimeOfficialDonutFrame' },
              h('div', { className: 'dshWakatimeOfficialDonut', 'data-percent': changedLines > 0 ? formatPercent(aiPercent) : '—', style: { background: `conic-gradient(#5b7cff ${aiPercent}%, color-mix(in srgb, currentColor 12%, transparent) 0)` } }),
              h('div', { className: 'dshWakatimeOfficialDonutLabel' }, tr(t, 'aiDrivenLabel', 'AI-driven')),
            ),
          ),
          h('div', { className: 'dshWakatimeOfficialAiGrid' },
            officialAiMetric({ label: tr(t, 'aiLinesLabel', 'AI lines'), value: compactNumber(aiLines) }),
            officialAiMetric({ label: tr(t, 'humanLinesLabel', 'Human lines'), value: compactNumber(humanLines) }),
            officialAiMetric({ label: tr(t, 'tokens', 'Tokens'), value: compactNumber(totalInputTokens + usage.totals.aiOutputTokens), meta: `${compactNumber(totalInputTokens)} in · ${compactNumber(usage.totals.aiOutputTokens)} out` }),
            officialAiMetric({ label: tr(t, 'cost', 'Cost'), value: formatCost(usage.totals.aiModelTotalCost), meta: tr(t, 'aiModelSpend', 'AI model spend') }),
          ),
        ),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialSection dshWakatimeOfficialCategoryBlock' },
      h(OfficialTimeline, { usage, t, mode: 'categories', embedded: true }),
      h(OfficialActivityCharts, { usage, t, mode: 'categories', embedded: true }),
    ),
    h('section', { className: 'dshWakatimeOfficialSection dshWakatimeOfficialSplit' },
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'models', 'Models')),
        h(OfficialList, { items: modelItems, empty: tr(t, 'noBreakdown', 'No breakdown yet') }),
      ),
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'editors', 'Editors')),
        h(OfficialList, { items: bucketItems(usage.editors), empty: tr(t, 'noBreakdown', 'No breakdown yet') }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialSection dshWakatimeOfficialSplit' },
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'languages', 'Languages')),
        h(OfficialList, { items: bucketItems(usage.languages), empty: tr(t, 'noBreakdown', 'No breakdown yet') }),
      ),
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'operatingSystems', 'Operating Systems')),
        h(OfficialList, { items: bucketItems(usage.operatingSystems), empty: tr(t, 'noBreakdown', 'No breakdown yet') }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialSection' },
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'machines', 'Machines')),
        h(OfficialList, { items: bucketItems(usage.machines), empty: tr(t, 'noBreakdown', 'No breakdown yet') }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialSection' },
      h('div', { className: 'dshWakatimeOfficialMetrics dshWakatimeOfficialMetricStrip' },
        officialMetric({ label: tr(t, 'todayCodingTime', 'Today coding time'), value: today, meta: tr(t, 'today', 'Today') }),
        officialMetric({
          label: tr(t, 'comparedWithPreviousDay', 'Compared with previous day'),
          value: changePercent === undefined
            ? tr(t, 'noComparison', 'No comparison')
            : changePercent === 0
              ? tr(t, 'noChange', 'No change')
              : `${changePercent < 0 ? tr(t, 'decrease', 'Decrease') : tr(t, 'increase', 'Increase')} ${formatPercent(Math.abs(changePercent))}`,
          meta: changePercent === undefined ? tr(t, 'comparisonUnavailable', 'At least two days are needed') : tr(t, 'comparisonMeta', 'vs. previous day'),
        }),
        officialMetric({ label: tr(t, 'dailyAverageCoding', 'Average coding time'), value: dailyAverage, meta: selectedRangeLabel }),
        officialMetric({ label: tr(t, 'mostActiveDayShort', 'Most active day'), value: bestDay === undefined ? '—' : dayLabel(bestDay.date), meta: bestDayMeta }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialSection dshWakatimeOfficialSplit' },
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'aiVsHumanByDay', 'AI vs Human by Day')),
        h(OfficialAiHumanByDay, { usage, t }),
      ),
      h('div', { className: 'dshWakatimeOfficialPanel' },
        h('h3', null, tr(t, 'weekdays', 'Weekdays')),
        h(OfficialWeekdays, { usage }),
      ),
    ),
    usage.isUpToDate === false ? h('p', { className: 'dshWakatimeNotice', role: 'status' }, tr(t, 'stale', 'WakaTime is updating this range.')) : null,
  )
}

function ProjectsView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  return h(React.Fragment, null,
    h(OfficialActivityCharts, { usage, t, mode: 'projects' }),
    h(OfficialTimeline, { usage, t, mode: 'projects' }),
    h('section', { className: 'dshWakatimeOfficialSection' },
      h('div', { className: 'dshWakatimeOfficialSectionHeading' },
        h('h2', null, tr(t, 'projectsOverview', 'Projects')),
      ),
      h('div', { className: 'dshWakatimeProjectGrid' }, usage.projects.map(project => h(OfficialProjectCard, { project, t, key: project.name }))),
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

function weekdayLabel(index: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + index))
  } catch {
    return String(index + 1)
  }
}

function insightDate(value: string): Date {
  return new Date(`${value}T12:00:00`)
}

function addInsightDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function insightDateKey(value: Date): string {
  return localDateInput(value)
}

function insightMonthLabel(value: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(value)
  } catch {
    return String(value.getMonth() + 1)
  }
}

function insightHeatLevel(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  const ratio = value / Math.max(1, max)
  if (ratio <= .25) return 1
  if (ratio <= .5) return 2
  if (ratio <= .75) return 3
  return 4
}

function InsightsHeatmap({ insights, t, kind }: { insights: WakatimeInsightsData; t: Translator; kind: 'activity' | 'ai' }) {
  const source = kind === 'ai' && insights.aiDays.length > 0 ? insights.aiDays : insights.days
  const firstDate = insights.start ?? source[0]?.date
  const lastDate = insights.end ?? source[source.length - 1]?.date
  if (firstDate === undefined || lastDate === undefined || source.length === 0) {
    return h('section', { className: 'dshWakatimeInsightsPanel' },
      h('div', { className: 'dshWakatimeInsightsPanelHeader' }, h('h2', null, tr(t, kind === 'activity' ? 'insightActivity' : 'insightAiPercentage', kind === 'activity' ? 'Activity' : 'AI Percentage'))),
      emptyBreakdown(t),
    )
  }
  const first = insightDate(firstDate)
  const last = insightDate(lastDate)
  const firstMonday = addInsightDays(first, -((first.getDay() + 6) % 7))
  const lastSunday = addInsightDays(last, 6 - ((last.getDay() + 6) % 7))
  const weeks = Math.max(1, Math.floor((lastSunday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
  const byDate = new Map(source.map(day => [day.date, day]))
  const max = kind === 'ai' ? 100 : Math.max(1, ...source.map(day => day.totalSeconds))
  const cells: Array<{ date: string | undefined; level: number; label: string }> = []
  for (let week = 0; week < weeks; week += 1) {
    for (let row = 0; row < 7; row += 1) {
      const date = addInsightDays(firstMonday, week * 7 + row)
      const key = insightDateKey(date)
      const day = byDate.get(key)
      const value = kind === 'ai' ? day?.aiPercent ?? 0 : day?.totalSeconds ?? 0
      const label = day === undefined
        ? `${key} · ${tr(t, 'noData', 'No activity')}`
        : kind === 'ai' ? `${key} · ${formatPercent(day.aiPercent)} ${tr(t, 'insightAiDriven', 'AI-driven')}` : `${key} · ${formatDuration(day.totalSeconds)}`
      cells.push({ date: day === undefined ? undefined : key, level: insightHeatLevel(value, max), label })
    }
  }
  const monthLabels = Array.from({ length: weeks }, (_, week) => {
    const date = addInsightDays(firstMonday, week * 7)
    return date.getDate() <= 7 ? insightMonthLabel(date) : ''
  })
  const gridStyle = { '--dsh-insight-weeks': String(weeks) } as React.CSSProperties
  const rowLabels = [weekdayLabel(1), '', weekdayLabel(3), '', weekdayLabel(5), '', '']
  return h('section', { className: 'dshWakatimeInsightsPanel' },
    h('div', { className: 'dshWakatimeInsightsPanelHeader' },
      h('div', null,
        h('h2', null, tr(t, kind === 'activity' ? 'insightActivity' : 'insightAiPercentage', kind === 'activity' ? 'Activity' : 'AI Percentage')),
      ),
    ),
    h('div', { className: 'dshWakatimeInsightsHeatmapScroll' },
      h('div', { className: 'dshWakatimeInsightsHeatmap' },
        h('div', { className: 'dshWakatimeInsightsHeatmapLabels' }, rowLabels.map((label, index) => h('span', { key: index }, label))),
        h('div', { className: 'dshWakatimeInsightsHeatmapBody' },
          h('div', { className: 'dshWakatimeInsightsHeatmapMonths', style: gridStyle }, monthLabels.map((label, index) => h('span', { key: index }, label))),
          h('div', { className: 'dshWakatimeInsightsHeatGrid', style: gridStyle, role: 'grid', 'aria-label': tr(t, kind === 'activity' ? 'insightActivity' : 'insightAiPercentage', kind === 'activity' ? 'Activity' : 'AI Percentage') }, cells.map((cell, index) => h('span', {
            key: `${cell.date ?? 'empty'}-${index}`,
            className: 'dshWakatimeInsightsHeatCell',
            'data-kind': kind,
            'data-level': cell.level,
            title: cell.label,
            'aria-label': cell.label,
            role: 'gridcell',
          }))),
        ),
      ),
    ),
    h('div', { className: 'dshWakatimeInsightsLegend' },
      h('span', null, tr(t, 'insightLess', 'Less')),
      h('i', null), h('i', null), h('i', null), h('i', null),
      h('span', null, tr(t, 'insightMore', 'More')),
    ),
  )
}

function weekdayOrder(name: string): number {
  const value = name.toLowerCase()
  const index = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].findIndex(item => value.includes(item))
  if (index >= 0) return index
  const numeric = Number.parseInt(name, 10)
  return Number.isFinite(numeric) ? numeric : 7
}

function InsightsWeekdayChart({ insights, t }: { insights: WakatimeInsightsData; t: Translator }) {
  const items = [...insights.weekdays].sort((a, b) => weekdayOrder(a.name) - weekdayOrder(b.name))
  const max = Math.max(1, ...items.map(item => item.totalSeconds))
  return h('section', { className: 'dshWakatimeInsightsPanel' },
    h('div', { className: 'dshWakatimeInsightsPanelHeader' },
      h('div', null,
        h('h2', null, tr(t, 'weekdayAverage', 'Weekday average')),
      ),
    ),
    items.length === 0 ? emptyBreakdown(t) : h('div', { className: 'dshWakatimeInsightsWeekdayChart' }, items.map((item, itemIndex) => {
      const segments = item.categoryBreakdown.length > 0 ? item.categoryBreakdown : [{ name: 'Coding', totalSeconds: item.totalSeconds, percent: 100 }]
      const detailSegments = item.categoryBreakdown.filter(segment => segment.totalSeconds > 0)
      const label = weekdayLabel((weekdayOrder(item.name) + 1) % 7)
      const tooltipId = `dsh-insight-weekday-tooltip-${itemIndex}`
      return h('div', { className: 'dshWakatimeInsightsWeekday', key: item.name, tabIndex: 0, role: 'group', 'aria-describedby': tooltipId, 'aria-label': `${label} · ${item.averageText ?? formatDuration(item.totalSeconds)}` },
        h('div', { className: 'dshWakatimeInsightsWeekdayBar' }, segments.map((segment, segmentIndex) => h('span', {
          key: segment.name,
          style: { height: `${Math.max(1, segment.totalSeconds / max * 100)}%`, background: categoryColor(segment.name, segmentIndex) },
        }))),
        h('div', { className: 'dshWakatimeInsightsWeekdayLabel' }, label),
        h('div', { className: 'dshWakatimeInsightsWeekdayValue' }, item.averageText ?? formatDuration(item.totalSeconds)),
        h('div', { id: tooltipId, className: 'dshWakatimeInsightsWeekdayTooltip', role: 'tooltip' },
          h('strong', { className: 'dshWakatimeInsightsWeekdayTooltipTitle' }, label),
          h('span', { className: 'dshWakatimeInsightsWeekdayTooltipMeta' }, `${tr(t, 'insightTooltipAverage', 'Average coding time')} · ${item.averageText ?? formatDuration(item.totalSeconds)} · ${tr(t, 'insightTooltipDays', '{days} weekdays').replace('{days}', formatNumber(item.days))}`),
          detailSegments.length === 0
            ? h('span', { className: 'dshWakatimeInsightsWeekdayTooltipMeta' }, tr(t, 'insightTooltipNoBreakdown', 'No category breakdown'))
            : h('div', { className: 'dshWakatimeInsightsWeekdayTooltipRows' }, detailSegments.map(segment => h('div', { className: 'dshWakatimeInsightsWeekdayTooltipRow', key: segment.name },
              h('span', null, segment.name),
              h('span', null, `${formatDuration(segment.totalSeconds)} · ${formatPercent(segment.percent)}`),
            ))),
        ),
      )
    })),
  )
}

function InsightsDonut({ title, center, segments, legendColumns = 1 }: { title: string; center: string; segments: Array<{ label: string; value: number; color: string; tone: string }>; legendColumns?: 1 | 2 }) {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0)
  let cursor = 0
  const stops = total > 0 ? segments.map(segment => {
    const start = cursor / total * 100
    cursor += Math.max(0, segment.value)
    return `${segment.color} ${start}% ${cursor / total * 100}%`
  }).join(', ') : 'color-mix(in srgb, currentColor 14%, transparent) 0 100%'
  return h('div', { className: 'dshWakatimeInsightsDonutCard' },
    h('div', { className: 'dshWakatimeInsightsDonut', 'data-value': center, style: { background: `conic-gradient(${stops})` } }),
    h('div', { className: 'dshWakatimeInsightsDonutTitle' }, title),
    h('div', { className: `dshWakatimeInsightsDonutLegend${legendColumns === 2 ? ' dshWakatimeInsightsDonutLegendGrid' : ''}` }, segments.map(segment => h('span', { key: segment.label }, h('i', { 'data-tone': segment.tone }), `${segment.label} ${total > 0 ? formatPercent(segment.value / total * 100) : '0%'}`))),
  )
}

function InsightsModels({ insights, t }: { insights: WakatimeInsightsData; t: Translator }) {
  const models = insights.aiModels
  const totalLines = models.reduce((sum, model) => sum + Math.abs(model.lines), 0)
  return h('section', { className: 'dshWakatimeInsightsPanel' },
    h('div', { className: 'dshWakatimeInsightsPanelHeader' }, h('h2', null, tr(t, 'models', 'Models'))),
    models.length === 0 ? emptyBreakdown(t) : h(React.Fragment, null,
      h('div', { className: 'dshWakatimeInsightsModels' }, models.map(model => h('div', { className: 'dshWakatimeInsightsModelRow', key: model.name },
        h('div', { className: 'dshWakatimeInsightsModelHead' },
          h('span', { title: model.name }, model.name),
          h('span', null, `${formatNumber(Math.abs(model.lines))} ${tr(t, 'lines', 'lines')}`),
          h('span', null, formatCost(model.cost)),
        ),
        h('div', { className: 'dshWakatimeInsightsModelTrack' }, h('span', { style: { width: `${Math.max(2, totalLines > 0 ? Math.abs(model.lines) / totalLines * 100 : 2)}%` } })),
      ))),
    ),
  )
}

function InsightsView({ insights, t, loading }: { insights: WakatimeInsightsData | undefined; t: Translator; loading: boolean }) {
  if (loading && insights === undefined) return h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'loading', 'Loading…'))
  if (insights === undefined || !insights.available) return h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'insightNoData', 'There is no insight data for this range yet.'))
  const summary = insights.summary
  const aiLines = insights.totals.aiAdditions + insights.totals.aiDeletions
  const humanLines = insights.totals.humanAdditions + insights.totals.humanDeletions
  const aiAdditions = insights.totals.aiAdditions
  const humanAdditions = insights.totals.humanAdditions
  const aiDeletions = insights.totals.aiDeletions
  const humanDeletions = insights.totals.humanDeletions
  const topLanguage = insights.languages[0]
  const topProject = insights.projects[0]
  const topOperatingSystem = insights.operatingSystems[0]
  return h(React.Fragment, null,
    insights.isUpToDate === false || insights.isUpdating === true
      ? h('p', { className: 'dshWakatimeInsightsStatus', role: 'status' }, tr(t, 'insightUpdating', 'WakaTime is preparing this long-range data; cached results are shown for now.'))
      : null,
    h('section', { className: 'dshWakatimeInsightsSummary' },
      h('div', { className: 'dshWakatimeInsightsSummaryCard' },
        h('div', { className: 'dshWakatimeInsightsSummaryLabel' }, tr(t, 'insightTotal', 'Total coding time')),
        h('div', { className: 'dshWakatimeInsightsSummaryValue' }, summary.totalText ?? formatDuration(summary.totalSeconds)),
        h('div', { className: 'dshWakatimeInsightsSummaryMeta' }, tr(t, 'insightActiveDaysMeta', '{days} active days').replace('{days}', formatNumber(summary.activeDays))),
      ),
      ...[
        { label: tr(t, 'insightDailyAverage', 'Daily average'), value: summary.dailyAverageText ?? formatDuration(summary.dailyAverageSeconds), meta: tr(t, 'insightRangeMeta', 'over the last year') },
        { label: tr(t, 'insightTopLanguage', 'Top language'), value: topLanguage?.name ?? '—', meta: topLanguage === undefined ? undefined : tr(t, 'insightDurationMeta', 'Total time {time}').replace('{time}', formatDuration(topLanguage.totalSeconds)) },
        { label: tr(t, 'insightTopProject', 'Top project'), value: topProject?.name ?? '—', meta: topProject === undefined ? undefined : tr(t, 'insightDurationMeta', 'Total time {time}').replace('{time}', formatDuration(topProject.totalSeconds)) },
        { label: tr(t, 'insightTopOperatingSystem', 'Top operating system'), value: topOperatingSystem?.name ?? '—', meta: topOperatingSystem === undefined ? undefined : tr(t, 'insightDurationMeta', 'Total time {time}').replace('{time}', formatDuration(topOperatingSystem.totalSeconds)) },
        { label: tr(t, 'insightMostActiveDay', 'Most active day'), value: summary.bestDay === undefined ? '—' : dayLabel(summary.bestDay.date), meta: summary.bestDay === undefined ? undefined : tr(t, 'insightBestDayMeta', 'That day {time}').replace('{time}', formatDuration(summary.bestDay.totalSeconds)) },
      ].map(item => h('div', { className: 'dshWakatimeInsightsSummaryCard', key: item.label },
        h('div', { className: 'dshWakatimeInsightsSummaryLabel' }, item.label),
        h('div', { className: 'dshWakatimeInsightsSummaryValue', title: item.value }, item.value),
        item.meta === undefined ? null : h('div', { className: 'dshWakatimeInsightsSummaryMeta' }, item.meta),
      )),
    ),
    h(InsightsWeekdayChart, { insights, t }),
    h(InsightsHeatmap, { insights, t, kind: 'activity' }),
    h(InsightsHeatmap, { insights, t, kind: 'ai' }),
    h('div', { className: 'dshWakatimeInsightsColumns' },
      h('section', { className: 'dshWakatimeInsightsPanel' },
        h('div', { className: 'dshWakatimeInsightsPanelHeader' },
          h('div', null,
            h('h2', null, tr(t, 'aiHuman', 'AI vs human')),
          ),
        ),
        h('div', { className: 'dshWakatimeInsightsDonuts' },
          h(InsightsDonut, { title: tr(t, 'insightAiDriven', 'AI-driven'), center: formatPercent(aiLines + humanLines > 0 ? aiLines / (aiLines + humanLines) * 100 : 0), segments: [
            { label: tr(t, 'insightAiDriven', 'AI-driven'), value: aiLines, color: '#5b7cff', tone: 'ai' },
            { label: tr(t, 'insightHuman', 'Human'), value: humanLines, color: '#d69a2e', tone: 'human' },
          ] }),
          h(InsightsDonut, { title: tr(t, 'insightAiAdditions', 'AI additions'), center: formatNumber(aiAdditions), legendColumns: 2, segments: [
            { label: tr(t, 'insightAiAdditions', 'AI additions'), value: aiAdditions, color: '#5b7cff', tone: 'ai' },
            { label: tr(t, 'insightAiDeletions', 'AI deletions'), value: aiDeletions, color: '#8a78d8', tone: 'ai-delete' },
            { label: tr(t, 'insightHumanAdditions', 'Human additions'), value: humanAdditions, color: '#d69a2e', tone: 'human' },
            { label: tr(t, 'insightHumanDeletions', 'Human deletions'), value: humanDeletions, color: '#d66f5e', tone: 'human-delete' },
          ] }),
        ),
      ),
      h(InsightsModels, { insights, t }),
    ),
  )
}

function WakatimeSettingsTab({ rpcCall, t }: { rpcCall: WakatimeUiRpcCall; t: Translator }) {
  const [tab, setTab] = React.useState<Tab>('dashboard')
  const [range, setRange] = React.useState<UsageRange>(defaultRange)
  const [status, setStatus] = React.useState<WakatimeUiStatus>()
  const [usage, setUsage] = React.useState<WakatimeUsageData>()
  const [insights, setInsights] = React.useState<WakatimeInsightsData>()
  const [form, setForm] = React.useState<FormState>()
  const [apiKey, setApiKey] = React.useState('')
  const [clearApiKey, setClearApiKey] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [usageLoading, setUsageLoading] = React.useState(false)
  const [insightsLoading, setInsightsLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [cliAction, setCliAction] = React.useState<'download' | 'update'>()
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

  const loadInsights = React.useCallback(async () => {
    setInsightsLoading(true)
    try {
      const next = await callValue<WakatimeInsightsData>(rpcCall, 'insights', { range: 'last_year' })
      setInsights(next)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'usageFailed', 'Could not read WakaTime insights'))
    } finally {
      setInsightsLoading(false)
    }
  }, [rpcCall, t])

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
  React.useEffect(() => {
    if (tab !== 'insights' || status?.apiKeyConfigured !== true || insights !== undefined) return
    void loadInsights()
  }, [insights, loadInsights, status?.apiKeyConfigured, tab])

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
      setInsights(undefined)
      setNotice(tr(t, 'saved', 'Saved'))
      await loadUsage(range)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'saveFailed', 'Could not save settings'))
    } finally {
      setSaving(false)
    }
  }

  const runCliAction = async (action: 'download' | 'update') => {
    setCliAction(action)
    setError('')
    setNotice('')
    try {
      const next = await callValue<WakatimeUiStatus>(rpcCall, action === 'download' ? 'download-cli' : 'update-cli')
      setStatus(next)
      setForm(formFromStatus(next))
      setNotice(tr(t, action === 'download' ? 'cliDownloaded' : 'cliChecked', action === 'download' ? 'CLI installed' : 'Check complete'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tr(t, 'cliActionFailed', 'CLI action failed'))
    } finally {
      setCliAction(undefined)
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
  const busy = loading || usageLoading || saving || cliAction !== undefined
  const config = form
  const state = status?.cli.state ?? 'missing'
  const source = status?.cli.source ?? 'none'
  const cliPath = status?.cli.path ?? status?.cli.managedPath
  const canDownloadCli = source === 'none' || (source === 'managed' && state === 'invalid')
  const canUpdateCli = source === 'managed' && state === 'ready'
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

  const data = status?.apiKeyConfigured !== true || loading
    ? dataState
    : tab === 'insights'
      ? h(InsightsView, { insights, t, loading: insightsLoading })
      : usage === undefined
        ? dataState
        : tab === 'dashboard'
          ? h(DashboardView, { usage, t, range, onPreset: setPreset, onOpenAi: () => setTab('ai') })
          : tab === 'ai'
            ? h(AiView, { usage, t })
            : h(ProjectsView, { usage, t })

  const settings = config === undefined
    ? h('div', { className: 'dshWakatimeEmpty' }, tr(t, 'loading', 'Loading…'))
    : h('section', { className: 'dshWakatimeCard dshWakatimeConfigCard' },
      h('div', { className: 'dshWakatimeForm' },
        h('div', { className: 'dshWakatimeKeyRow' },
          h('div', { className: 'dshWakatimeKeyMeta' },
            h('label', { htmlFor: 'dsh-wakatime-api-key' }, tr(t, 'apiKey', 'API key')),
            h('span', { className: 'dshWakatimeKeyStatus' }, status?.apiKeyConfigured ? tr(t, 'apiKeyConfigured', 'Configured') : tr(t, 'apiKeyMissing', 'Not configured')),
          ),
          h('div', { className: 'dshWakatimeInlineActions' },
            h('input', {
              id: 'dsh-wakatime-api-key',
              type: 'password',
              autoComplete: 'off',
              value: apiKey,
              placeholder: status?.apiKeyConfigured ? '••••••••' : tr(t, 'apiKeyPlaceholder', 'Enter API key'),
              onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setApiKey(event.target.value); setClearApiKey(false) },
            }),
            status?.apiKeyConfigured === true ? h('button', { className: 'dshWakatimeButton', type: 'button', disabled: busy, onClick: () => { setApiKey(''); setClearApiKey(true) } }, tr(t, 'clearApiKey', 'Clear')) : null,
          ),
        ),
        h('section', { className: 'dshWakatimeCliPanel', 'aria-labelledby': 'dsh-wakatime-cli-title' },
          h('div', { className: 'dshWakatimeCliHeader' },
            h('h3', { id: 'dsh-wakatime-cli-title', className: 'dshWakatimeCliTitle' }, tr(t, 'cli', 'CLI')),
            h('span', { className: 'dshWakatimeCliBadge' }, `${cliSourceLabel(t, source)} · ${cliLabel(t, state)}${status?.cli.version === undefined ? '' : ` · ${status.cli.version}`}`),
          ),
          cliPath === undefined ? null : h('div', { className: 'dshWakatimeCliPath', title: cliPath }, cliPath),
          source === 'configured' && state === 'invalid'
              ? h('p', { className: 'dshWakatimeCliHint' }, tr(t, 'cliInvalidConfigured', 'The configured CLI path is not executable.'))
              : source === 'path' && state === 'invalid'
                ? h('p', { className: 'dshWakatimeCliHint' }, tr(t, 'cliInvalidPath', 'The CLI found on PATH is not executable.'))
                : null,
          h('div', { className: 'dshWakatimeCliActions' },
            canDownloadCli
              ? h('button', { className: 'dshWakatimeButton', 'data-primary': 'true', type: 'button', disabled: busy, onClick: () => { void runCliAction('download') } }, cliAction === 'download' ? tr(t, 'saving', 'Saving…') : tr(t, 'cliDownload', 'Download WakaTime CLI'))
              : null,
            canUpdateCli
              ? h('button', { className: 'dshWakatimeButton', type: 'button', disabled: busy, onClick: () => { void runCliAction('update') } }, cliAction === 'update' ? tr(t, 'saving', 'Saving…') : tr(t, 'cliUpdate', 'Check for updates'))
              : null,
          ),
        ),
        h('details', { className: 'dshWakatimeAdvanced' },
          h('summary', null, tr(t, 'advanced', 'Advanced options')),
          h('div', { className: 'dshWakatimeForm' },
            h('div', { className: 'dshWakatimeFormGrid' },
              h('div', { className: 'dshWakatimeField' },
                h('label', { id: 'dsh-wakatime-category-label' }, tr(t, 'category', 'Activity category')),
                h(CategoryMenu, { id: 'dsh-wakatime-category', value: config.category, onChange: value => input('category', value) }),
              ),
              h('div', { className: 'dshWakatimeField' },
                h('label', { htmlFor: 'dsh-wakatime-interval' }, tr(t, 'heartbeatInterval', 'Heartbeat interval (ms)')),
                h('input', { id: 'dsh-wakatime-interval', type: 'number', min: 1000, step: 1000, value: config.heartbeatIntervalMs, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('heartbeatIntervalMs', event.target.value) }),
              ),
            ),
            h('div', { className: 'dshWakatimeField' },
              h('label', { htmlFor: 'dsh-wakatime-cli-path' }, tr(t, 'cliPath', 'CLI path')),
              h('input', { id: 'dsh-wakatime-cli-path', type: 'text', value: config.cliPath, placeholder: '~/.wakatime/wakatime-cli-*', onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('cliPath', event.target.value) }),
            ),
            h('div', { className: 'dshWakatimeChecks' },
              h('div', { className: 'dshWakatimeCheck' }, h('input', { id: 'dsh-wakatime-track-reads', type: 'checkbox', checked: config.trackReads, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('trackReads', event.target.checked) }), h('div', null, h('label', { htmlFor: 'dsh-wakatime-track-reads' }, tr(t, 'trackReads', 'Track reads')))),
              h('div', { className: 'dshWakatimeCheck' }, h('input', { id: 'dsh-wakatime-debug', type: 'checkbox', checked: config.debug, onChange: (event: React.ChangeEvent<HTMLInputElement>) => input('debug', event.target.checked) }), h('div', null, h('label', { htmlFor: 'dsh-wakatime-debug' }, tr(t, 'debug', 'Debug logging')))),
            ),
          ),
        ),
        h('div', { className: 'dshWakatimeFormActions' },
          notice.length > 0 ? h('span', { className: 'dshWakatimeSaved', role: 'status' }, notice) : null,
          h('button', { className: 'dshWakatimeButton', 'data-primary': 'true', type: 'button', disabled: busy, onClick: () => { void save() } }, saving ? tr(t, 'saving', 'Saving…') : tr(t, 'save', 'Save settings')),
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
        tab === 'dashboard' || tab === 'insights' ? null : h('div', { className: 'dshWakatimeToolbar' },
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
