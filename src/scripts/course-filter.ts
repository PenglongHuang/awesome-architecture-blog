import {
  isTagAvailable,
  matchesCourseFilter,
  normalizeCourseFilter,
  toggleTag,
  type CourseFilterState,
} from '../lib/course-filter'

const filterRoot = document.querySelector<HTMLElement>('[data-course-filter]')
const courseList = document.querySelector<HTMLElement>('[data-course-list]')

if (filterRoot && courseList) {
  initCourseFilter(filterRoot, courseList)
}

function initCourseFilter(root: HTMLElement, list: HTMLElement): void {
  const trackButtons = Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-track-filter]')
  )
  const optionTagButtons = Array.from(
    root.querySelectorAll<HTMLElement>('[data-tag-option]')
  )
  const tagButtons = Array.from(
    document.querySelectorAll<HTMLElement>('[data-tag-filter]')
  )
  const cards = Array.from(list.querySelectorAll<HTMLElement>('[data-course-card]'))
  const summary = document.querySelector<HTMLElement>('[data-course-summary]')
  const clearButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('[data-course-clear], [data-course-clear-reset]')
  )
  const emptyState = document.querySelector<HTMLElement>('[data-course-empty]')
  const moreButton = document.querySelector<HTMLButtonElement>('[data-tag-more]')
  const morePanel = document.querySelector<HTMLElement>('[data-tag-more-panel]')
  const moreCount = document.querySelector<HTMLElement>('[data-tag-more-count]')

  if (trackButtons.length === 0 || cards.length === 0) {
    return
  }

  const validTracks = new Set(trackButtons.map((button) => button.dataset.trackFilter ?? ''))
  const validTags = new Set(
    optionTagButtons
      .map((button) => button.dataset.tagFilter ?? '')
      .filter((tag) => tag !== '')
  )
  const tagTracks = new Map<string, Set<string>>()
  const tagAliases = new Map<string, string>()

  for (const button of optionTagButtons) {
    const tag = button.dataset.tagFilter ?? ''
    if (!tag) continue

    const tracks = new Set((button.dataset.tagTracks ?? '').split(' ').filter(Boolean))
    tagTracks.set(tag, tracks)

    tagAliases.set(tag, tag)
    const label = button.dataset.tagLabel ?? ''
    if (label) tagAliases.set(label, tag)
    for (const alias of (button.dataset.tagAliases ?? '').split('|').filter(Boolean)) {
      tagAliases.set(alias, tag)
    }
  }

  let state = normalizeCourseFilter(readState(), validTracks, validTags, tagTracks)

  for (const button of trackButtons) {
    button.addEventListener('click', () => {
      state = normalizeCourseFilter(
        { ...state, track: button.dataset.trackFilter ?? '' },
        validTracks,
        validTags,
        tagTracks
      )
      applyState({ syncUrl: true })
    })
  }

  for (const button of tagButtons) {
    if (!root.contains(button)) {
      button.setAttribute('role', 'button')
      button.tabIndex = 0
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        selectTag(button, false)
      })
    }

    button.addEventListener('click', () => {
      selectTag(button, true)
    })
  }

  for (const button of clearButtons) {
    button.addEventListener('click', () => {
      state = { track: '', tags: [] }
      applyState({ syncUrl: true })
      trackButtons[0]?.focus()
    })
  }

  if (moreButton && morePanel) {
    moreButton.addEventListener('click', () => {
      const expanded = moreButton.getAttribute('aria-expanded') === 'true'
      moreButton.setAttribute('aria-expanded', String(!expanded))
      morePanel.hidden = expanded
    })
  }

  applyState({ syncUrl: true })
  root.hidden = false

  function selectTag(button: HTMLElement, shouldScroll: boolean): void {
    const tag = button.dataset.tagFilter ?? ''
    const wasSelected = tag !== '' && state.tags.includes(tag)

    state = normalizeCourseFilter(
      { ...state, tags: toggleTag(state.tags, tag) },
      validTracks,
      validTags,
      tagTracks
    )
    applyState({ syncUrl: true })

    if (tag !== '' && root.contains(button)) {
      focusTag(wasSelected ? 'option' : 'selected', tag)
    }

    if (shouldScroll && !root.contains(button)) {
      root.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      })
    }
  }

  function focusTag(kind: 'option' | 'selected', tag: string): void {
    const attribute = kind === 'option' ? 'data-tag-option' : 'data-tag-selected'
    const target = Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
      (button) => (button.dataset.tagFilter ?? '') === tag
    )

    if (target && target.offsetParent !== null) {
      target.focus()
    } else {
      root.querySelector<HTMLElement>('[data-tag-filter=""]')?.focus()
    }
  }

  function readState(): CourseFilterState {
    const params = new URLSearchParams(window.location.search)
    const track = params.get('track') ?? ''
    const tags = params.getAll('tag').map((tag) => tagAliases.get(tag) ?? tag)

    return {
      track: validTracks.has(track) ? track : '',
      tags,
    }
  }

  function applyState(options: { syncUrl?: boolean } = {}): void {
    for (const button of trackButtons) {
      setPressed(button, (button.dataset.trackFilter ?? '') === state.track)
    }

    for (const button of tagButtons) {
      if (!root.contains(button)) continue

      const tag = button.dataset.tagFilter ?? ''
      const selected =
        tag === '' ? state.tags.length === 0 : state.tags.includes(tag)
      setPressed(button, selected)

      if (button.hasAttribute('data-tag-option')) {
        button.hidden =
          !isTagAvailable(tag, state.track, validTags, tagTracks) ||
          state.tags.includes(tag)
      } else if (button.hasAttribute('data-tag-selected')) {
        button.hidden = !state.tags.includes(tag)
      }
    }

    const moreOptions = morePanel
      ? Array.from(morePanel.querySelectorAll<HTMLElement>('[data-tag-option]'))
      : []
    const visibleMoreCount = moreOptions.filter((button) => !button.hidden).length

    if (moreCount) {
      moreCount.textContent = String(visibleMoreCount)
    }

    if (moreButton) {
      moreButton.hidden = visibleMoreCount === 0
      if (visibleMoreCount === 0) {
        moreButton.setAttribute('aria-expanded', 'false')
        if (morePanel) morePanel.hidden = true
      }
    }

    if (morePanel) {
      for (const group of morePanel.querySelectorAll<HTMLElement>('[data-tag-group]')) {
        group.hidden = group.querySelector('[data-tag-option]:not([hidden])') === null
      }
    }

    let visibleCount = 0

    for (const card of cards) {
      const isVisible = matchesCard(card)
      card.hidden = !isVisible
      if (isVisible) visibleCount += 1
    }

    if (summary) {
      const tagSummary = state.tags.length > 1 ? ` · ${state.tags.length} 个标签` : ''
      summary.textContent = `显示 ${visibleCount} 门${tagSummary}`
    }

    const hasFilter = state.track !== '' || state.tags.length > 0
    for (const button of clearButtons) {
      button.hidden = !hasFilter
    }

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0
    }

    if (options.syncUrl) {
      syncUrl()
    }
  }

  function matchesCard(card: HTMLElement): boolean {
    return matchesCourseFilter(
      {
        track: card.dataset.courseTrack ?? '',
        tags: parseTags(card.dataset.courseTags ?? '[]'),
      },
      state
    )
  }

  function syncUrl(): void {
    const params = new URLSearchParams(window.location.search)

    if (state.track) {
      params.set('track', state.track)
    } else {
      params.delete('track')
    }

    params.delete('tag')
    for (const tag of state.tags) {
      params.append('tag', tag)
    }

    const query = params.toString()
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`

    window.history.replaceState(null, '', nextUrl)
  }
}

function setPressed(button: HTMLElement, pressed: boolean): void {
  button.setAttribute('aria-pressed', String(pressed))
  button.classList.toggle('is-active', pressed)
}

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : []
  } catch {
    return []
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
