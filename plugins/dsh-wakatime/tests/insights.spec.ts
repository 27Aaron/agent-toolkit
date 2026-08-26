import { describe, expect, it } from 'vitest'
import { normalizeWakatimeInsights, validateInsightRange } from '../src/insights.ts'

describe('WakaTime Insights normalization', () => {
  it('normalizes stats, daily activity, AI heatmap, and weekday data', () => {
    const insights = normalizeWakatimeInsights({
      data: {
        total_seconds: 7200,
        total_seconds_including_other_language: 7500,
        human_readable_total: '2 hrs',
        daily_average: 3600,
        human_readable_daily_average: '1 hr per day',
        ai_additions: 80,
        ai_deletions: 20,
        human_additions: 10,
        human_deletions: 5,
        ai_input_tokens: 1000,
        ai_output_tokens: 400,
        ai_prompt_events_total: 8,
        ai_sessions: 2,
        ai_model_breakdown: [{ name: 'GPT', lines: 100, cost: 1.5 }],
        ai_model_total_cost: 1.5,
        days_minus_holidays: 2,
        best_day: { date: '2026-08-25', total_seconds: 5400, text: '1 hr 30 mins' },
        projects: [{ name: 'agent-toolkit', total_seconds: 7200, percent: 100, ai_additions: 80 }],
        languages: [{ name: 'TypeScript', total_seconds: 7200, percent: 100 }],
        range: 'last_year',
        human_readable_range: 'last year',
        start: '2025-08-25T00:00:00Z',
        end: '2026-08-25T00:00:00Z',
        timezone: 'Asia/Shanghai',
        is_up_to_date: true,
        percent_calculated: 100,
      },
    }, {
      data: {
        days: [
          { date: '2026-08-24', total_seconds: 1800, text: '30 mins' },
          { date: '2026-08-25', total_seconds: 5400, text: '1 hr 30 mins' },
        ],
      },
    }, {
      data: {
        ai_days: [
          { date: '2026-08-24', ai_percent: 75 },
          { date: '2026-08-25', ai_percent: 90 },
        ],
      },
    }, {
      data: {
        weekdays: [
          { name: 'Monday', total_seconds: 3600, human_readable_average: '1 hr', percent: 50, days: 1 },
        ],
      },
    }, 'last_year', 123)

    expect(insights.available).toBe(true)
    expect(insights.fetchedAt).toBe(123)
    expect(insights.range).toBe('last_year')
    expect(insights.start).toBe('2025-08-25')
    expect(insights.end).toBe('2026-08-25')
    expect(insights.summary).toMatchObject({
      totalSeconds: 7200,
      dailyAverageSeconds: 3600,
      activeDays: 2,
      bestDay: { date: '2026-08-25', totalSeconds: 5400 },
    })
    expect(insights.days[1]).toMatchObject({ date: '2026-08-25', totalSeconds: 5400, aiPercent: 90 })
    expect(insights.aiDays[0]).toMatchObject({ date: '2026-08-24', aiPercent: 75 })
    expect(insights.weekdays[0]).toMatchObject({ name: 'Monday', totalSeconds: 3600, averageText: '1 hr', days: 1 })
    expect(insights.projects[0]).toMatchObject({ name: 'agent-toolkit', aiAdditions: 80 })
    expect(insights.aiModels).toEqual([{ name: 'GPT', lines: 100, cost: 1.5 }])
    expect(insights.totals).toMatchObject({ aiAdditions: 80, humanAdditions: 10, aiModelTotalCost: 1.5 })
    // aiSeconds is derived from the merged daily AI share: 1800s@75% + 5400s@90%.
    expect(insights.totals.aiSeconds).toBe(1350 + 4860)
  })

  it('accepts official insight ranges and rejects arbitrary input', () => {
    expect(validateInsightRange('last_year')).toBe('last_year')
    expect(validateInsightRange('2025')).toBe('2025')
    expect(validateInsightRange('2025-08')).toBe('2025-08')
    expect(() => validateInsightRange('today')).toThrow()
    expect(() => validateInsightRange('2025/08')).toThrow()
  })

  it('supports the compact total and percentage fields returned by Insights', () => {
    const insights = normalizeWakatimeInsights({ data: { total_seconds: 3600, projects: [], languages: [], categories: [], editors: [], machines: [], operating_systems: [] } }, {
      data: { days: [{ date: '2026-08-25', total: 3600, categories: [{ name: 'Coding', total: 3600 }] }] },
    }, {
      data: { ai_days: [{ date: '2026-08-25', ai_line_changes: 95, human_line_changes: 5, ai_percentage: 95 }] },
    }, {
      data: { weekdays: [{ name: 'Monday', count: 1, total: 7200, average: 7200, human_readable_average: '2 hrs', categories: [{ name: 'Coding', total: 7200, average: 7200 }] }] },
    }, 'last_year')

    expect(insights.days[0]).toMatchObject({ date: '2026-08-25', totalSeconds: 3600 })
    expect(insights.aiDays[0]).toMatchObject({ aiPercent: 95, aiAdditions: 95, humanAdditions: 5 })
    expect(insights.weekdays[0]).toMatchObject({ name: 'Monday', totalSeconds: 7200, averageText: '2 hrs' })
    expect(insights.weekdays[0]?.categoryBreakdown[0]).toMatchObject({ name: 'Coding', totalSeconds: 7200 })
  })
})
