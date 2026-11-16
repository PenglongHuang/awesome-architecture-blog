import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { canonicalUrl } from './urls'
import { sortByDateDesc, postHref, postsForLocale } from './posts'
import { messagesFor, localePath, type Locale } from './i18n.mjs'

export async function createFeed(locale: Locale = 'zh-CN') {
  const t = messagesFor(locale)
  const posts = sortByDateDesc(postsForLocale(await getCollection('posts'), locale))
  return rss({
    title: `${t.siteName} · Awesome Architecture`,
    description: t.description,
    site: canonicalUrl(localePath('/', locale)),
    items: posts.map(post => ({ title: post.data.title, description: post.data.description,
      pubDate: post.data.pubDate, link: canonicalUrl(postHref(post)) })),
    customData: `<language>${locale === 'en' ? 'en' : 'zh-cn'}</language>`,
  })
}
