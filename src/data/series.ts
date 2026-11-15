import raw from './series.json'

export type Channel = 'tutorial' | 'templates' | 'cases'

export interface SeriesDef {
  id: string
  channel: Channel
  title: string
  description: string
  order: number
  match: string
  explicitOrder?: string[]
  featured?: boolean
  featuredOrder?: number
  featuredTags?: string[]
}

export const SERIES = raw as SeriesDef[]
export const SERIES_IDS = SERIES.map((s) => s.id) as [string, ...string[]]

export const CHANNELS: Record<Channel, { title: string; description: string; href: string }> = {
  tutorial: { title: '系列教程', description: '按系列组织的架构教程，由浅入深读到 AI 时代的工程判断。', href: '/tutorial/' },
  templates: { title: '架构设计', description: '真实系统的架构设计，沿着组件、数据流和设计取舍建立理解。', href: '/templates/' },
  cases: { title: '系统设计', description: '端到端的系统设计推演与架构取舍。', href: '/cases/' },
}
