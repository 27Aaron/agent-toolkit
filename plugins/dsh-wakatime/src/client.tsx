import * as React from 'react'
import {
  WAKATIME_RPC_CHANNEL,
  UI_CATEGORIES,
  type WakatimeDailyUsage,
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
  activityOverview: '活动概览',
  overLast7Days: '过去 7 天',
  currentDay: '当前日期',
  topDay: '最活跃的一天',
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
  topProjectsHint: '按编码时间排序的项目。',
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
  activityOverview: 'Activity Overview',
  overLast7Days: 'over the Last 7 Days',
  currentDay: 'Current day',
  topDay: 'top day',
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
  topProjectsHint: 'Projects ordered by coding time.',
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
  padding: 0 0 24px;
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
.dshWakatimeOfficialHeader { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 0 0 18px; }
.dshWakatimeOfficialBrand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.dshWakatimeOfficialMark { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 8px; color: #fff; background: #5b7cff; font-size: 16px; font-weight: 800; }
.dshWakatimeOfficialEyebrow { margin: 0 0 4px; color: currentColor; opacity: .55; font-size: 11px; font-weight: 650; letter-spacing: .01em; }
.dshWakatimeOfficialTitle { margin: 0; font-size: clamp(20px, 5vw, 28px); letter-spacing: -.035em; line-height: 1.05; }
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
.dshWakatimeOfficialOverview { display: grid; grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(0, 1fr)); gap: 10px; padding: 16px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 9px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialOverviewTotal { display: flex; min-width: 0; flex-direction: column; justify-content: center; padding: 2px 6px 2px 2px; }
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
.dshWakatimeOfficialAiLayout { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 12px; align-items: center; padding: 14px; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 9px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialDonutFrame { display: grid; width: 142px; min-height: 142px; place-items: center; margin: auto; border: 1px solid color-mix(in srgb, currentColor 14%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 3%, transparent); }
.dshWakatimeOfficialDonut { display: grid; width: 112px; height: 112px; place-items: center; border-radius: 50%; background: conic-gradient(#5b7cff var(--dsh-ai-percent), color-mix(in srgb, currentColor 12%, transparent) 0); }
.dshWakatimeOfficialDonut::after { display: grid; width: 76px; height: 76px; place-items: center; border-radius: 50%; background: color-mix(in srgb, currentColor 3%, transparent); content: attr(data-percent); font-size: 22px; font-weight: 750; }
.dshWakatimeOfficialDonutLabel { margin-top: -4px; color: currentColor; opacity: .68; font-size: 10px; text-align: center; }
.dshWakatimeOfficialAiMetric { min-width: 0; padding: 10px 11px; border: 1px solid color-mix(in srgb, currentColor 12%, transparent); border-radius: 7px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialAiMetricLabel { color: currentColor; opacity: .56; font-size: 10px; }
.dshWakatimeOfficialAiMetricValue { margin-top: 4px; overflow-wrap: anywhere; font-size: 16px; font-weight: 700; line-height: 1.1; }
.dshWakatimeOfficialAiMetricMeta { margin-top: 3px; overflow-wrap: anywhere; color: currentColor; opacity: .54; font-size: 10px; line-height: 1.25; }
.dshWakatimeOfficialSplit { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.dshWakatimeOfficialPanel { min-width: 0; padding: 14px 15px; border: 1px solid color-mix(in srgb, currentColor 13%, transparent); border-radius: 8px; background: color-mix(in srgb, currentColor 2%, transparent); }
.dshWakatimeOfficialPanel h3 { margin: 0 0 10px; font-size: 13px; }
.dshWakatimeOfficialList { display: grid; gap: 7px; }
.dshWakatimeOfficialListRow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: baseline; min-width: 0; font-size: 11px; }
.dshWakatimeOfficialListRow span:first-child { overflow: hidden; color: currentColor; opacity: .72; text-overflow: ellipsis; white-space: nowrap; }
.dshWakatimeOfficialListRow span:last-child { color: currentColor; opacity: .8; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.dshWakatimeOfficialChartGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
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
  .dshWakatimeOfficialMetrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeOfficialOverview { grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(0, 1fr)); }
  .dshWakatimeOfficialOverviewTotal { grid-column: auto; }
  .dshWakatimeOfficialOverviewTotal .dshWakatimeOfficialMetricValue { font-size: 24px; }
  .dshWakatimeOfficialAiGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dshWakatimeOfficialChartGrid { grid-template-columns: 1fr; }
  .dshWakatimeOfficialSplit { grid-template-columns: 1fr; }
  .dshWakatimeProjectStats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

function OfficialTimeline({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
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
  return h('section', { className: 'dshWakatimeOfficialSection' },
    h('div', { className: 'dshWakatimeOfficialSplit' },
      ...(['projects', 'categories'] as const).map(mode => h('div', { className: 'dshWakatimeOfficialTimeline', key: mode },
        h('div', { className: 'dshWakatimeOfficialTimelineHeader' },
          h('div', { className: 'dshWakatimeOfficialTimelineTitle' }, tr(t, mode === 'projects' ? 'projectsOverview' : 'categoriesOverview', mode === 'projects' ? 'Projects' : 'Categories')),
          h('div', { className: 'dshWakatimeOfficialTimelineTitle' }, `${today} · ${tr(t, 'today', 'Today')}`),
        ),
        mode === 'categories' ? h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'segmentHint', 'Segment by category, language, editor, or operating system')) : null,
        renderRows(mode === 'projects' ? usage.todayBreakdown.projects : usage.todayBreakdown.categories),
      )),
    ),
  )
}

function OfficialActivityCharts({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  const palette = ['#6d91ff', '#d69a2e', '#6fbf86', '#a58ce6', '#dd765f', '#55b8b0']
  const renderChart = (mode: 'projects' | 'categories') => {
    const source = mode === 'projects' ? usage.projects : usage.categories
    if (mode === 'projects') {
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
          return h('span', { key: name, style: { height: `${seconds / max * 100}%`, background: palette[index % palette.length] } })
        })),
        h('div', { className: 'dshWakatimeOfficialStackLabel' }, dayLabel(day.date)),
      )
    }))
    const legend = h('div', { className: 'dshWakatimeOfficialLegend' }, source.map((item, index) => h('span', { className: 'dshWakatimeOfficialLegendItem', key: item.name },
      h('i', { style: { background: palette[index % palette.length] } }),
      h('span', { title: item.name }, item.name),
    )))
    return h(React.Fragment, null, chart, legend)
  }
  return h('section', { className: 'dshWakatimeOfficialChartGrid' },
    h('div', { className: 'dshWakatimeOfficialChartPanel' },
      h('h3', null, tr(t, 'projectsOverview', 'Projects')),
      renderChart('projects'),
    ),
    h('div', { className: 'dshWakatimeOfficialChartPanel' },
      h('h3', null, tr(t, 'categoriesOverview', 'Categories')),
      renderChart('categories'),
    ),
  )
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
        h('div', null,
          h('p', { className: 'dshWakatimeOfficialEyebrow' }, 'WakaTime Dashboard'),
          h('h1', { className: 'dshWakatimeOfficialTitle' }, tr(t, 'activityOverview', 'Activity Overview')),
        ),
      ),
      h('div', { className: 'dshWakatimeOfficialRange' },
        h(OfficialRangeMenu, { range, t, onPreset }),
      ),
    ),
    h('section', { className: 'dshWakatimeOfficialOverview' },
      h('div', { className: 'dshWakatimeOfficialOverviewTotal' },
        h('div', { className: 'dshWakatimeOfficialMetricValue' }, dashboard.cumulativeText ?? formatDuration(dashboard.cumulativeSeconds)),
        h('div', { className: 'dshWakatimeOfficialMetricMeta' }, tr(t, 'overLast7Days', 'over the Last 7 Days')),
      ),
      officialMetric({ label: tr(t, 'currentDay', 'Current day'), value: today, meta: tr(t, 'today', 'Today') }),
      officialMetric({ label: tr(t, 'dailyAverage', 'Daily average'), value: dailyAverage, meta: tr(t, 'overLast7Days', 'over the Last 7 Days') }),
      officialMetric({ label: tr(t, 'bestDay', 'Most active'), value: bestDay === undefined ? '—' : dayLabel(bestDay.date), meta: tr(t, 'topDay', 'top day') }),
    ),
    h('section', { className: 'dshWakatimeOfficialSection' },
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
    h(OfficialActivityCharts, { usage, t }),
    h(OfficialTimeline, { usage, t }),
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
      h('div', { className: 'dshWakatimeOfficialMetrics' },
        officialMetric({ label: tr(t, 'today', 'Today'), value: today, meta: tr(t, 'today', 'Today') }),
        officialMetric({ label: changePercent === undefined ? tr(t, 'decrease', 'Decrease') : changePercent < 0 ? tr(t, 'decrease', 'Decrease') : tr(t, 'increase', 'Increase'), value: changePercent === undefined ? '—' : formatPercent(Math.abs(changePercent)) }),
        officialMetric({ label: tr(t, 'dailyAverage', 'Daily Average'), value: dailyAverage }),
        officialMetric({ label: tr(t, 'bestDay', 'Most Active Day'), value: bestDay === undefined ? '—' : dayLabel(bestDay.date) }),
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

function WorkspaceView({ usage, t }: { usage: WakatimeUsageData; t: Translator }) {
  return h(React.Fragment, null,
    h('p', { className: 'dshWakatimeSectionHint' }, tr(t, 'workspaceHint', 'Time share across coding tools, languages, machines, and projects.')),
    h('section', { className: 'dshWakatimeCard' },
      h('h2', { className: 'dshWakatimeCardTitle' }, tr(t, 'topProjects', 'Projects')),
      h('p', { className: 'dshWakatimeCardHint' }, tr(t, 'topProjectsHint', 'Projects ordered by coding time.')),
      bucketBreakdown(usage.projects, formatDuration, t),
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
    return new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(new Date(2024, 0, 7 + index))
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
      ? h(DashboardView, { usage, t, range, onPreset: setPreset, onOpenAi: () => setTab('ai') })
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
        tab === 'dashboard' ? null : h('div', { className: 'dshWakatimeToolbar' },
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
