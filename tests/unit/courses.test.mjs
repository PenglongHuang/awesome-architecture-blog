import { describe, expect, it } from 'vitest'
import {
  COURSES,
  COURSE_FORMATS,
  COURSE_LEVELS,
  COURSE_TAGS,
  COURSE_TAG_GROUPS,
  COURSE_TRACKS,
  collectCourseTags,
  collectCourseTracks,
  collectTagTracks,
  countCoursesWithTag,
  getTagLabel,
  getTrackLabel,
  groupCourseTags,
  sortTagsByUsage,
} from '../../src/data/courses.ts'

const trackIds = new Set(COURSE_TRACKS.map((track) => track.id))
const formatIds = new Set(Object.keys(COURSE_FORMATS))
const levelIds = new Set(Object.keys(COURSE_LEVELS))
const tagIds = new Set(COURSE_TAGS.map((tag) => tag.id))
const trackLabels = new Set(COURSE_TRACKS.map((track) => track.label))
const formatLabels = new Set(Object.values(COURSE_FORMATS))

describe('course taxonomy', () => {
  it('assigns every course to a known track, format, level, and tag', () => {
    for (const course of COURSES) {
      expect(trackIds.has(course.track)).toBe(true)
      expect(formatIds.has(course.format)).toBe(true)
      expect(levelIds.has(course.level)).toBe(true)

      for (const tag of course.tags) {
        expect(tagIds.has(tag)).toBe(true)
      }
    }
  })

  it('uses 2-5 unique tag ids per course', () => {
    for (const course of COURSES) {
      expect(course.tags.length).toBeGreaterThanOrEqual(2)
      expect(course.tags.length).toBeLessThanOrEqual(5)
      expect(new Set(course.tags).size).toBe(course.tags.length)
    }
  })

  it('keeps a unique, non-empty tag registry', () => {
    const ids = COURSE_TAGS.map((tag) => tag.id)
    const labels = COURSE_TAGS.map((tag) => tag.label)
    const aliases = COURSE_TAGS.flatMap((tag) => tag.aliases)
    const lookupValues = COURSE_TAGS.flatMap((tag) => [tag.id, tag.label, ...tag.aliases])
    const groupIds = new Set(COURSE_TAG_GROUPS.map((group) => group.id))

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
    expect(new Set(aliases).size).toBe(aliases.length)
    expect(new Set(lookupValues).size).toBe(lookupValues.length)

    for (const tag of COURSE_TAGS) {
      expect(tag.label.trim()).not.toBe('')
      expect(groupIds.has(tag.group)).toBe(true)
    }
  })

  it('does not repeat track or format labels as tag labels', () => {
    for (const course of COURSES) {
      for (const tag of course.tags) {
        const label = getTagLabel(tag)
        expect(trackLabels.has(label)).toBe(false)
        expect(formatLabels.has(label)).toBe(false)
      }
    }
  })

  it('collects used tags in registry order', () => {
    expect(collectCourseTags().map((tag) => tag.id)).toEqual([
      'ai-gateway',
      'request-routing',
      'rate-limiting',
      'pricing',
      'binary-scoring',
      'litellm',
      'llm2jev',
    ])
  })

  it('sorts tags by usage and then registry order', () => {
    const courses = [
      { track: 'ai-infra', tags: ['ai-gateway'] },
      { track: 'ai-infra', tags: ['ai-gateway', 'rate-limiting'] },
      { track: 'classic-systems', tags: ['pricing'] },
    ]

    expect(sortTagsByUsage(courses).map((tag) => tag.id)).toEqual([
      'ai-gateway',
      'rate-limiting',
      'pricing',
    ])
    expect(countCoursesWithTag('ai-gateway', courses)).toBe(2)
    expect(countCoursesWithTag('pricing', courses)).toBe(1)
  })

  it('groups tags by their registry group', () => {
    const groups = groupCourseTags(collectCourseTags())

    expect(groups.map((group) => group.label)).toEqual(['系统类型', '运行机制', '项目'])
    expect(groups.map((group) => group.tags.map((tag) => tag.id))).toEqual([
      ['ai-gateway'],
      ['request-routing', 'rate-limiting', 'pricing', 'binary-scoring'],
      ['litellm', 'llm2jev'],
    ])
  })

  it('maps each tag to the tracks that use it', () => {
    const tagTracks = collectTagTracks()
    for (const tag of collectCourseTags()) {
      expect([...(tagTracks.get(tag.id) ?? [])]).toEqual(['ai-infra'])
    }
  })

  it('only exposes tracks that have courses', () => {
    expect(collectCourseTracks().map((track) => track.id)).toEqual(['ai-infra'])
    expect(collectCourseTracks([])).toEqual([])
    expect(collectCourseTags([])).toEqual([])
    expect(collectTagTracks([]).size).toBe(0)
  })

  it('resolves the LiteLLM metadata and labels', () => {
    expect(COURSES[0]).toMatchObject({
      slug: 'litellm',
      track: 'ai-infra',
      format: 'source-walkthrough',
      level: 'beginner',
      tags: ['ai-gateway', 'request-routing', 'rate-limiting', 'pricing', 'litellm'],
    })
    expect(getTrackLabel('ai-infra')).toBe('AI 基础设施')
    expect(getTagLabel('ai-gateway')).toBe('AI 网关')
    expect(COURSE_FORMATS['source-walkthrough']).toBe('源码漫游')
    expect(COURSE_LEVELS.beginner).toBe('零基础')
  })
})
