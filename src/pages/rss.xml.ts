import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import { canonicalUrl } from '../lib/urls'
import { sortByDateDesc, postHref } from '../lib/posts'

export async function GET() {
  const posts = sortByDateDesc(await getCollection('posts'))
  return rss({
    title: 'AI架构师之路 · Awesome Architecture',
    description: '专注架构思维的中文知识库，涵盖系列教程、真实系统架构设计、端到端系统设计与交互式项目课程。',
    site: canonicalUrl('/'),
    items: posts.map((post) => {
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: canonicalUrl(postHref(post)),
      }
    }),
    customData: '<language>zh-cn</language>',
  })
}
