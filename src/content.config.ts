import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'
import { SERIES_IDS } from './data/series'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    series: z.enum(SERIES_IDS),
    order: z.number().int().positive(),
    pubDate: z.coerce.date(),
    kind: z.enum(['tutorial', 'template', 'case']),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { posts }
