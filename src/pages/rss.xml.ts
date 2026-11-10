import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'
import { sortByDateDesc } from '../lib/posts'

export async function GET(context: APIContext) {
  const posts = sortByDateDesc(await getCollection('posts'))
  return rss({
    title: 'AI架构师之路 · Awesome Architecture',
    description: '专注架构思维的中文知识库，涵盖入门教程、真实系统架构地图、端到端系统设计与交互式项目课程。',
    site: context.site!,
    items: posts.map((post) => {
      const channel = post.data.kind === 'template' ? 'templates' : post.data.kind === 'case' ? 'cases' : 'tutorial'
      const slug = post.id.split('/').pop()
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `${import.meta.env.BASE_URL}${channel}/${slug}/`,
      }
    }),
    customData: '<language>zh-cn</language>',
  })
}
