import { describe, expect, it } from 'vitest'
import {
  isTagAvailable,
  matchesCourseFilter,
  normalizeCourseFilter,
  toggleTag,
} from '../../src/lib/course-filter.ts'

const validTracks = new Set(['ai-infra', 'classic-systems'])
const validTags = new Set(['ai-gateway', 'rate-limiting', 'pricing'])
const tagTracks = new Map([
  ['ai-gateway', new Set(['ai-infra'])],
  ['rate-limiting', new Set(['ai-infra', 'classic-systems'])],
  ['pricing', new Set(['classic-systems'])],
])

const aiGatewayCourse = {
  track: 'ai-infra',
  tags: ['ai-gateway', 'rate-limiting'],
}

describe('course filter', () => {
  it('matches every course when no filter is active', () => {
    expect(matchesCourseFilter(aiGatewayCourse, { track: '', tags: [] })).toBe(true)
  })

  it('filters by track', () => {
    expect(matchesCourseFilter(aiGatewayCourse, { track: 'ai-infra', tags: [] })).toBe(true)
    expect(matchesCourseFilter(aiGatewayCourse, { track: 'classic-systems', tags: [] })).toBe(
      false
    )
  })

  it('filters by a single tag', () => {
    expect(matchesCourseFilter(aiGatewayCourse, { track: '', tags: ['rate-limiting'] })).toBe(
      true
    )
    expect(matchesCourseFilter(aiGatewayCourse, { track: '', tags: ['pricing'] })).toBe(false)
  })

  it('matches any selected tag', () => {
    expect(
      matchesCourseFilter(aiGatewayCourse, { track: '', tags: ['pricing', 'rate-limiting'] })
    ).toBe(true)
    expect(
      matchesCourseFilter(aiGatewayCourse, { track: '', tags: ['pricing', 'ai-gateway'] })
    ).toBe(true)
  })

  it('combines track and tag filters', () => {
    expect(
      matchesCourseFilter(aiGatewayCourse, { track: 'ai-infra', tags: ['rate-limiting'] })
    ).toBe(true)
    expect(
      matchesCourseFilter(aiGatewayCourse, { track: 'classic-systems', tags: ['rate-limiting'] })
    ).toBe(false)
  })

  it('scopes tag availability to the selected track', () => {
    expect(isTagAvailable('ai-gateway', '', validTags, tagTracks)).toBe(true)
    expect(isTagAvailable('ai-gateway', 'ai-infra', validTags, tagTracks)).toBe(true)
    expect(isTagAvailable('ai-gateway', 'classic-systems', validTags, tagTracks)).toBe(false)
  })

  it('keeps only tags available in the selected track', () => {
    expect(
      normalizeCourseFilter(
        { track: 'classic-systems', tags: ['ai-gateway', 'rate-limiting'] },
        validTracks,
        validTags,
        tagTracks
      )
    ).toEqual({ track: 'classic-systems', tags: ['rate-limiting'] })
  })

  it('drops unknown and duplicate tag values', () => {
    expect(
      normalizeCourseFilter(
        { track: 'unknown', tags: ['unknown', 'ai-gateway', 'ai-gateway'] },
        validTracks,
        validTags,
        tagTracks
      )
    ).toEqual({ track: '', tags: ['ai-gateway'] })
  })

  it('toggles tags without mutating the source list', () => {
    const selected = ['ai-gateway']

    expect(toggleTag(selected, 'rate-limiting')).toEqual(['ai-gateway', 'rate-limiting'])
    expect(toggleTag(selected, 'ai-gateway')).toEqual([])
    expect(toggleTag(selected, '')).toEqual([])
    expect(selected).toEqual(['ai-gateway'])
  })
})
