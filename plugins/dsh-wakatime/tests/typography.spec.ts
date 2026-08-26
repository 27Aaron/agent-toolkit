import { describe, expect, it } from 'vitest'
import { formatCjkMixedText } from '../src/client.tsx'

describe('CJK mixed typography', () => {
  it('adds spaces between Chinese text and Latin or numeric tokens', () => {
    expect(formatCjkMixedText('AI编程 2026年8月25日 C++项目')).toBe('AI 编程 2026 年 8 月 25 日 C++ 项目')
  })

  it('does not duplicate existing spaces or alter unrelated text', () => {
    expect(formatCjkMixedText('AI 编程 2 小时 · 50%')).toBe('AI 编程 2 小时 · 50%')
    expect(formatCjkMixedText('https://api.wakatime.com/api/v1')).toBe('https://api.wakatime.com/api/v1')
  })
})
