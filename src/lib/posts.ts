import type { CollectionEntry } from 'astro:content'
import { SERIES, localizedSeries, type Channel } from '../data/series'
import { href } from './urls'
import { localePath, type Locale } from './i18n.mjs'

export type Post = CollectionEntry<'posts'>

export function getSeries(id: string, locale: Locale = 'zh-CN') {
  return localizedSeries(SERIES.find((s) => s.id === id)!, locale)
}

export function postSlug(post: Post): string {
  return post.id.split('/').pop()!
}

const CHANNEL_OF_KIND = { tutorial: 'tutorial', template: 'templates', case: 'cases' } as const

export function postChannel(post: Post): Channel {
  return CHANNEL_OF_KIND[post.data.kind]
}

export function postHref(post: Post): string {
  return href(localePath(`/${postChannel(post)}/${postSlug(post)}/`, post.data.locale))
}

export function seriesHref(seriesId: string, locale: Locale = 'zh-CN'): string {
  const s = getSeries(seriesId, locale)
  return href(localePath(s.channel === 'cases' ? '/cases/' : `/${s.channel}/${s.id}/`, locale))
}

export function sortByOrder(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => a.data.order - b.data.order)
}

export function sortByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => +b.data.pubDate - +a.data.pubDate)
}

export function postsInSeries(posts: Post[], seriesId: string, locale: Locale = 'zh-CN'): Post[] {
  return sortByOrder(posts.filter((p) => p.data.series === seriesId && p.data.locale === locale))
}

export function postsForLocale(posts: Post[], locale: Locale = 'zh-CN'): Post[] {
  return posts.filter(post => post.data.locale === locale)
}

export function translationKey(post: Post): string {
  return post.data.translationKey ?? `${postChannel(post)}/${postSlug(post)}`
}

export function postAlternates(post: Post, all: Post[]): Partial<Record<Locale, string>> {
  return Object.fromEntries(all.filter(candidate => translationKey(candidate) === translationKey(post))
    .map(candidate => [candidate.data.locale, postHref(candidate)]))
}
