import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'
import { sortByDateDesc } from '../lib/posts'

export async function GET(context: APIContext) {
  const posts = sortByDateDesc(await getCollection('posts'))
  return rss({
    title: '架构图谱 · Awesome Architecture',
    description: '专注架构思维的中文知识库:40 章教程、31 张架构地图、6 个案例。',
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
