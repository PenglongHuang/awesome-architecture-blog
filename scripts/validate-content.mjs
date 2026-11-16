import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { entryIdentity, validateTranslations } from './lib/translations.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const POSTS = path.join(ROOT, 'src/content/posts')
const SERIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/series.json'), 'utf8'))
const SERIES_IDS = new Set(SERIES.map((s) => s.id))
const CHANNEL_OF_KIND = { tutorial: 'tutorial', template: 'templates', case: 'cases' }

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, acc)
    else if (e.name.endsWith('.md')) acc.push(f)
  }
  return acc
}

const errors = []
if (SERIES_IDS.size !== SERIES.length) errors.push('series.json: duplicate series IDs')
for (const series of SERIES) {
  if (!['tutorial', 'templates', 'cases'].includes(series.channel)) errors.push(`series.json: invalid channel for ${series.id}`)
}

const posts = walk(POSTS).map((file) => {
  const rel = path.relative(POSTS, file).split(path.sep).join('/')
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = matter(raw)
  return { rel, data: parsed.data, body: parsed.content, raw }
})

const bySeries = new Map()
const slugs = new Map()

for (const post of posts) {
  const d = post.data
  for (const key of ['title', 'description', 'series', 'order', 'pubDate', 'kind']) {
    if (d[key] === undefined || d[key] === null || d[key] === '') errors.push(`${post.rel}: missing ${key}`)
  }
  if (!SERIES_IDS.has(d.series)) errors.push(`${post.rel}: invalid series ${d.series}`)
  if (!(d.pubDate instanceof Date) || Number.isNaN(+d.pubDate)) errors.push(`${post.rel}: invalid pubDate`)
  if (d.updatedDate !== undefined) {
    if (!(d.updatedDate instanceof Date) || Number.isNaN(+d.updatedDate)) errors.push(`${post.rel}: invalid updatedDate`)
    else if (d.pubDate instanceof Date && +d.updatedDate < +d.pubDate) errors.push(`${post.rel}: updatedDate is earlier than pubDate`)
  }
  for (const key of ['author', 'editor', 'cover', 'coverAlt']) {
    if (d[key] !== undefined && (typeof d[key] !== 'string' || !d[key].trim())) errors.push(`${post.rel}: invalid ${key}`)
  }
  if (d.cover && !d.coverAlt) errors.push(`${post.rel}: cover requires coverAlt`)
  if (d.cover && !d.cover.startsWith('http://') && !d.cover.startsWith('https://')) {
    const coverFile = path.join(ROOT, 'public', d.cover.split('/').filter(Boolean).join(path.sep))
    if (!fs.existsSync(coverFile)) errors.push(`${post.rel}: cover not found in public/: ${d.cover}`)
  }
  if (!CHANNEL_OF_KIND[d.kind]) errors.push(`${post.rel}: invalid kind ${d.kind}`)

  const { locale, channel, slug } = entryIdentity(post)
  const series = SERIES.find(s => s.id === d.series)
  if (series && series.channel !== channel) errors.push(`${post.rel}: kind ${d.kind} disagrees with series channel ${series.channel}`)
  const key = `${locale}/${channel}/${slug}`
  if (slugs.has(key)) errors.push(`${post.rel}: duplicate slug ${key}`)
  slugs.set(key, true)

  const group = `${locale}/${d.series}`
  if (!bySeries.has(group)) bySeries.set(group, [])
  bySeries.get(group).push(post)

  const internalMd = [...post.body.matchAll(/\]\(([^)\s]+\.md[^)]*)\)/g)]
    .filter((m) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(m[1]))
  if (internalMd.length) errors.push(`${post.rel}: unresolved .md link: ${internalMd[0][1]}`)
  if (!post.body.trim()) errors.push(`${post.rel}: empty body`)

  for (const m of post.body.matchAll(/^```(quiz|decision)\n([\s\S]*?)```/gm)) {
    try {
      const data = JSON.parse(m[2])
      if (m[1] === 'quiz' && (!Array.isArray(data.options) || data.answer < 0 || data.answer >= data.options.length)) {
        errors.push(`${post.rel}: quiz answer out of range`)
      }
    } catch {
      errors.push(`${post.rel}: invalid ${m[1]} JSON`)
    }
  }
}

for (const [seriesId, list] of bySeries) {
  const sorted = [...list].sort((a, b) => a.data.order - b.data.order)
  sorted.forEach((p, i) => {
    if (p.data.order !== i + 1) errors.push(`${p.rel}: order ${p.data.order} in ${seriesId}, expected ${i + 1}`)
    if (i > 0 && +p.data.pubDate <= +sorted[i - 1].data.pubDate) errors.push(`${p.rel}: pubDate not increasing in ${seriesId}`)
  })
}

for (const s of SERIES) {
  if (s.channel === 'cases' && s.id === 'cases') continue
  const hub = `${s.channel}/${s.id}`
  for (const locale of ['zh-CN', 'en']) {
    if (slugs.has(`${locale}/${hub}`)) errors.push(`slug collides with series id: ${locale}/${hub}`)
  }
}

errors.push(...validateTranslations(posts, SERIES))

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`validated ${posts.length} posts across ${bySeries.size} language/series groups`)
