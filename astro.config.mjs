import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import remarkQuiz from './src/plugins/remark-quiz.mjs'
import remarkBaseLinks from './src/plugins/remark-base-links.mjs'
import remarkAsciiFigure from './src/plugins/remark-ascii-figure.mjs'
import remarkCjkStrong from './src/plugins/remark-cjk-strong.mjs'
import rehypeTableWrap from './src/plugins/rehype-table-wrap.mjs'

function normalizeBase(value) {
  const raw = (value ?? '').trim()
  if (!raw || raw === '/') return '/'
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`
}

function normalizeSite(value) {
  const raw = (value ?? '').trim()
  if (!raw) return 'https://penglonghuang.github.io'
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '')
  return `https://${raw.replace(/^\/+/, '').replace(/\/$/, '')}`
}

const BASE = normalizeBase(process.env.BASE_PATH || '/awesome-architecture-blog/')
const SITE = normalizeSite(process.env.SITE_URL)

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins: [[remarkBaseLinks, { base: BASE }], remarkCjkStrong, remarkQuiz, remarkAsciiFigure],
      rehypePlugins: [rehypeTableWrap],
    }),
  },
})
