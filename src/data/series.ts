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
  tutorial: { title: '入门教程', description: '从架构思维到实战的系统化入门教程。', href: '/tutorial/' },
  templates: { title: '架构地图', description: '真实系统架构地图,一条从看懂到判断的路径。', href: '/templates/' },
  cases: { title: '系统设计', description: '端到端的系统设计推演与架构取舍。', href: '/cases/' },
}
