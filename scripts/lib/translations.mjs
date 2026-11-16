import { createHash } from 'node:crypto'

export function contentRevision(source) {
  return createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex')
}
export function entryIdentity(post) {
  const locale = post.data.locale ?? 'zh-CN'
  const channel = { tutorial: 'tutorial', template: 'templates', case: 'cases' }[post.data.kind]
  const slug = post.rel.split('/').pop().replace(/\.md$/, '').toLowerCase()
  return { locale, key: post.data.translationKey ?? `${channel}/${slug}`, channel, slug }
}

/** Validate translated pairs without requiring translations for non-pilot series. */
export function validateTranslations(posts, series) {
  const errors = []
  const pairs = new Map()
  for (const post of posts) {
    const { locale, key, channel } = entryIdentity(post)
    if (!['zh-CN', 'en'].includes(locale)) errors.push(`${post.rel}: unsupported locale ${locale}`)
    const expectedDirectory = locale === 'en' ? `en/${channel}/` : `${channel}/`
    if (!post.rel.startsWith(expectedDirectory)) errors.push(`${post.rel}: locale/channel disagrees with directory`)
    if (!/^(tutorial|templates|cases)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) errors.push(`${post.rel}: invalid translation key ${key}`)
    const pair = pairs.get(key) ?? new Map()
    if (pair.has(locale)) errors.push(`${post.rel}: duplicate translation key ${locale}/${key}`)
    pair.set(locale, post)
    pairs.set(key, pair)
  }
  for (const [key, pair] of pairs) {
    const zh = pair.get('zh-CN'), en = pair.get('en')
    if (!en) continue
    if (!zh) { errors.push(`${en.rel}: missing Chinese counterpart for ${key}`); continue }
    if (!en.data.translationKey) errors.push(`${en.rel}: English articles require translationKey`)
    if (en.data.sourceHash !== contentRevision(zh.raw)) errors.push(`${en.rel}: translation is stale or sourceHash is missing; review against ${zh.rel}`)
    for (const field of ['kind', 'series', 'order']) {
      if (en.data[field] !== zh.data[field]) errors.push(`${en.rel}: ${field} disagrees with Chinese counterpart`)
    }
    const definition = series.find(item => item.id === en.data.series)
    if (!definition?.translations?.en) errors.push(`${en.rel}: missing English series metadata`)
    for (const type of ['quiz', 'decision']) {
      const count = body => [...body.matchAll(new RegExp('^```' + type + '\\n', 'gm'))].length
      if (count(en.body) !== count(zh.body)) errors.push(`${en.rel}: ${type} count differs from Chinese counterpart`)
    }
    for (const match of en.body.matchAll(/\[([^\]]+)\]\((\/[^)\s]+)\)/g)) {
      if (!match[2].startsWith('/en/') && !match[1].includes('(Chinese)')) errors.push(`${en.rel}: cross-language link must be marked (Chinese): ${match[2]}`)
    }
  }
  // Each advertised English series is complete; untranslated series remain valid.
  for (const definition of series.filter(item => item.translations?.en)) {
    for (const post of posts.filter(p => (p.data.locale ?? 'zh-CN') === 'zh-CN' && p.data.series === definition.id)) {
      const { key } = entryIdentity(post)
      if (!pairs.get(key)?.has('en')) errors.push(`${post.rel}: English pilot series is missing translation ${key}`)
    }
  }
  return errors
}
