import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRelative } from './lib/relative.mjs'
import { rewriteLink } from './lib/links.mjs'
import {
  extractTitle, stripTitle, extractDescription, convertComponents,
} from './lib/frontmatter.mjs'
import { dateForIndex } from './lib/dates.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = path.resolve(ROOT, process.argv[2] ?? '../awesome-architecture')
const SLUGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/slugs.json'), 'utf8'))
const SERIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/series.json'), 'utf8'))

const EXCLUDED = new Set([
  'tutorial/README.md',
  'templates/README.md',
  'cases/README.md',
  'templates/_TEMPLATE.md',
  'templates/ai-native-organization/README.md',
])

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, acc)
    else if (entry.name.endsWith('.md')) acc.push(full)
  }
  return acc
}

function toPosix(p) {
  return p.split(path.sep).join('/')
}

const allFiles = ['tutorial', 'templates', 'cases']
  .flatMap((d) => walk(path.join(SOURCE, d)))
  .map((f) => toPosix(path.relative(SOURCE, f)))

const candidates = allFiles.filter((f) => !EXCLUDED.has(f))

function seriesFor(file) {
  const hit = SERIES.find((s) => new RegExp(s.match).test(file))
  if (!hit) throw new Error(`no series matched: ${file}`)
  return hit
}

function kindOf(file) {
  if (file.startsWith('tutorial/')) return 'tutorial'
  if (file.startsWith('templates/')) return 'template'
  return 'case'
}

function slugOf(file) {
  if (file.startsWith('tutorial/')) {
    const slug = SLUGS[file]
    if (!slug) throw new Error(`missing slug mapping: ${file}`)
    return slug
  }
  return path.posix.basename(path.posix.dirname(file))
}

function tagFor(series) {
  const kind = { tutorial: '教程', templates: '模板', cases: '案例' }[series.channel]
  return [series.title, kind]
}

// group + order
const grouped = new Map()
for (const file of candidates) {
  const s = seriesFor(file)
  if (!grouped.has(s.id)) grouped.set(s.id, [])
  grouped.get(s.id).push(file)
}

const ordered = []
for (const s of [...SERIES].sort((a, b) => a.order - b.order)) {
  const files = grouped.get(s.id) ?? []
  const sorted = s.explicitOrder
    ? [...files].sort((a, b) => s.explicitOrder.indexOf(a) - s.explicitOrder.indexOf(b))
    : [...files].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
  if (sorted.length === 0) throw new Error(`empty series: ${s.id}`)
  sorted.forEach((file, i) => ordered.push({ file, series: s, order: i + 1 }))
}

if (ordered.length !== 80) throw new Error(`expected 80 posts, got ${ordered.length}`)

// link map
const routeOf = new Map()
for (const { file, series } of ordered) {
  const channel = { tutorial: 'tutorial', templates: 'templates', cases: 'cases' }[series.channel]
  routeOf.set(file, `/${channel}/${slugOf(file)}/`)
}
routeOf.set('tutorial/README.md', '/tutorial/')
routeOf.set('templates/README.md', '/templates/')
routeOf.set('cases/README.md', '/cases/')
routeOf.set('README.md', '/about/')
routeOf.set('templates/ai-native-organization/README.md', '/templates/')
routeOf.set('templates/_TEMPLATE.md', null)

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const linkMap = Object.fromEntries(routeOf)

const report = { posts: 0, quizzes: 0, decisions: 0, links: 0, cjkPre: [], unmapped: [] }
const outRoot = path.join(ROOT, 'src/content/posts')

for (const { file, series, order } of ordered) {
  const raw = fs.readFileSync(path.join(SOURCE, file), 'utf8')
  const title = extractTitle(raw)
  const description = extractDescription(raw)
  let body = stripTitle(raw)

  body = body.replace(LINK_RE, (full, text, link) => {
    const resolved = resolveRelative(file, link.split('#')[0].split('?')[0])
    if (linkMap[resolved] === null) return text
    const r = rewriteLink({ link, fromFile: file, map: linkMap })
    if (!r.ok) {
      report.unmapped.push({ file, link: r.reason })
      throw new Error(`${file}: ${r.reason}`)
    }
    report.links++
    return `[${text}](${r.href})`
  })

  const converted = convertComponents(body)
  report.quizzes += converted.quizzes
  report.decisions += converted.decisions

  for (const block of converted.md.matchAll(/^```[\w-]*\n([\s\S]*?)```/gm)) {
    if (/[一-鿿]/.test(block[1]) && /[│─┌┐└┘├┤┬┴┼▶◀▲▼→←]/.test(block[1])) {
      report.cjkPre.push(`${file}#${report.cjkPre.length + 1}`)
    }
  }

  const kind = kindOf(file)
  const channel = { tutorial: 'tutorial', templates: 'templates', cases: 'cases' }[series.channel]
  const slug = slugOf(file)
  const pubDate = dateForIndex(report.posts + 1)

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `series: ${series.id}`,
    `order: ${order}`,
    `pubDate: ${pubDate}`,
    `kind: ${kind}`,
    `tags: ${JSON.stringify(tagFor(series))}`,
    '---',
    '',
  ].join('\n')

  const outPath = path.join(outRoot, channel, `${slug}.md`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, frontmatter + converted.md.replace(/\s+$/, '') + '\n', 'utf8')
  report.posts++
}

if (report.posts !== 80) throw new Error(`expected 80 written posts, got ${report.posts}`)
if (report.unmapped.length) throw new Error(`unmapped links: ${report.unmapped.length}`)

fs.writeFileSync(path.join(ROOT, 'scripts/import-report.json'), JSON.stringify(report, null, 2))
console.log(`imported ${report.posts} posts, ${report.quizzes} quizzes, ${report.decisions} decisions, ${report.links} links rewritten`)
