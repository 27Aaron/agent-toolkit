import { describe, expect, it } from 'vitest'
import { validateUsageRange } from '../src/usage.ts'

const POSIX_ONLY = process.platform === 'win32' ? it.skip : it

describe('validateUsageRange timezone robustness', () => {
  POSIX_ONLY('accepts valid dates in UTC+14 (Pacific/Kiritimati)', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'Pacific/Kiritimati'
    try {
      expect(validateUsageRange('2026-08-24', '2026-08-25')).toEqual({
        start: '2026-08-24',
        end: '2026-08-25',
      })
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })

  POSIX_ONLY('accepts valid dates in UTC-12 (Etc/GMT+12)', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'Etc/GMT+12'
    try {
      expect(validateUsageRange('2026-08-24', '2026-08-25')).toEqual({
        start: '2026-08-24',
        end: '2026-08-25',
      })
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })

  POSIX_ONLY('still rejects rollover dates in extreme timezones', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'Pacific/Kiritimati'
    try {
      expect(() => validateUsageRange('2023-02-30', '2023-03-01')).toThrow()
      expect(() => validateUsageRange('2026-13-01', '2026-13-02')).toThrow()
      expect(() => validateUsageRange('2026-08-25', 'not-a-date')).toThrow()
    } finally {
      if (originalTz === undefined) delete process.env.TZ
      else process.env.TZ = originalTz
    }
  })
})
