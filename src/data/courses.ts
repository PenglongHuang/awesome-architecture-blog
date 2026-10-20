export interface Course {
  slug: string
  title: string
  subtitle: string
  description: string
  modules: number
  minutes: number
  level: string
  tags: string[]
}

export const COURSES: Course[] = [
  {
    slug: 'litellm',
    title: 'LiteLLM 内部漫游指南',
    subtitle: '跟着一个请求,走完 AI 网关的每一层',
    description:
      '从一次 /v1/chat/completions 请求出发,穿过鉴权、限流、翻译、路由与计价,理解 LiteLLM 的 8 个核心模块。每个场景都配可交互的架构图与源码片段。',
    modules: 8,
    minutes: 30,
    level: '零基础',
    tags: ['AI 网关', '源码漫游', 'LiteLLM'],
  },
]
