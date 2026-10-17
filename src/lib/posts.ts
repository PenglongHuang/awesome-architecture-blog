import type { CollectionEntry } from 'astro:content'
import { SERIES, type Channel } from '../data/series'
import { href } from './urls'

export type Post = CollectionEntry<'posts'>

export function getSeries(id: string) {
  return SERIES.find((s) => s.id === id)!
}

export function postSlug(post: Post): string {
  return post.id.split('/').pop()!
}

const CHANNEL_OF_KIND = { tutorial: 'tutorial', template: 'templates', case: 'cases' } as const

export function postChannel(post: Post): Channel {
  return CHANNEL_OF_KIND[post.data.kind]
}

export function postHref(post: Post): string {
  return href(`/${postChannel(post)}/${postSlug(post)}/`)
}

export function seriesHref(seriesId: string): string {
  const s = getSeries(seriesId)
  return s.channel === 'cases' ? href('/cases/') : href(`/${s.channel}/${s.id}/`)
}

export function sortByOrder(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => a.data.order - b.data.order)
}

export function sortByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => +b.data.pubDate - +a.data.pubDate)
}

export function postsInSeries(posts: Post[], seriesId: string): Post[] {
  return sortByOrder(posts.filter((p) => p.data.series === seriesId))
}
