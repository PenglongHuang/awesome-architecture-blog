import { describe, it, expect } from 'vitest'
import { dateForIndex } from '../../scripts/lib/dates.mjs'

describe('dateForIndex', () => {
  it('starts on Tuesday 2026-01-06', () => expect(dateForIndex(1)).toBe('2026-01-06'))
  it('puts the second post on Friday', () => expect(dateForIndex(2)).toBe('2026-01-09'))
  it('ends the tutorial on 2026-06-02', () => expect(dateForIndex(43)).toBe('2026-06-02'))
  it('starts templates on 2026-06-05', () => expect(dateForIndex(44)).toBe('2026-06-05'))
  it('ends templates on 2026-09-18', () => expect(dateForIndex(74)).toBe('2026-09-18'))
  it('starts cases on 2026-09-22', () => expect(dateForIndex(75)).toBe('2026-09-22'))
  it('ends cases on 2026-10-09', () => expect(dateForIndex(80)).toBe('2026-10-09'))
})
