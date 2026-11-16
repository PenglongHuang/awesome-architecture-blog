import type { Course, CourseTagId, CourseTrackId, CourseFormatId, CourseLevelId, CourseTagGroupId } from './courses'
import { getTagLabel, getTrackLabel, COURSE_FORMATS, COURSE_LEVELS } from './courses'
import type { Locale } from '../lib/i18n.mjs'

const titles: Record<string, Pick<Course, 'title' | 'subtitle' | 'description'>> = {
  litellm: { title: 'Inside LiteLLM', subtitle: 'Follow a request through every layer of an AI gateway', description: 'Trace /v1/chat/completions through authentication, rate limiting, translation, routing and pricing across eight modules, with source excerpts and interactive architecture maps.' },
  llm2jev: { title: 'Inside the LLM2Jev decision engine', subtitle: 'How a model returns probabilities without training', description: 'Follow a systemone request through binary scoring, L1 normalization and confidence assembly. Explore SGLang, Transformers and MLX backends, shared-prefix caching and an interactive architecture map.' },
  pi: { title: 'Inside the Pi coding agent', subtitle: 'Six handoffs from your first instruction to completion', description: 'Follow terminal input through the TUI, session checks, agent loop, model runtime and built-in tools. See how context is compacted and each step is recorded in JSONL.' },
}
const tags: Record<CourseTagId, string> = { 'ai-gateway': 'AI gateway', 'request-routing': 'Request routing', 'rate-limiting': 'Rate limiting', pricing: 'Pricing', 'binary-scoring': 'Binary scoring', litellm: 'LiteLLM', llm2jev: 'LLM2Jev', 'agent-loop': 'Agent loop', 'tool-calling': 'Tool calling', 'context-compaction': 'Context compaction', pi: 'Pi' }
const tracks: Record<CourseTrackId, string> = { 'ai-infra': 'AI infrastructure', 'classic-systems': 'Classic systems', engineering: 'Engineering' }
const formats: Record<CourseFormatId, string> = { 'source-walkthrough': 'Source walkthrough', 'case-study': 'Case study', lab: 'Hands-on lab' }
const levels: Record<CourseLevelId, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }
const groups: Record<CourseTagGroupId, string> = { system: 'System type', mechanics: 'Mechanisms', product: 'Project' }
export function localizedCourse(course: Course, locale: Locale = 'zh-CN'): Course {
  if (locale === 'zh-CN') return course
  if (!titles[course.slug]) throw new Error(`Missing English course metadata: ${course.slug}`)
  return { ...course, ...titles[course.slug] }
}
export const courseTagLabel = (id: CourseTagId, locale: Locale = 'zh-CN') => locale === 'en' ? tags[id] : getTagLabel(id)
export const courseTrackLabel = (id: CourseTrackId, locale: Locale = 'zh-CN') => locale === 'en' ? tracks[id] : getTrackLabel(id)
export const courseFormatLabel = (id: CourseFormatId, locale: Locale = 'zh-CN') => locale === 'en' ? formats[id] : COURSE_FORMATS[id]
export const courseLevelLabel = (id: CourseLevelId, locale: Locale = 'zh-CN') => locale === 'en' ? levels[id] : COURSE_LEVELS[id]
export const courseGroupLabel = (id: CourseTagGroupId) => groups[id]
export function learningCopy(locale: Locale = 'zh-CN') {
  return locale === 'en' ? {
    title: 'Project courses', description: 'Interactive source-code courses on LiteLLM, LLM2Jev and Pi, following real requests through AI infrastructure and coding agents.',
    interactive: 'interactive courses', line1: 'Explore architecture', line2: 'inside real projects', intro: 'Follow a real request through code, configuration and system boundaries. Open a course and explore its interactive examples.',
    languageNote: 'Course descriptions are available in English. The independent course pages and architecture diagrams are in Chinese.', allCourses: 'All courses',
    trackAria: 'Filter by track', track: 'Track', tagAria: 'Filter by tag', tags: 'Tags', all: 'All', more: 'More tags', clear: 'Clear filters', empty: 'No courses match these filters.',
    how: 'How to learn', how1: 'Each course starts with a concrete question: how is a request processed, or how is a call priced? Follow the actual code path before memorizing concepts.',
    how2: 'Courses open as independent interactive pages, with architecture maps, source excerpts and scenario explanations. Return to the catalogue to continue exploring.',
  } : {
    title: '项目学习', description: '通过 LiteLLM、LLM2Jev、Pi 等真实项目的交互式源码课程，沿着请求链路理解 AI 基础设施与编码 Agent 架构。',
    interactive: '门 · 可交互', line1: '在真实项目里，', line2: '把架构走一遍', intro: '不只读结论，而是跟着一条真实请求、一次真实部署，穿过代码、配置与边界。每门课都可以直接打开，边读边点。',
    languageNote: '课程正文和架构总览为中文。', allCourses: '全部课程', trackAria: '按方向筛选', track: '方向', tagAria: '按标签筛选', tags: '标签', all: '全部', more: '更多标签', clear: '清除筛选', empty: '当前筛选下还没有课程。',
    how: '怎么学', how1: '每门课都从一个具体问题开始：一个请求怎么被处理？一次调用怎么被计价？然后沿着真实代码路径往下走，而不是先背概念。',
    how2: '课程页面是独立交互页，包含可点击的架构图、逐段源码和场景解释；读完可以回到这里继续下一门。',
  }
}
