import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'
import { SERIES_IDS } from './data/series'

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    locale: z.enum(['zh-CN', 'en']).default('zh-CN'),
    translationKey: z.string().regex(/^(tutorial|templates|cases)\/[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    title: z.string(),
    description: z.string(),
    series: z.enum(SERIES_IDS),
    order: z.number().int().positive(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().trim().min(1).optional(),
    editor: z.string().trim().min(1).optional(),
    cover: z.string().trim().min(1).optional(),
    coverAlt: z.string().trim().min(1).optional(),
    kind: z.enum(['tutorial', 'template', 'case']),
    tags: z.array(z.string()).default([]),
  }),
})

export const collections = { posts }
