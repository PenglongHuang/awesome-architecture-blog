import raw from './series.json'
import { z } from 'astro/zod'
import type { Locale } from '../lib/i18n.mjs'

export type Channel = 'tutorial' | 'templates' | 'cases'

export const seriesSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  channel: z.enum(['tutorial', 'templates', 'cases']),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  order: z.number().int().positive(),
  match: z.string().min(1).refine(value => { try { new RegExp(value); return true } catch { return false } }, 'Invalid match regex'),
  explicitOrder: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
  featuredOrder: z.number().int().positive().optional(),
  featuredTags: z.array(z.string().trim().min(1)).optional(),
  translations: z.object({ en: z.object({ title: z.string().trim().min(1), description: z.string().trim().min(1), featuredTags: z.array(z.string().trim().min(1)).optional() }).optional() }).optional(),
})
export type SeriesDef = z.infer<typeof seriesSchema>
const seriesListSchema = z.array(seriesSchema).min(1).refine(
  items => new Set(items.map(item => item.id)).size === items.length,
  'Series IDs must be unique',
)
export const SERIES = seriesListSchema.parse(raw)
export const SERIES_IDS = SERIES.map(s => s.id) as [string, ...string[]]

export const CHANNELS: Record<Channel, { title: string; description: string; href: string }> = {
  tutorial: { title: '系列教程', description: '按系列组织的架构教程，由浅入深读到 AI 时代的工程判断。', href: '/tutorial/' },
  templates: { title: '架构设计', description: '真实系统的架构设计，沿着组件、数据流和设计取舍建立理解。', href: '/templates/' },
  cases: { title: '系统设计', description: '端到端的系统设计推演与架构取舍。', href: '/cases/' },
}

export function localizedSeries(series: SeriesDef, locale: Locale = 'zh-CN'): SeriesDef {
  if (locale === 'zh-CN') return series
  const translation = series.translations?.en
  if (!translation) throw new Error(`Series ${series.id} has no English metadata`)
  return { ...series, ...translation }
}
