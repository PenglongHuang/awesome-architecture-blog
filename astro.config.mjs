import { defineConfig } from 'astro/config'
import { unified } from '@astrojs/markdown-remark'
import sitemap from '@astrojs/sitemap'
import remarkQuiz from './src/plugins/remark-quiz.mjs'
import remarkBaseLinks from './src/plugins/remark-base-links.mjs'
import remarkAsciiFigure from './src/plugins/remark-ascii-figure.mjs'

const BASE = '/awesome-architecture-blog/'
const SITE = 'https://penglonghuang.github.io'

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      remarkPlugins: [[remarkBaseLinks, { base: BASE }], remarkQuiz, remarkAsciiFigure],
    }),
  },
})
