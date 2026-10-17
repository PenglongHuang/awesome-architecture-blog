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
}

export const SERIES = raw as SeriesDef[]
export const SERIES_IDS = SERIES.map((s) => s.id) as [string, ...string[]]

export const CHANNELS: Record<Channel, { title: string; description: string; href: string }> = {
  tutorial: { title: '教程', description: '像架构师一样思考的 43 篇教程。', href: '/tutorial/' },
  templates: { title: '架构地图', description: '31 张真实系统的架构地图。', href: '/templates/' },
  cases: { title: '案例', description: '6 个端到端的架构推演。', href: '/cases/' },
}
