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

// Astro's dev server does not resolve public/ directory indexes; static hosts do.
// Keep course URLs clean in production and teach only the dev server the same rule.
function courseDirectoryIndex() {
  return {
    name: 'course-directory-index',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()
        const [pathname, query] = req.url.split('?')
        if (/\/learning\/[^/]+\/$/.test(pathname)) {
          req.url = `${pathname}index.html${query ? `?${query}` : ''}`
        }
        next()
      })
    },
  }
}

const BASE = normalizeBase(process.env.BASE_PATH || '/awesome-architecture-blog/')
const SITE = normalizeSite(process.env.SITE_URL)

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  vite: { plugins: [courseDirectoryIndex()] },
  integrations: [
    sitemap({
      customPages: [
        new URL(`${BASE}learning/litellm/`, SITE).href,
        new URL(`${BASE}learning/llm2jev/`, SITE).href,
      ],
    }),
  ],
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins: [[remarkBaseLinks, { base: BASE }], remarkCjkStrong, remarkQuiz, remarkAsciiFigure],
      rehypePlugins: [rehypeTableWrap],
    }),
  },
})
