import type { Locale } from './i18n.mjs'
export function readingMinutes(body: string, locale: Locale = 'zh-CN'): number {
  if (locale === 'en') return Math.max(1, Math.round((body.match(/\b[\w'-]+\b/g) ?? []).length / 230))
  return Math.max(1, Math.round(body.replace(/\s/g, '').length / 400))
}
