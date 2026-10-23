export interface CourseFilterState {
  track: string
  tags: string[]
}

interface FilterableCourse {
  track: string
  tags: readonly string[]
}

export function matchesCourseFilter(
  course: FilterableCourse,
  state: CourseFilterState
): boolean {
  const trackMatches = state.track === '' || course.track === state.track
  const tagsMatch =
    state.tags.length === 0 || state.tags.some((tag) => course.tags.includes(tag))

  return trackMatches && tagsMatch
}

export function isTagAvailable(
  tag: string,
  track: string,
  validTags: ReadonlySet<string>,
  tagTracks: ReadonlyMap<string, ReadonlySet<string>>
): boolean {
  if (!track) return validTags.has(tag)
  return tagTracks.get(tag)?.has(track) ?? false
}

export function toggleTag(tags: readonly string[], tag: string): string[] {
  if (tag === '') return []
  return tags.includes(tag)
    ? tags.filter((selected) => selected !== tag)
    : [...tags, tag]
}

export function normalizeCourseFilter(
  candidate: CourseFilterState,
  validTracks: ReadonlySet<string>,
  validTags: ReadonlySet<string>,
  tagTracks: ReadonlyMap<string, ReadonlySet<string>>
): CourseFilterState {
  const track = validTracks.has(candidate.track) ? candidate.track : ''
  const tags = [...new Set(candidate.tags)].filter(
    (tag) => validTags.has(tag) && isTagAvailable(tag, track, validTags, tagTracks)
  )

  return { track, tags }
}
