export type CourseTrackId = 'ai-infra' | 'classic-systems' | 'engineering'
export type CourseFormatId = 'source-walkthrough' | 'case-study' | 'lab'
export type CourseLevelId = 'beginner' | 'intermediate' | 'advanced'
export type CourseTagGroupId = 'system' | 'mechanics' | 'product'

export interface CourseTrack {
  id: CourseTrackId
  label: string
}

export const COURSE_TRACKS: CourseTrack[] = [
  { id: 'ai-infra', label: 'AI 基础设施' },
  { id: 'classic-systems', label: '经典系统' },
  { id: 'engineering', label: '工程实践' },
]

export const COURSE_FORMATS: Record<CourseFormatId, string> = {
  'source-walkthrough': '源码漫游',
  'case-study': '案例拆解',
  lab: '动手实验',
}

export const COURSE_LEVELS: Record<CourseLevelId, string> = {
  beginner: '零基础',
  intermediate: '进阶',
  advanced: '高级',
}

export const COURSE_TAG_GROUPS: { id: CourseTagGroupId; label: string }[] = [
  { id: 'system', label: '系统类型' },
  { id: 'mechanics', label: '运行机制' },
  { id: 'product', label: '项目' },
]

export const COURSE_TAGS = [
  {
    id: 'ai-gateway',
    label: 'AI 网关',
    group: 'system',
    order: 10,
    aliases: ['AI网关'],
  },
  {
    id: 'request-routing',
    label: '请求路由',
    group: 'mechanics',
    order: 20,
    aliases: ['路由'],
  },
  {
    id: 'rate-limiting',
    label: '限流',
    group: 'mechanics',
    order: 30,
    aliases: [],
  },
  {
    id: 'pricing',
    label: '计价',
    group: 'mechanics',
    order: 40,
    aliases: ['计费'],
  },
  {
    id: 'binary-scoring',
    label: '二值打分',
    group: 'mechanics',
    order: 45,
    aliases: ['prefill 打分'],
  },
  {
    id: 'litellm',
    label: 'LiteLLM',
    group: 'product',
    order: 50,
    aliases: [],
  },
  {
    id: 'llm2jev',
    label: 'LLM2Jev',
    group: 'product',
    order: 60,
    aliases: [],
  },
] as const satisfies readonly {
  id: string
  label: string
  group: CourseTagGroupId
  order: number
  aliases: readonly string[]
}[]

export type CourseTagId = (typeof COURSE_TAGS)[number]['id']
export type CourseTag = (typeof COURSE_TAGS)[number]

export const FEATURED_TAG_LIMIT = 8

export interface Course {
  slug: string
  title: string
  subtitle: string
  description: string
  track: CourseTrackId
  format: CourseFormatId
  level: CourseLevelId
  modules: number
  minutes: number
  tags: CourseTagId[]
}

export const COURSES: Course[] = [
  {
    slug: 'litellm',
    title: 'LiteLLM 内部漫游指南',
    subtitle: '跟着一个请求,走完 AI 网关的每一层',
    description:
      '从一次 /v1/chat/completions 请求出发,穿过鉴权、限流、翻译、路由与计价,理解 LiteLLM 的 8 个核心模块。每个场景都配可交互的架构图与源码片段。',
    track: 'ai-infra',
    format: 'source-walkthrough',
    level: 'beginner',
    modules: 8,
    minutes: 30,
    tags: ['ai-gateway', 'request-routing', 'rate-limiting', 'pricing', 'litellm'],
  },
  {
    slug: 'llm2jev',
    title: 'LLM2Jev 决策引擎拆解',
    subtitle: '跟着一次 systemone 请求,看大模型如何零训练输出概率',
    description:
      '从 client.systemone.create() 出发,看请求如何被拆成 N 个 yes/no 判断,经 prefill-only 二值打分、L1 归一化与置信度组装成 Jev 概率。覆盖 SGLang/Transformers/MLX 三后端与共享前缀缓存,配可交互架构图。',
    track: 'ai-infra',
    format: 'source-walkthrough',
    level: 'intermediate',
    modules: 5,
    minutes: 25,
    tags: ['binary-scoring', 'llm2jev'],
  },
]

export function getTrackLabel(trackId: CourseTrackId): string {
  return COURSE_TRACKS.find((track) => track.id === trackId)?.label ?? trackId
}

export function getTagLabel(tagId: CourseTagId): string {
  return COURSE_TAGS.find((tag) => tag.id === tagId)?.label ?? tagId
}

export function collectCourseTags(courses: readonly Course[] = COURSES): CourseTag[] {
  const usedTags = new Set(courses.flatMap((course) => course.tags))
  return COURSE_TAGS.filter((tag) => usedTags.has(tag.id))
}

export function countCoursesWithTag(
  tagId: CourseTagId,
  courses: readonly Course[] = COURSES
): number {
  return courses.filter((course) => course.tags.includes(tagId)).length
}

export function sortTagsByUsage(courses: readonly Course[] = COURSES): CourseTag[] {
  return collectCourseTags(courses)
    .map((tag) => ({ tag, count: countCoursesWithTag(tag.id, courses) }))
    .sort((a, b) => b.count - a.count || a.tag.order - b.tag.order)
    .map(({ tag }) => tag)
}

export function groupCourseTags(
  tags: readonly CourseTag[]
): { id: CourseTagGroupId; label: string; tags: CourseTag[] }[] {
  return COURSE_TAG_GROUPS.map((group) => ({
    ...group,
    tags: tags.filter((tag) => tag.group === group.id),
  })).filter((group) => group.tags.length > 0)
}

export function collectTagTracks(
  courses: readonly Course[] = COURSES
): Map<CourseTagId, Set<CourseTrackId>> {
  const tagTracks = new Map<CourseTagId, Set<CourseTrackId>>()

  for (const course of courses) {
    for (const tag of course.tags) {
      const tracks = tagTracks.get(tag) ?? new Set<CourseTrackId>()
      tracks.add(course.track)
      tagTracks.set(tag, tracks)
    }
  }

  return tagTracks
}

export function collectCourseTracks(courses: readonly Course[] = COURSES): CourseTrack[] {
  const usedTracks = new Set(courses.map((course) => course.track))
  return COURSE_TRACKS.filter((track) => usedTracks.has(track.id))
}
