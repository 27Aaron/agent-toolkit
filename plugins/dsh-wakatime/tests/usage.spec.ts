import { describe, expect, it } from 'vitest'
import { normalizeWakatimeSummaries, validateUsageRange } from '../src/usage.ts'

describe('WakaTime usage normalization', () => {
  it('keeps daily activity and AI fields in a small UI-safe shape', () => {
    const usage = normalizeWakatimeSummaries({
      cumulative_total: { seconds: 3600, text: '1 hr' },
      daily_average: { seconds: 1800, seconds_including_other_language: 2000 },
      is_up_to_date: true,
      data: [{
        grand_total: {
          total_seconds: 3600,
          ai_additions: 12,
          ai_deletions: 3,
          human_additions: 20,
          human_deletions: 4,
          ai_input_tokens: 100,
          ai_cached_input_tokens: 50,
          ai_output_tokens: 250,
          ai_prompt_length_sum: 120,
          ai_prompt_events_total: 2,
          ai_sessions: 1,
          ai_model_breakdown: [{ name: 'gpt-5', lines: 15, cost: 0.04 }],
          ai_model_total_cost: 0.04,
        },
        categories: [
          { name: 'AI Coding', total_seconds: 900 },
          { name: 'Coding', total_seconds: 2700 },
        ],
        projects: [{
          name: 'agent-toolkit',
          total_seconds: 3600,
          percent: 100,
          ai_additions: 12,
          ai_deletions: 3,
          human_additions: 20,
          human_deletions: 4,
          ai_input_tokens: 100,
          ai_cached_input_tokens: 50,
          ai_output_tokens: 250,
          ai_prompt_events_total: 2,
          ai_sessions: 1,
          ai_model_total_cost: 0.04,
        }],
        languages: [{ name: 'TypeScript', total_seconds: 3000, percent: 83 }],
        editors: [{ name: 'VS Code', total_seconds: 1800, percent: 50 }],
        machines: [{ name: 'luna', total_seconds: 3600, percent: 100 }],
        operating_systems: [{ name: 'macOS', total_seconds: 3600, percent: 100 }],
        range: { date: '2026-08-25', timezone: 'Asia/Shanghai' },
      }],
    }, '2026-08-24', '2026-08-25', 123)

    expect(usage.available).toBe(true)
    expect(usage.fetchedAt).toBe(123)
    expect(usage.days).toHaveLength(2)
    expect(usage.days[0]?.totalSeconds).toBe(0)
    expect(usage.days[1]).toMatchObject({
      date: '2026-08-25',
      aiSeconds: 900,
      aiAdditions: 12,
      aiDeletions: 3,
      aiSessions: 1,
      projectCount: 1,
      topProject: 'agent-toolkit',
      aiPromptLengthSum: 120,
    })
    expect(usage.totals.aiModelTotalCost).toBeCloseTo(0.04)
    expect(usage.totals.aiCachedInputTokens).toBe(50)
    expect(usage.totals.aiPromptLengthSum).toBe(120)
    expect(usage.aiModels).toEqual([{ name: 'gpt-5', lines: 15, cost: 0.04 }])
    expect(usage.projects[0]?.percent).toBe(100)
    expect(usage.projects[0]).toMatchObject({
      aiAdditions: 12,
      humanAdditions: 20,
      aiInputTokens: 100,
      aiPromptEvents: 2,
      aiCost: 0.04,
    })
    expect(usage.editors[0]?.name).toBe('VS Code')
    expect(usage.machines[0]?.name).toBe('luna')
    expect(usage.operatingSystems[0]?.name).toBe('macOS')
    expect(usage.categories[0]).toMatchObject({ name: 'Coding' })
    expect(usage.todayBreakdown.date).toBe('2026-08-25')
    expect(usage.todayBreakdown.projects[0]?.name).toBe('agent-toolkit')
    expect(usage.todayBreakdown.languages[0]?.name).toBe('TypeScript')
    expect(usage.todayBreakdown.categories[0]?.name).toBe('Coding')
    expect(usage.dashboard).toMatchObject({
      cumulativeSeconds: 3600,
      cumulativeText: '1 hr',
      dailyAverageSeconds: 1800,
      dailyAverageIncludingOtherSeconds: 2000,
      todaySeconds: 3600,
    })
  })

  it('rejects malformed and overly long ranges', () => {
    expect(() => validateUsageRange('2026-08-25', '2026-08-24')).toThrow(/start must not be after end/)
    expect(() => validateUsageRange('2026-08-01', '2026-09-02')).toThrow()
    expect(validateUsageRange('2026-08-24', '2026-08-25')).toEqual({
      start: '2026-08-24',
      end: '2026-08-25',
    })
  })
})
