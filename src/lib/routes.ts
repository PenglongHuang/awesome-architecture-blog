import type { Locale } from './i18n.mjs'
import type { Post } from './posts'
import { SERIES, type Channel } from '../data/series'
import { postChannel, postSlug } from './posts'

export type ChannelPath =
  | { params: { slug: string }; props: { type: 'series'; seriesId: string } }
  | { params: { slug: string }; props: { type: 'post'; post: Post } }

export function channelStaticPaths(channel: Channel, posts: Post[], locale: Locale = 'zh-CN'): ChannelPath[] {
  const seriesPaths = SERIES
    .filter((s) => s.channel === channel && (locale === 'zh-CN' || (s.translations?.en && posts.some(p => p.data.locale === locale && p.data.series === s.id))) && !(channel === 'cases' && s.id === 'cases'))
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ params: { slug: s.id }, props: { type: 'series' as const, seriesId: s.id } }))

  const postPaths = posts
    .filter((p) => postChannel(p) === channel && p.data.locale === locale)
    .map((p) => ({ params: { slug: postSlug(p) }, props: { type: 'post' as const, post: p } }))

  return [...seriesPaths, ...postPaths]
}
