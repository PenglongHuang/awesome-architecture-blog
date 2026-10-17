# Awesome Architecture 博客站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `awesome-architecture` 的 80 篇中文内容迁移成一个纸本杂志风格的 Astro 系列博客,部署到 `https://penglonghuang.github.io/awesome-architecture-blog/`。

**Architecture:** 单一 Astro 应用,Content Collections 存 80 篇 Markdown;一个可重跑的导入脚本负责从源仓库搬运并改写链接/组件;remark 插件在构建期把 `quiz`/`decision` 代码块渲染成静态交互标记 + 原生 JS;频道/系列/文章三层静态路由;Pagefind 做站内搜索;GitHub Actions 构建并部署到 Pages。

**Tech Stack:** Astro 7.4 + TypeScript strict + Zod 4(经 `astro/zod`)+ Pagefind 1.5 + Vitest 5 + Playwright 1.64 + pnpm + Node 22。

---

## 实现说明(与 spec 的两处等价偏差)

1. **Quiz 标记用围栏代码块而非 `:::quiz`**:` ```quiz {json} ``` ` 不会被行内 Markdown 解析破坏(属性里可能含 `*`/`_`),remark 插件识别 `code.lang === 'quiz'` 后替换为静态 HTML。行为与 spec 一致。
2. **路由文件用 `[slug].astro` 而非 `[...path].astro`**:每个频道内系列页与文章页都只有一段路径,由同一个 `getStaticPaths` 产出并分支渲染,天然避免路由优先级冲突,URL 规则完全不变。
3. Astro 组件无法在 `.md` 中直接使用,因此 Quiz 的标记由 `src/lib/quiz-html.mjs` 单一渲染函数产出,不额外维护一个重复的 `.astro` 组件。

---

## 文件结构

```
awesome-architecture-blog/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── scripts/
│   ├── import-content.mjs
│   ├── validate-content.mjs
│   ├── slugs.json
│   └── lib/
│       ├── relative.mjs
│       ├── links.mjs
│       ├── frontmatter.mjs
│       └── dates.mjs
├── src/
│   ├── content.config.ts
│   ├── data/series.json
│   ├── data/series.ts
│   ├── lib/{urls,posts,routes,reading-time}.ts
│   ├── plugins/{remark-quiz,remark-base-links}.mjs
│   ├── content/posts/{tutorial,templates,cases}/
│   ├── layouts/BaseLayout.astro
│   ├── components/
│   │   ├── Masthead.astro  Footer.astro
│   │   ├── SeriesCard.astro  PostList.astro
│   │   ├── Toc.astro  PostNav.astro
│   │   ├── Comments.astro
│   │   └── pages/{SeriesPage,PostPage}.astro
│   ├── scripts/quiz.ts
│   ├── pages/
│   │   ├── index.astro  about.astro  search.astro  404.astro  rss.xml.ts
│   │   ├── tutorial/{index,[slug]}.astro
│   │   ├── templates/{index,[slug]}.astro
│   │   └── cases/{index,[slug]}.astro
│   └── styles/{tokens.css,global.css}
├── public/{.nojekyll,favicon.svg}
├── tests/unit/*.test.mjs
├── tests/e2e/smoke.spec.ts
└── .github/workflows/{ci,deploy}.yml
```

---

## Task 1: 脚手架与基础配置

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `public/.nojekyll`, `src/pages/index.astro`

- [ ] **Step 1: 写 `package.json`**

```json
{
  "name": "awesome-architecture-blog",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.3.4",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist --output-subdir _pagefind",
    "preview": "astro preview",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "import": "node scripts/import-content.mjs",
    "validate": "node scripts/validate-content.mjs"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.19",
    "@astrojs/sitemap": "^3.7.4",
    "@fontsource/noto-serif-sc": "^5.3.1",
    "astro": "^7.4.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.64.1",
    "gray-matter": "^4.0.3",
    "pagefind": "^1.5.2",
    "typescript": "^5.9.3",
    "unist-util-visit": "^5.0.0",
    "vitest": "^5.0.5"
  }
}
```

- [ ] **Step 2: 写 `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config'
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
    remarkPlugins: [remarkBaseLinks, remarkQuiz, remarkAsciiFigure],
  },
})
```

- [ ] **Step 3: 写 `tsconfig.json` 与 `.gitignore`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": { "resolveJsonModule": true },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

```gitignore
node_modules/
dist/
.astro/
.superpowers/
test-results/
playwright-report/
scripts/import-report.json
.env
```

- [ ] **Step 4: 写占位首页与 `.nojekyll`**

`src/pages/index.astro`:

```astro
---
const title = '架构图谱'
---
<html lang="zh-Hans"><head><title>{title}</title></head><body><h1>{title}</h1></body></html>
```

`public/.nojekyll` 为空文件。

- [ ] **Step 5: 安装依赖并验证构建**

Run: `pnpm install && pnpm build`
Expected: 构建成功,`dist/index.html` 存在。首次构建会因为插件文件不存在而失败 —— 先创建两个空插件:

`src/plugins/remark-quiz.mjs`:

```js
export default function remarkQuiz() {
  return () => {}
}
```

`src/plugins/remark-base-links.mjs`:

```js
export default function remarkBaseLinks() {
  return () => {}
}
```

`src/plugins/remark-ascii-figure.mjs`:

```js
export default function remarkAsciiFigure() {
  return () => {}
}
```

`syntaxHighlight: false` 是刻意的:关掉 Shiki 的内联配色,代码块配色完全交给纸本 CSS 控制。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: scaffold Astro project"
```

---

## Task 2: 设计令牌、全局样式与基础版式

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/Masthead.astro`, `src/components/Footer.astro`, `src/scripts/quiz.ts`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 写 `src/styles/tokens.css`**

```css
:root {
  --paper: #f6f2ea;
  --ink: #1a1814;
  --muted: #6b6459;
  --accent: #b03a2e;
  --rule: #d8d0c0;
  --code-bg: #efe9dd;
  --soft: #f0e8d8;

  --font-serif: "Noto Serif SC", "Songti SC", "Source Han Serif SC", Georgia, serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  --measure: 38em;

  --step-display: 52px;
  --step-title: 40px;
  --step-h2: 21px;
  --step-body: 16px;
}

[data-theme="dark"] {
  --paper: #161513;
  --ink: #e7e0d3;
  --muted: #9a9284;
  --accent: #d96a56;
  --rule: #2e2a24;
  --code-bg: #1f1d19;
  --soft: #221f1a;
}
```

- [ ] **Step 2: 写 `src/styles/global.css`**

```css
@import '@fontsource/noto-serif-sc/400.css';
@import '@fontsource/noto-serif-sc/600.css';
@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }

html { background: var(--paper); color: var(--ink); }

body {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--step-body);
  line-height: 1.95;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
a:hover { color: var(--accent); }
img { max-width: 100%; height: auto; }

.wrap { max-width: 980px; margin: 0 auto; padding: 0 44px; }

.masthead { display: flex; align-items: baseline; justify-content: space-between; padding: 26px 0 14px; border-bottom: 1px solid var(--ink); }
.masthead__brand { font-size: 19px; letter-spacing: .34em; text-decoration: none; }
.masthead__nav { display: flex; gap: 26px; font-size: 13px; letter-spacing: .08em; }
.masthead__nav a { color: var(--muted); text-decoration: none; }
.masthead__nav a[aria-current="page"], .masthead__nav a:hover { color: var(--accent); }
.subrule { border-bottom: 1px solid var(--ink); opacity: .35; margin-top: 3px; }

.kicker { font-size: 10px; letter-spacing: .28em; color: var(--accent); text-transform: uppercase; }

.hero { padding: 54px 0 44px; border-bottom: 1px solid var(--rule); }
.hero h1 { font-size: var(--step-display); line-height: 1.18; font-weight: 400; letter-spacing: -.01em; margin: 14px 0 16px; }
.hero p { font-size: 16px; line-height: 1.85; color: var(--muted); max-width: 620px; margin: 0 0 18px; }
.hero .meta { font-size: 12px; color: var(--muted); letter-spacing: .06em; }
.cta { display: inline-block; margin-top: 22px; font-size: 13px; letter-spacing: .12em; color: var(--accent); border-bottom: 1px solid var(--accent); padding-bottom: 3px; text-decoration: none; }

.section { padding: 38px 0; border-bottom: 1px solid var(--rule); }
.section__head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 24px; }
.section__head b { font-size: 15px; font-weight: 400; letter-spacing: .1em; }
.section__head i { font-style: normal; font-size: 11px; color: var(--muted); letter-spacing: .14em; }

.series-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--rule); border: 1px solid var(--rule); }
.series-card { background: var(--paper); padding: 20px 18px 18px; text-decoration: none; color: inherit; transition: background .15s; }
.series-card:hover { background: var(--soft); color: inherit; }
.series-card__n { font-size: 11px; color: var(--accent); letter-spacing: .14em; }
.series-card h3 { font-size: 17px; font-weight: 400; margin: 8px 0 6px; }
.series-card p { font-size: 12px; line-height: 1.7; color: var(--muted); margin: 0; }
.series-card__count { margin-top: 12px; font-size: 10px; letter-spacing: .12em; color: var(--muted); }

.post-list { list-style: none; margin: 0; padding: 0; }
.post-list li { display: flex; gap: 22px; align-items: baseline; padding: 15px 0; border-bottom: 1px solid var(--rule); }
.post-list__date { font-size: 11px; color: var(--muted); letter-spacing: .08em; width: 86px; flex: none; }
.post-list__title { font-size: 17px; }
.post-list__series { margin-left: auto; font-size: 11px; color: var(--muted); letter-spacing: .1em; white-space: nowrap; }

/* article */
.article { display: grid; grid-template-columns: 1fr 210px; gap: 52px; padding: 40px 0; }
.crumb { font-size: 11px; letter-spacing: .12em; color: var(--muted); }
.crumb b { color: var(--accent); font-weight: 400; }
.article h1 { font-size: var(--step-title); line-height: 1.25; font-weight: 400; margin: 12px 0 14px; }
.dek { font-size: 16px; line-height: 1.9; color: var(--muted); margin: 0 0 18px; }
.article__meta { font-size: 11px; color: var(--muted); letter-spacing: .08em; padding-bottom: 20px; border-bottom: 1px solid var(--ink); }

.prose { font-size: 15.5px; line-height: 1.95; }
.prose h2 { font-size: var(--step-h2); font-weight: 400; margin: 32px 0 12px; display: flex; align-items: baseline; gap: 10px; }
.prose h2::before { content: ""; width: 9px; height: 9px; background: var(--accent); display: inline-block; flex: none; }
.prose h3 { font-size: 17px; font-weight: 600; margin: 26px 0 10px; }
.prose p { margin: 0 0 16px; }
.prose ul, .prose ol { padding-left: 1.4em; }
.prose li { margin: 6px 0; }
.prose blockquote { border-left: 2px solid var(--accent); padding: 2px 0 2px 16px; color: var(--muted); font-style: italic; margin: 22px 0; }
.prose table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 20px 0; }
.prose th, .prose td { border-bottom: 1px solid var(--rule); padding: 8px 10px; text-align: left; vertical-align: top; }
.prose th { font-weight: 600; }
.prose code { font-family: var(--font-mono); font-size: .88em; background: var(--code-bg); padding: .1em .35em; }
.prose pre { background: var(--code-bg); padding: 16px 18px; overflow-x: auto; font-size: 12.5px; line-height: 1.55; }
.prose pre code { background: none; padding: 0; }
.prose figure { margin: 24px 0; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 16px 0 14px; }
.prose figure figcaption { font-size: 10px; letter-spacing: .16em; color: var(--accent); margin-bottom: 12px; }
.prose figure pre { background: transparent; padding: 0; }
.prose .ascii { overflow-x: auto; }

.toc { position: sticky; top: 24px; font-size: 11.5px; line-height: 1.9; color: var(--muted); border-left: 1px solid var(--rule); padding-left: 18px; }
.toc b { display: block; font-size: 10px; letter-spacing: .2em; color: var(--ink); font-weight: 400; margin-bottom: 10px; }
.toc a { color: var(--muted); text-decoration: none; }
.toc a:hover { color: var(--accent); }

/* quiz */
.quiz { border: 1px solid var(--ink); padding: 18px 20px; margin: 28px 0; background: var(--soft); }
.quiz__kicker { font-size: 10px; letter-spacing: .28em; color: var(--accent); margin: 0 0 8px; }
.quiz__q { font-size: 15px; margin: 0 0 14px; }
.quiz__opts { display: grid; gap: 7px; }
.quiz__opt { display: flex; gap: 10px; width: 100%; text-align: left; font: inherit; font-size: 13.5px; line-height: 1.7; padding: 8px 10px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.quiz__opt:hover { border-color: var(--accent); }
.quiz__opt.is-selected { border-color: var(--accent); }
.quiz__opt.is-correct { border-color: #2f7a4f; background: #e9f2ea; }
.quiz__opt.is-wrong { border-color: var(--accent); opacity: .65; }
[data-theme="dark"] .quiz__opt.is-correct { background: #1c2a20; }
.quiz__key { color: var(--accent); font-size: 11px; letter-spacing: .1em; padding-top: 2px; }
.quiz__actions { display: flex; gap: 12px; margin-top: 12px; }
.quiz__check, .quiz__reset { font: inherit; font-size: 12px; letter-spacing: .1em; color: var(--accent); background: none; border: 0; border-bottom: 1px solid var(--accent); padding: 2px 0; cursor: pointer; }
.quiz__feedback { font-size: 12px; color: var(--accent); margin: 12px 0 0; }
.quiz__expl { font-size: 13px; color: var(--muted); margin: 10px 0 0; line-height: 1.8; }

.decision { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 18px 0; margin: 28px 0; }
.decision__title { font-size: 16px; margin: 0 0 14px; }
.decision__cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.decision__cols h4 { font-size: 13px; letter-spacing: .08em; margin: 0 0 6px; color: var(--accent); font-weight: 400; }
.decision__cols p { font-size: 13.5px; color: var(--muted); margin: 0; line-height: 1.8; }
.decision__verdict { font-size: 13.5px; margin: 16px 0 0; }

.nav-pair { display: flex; justify-content: space-between; gap: 24px; padding: 26px 0; border-top: 1px solid var(--rule); font-size: 13px; }
.nav-pair a { text-decoration: none; }
.nav-pair small { display: block; font-size: 10px; letter-spacing: .16em; color: var(--muted); }

.site-footer { padding: 30px 0 46px; display: flex; justify-content: space-between; gap: 20px; font-size: 11px; color: var(--muted); letter-spacing: .08em; }
.site-footer a { color: var(--muted); }

.search-form { display: flex; gap: 12px; margin: 30px 0; }
.search-form input { flex: 1; font: inherit; font-size: 16px; padding: 10px 12px; background: var(--paper); color: var(--ink); border: 1px solid var(--ink); }
.search-form button { font: inherit; font-size: 13px; letter-spacing: .1em; padding: 10px 18px; background: var(--ink); color: var(--paper); border: 0; cursor: pointer; }
.search-hit { padding: 16px 0; border-bottom: 1px solid var(--rule); }
.search-hit h3 { font-size: 17px; font-weight: 400; margin: 0 0 6px; }
.search-hit p { font-size: 13px; color: var(--muted); margin: 0; }

@media (max-width: 900px) {
  .wrap { padding: 0 22px; }
  .article { grid-template-columns: 1fr; gap: 0; }
  .toc { position: static; border-left: 0; border-top: 1px solid var(--rule); padding: 14px 0 0; margin-bottom: 24px; }
  .series-grid { grid-template-columns: 1fr 1fr; }
  .hero h1 { font-size: 38px; }
  .decision__cols { grid-template-columns: 1fr; }
}

@media (max-width: 560px) {
  .series-grid { grid-template-columns: 1fr; }
  .post-list li { flex-wrap: wrap; gap: 4px 14px; }
  .post-list__series { margin-left: 0; }
  .site-footer { flex-direction: column; }
}
```

- [ ] **Step 3: 写 `BaseLayout.astro`**

先创建 `src/scripts/quiz.ts` 占位(Task 8 会替换):

```ts
export {}
```

然后写布局:

```astro
---
import '../styles/global.css'
import Masthead from '../components/Masthead.astro'
import Footer from '../components/Footer.astro'

interface Props { title: string; description?: string }
const { title, description = '专注架构思维的中文知识库:40 章教程、31 张架构地图、6 个案例。' } = Astro.props
const fullTitle = title === '架构图谱' ? title : `${title} · 架构图谱`
---
<!doctype html>
<html lang="zh-Hans">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{fullTitle}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />
    <link rel="icon" href={`${import.meta.env.BASE_URL}favicon.svg`} />
    <script is:inline>
      (() => {
        const stored = localStorage.getItem('theme');
        const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.dataset.theme = stored || (dark ? 'dark' : 'light');
      })();
    </script>
  </head>
  <body>
    <div class="wrap">
      <Masthead />
      <main><slot /></main>
      <Footer />
    </div>
    <script>
      import '../scripts/quiz'
    </script>
  </body>
</html>
```

- [ ] **Step 4: 写 `Masthead.astro`**

```astro
---
const base = import.meta.env.BASE_URL
const path = Astro.url.pathname
const items = [
  { href: `${base}tutorial/`, label: '教程', match: '/tutorial/' },
  { href: `${base}templates/`, label: '架构地图', match: '/templates/' },
  { href: `${base}cases/`, label: '案例', match: '/cases/' },
  { href: `${base}about/`, label: '关于', match: '/about/' },
  { href: `${base}search/`, label: '搜索', match: '/search/' },
]
---
<header class="masthead">
  <a class="masthead__brand" href={base}>架构图谱</a>
  <nav class="masthead__nav">
    {items.map((it) => (
      <a href={it.href} aria-current={path.includes(it.match) ? 'page' : undefined}>{it.label}</a>
    ))}
    <button id="theme-toggle" type="button" aria-label="切换深浅色" style="background:none;border:0;color:inherit;font:inherit;cursor:pointer">◐</button>
  </nav>
</header>
<div class="subrule"></div>
<script is:inline>
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange', { detail: next }));
  });
</script>
```

- [ ] **Step 5: 写 `Footer.astro`**

```astro
---
const base = import.meta.env.BASE_URL
---
<footer class="site-footer">
  <span>© 2026 Penglong Huang · 内容整理自 <a href="https://github.com/study8677/awesome-architecture">Awesome Architecture</a> · MIT</span>
  <span><a href={`${base}rss.xml`}>RSS</a> · <a href="https://github.com/PenglongHuang/awesome-architecture-blog">GitHub</a></span>
</footer>
```

- [ ] **Step 6: 首页临时使用布局并构建**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---
<BaseLayout title="架构图谱">
  <div class="hero"><h1>先看清系统,再动手写代码。</h1></div>
</BaseLayout>
```

Run: `pnpm build`
Expected: 成功。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add design tokens and base layout"
```

---

## Task 3: 系列分类数据与 URL 助手

**Files:**
- Create: `src/data/series.json`, `src/data/series.ts`, `src/lib/urls.ts`, `src/lib/posts.ts`

- [ ] **Step 1: 写 `src/data/series.json`(14 个系列)**

```json
[
  { "id": "foundations", "channel": "tutorial", "title": "入门篇", "description": "为什么先有架构思维,到读懂、画好一张架构图。", "order": 1, "match": "^tutorial/0[1-9]-" },
  { "id": "advanced", "channel": "tutorial", "title": "进阶篇", "description": "分布式硬道理、数据一致性、韧性、规模化与拆分。", "order": 2, "match": "^tutorial/1[0-7]-" },
  { "id": "practice", "channel": "tutorial", "title": "实战篇", "description": "拆解陌生系统、完整设计演练、演进剧本与迁移。", "order": 3, "match": "^tutorial/(18|19|20|21|22)-" },
  { "id": "ai-collaboration", "channel": "tutorial", "title": "AI 协同篇", "description": "约束怎么写给 AI,AI 产出默认缺什么。", "order": 4, "match": "^tutorial/2[3-6]-" },
  { "id": "stack-selection", "channel": "tutorial", "title": "技术栈选型篇", "description": "语言、数据库、缓存、API、云原生、可观测性怎么选。", "order": 5, "match": "^tutorial/(2[7-9]|3[0-4])-" },
  { "id": "ai-native-org", "channel": "tutorial", "title": "AI 原生组织篇", "description": "超级个体、共享上下文、工作流、责任与治理。", "order": 6, "match": "^tutorial/(3[5-9]|40)-" },
  { "id": "model-training", "channel": "tutorial", "title": "基础模型训练决策专题", "description": "从目标、任务、数据和学习信号出发,判断 SFT、DPO、PPO、GRPO 的适用条件。", "order": 7, "match": "^tutorial/T01-" },
  { "id": "appendix", "channel": "tutorial", "title": "附录", "description": "架构术语表与演进触发信号。", "order": 8, "match": "^tutorial/(术语表|演进触发信号)\\.md$", "explicitOrder": ["tutorial/术语表.md", "tutorial/演进触发信号.md"] },
  { "id": "classic-systems", "channel": "templates", "title": "经典 / 通用系统", "description": "电商、支付、搜索、抢票等 16 张真实系统地图。", "order": 9, "match": "^templates/(ai-chat-product|browser-extension|standard-web-app|mobile-app|ecommerce-platform|social-feed|video-streaming|realtime-chat|url-shortener|payment-system|search-engine|ride-hailing|collaborative-doc|cloud-storage|notification-system|online-ticketing)/README\\.md$", "explicitOrder": ["templates/ai-chat-product/README.md","templates/browser-extension/README.md","templates/standard-web-app/README.md","templates/mobile-app/README.md","templates/ecommerce-platform/README.md","templates/social-feed/README.md","templates/video-streaming/README.md","templates/realtime-chat/README.md","templates/url-shortener/README.md","templates/payment-system/README.md","templates/search-engine/README.md","templates/ride-hailing/README.md","templates/collaborative-doc/README.md","templates/cloud-storage/README.md","templates/notification-system/README.md","templates/online-ticketing/README.md"] },
  { "id": "ai-native-systems", "channel": "templates", "title": "AI 原生系统", "description": "AI 网关、RAG、Agent 平台、推理服务、向量数据库。", "order": 10, "match": "^templates/(ai-gateway|rag-knowledge-base|ai-agent-platform|inference-serving|vector-database)/README\\.md$", "explicitOrder": ["templates/ai-gateway/README.md","templates/rag-knowledge-base/README.md","templates/ai-agent-platform/README.md","templates/inference-serving/README.md","templates/vector-database/README.md"] },
  { "id": "coding-agents", "channel": "templates", "title": "AI 编码 / 自治 Agent", "description": "Claude Code、Codex、OpenClaw、Hermes 的真实架构。", "order": 11, "match": "^templates/(claude-code|codex|openclaw|hermes)/README\\.md$", "explicitOrder": ["templates/claude-code/README.md","templates/codex/README.md","templates/openclaw/README.md","templates/hermes/README.md"] },
  { "id": "system-prompts", "channel": "templates", "title": "系统提示词架构", "description": "分层 Agent OS、决策树路由、Skills 外化与运行时注入。", "order": 12, "match": "^templates/system-prompt-architecture/README\\.md$", "explicitOrder": ["templates/system-prompt-architecture/README.md"] },
  { "id": "industrial-embedded", "channel": "templates", "title": "工业 / 嵌入式", "description": "固件、IoT、SCADA、车载 E/E、机器人系统。", "order": 13, "match": "^templates/(embedded-device|iot-platform|industrial-edge|automotive-ee|robotics)/README\\.md$", "explicitOrder": ["templates/embedded-device/README.md","templates/iot-platform/README.md","templates/industrial-edge/README.md","templates/automotive-ee/README.md","templates/robotics/README.md"] },
  { "id": "cases", "channel": "cases", "title": "案例篇", "description": "把架构从答案写成推理过程的 6 个端到端案例。", "order": 14, "match": "^cases/[^/]+/README\\.md$", "explicitOrder": ["cases/stararena-ticketing/README.md","cases/patchdesk-saas/README.md","cases/documind-rag/README.md","cases/syncroom-collaboration/README.md","cases/feedstream-content/README.md","cases/codepilot-agent/README.md"] }
]
```

- [ ] **Step 2: 写 `src/data/series.ts`**

```ts
import raw from './series.json'

export type Channel = 'tutorial' | 'templates' | 'cases'

export interface SeriesDef {
  id: string
  channel: Channel
  title: string
  description: string
  order: number
  match: string
  explicitOrder?: string[]
}

export const SERIES = raw as SeriesDef[]
export const SERIES_IDS = SERIES.map((s) => s.id) as [string, ...string[]]

export const CHANNELS: Record<Channel, { title: string; description: string; href: string }> = {
  tutorial: { title: '教程', description: '像架构师一样思考的 43 篇教程。', href: '/tutorial/' },
  templates: { title: '架构地图', description: '31 张真实系统的架构地图。', href: '/templates/' },
  cases: { title: '案例', description: '6 个端到端的架构推演。', href: '/cases/' },
}
```

- [ ] **Step 3: 写 `src/lib/urls.ts`**

```ts
const BASE = import.meta.env.BASE_URL

export function href(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  return `${BASE}${path.replace(/^\//, '')}`
}
```

- [ ] **Step 4: 写 `src/lib/posts.ts`**

```ts
import type { CollectionEntry } from 'astro:content'
import { SERIES, type Channel } from '../data/series'
import { href } from './urls'

export type Post = CollectionEntry<'posts'>

export function getSeries(id: string) {
  return SERIES.find((s) => s.id === id)!
}

export function postSlug(post: Post): string {
  return post.id.split('/').pop()!
}

const CHANNEL_OF_KIND = { tutorial: 'tutorial', template: 'templates', case: 'cases' } as const

export function postChannel(post: Post): Channel {
  return CHANNEL_OF_KIND[post.data.kind]
}

export function postHref(post: Post): string {
  return href(`/${postChannel(post)}/${postSlug(post)}/`)
}

export function seriesHref(seriesId: string): string {
  const s = getSeries(seriesId)
  return s.channel === 'cases' ? href('/cases/') : href(`/${s.channel}/${s.id}/`)
}

export function sortByOrder(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => a.data.order - b.data.order)
}

export function sortByDateDesc(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => +b.data.pubDate - +a.data.pubDate)
}

export function postsInSeries(posts: Post[], seriesId: string): Post[] {
  return sortByOrder(posts.filter((p) => p.data.series === seriesId))
}
```

- [ ] **Step 5: 构建验证并提交**

Run: `pnpm build`
Expected: 成功。

```bash
git add -A
git commit -m "feat: add series taxonomy and URL helpers"
```

---

## Task 4: 链接解析纯函数(TDD)

**Files:**
- Create: `scripts/lib/relative.mjs`, `scripts/lib/links.mjs`
- Test: `tests/unit/relative.test.mjs`, `tests/unit/links.test.mjs`

- [ ] **Step 1: 写失败的测试**

`tests/unit/relative.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { resolveRelative } from '../../scripts/lib/relative.mjs'

describe('resolveRelative', () => {
  it('resolves a same-directory link', () => {
    expect(resolveRelative('tutorial/01-a.md', '02-b.md')).toBe('tutorial/02-b.md')
  })
  it('resolves a parent-directory link', () => {
    expect(resolveRelative('tutorial/01-a.md', '../templates/x/README.md')).toBe('templates/x/README.md')
  })
  it('normalizes a ./ prefix', () => {
    expect(resolveRelative('cases/x/README.md', './y.md')).toBe('cases/x/y.md')
  })
})
```

`tests/unit/links.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { rewriteLink } from '../../scripts/lib/links.mjs'

const map = {
  'tutorial/02-b.md': '/tutorial/two/',
  'templates/x/README.md': '/templates/x/',
}

describe('rewriteLink', () => {
  it('rewrites a mapped same-directory link', () => {
    expect(rewriteLink({ link: '02-b.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/tutorial/two/' })
  })
  it('rewrites a mapped relative link', () => {
    expect(rewriteLink({ link: '../templates/x/README.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/templates/x/' })
  })
  it('preserves anchors', () => {
    expect(rewriteLink({ link: '02-b.md#section', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/tutorial/two/#section' })
  })
  it('leaves external links untouched', () => {
    expect(rewriteLink({ link: 'https://example.com/a.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: 'https://example.com/a.md' })
  })
  it('leaves non-md links untouched', () => {
    expect(rewriteLink({ link: './image.png', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: './image.png' })
  })
  it('fails loudly on unmapped targets', () => {
    const r = rewriteLink({ link: 'nope.md', fromFile: 'tutorial/01-a.md', map })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('tutorial/nope.md')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test`
Expected: FAIL(`Failed to resolve import .../relative.mjs`)。

- [ ] **Step 3: 实现 `scripts/lib/relative.mjs`**

```js
import path from 'node:path'

export function resolveRelative(fromFile, target) {
  const dir = path.posix.dirname(fromFile)
  return path.posix.normalize(path.posix.join(dir, target))
}
```

- [ ] **Step 4: 实现 `scripts/lib/links.mjs`**

```js
import { resolveRelative } from './relative.mjs'

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

export function rewriteLink({ link, fromFile, map }) {
  const trimmed = link.trim()
  if (!trimmed) return { ok: true, href: link }
  if (EXTERNAL.test(trimmed)) return { ok: true, href: link }

  const hashIndex = trimmed.indexOf('#')
  const anchor = hashIndex >= 0 ? trimmed.slice(hashIndex) : ''
  const withoutAnchor = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed
  const pathPart = withoutAnchor.split('?')[0]

  if (!pathPart.endsWith('.md')) return { ok: true, href: link }

  const resolved = resolveRelative(fromFile, pathPart)
  const href = map[resolved]
  if (href === undefined) {
    return { ok: false, reason: `unmapped link target: ${resolved}`, href: link }
  }
  return { ok: true, href: href + anchor }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add relative link resolution and rewriting"
```

---

## Task 5: 标题、导语与组件解析(TDD)

**Files:**
- Create: `scripts/lib/frontmatter.mjs`
- Test: `tests/unit/frontmatter.test.mjs`

- [ ] **Step 1: 写失败的测试**

```js
import { describe, it, expect } from 'vitest'
import {
  extractTitle, stripTitle, extractDescription,
  parseArrayLiteral, convertComponents,
} from '../../scripts/lib/frontmatter.mjs'

const sample = `# 01 · 测试标题

> 这是**导语**,带一个[链接](02-b.md)。

---

正文。

<Quiz
  question="选哪个?"
  :options="['A 选项', 'B 选项', 'C 选项']"
  :answer="1"
  explanation="因为 B。"
/>

<DecisionCard title="同步还是事件?" a="同步" aDesc="直接等" b="事件" bDesc="广播" verdict="简单就同步。" />
`

describe('frontmatter', () => {
  it('extracts and strips the H1', () => {
    expect(extractTitle(sample)).toBe('01 · 测试标题')
    expect(stripTitle(sample).startsWith('> 这是')).toBe(true)
  })
  it('extracts a cleaned description', () => {
    expect(extractDescription(sample)).toBe('这是导语,带一个链接。')
  })
  it('parses a JS string array literal', () => {
    expect(parseArrayLiteral("['a', 'b\\'c', \"d\"]")).toEqual(['a', "b'c", 'd'])
  })
  it('converts quiz and decision components to fenced blocks', () => {
    const { md, quizzes, decisions } = convertComponents(sample)
    expect(quizzes).toBe(1)
    expect(decisions).toBe(1)
    expect(md).toContain('```quiz')
    expect(md).toContain('"answer": 1')
    expect(md).toContain('```decision')
    expect(md).not.toContain('<Quiz')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL。

- [ ] **Step 3: 实现 `scripts/lib/frontmatter.mjs`**

```js
export function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m)
  if (!m) throw new Error('missing H1')
  return m[1].trim()
}

export function stripTitle(md) {
  return md.replace(/^#\s+.+\r?\n(\r?\n)?/, '')
}

function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

export function extractDescription(md) {
  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length && !/^#\s+/.test(lines[i])) i++
  i++
  while (i < lines.length && lines[i].trim() === '') i++

  const quote = []
  while (i < lines.length && /^>\s?/.test(lines[i])) {
    quote.push(lines[i].replace(/^>\s?/, ''))
    i++
  }
  if (quote.length) {
    const text = cleanInline(quote.join(' '))
    if (text) return text.slice(0, 300)
  }

  while (i < lines.length && lines[i].trim() === '') i++
  const para = []
  while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s/.test(lines[i])) {
    para.push(lines[i])
    i++
  }
  const text = cleanInline(para.join(' '))
  if (!text) throw new Error('missing description')
  return text.slice(0, 300)
}

export function parseArrayLiteral(src) {
  const s = src.trim()
  if (!s.startsWith('[') || !s.endsWith(']')) throw new Error(`not an array literal: ${s}`)
  const inner = s.slice(1, -1)
  const out = []
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && (inner[i] === ',' || /\s/.test(inner[i]))) i++
    if (i >= inner.length) break
    const q = inner[i]
    if (q !== "'" && q !== '"') throw new Error(`only string arrays are supported: ${s}`)
    i++
    let buf = ''
    let closed = false
    while (i < inner.length) {
      const c = inner[i]
      if (c === '\\') { buf += inner[i + 1]; i += 2; continue }
      if (c === q) { i++; closed = true; break }
      buf += c
      i++
    }
    if (!closed) throw new Error(`unterminated string in array: ${s}`)
    out.push(buf)
  }
  return out
}

function parseAttributes(raw) {
  const attrs = {}
  const re = /(:?)([A-Za-z][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
  let m
  while ((m = re.exec(raw))) {
    const bound = m[1] === ':'
    const quote = m[3][0]
    const value = m[3].slice(1, -1).replace(/\\(.)/g, '$1')
    attrs[m[2]] = { bound, value }
  }
  return attrs
}

export function convertComponents(md) {
  let quizzes = 0
  let decisions = 0

  let out = md.replace(/<Quiz\b([\s\S]*?)\/>/g, (_, raw) => {
    const a = parseAttributes(raw)
    if (!a.question || !a.options || !a.answer) throw new Error('Quiz missing question/options/answer')
    const quiz = {
      question: a.question.value,
      options: parseArrayLiteral(a.options.value),
      answer: Number(a.answer.value),
      explanation: a.explanation?.value ?? '',
    }
    if (!Number.isInteger(quiz.answer) || quiz.answer < 0 || quiz.answer >= quiz.options.length) {
      throw new Error('Quiz answer out of range')
    }
    quizzes++
    return ['```quiz', JSON.stringify(quiz), '```'].join('\n')
  })

  out = out.replace(/<DecisionCard\b([\s\S]*?)\/>/g, (_, raw) => {
    const a = parseAttributes(raw)
    const card = {
      title: a.title?.value ?? '',
      a: a.a?.value ?? '',
      aDesc: a.aDesc?.value ?? '',
      b: a.b?.value ?? '',
      bDesc: a.bDesc?.value ?? '',
      verdict: a.verdict?.value ?? '',
    }
    decisions++
    return ['```decision', JSON.stringify(card), '```'].join('\n')
  })

  return { md: out, quizzes, decisions }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add frontmatter and component parsing"
```

---

## Task 6: 时间线与教程 slug 表(TDD)

**Files:**
- Create: `scripts/lib/dates.mjs`, `scripts/slugs.json`
- Test: `tests/unit/dates.test.mjs`

- [ ] **Step 1: 写失败的测试**

```js
import { describe, it, expect } from 'vitest'
import { dateForIndex } from '../../scripts/lib/dates.mjs'

describe('dateForIndex', () => {
  it('starts on Tuesday 2026-01-06', () => expect(dateForIndex(1)).toBe('2026-01-06'))
  it('puts the second post on Friday', () => expect(dateForIndex(2)).toBe('2026-01-09'))
  it('ends the tutorial on 2026-06-02', () => expect(dateForIndex(43)).toBe('2026-06-02'))
  it('starts templates on 2026-06-05', () => expect(dateForIndex(44)).toBe('2026-06-05'))
  it('ends templates on 2026-09-18', () => expect(dateForIndex(74)).toBe('2026-09-18'))
  it('starts cases on 2026-09-22', () => expect(dateForIndex(75)).toBe('2026-09-22'))
  it('ends cases on 2026-10-09', () => expect(dateForIndex(80)).toBe('2026-10-09'))
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test`
Expected: FAIL。

- [ ] **Step 3: 实现 `scripts/lib/dates.mjs`**

```js
const START = Date.UTC(2026, 0, 6) // 2026-01-06 Tuesday
const DAY = 86400000

export function dateForIndex(index) {
  if (!Number.isInteger(index) || index < 1) throw new Error('index must be a positive integer')
  const w = Math.floor((index - 1) / 2)
  const offset = w * 7 + ((index - 1) % 2 === 1 ? 3 : 0)
  return new Date(START + offset * DAY).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: 写 `scripts/slugs.json`(43 条教程映射)**

键为源仓库相对路径,值见 spec 3.3。

```json
{
  "tutorial/01-为什么先有架构思维.md": "why-architecture-first",
  "tutorial/02-架构师的思考框架.md": "architects-thinking-framework",
  "tutorial/03-读懂与画好架构图.md": "reading-and-drawing-diagrams",
  "tutorial/04-十大核心架构模式.md": "ten-core-patterns",
  "tutorial/05-数据与状态.md": "data-and-state",
  "tutorial/06-质量属性与取舍.md": "quality-attributes-and-tradeoffs",
  "tutorial/07-从0到1设计一个系统.md": "designing-from-zero-to-one",
  "tutorial/08-架构决策记录与演进.md": "adr-and-evolution",
  "tutorial/09-架构品味.md": "architectural-taste",
  "tutorial/10-分布式系统的硬道理.md": "hard-truths-of-distributed-systems",
  "tutorial/11-数据一致性工程.md": "data-consistency-engineering",
  "tutorial/12-为失败而设计.md": "designing-for-failure",
  "tutorial/13-规模化的力学.md": "mechanics-of-scale",
  "tutorial/14-演进与拆分大型系统.md": "evolving-and-splitting-large-systems",
  "tutorial/15-组织即架构.md": "organization-as-architecture",
  "tutorial/16-安全与多租户架构.md": "security-and-multi-tenancy",
  "tutorial/17-大模型时代的架构判断.md": "architecture-judgment-in-llm-era",
  "tutorial/18-读地图用框架拆解陌生系统.md": "deconstructing-unfamiliar-systems",
  "tutorial/19-完整设计演练中等复杂度系统.md": "full-design-walkthrough",
  "tutorial/20-演进剧本MVP到规模化.md": "evolution-playbook-mvp-to-scale",
  "tutorial/21-拆分与迁移实战.md": "splitting-and-migration-in-practice",
  "tutorial/22-AI原生系统设计.md": "ai-native-system-design",
  "tutorial/23-规格即架构约束怎么写给AI.md": "spec-as-architecture",
  "tutorial/24-审查清单AI产出默认缺什么.md": "review-checklist-for-ai-output",
  "tutorial/25-评测驱动把够好写进架构.md": "eval-driven-architecture",
  "tutorial/26-协作决策树何时vibe何时spec-first.md": "when-to-vibe-when-to-spec",
  "tutorial/27-编程语言与后端框架选型.md": "languages-and-backend-frameworks",
  "tutorial/28-数据库与存储选型.md": "databases-and-storage",
  "tutorial/29-缓存消息队列与事件系统选型.md": "cache-queues-and-events",
  "tutorial/30-API与服务通信选型.md": "apis-and-service-communication",
  "tutorial/31-云原生与部署平台选型.md": "cloud-native-and-deployment",
  "tutorial/32-可观测性与可靠性技术栈选型.md": "observability-and-reliability",
  "tutorial/33-AI基础设施技术栈选型.md": "ai-infrastructure",
  "tutorial/34-技术选型决策树.md": "technology-selection-decision-tree",
  "tutorial/35-AI原生组织架构.md": "ai-native-organization",
  "tutorial/36-超级个体与超级团队.md": "super-individuals-and-teams",
  "tutorial/37-共享上下文架构.md": "shared-context-architecture",
  "tutorial/38-AI工作流架构.md": "ai-workflow-architecture",
  "tutorial/39-责任与治理架构.md": "responsibility-and-governance",
  "tutorial/40-AI原生组织演进路线.md": "ai-native-organization-roadmap",
  "tutorial/T01-训练方案不是算法排行榜先把决策分层.md": "training-plan-decision-layers",
  "tutorial/术语表.md": "glossary",
  "tutorial/演进触发信号.md": "evolution-trigger-signals"
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: add timeline generator and slug map"
```

---

## Task 7: 导入脚本

**Files:**
- Create: `scripts/import-content.mjs`
- Output: `src/content/posts/**`, `scripts/import-report.json`

- [ ] **Step 1: 写 `scripts/import-content.mjs`**

```js
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
```

- [ ] **Step 2: 运行导入**

Run: `pnpm import`
Expected: `imported 80 posts, 115 quizzes, 1 decisions, ... links rewritten`。

如果报错,按错误里的文件与链接修 `scripts/slugs.json` 或映射表 —— **不要改成静默跳过**。

- [ ] **Step 3: 幂等性检查**

Run: `pnpm import && git status --short src/content`
Expected: 第二次运行后没有新的 diff(首次运行后先 `git add` 再跑第二次对比)。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: import 80 posts from awesome-architecture"
```

---

## Task 8: Remark 插件与 Quiz 交互

**Files:**
- Create: `src/lib/quiz-html.mjs`, `src/plugins/remark-quiz.mjs`, `src/plugins/remark-base-links.mjs`, `src/scripts/quiz.ts`

- [ ] **Step 1: 写 `src/lib/quiz-html.mjs`**

```js
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function renderQuizHtml(q) {
  const opts = q.options
    .map((o, i) => `<button type="button" class="quiz__opt" data-index="${i}" aria-pressed="false"><span class="quiz__key">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span></button>`)
    .join('')
  return `<div class="quiz" data-answer="${q.answer}">
<p class="quiz__kicker">随堂</p>
<p class="quiz__q">${esc(q.question)}</p>
<div class="quiz__opts">${opts}</div>
<div class="quiz__actions"><button type="button" class="quiz__check">确认</button><button type="button" class="quiz__reset" hidden>重做</button></div>
<p class="quiz__feedback" role="status" hidden></p>
<p class="quiz__expl" hidden><strong>解析:</strong> ${esc(q.explanation)}</p>
</div>`
}

export function renderDecisionHtml(d) {
  return `<div class="decision">
<p class="decision__title">${esc(d.title)}</p>
<div class="decision__cols">
<div><h4>A · ${esc(d.a)}</h4><p>${esc(d.aDesc)}</p></div>
<div><h4>B · ${esc(d.b)}</h4><p>${esc(d.bDesc)}</p></div>
</div>
<p class="decision__verdict"><strong>怎么选:</strong> ${esc(d.verdict)}</p>
</div>`
}
```

- [ ] **Step 2: 写 `src/plugins/remark-quiz.mjs`**

```js
import { visit } from 'unist-util-visit'
import { renderQuizHtml, renderDecisionHtml } from '../lib/quiz-html.mjs'

export default function remarkQuiz() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.lang !== 'quiz' && node.lang !== 'decision') return
      const data = JSON.parse(node.value)
      const html = node.lang === 'quiz' ? renderQuizHtml(data) : renderDecisionHtml(data)
      parent.children[index] = { type: 'html', value: html }
    })
  }
}
```

- [ ] **Step 3: 写 `src/plugins/remark-base-links.mjs`**

```js
import { visit } from 'unist-util-visit'

export default function remarkBaseLinks({ base = '/' } = {}) {
  const prefix = base.replace(/\/$/, '')
  return (tree) => {
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('/') && !node.url.startsWith('//')) {
        node.url = prefix + node.url
      }
    })
  }
}
```

并在 `astro.config.mjs` 中把该插件改为带参数形式,同时注册 ASCII 图插件:

```js
markdown: {
  syntaxHighlight: false,
  remarkPlugins: [[remarkBaseLinks, { base: BASE }], remarkQuiz, remarkAsciiFigure],
},
```

- [ ] **Step 4: 写 `src/plugins/remark-ascii-figure.mjs`**

把含方块绘制符的代码块包装成带图注的插图,其他代码块原样保留。

```js
import { visit } from 'unist-util-visit'

const ASCII = /[─│┌┐└┘├┤┬┴┼▶◀▲▼→←]/
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function remarkAsciiFigure() {
  return (tree) => {
    let n = 0
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!ASCII.test(node.value)) return
      n++
      parent.children[index] = {
        type: 'html',
        value: `<figure><figcaption>图 ${n}</figcaption><pre class="ascii"><code>${esc(node.value)}</code></pre></figure>`,
      }
    })
  }
}
```

- [ ] **Step 5: 写 `src/scripts/quiz.ts`**

```ts
function setup(root: HTMLElement) {
  const answer = Number(root.dataset.answer)
  const opts = Array.from(root.querySelectorAll<HTMLButtonElement>('.quiz__opt'))
  const check = root.querySelector<HTMLButtonElement>('.quiz__check')!
  const reset = root.querySelector<HTMLButtonElement>('.quiz__reset')!
  const feedback = root.querySelector<HTMLParagraphElement>('.quiz__feedback')!
  const expl = root.querySelector<HTMLParagraphElement>('.quiz__expl')!
  let selected = -1
  let done = false

  opts.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (done) return
      selected = i
      opts.forEach((b, j) => {
        b.classList.toggle('is-selected', j === i)
        b.setAttribute('aria-pressed', String(j === i))
        if (j !== i) b.classList.remove('is-wrong')
      })
    })
  })

  check.addEventListener('click', () => {
    if (done) return
    if (selected < 0) {
      feedback.hidden = false
      feedback.textContent = '先选一个选项。'
      return
    }
    if (selected === answer) {
      done = true
      opts.forEach((b, i) => {
        b.disabled = true
        if (i === answer) b.classList.add('is-correct')
      })
      check.hidden = true
      reset.hidden = false
      feedback.hidden = false
      feedback.textContent = '答对了。'
      expl.hidden = false
    } else {
      opts[selected].classList.add('is-wrong')
      feedback.hidden = false
      feedback.textContent = '不对,再试一次。'
    }
  })

  reset.addEventListener('click', () => {
    done = false
    selected = -1
    opts.forEach((b) => {
      b.disabled = false
      b.classList.remove('is-selected', 'is-correct', 'is-wrong')
      b.setAttribute('aria-pressed', 'false')
    })
    check.hidden = false
    reset.hidden = true
    feedback.hidden = true
    expl.hidden = true
  })
}

export function initQuizzes(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.quiz[data-answer]').forEach(setup)
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initQuizzes())
  } else {
    initQuizzes()
  }
}
```

- [ ] **Step 6: 构建并检查渲染结果**

Run: `pnpm build && grep -c 'class="quiz"' dist/tutorial/why-architecture-first/index.html`
Expected: 输出至少 `1`。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: render quiz and decision blocks"
```

---

## Task 9: 内容校验脚本

**Files:**
- Create: `scripts/validate-content.mjs`

- [ ] **Step 1: 写脚本**

```js
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

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
const posts = walk(POSTS).map((file) => {
  const rel = path.relative(POSTS, file).split(path.sep).join('/')
  const parsed = matter(fs.readFileSync(file, 'utf8'))
  return { rel, data: parsed.data, body: parsed.content }
})

if (posts.length !== 80) errors.push(`expected 80 posts, got ${posts.length}`)

const bySeries = new Map()
const slugs = new Map()

for (const post of posts) {
  const d = post.data
  for (const key of ['title', 'description', 'series', 'order', 'pubDate', 'kind']) {
    if (d[key] === undefined || d[key] === null || d[key] === '') errors.push(`${post.rel}: missing ${key}`)
  }
  if (!SERIES_IDS.has(d.series)) errors.push(`${post.rel}: invalid series ${d.series}`)
  if (!(d.pubDate instanceof Date) || Number.isNaN(+d.pubDate)) errors.push(`${post.rel}: invalid pubDate`)
  if (!CHANNEL_OF_KIND[d.kind]) errors.push(`${post.rel}: invalid kind ${d.kind}`)

  const channel = CHANNEL_OF_KIND[d.kind] ?? 'unknown'
  const slug = post.rel.split('/').pop().replace(/\.md$/, '')
  const key = `${channel}/${slug}`
  if (slugs.has(key)) errors.push(`${post.rel}: duplicate slug ${key}`)
  slugs.set(key, true)

  if (!bySeries.has(d.series)) bySeries.set(d.series, [])
  bySeries.get(d.series).push(post)

  if (/\]\([^)]*\.md[^)]*\)/.test(post.body)) errors.push(`${post.rel}: unresolved .md link`)
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
  if (slugs.has(hub)) errors.push(`slug collides with series id: ${hub}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`validated ${posts.length} posts across ${bySeries.size} series`)
```

- [ ] **Step 2: 运行**

Run: `pnpm validate`
Expected: `validated 80 posts across 14 series`。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add content validation script"
```

---

## Task 10: 频道页与系列页

**Files:**
- Create: `src/components/SeriesCard.astro`, `src/components/PostList.astro`, `src/components/pages/SeriesPage.astro`, `src/lib/routes.ts`
- Create: `src/pages/tutorial/index.astro`, `src/pages/tutorial/[slug].astro`, `src/pages/templates/index.astro`, `src/pages/templates/[slug].astro`, `src/pages/cases/index.astro`, `src/pages/cases/[slug].astro`

- [ ] **Step 1: 写 `src/lib/routes.ts`**

```ts
import type { Post } from './posts'
import { SERIES, type Channel } from '../data/series'
import { postChannel, postSlug } from './posts'

export type ChannelPath =
  | { params: { slug: string }; props: { type: 'series'; seriesId: string } }
  | { params: { slug: string }; props: { type: 'post'; post: Post } }

export function channelStaticPaths(channel: Channel, posts: Post[]): ChannelPath[] {
  const seriesPaths = SERIES
    .filter((s) => s.channel === channel && !(channel === 'cases' && s.id === 'cases'))
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ params: { slug: s.id }, props: { type: 'series' as const, seriesId: s.id } }))

  const postPaths = posts
    .filter((p) => postChannel(p) === channel)
    .map((p) => ({ params: { slug: postSlug(p) }, props: { type: 'post' as const, post: p } }))

  return [...seriesPaths, ...postPaths]
}
```

- [ ] **Step 2: 写 `SeriesCard.astro` 与 `PostList.astro`**

```astro
---
import type { SeriesDef } from '../data/series'
import { seriesHref } from '../lib/posts'
interface Props { series: SeriesDef; count: number; index?: number }
const { series, count, index } = Astro.props
---
<a class="series-card" href={seriesHref(series.id)}>
  <div class="series-card__n">{String(index ?? series.order).padStart(2, '0')}</div>
  <h3>{series.title}</h3>
  <p>{series.description}</p>
  <div class="series-card__count">{count} 篇</div>
</a>
```

```astro
---
import type { Post } from '../lib/posts'
import { postHref, getSeries } from '../lib/posts'
interface Props { posts: Post[]; showSeries?: boolean }
const { posts, showSeries = true } = Astro.props
const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')} / ${String(d.getDate()).padStart(2, '0')}`
---
<ul class="post-list">
  {posts.map((p) => (
    <li>
      <span class="post-list__date">{fmt(p.data.pubDate)}</span>
      <a class="post-list__title" href={postHref(p)}>{p.data.title}</a>
      {showSeries && <span class="post-list__series">{getSeries(p.data.series).title}</span>}
    </li>
  ))}
</ul>
```

- [ ] **Step 3: 写 `SeriesPage.astro`**

```astro
---
import { getCollection } from 'astro:content'
import BaseLayout from '../../layouts/BaseLayout.astro'
import PostList from '../PostList.astro'
import { getSeries, postsInSeries } from '../../lib/posts'

interface Props { seriesId: string }
const { seriesId } = Astro.props
const series = getSeries(seriesId)
const all = await getCollection('posts')
const posts = postsInSeries(all, seriesId)
---
<BaseLayout title={series.title} description={series.description}>
  <div class="section">
    <p class="kicker">系列 · {posts.length} 篇</p>
    <h1 style="font-size:38px;font-weight:400;margin:10px 0 10px">{series.title}</h1>
    <p class="dek">{series.description}</p>
    <PostList posts={posts} showSeries={false} />
  </div>
</BaseLayout>
```

- [ ] **Step 4: 写三类页面**

`src/pages/tutorial/index.astro`:

```astro
---
import { getCollection } from 'astro:content'
import BaseLayout from '../../layouts/BaseLayout.astro'
import SeriesCard from '../../components/SeriesCard.astro'
import PostList from '../../components/PostList.astro'
import { SERIES } from '../../data/series'
import { sortByDateDesc, postChannel } from '../../lib/posts'

const all = await getCollection('posts')
const series = SERIES.filter((s) => s.channel === 'tutorial').sort((a, b) => a.order - b.order)
const recent = sortByDateDesc(all.filter((p) => postChannel(p) === 'tutorial')).slice(0, 6)
---
<BaseLayout title="教程">
  <div class="hero">
    <p class="kicker">教程 · 43 篇</p>
    <h1>像架构师一样思考</h1>
    <p>不教你任何语言或框架,只教你一种可迁移的判断力:在写代码之前,先把系统想清楚。</p>
  </div>
  <div class="section">
    <div class="section__head"><b>系列</b><i>SERIES · {series.length}</i></div>
    <div class="series-grid">
      {series.map((s, i) => <SeriesCard series={s} count={all.filter((p) => p.data.series === s.id).length} index={i + 1} />)}
    </div>
  </div>
  <div class="section">
    <div class="section__head"><b>最近更新</b><i>RECENT</i></div>
    <PostList posts={recent} />
  </div>
</BaseLayout>
```

`src/pages/tutorial/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content'
import { channelStaticPaths } from '../../lib/routes'
import SeriesPage from '../../components/pages/SeriesPage.astro'
import PostPage from '../../components/pages/PostPage.astro'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return channelStaticPaths('tutorial', posts)
}

const props = Astro.props as
  | { type: 'series'; seriesId: string }
  | { type: 'post'; post: import('../../lib/posts').Post }
---
{props.type === 'series'
  ? <SeriesPage seriesId={props.seriesId} />
  : <PostPage post={props.post} />}
```

`src/pages/templates/index.astro`:

```astro
---
import { getCollection } from 'astro:content'
import BaseLayout from '../../layouts/BaseLayout.astro'
import SeriesCard from '../../components/SeriesCard.astro'
import PostList from '../../components/PostList.astro'
import { SERIES } from '../../data/series'
import { sortByDateDesc, postChannel } from '../../lib/posts'

const all = await getCollection('posts')
const series = SERIES.filter((s) => s.channel === 'templates').sort((a, b) => a.order - b.order)
const recent = sortByDateDesc(all.filter((p) => postChannel(p) === 'templates')).slice(0, 6)
---
<BaseLayout title="架构地图">
  <div class="hero">
    <p class="kicker">架构地图 · 31 篇</p>
    <h1>真实系统长什么样</h1>
    <p>只讲问题、组件、数据流和取舍。每张地图末尾都附真实开源项目与工程文档,可顺着去读源码。</p>
  </div>
  <div class="section">
    <div class="section__head"><b>系列</b><i>SERIES · {series.length}</i></div>
    <div class="series-grid">
      {series.map((s, i) => <SeriesCard series={s} count={all.filter((p) => p.data.series === s.id).length} index={i + 1} />)}
    </div>
  </div>
  <div class="section">
    <div class="section__head"><b>最近更新</b><i>RECENT</i></div>
    <PostList posts={recent} />
  </div>
</BaseLayout>
```

`src/pages/templates/[slug].astro`:

```astro
---
import { getCollection } from 'astro:content'
import { channelStaticPaths } from '../../lib/routes'
import SeriesPage from '../../components/pages/SeriesPage.astro'
import PostPage from '../../components/pages/PostPage.astro'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return channelStaticPaths('templates', posts)
}

const props = Astro.props as
  | { type: 'series'; seriesId: string }
  | { type: 'post'; post: import('../../lib/posts').Post }
---
{props.type === 'series'
  ? <SeriesPage seriesId={props.seriesId} />
  : <PostPage post={props.post} />}
```

`src/pages/cases/index.astro`:

```astro
---
import { getCollection } from 'astro:content'
import BaseLayout from '../../layouts/BaseLayout.astro'
import PostList from '../../components/PostList.astro'
import { postsInSeries } from '../../lib/posts'
const all = await getCollection('posts')
const posts = postsInSeries(all, 'cases')
---
<BaseLayout title="案例">
  <div class="hero">
    <p class="kicker">案例 · 6 篇</p>
    <h1>把架构从答案写成推理过程</h1>
    <p>模板告诉你这类系统通常长什么样;案例告诉你,在这个具体场景里,为什么最后只能这样取舍。</p>
  </div>
  <div class="section"><PostList posts={posts} showSeries={false} /></div>
</BaseLayout>
```

`src/pages/cases/[slug].astro` 只保留文章分支:

```astro
---
import { getCollection } from 'astro:content'
import { channelStaticPaths } from '../../lib/routes'
import PostPage from '../../components/pages/PostPage.astro'

export async function getStaticPaths() {
  const posts = await getCollection('posts')
  return channelStaticPaths('cases', posts)
}
const { post } = Astro.props as { post: import('../../lib/posts').Post }
---
<PostPage post={post} />
```

- [ ] **Step 5: 暂时用一个最小 PostPage 占位(Task 11 补全)**

`src/components/pages/PostPage.astro`:

```astro
---
import type { Post } from '../../lib/posts'
interface Props { post: Post }
const { post } = Astro.props
---
<article><h1>{post.data.title}</h1></article>
```

- [ ] **Step 6: 构建并抽查**

Run: `pnpm build`
Expected: 成功;`dist/tutorial/foundations/index.html`、`dist/tutorial/why-architecture-first/index.html`、`dist/cases/stararena-ticketing/index.html` 均存在。

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: add channel and series pages"
```

---

## Task 11: 文章页、目录与上下篇

**Files:**
- Create: `src/lib/reading-time.ts`, `src/components/Toc.astro`, `src/components/PostNav.astro`
- Modify: `src/components/pages/PostPage.astro`

- [ ] **Step 1: 写 `src/lib/reading-time.ts`**

```ts
export function readingMinutes(body: string): number {
  const chars = body.replace(/\s/g, '').length
  return Math.max(1, Math.round(chars / 400))
}
```

- [ ] **Step 2: 写 `Toc.astro` 与 `PostNav.astro`**

```astro
---
interface Props { headings: { depth: number; slug: string; text: string }[] }
const items = Astro.props.headings.filter((h) => h.depth === 2)
---
{items.length > 0 && (
  <aside class="toc">
    <b>本页目录</b>
    {items.map((h) => <div><a href={`#${h.slug}`}>{h.text}</a></div>)}
  </aside>
)}
```

```astro
---
import type { Post } from '../lib/posts'
import { postHref } from '../lib/posts'
interface Props { prev?: Post; next?: Post }
const { prev, next } = Astro.props
---
<div class="nav-pair">
  <div>{prev && <a href={postHref(prev)}><small>上一篇</small>{prev.data.title}</a>}</div>
  <div style="text-align:right">{next && <a href={postHref(next)}><small>下一篇</small>{next.data.title}</a>}</div>
</div>
```

- [ ] **Step 3: 写完整 `PostPage.astro`**

```astro
---
import { getCollection, render } from 'astro:content'
import BaseLayout from '../../layouts/BaseLayout.astro'
import Toc from '../Toc.astro'
import PostNav from '../PostNav.astro'
import Comments from '../Comments.astro'
import type { Post } from '../../lib/posts'
import { getSeries, postsInSeries, seriesHref, postHref } from '../../lib/posts'
import { readingMinutes } from '../../lib/reading-time'

interface Props { post: Post }
const { post } = Astro.props
const { Content, headings } = await render(post)
const series = getSeries(post.data.series)
const all = await getCollection('posts')
const siblings = postsInSeries(all, post.data.series)
const idx = siblings.findIndex((p) => p.id === post.id)
const prev = idx > 0 ? siblings[idx - 1] : undefined
const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined
const date = post.data.pubDate.toISOString().slice(0, 10)
---
<BaseLayout title={post.data.title} description={post.data.description}>
  <div class="article">
    <article>
      <div class="crumb">
        {series.channel === 'tutorial' ? '教程' : series.channel === 'templates' ? '架构地图' : '案例'}
        {' / '}
        <a href={seriesHref(series.id)}><b>{series.title}</b></a>
        {' / '}第 {post.data.order} 篇
      </div>
      <h1>{post.data.title}</h1>
      <p class="dek">{post.data.description}</p>
      <div class="article__meta">{date} &nbsp;|&nbsp; 约 {readingMinutes(post.body ?? '')} 分钟 &nbsp;|&nbsp; 系列 {post.data.order} / {siblings.length}</div>
      <div class="prose"><Content /></div>
      <PostNav prev={prev} next={next} />
      <Comments />
    </article>
    <Toc headings={headings} />
  </div>
</BaseLayout>
```

- [ ] **Step 4: 临时占位 `Comments.astro`(Task 14 补全)**

```astro
---
---
<div style="margin-top:40px"></div>
```

- [ ] **Step 5: 构建并检查**

Run: `pnpm build && grep -o '本页目录' dist/tutorial/why-architecture-first/index.html | head -1`
Expected: `本页目录`。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat: render post pages with TOC and series navigation"
```

---

## Task 12: 首页

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: 写首页**

```astro
---
import { getCollection } from 'astro:content'
import BaseLayout from '../layouts/BaseLayout.astro'
import SeriesCard from '../components/SeriesCard.astro'
import PostList from '../components/PostList.astro'
import { SERIES } from '../data/series'
import { sortByDateDesc } from '../lib/posts'
import { href } from '../lib/urls'

const all = await getCollection('posts')
const recent = sortByDateDesc(all).slice(0, 6)
const countOf = (id: string) => all.filter((p) => p.data.series === id).length
---
<BaseLayout title="架构图谱">
  <div class="hero">
    <p class="kicker">Architecture Notes · Vol. 2026</p>
    <h1>先看清系统,<br />再动手写代码。</h1>
    <p>写代码这件事正在消失,而判断力越来越值钱。这里收集 80 篇架构笔记:40 章教程、31 张真实系统地图、6 个端到端案例 —— 只讲架构,不讲语法。</p>
    <div class="meta">自 2026 年 1 月起 · 每周两篇 · 中文</div>
    <div><a class="cta" href={href('/tutorial/foundations/')}>从第一章开始 →</a></div>
  </div>

  <div class="section">
    <div class="section__head"><b>学习路径</b><i>SERIES · {SERIES.length}</i></div>
    <div class="series-grid">
      {SERIES.filter((s) => s.channel !== 'cases').map((s, i) => (
        <SeriesCard series={s} count={countOf(s.id)} index={i + 1} />
      ))}
    </div>
  </div>

  <div class="section">
    <div class="section__head"><b>最近更新</b><i>RECENT</i></div>
    <PostList posts={recent} />
  </div>
</BaseLayout>
```

- [ ] **Step 2: 构建并检查**

Run: `pnpm build && grep -o 'series-card' dist/index.html | wc -l`
Expected: 至少 `13`。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add homepage"
```

---

## Task 13: 站内搜索

**Files:**
- Create: `src/pages/search.astro`

- [ ] **Step 1: 写搜索页**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---
<BaseLayout title="搜索">
  <div class="section">
    <p class="kicker">Search</p>
    <h1 style="font-size:38px;font-weight:400;margin:10px 0 18px">搜索 80 篇笔记</h1>
    <form class="search-form" id="search-form">
      <input id="search-input" type="search" placeholder="试试「一致性」「抢票」「RAG」" autofocus />
      <button type="submit">搜索</button>
    </form>
    <p id="search-hint" class="dek">中文检索按词切分,单字与超短词召回有限,建议用 2–4 个字的短语。</p>
    <div id="search-results"></div>
  </div>

  <script>
    const base = import.meta.env.BASE_URL
    const input = document.getElementById('search-input') as HTMLInputElement
    const form = document.getElementById('search-form') as HTMLFormElement
    const results = document.getElementById('search-results')!
    let pagefind: any

    async function load() {
      pagefind = await import(/* @vite-ignore */ `${base}_pagefind/pagefind.js`)
      await pagefind.init()
    }

    async function run(query: string) {
      if (!query.trim()) { results.innerHTML = ''; return }
      if (!pagefind) await load()
      const search = await pagefind.search(query)
      const hits = await Promise.all(search.results.slice(0, 20).map((r: any) => r.data()))
      results.innerHTML = hits.length
        ? hits.map((h: any) => (
            '<div class="search-hit">' +
            `<h3><a href="${h.url}">${h.meta.title ?? h.url}</a></h3>` +
            `<p>${(h.excerpt ?? '').replace(/<[^>]+>/g, '')}</p>` +
            '</div>'
          )).join('')
        : '<p class="dek">没有找到结果。</p>'
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); run(input.value) })
    input.addEventListener('input', () => run(input.value))
  </script>
</BaseLayout>
```

- [ ] **Step 2: 构建并确认索引存在**

Run: `pnpm build && ls dist/_pagefind | head`
Expected: 列出 `pagefind.js` 等文件。

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "feat: add Pagefind search page"
```

---

## Task 14: RSS 与 giscus 评论

**Files:**
- Create: `src/pages/rss.xml.ts`, `src/components/Comments.astro`

- [ ] **Step 1: 写 `rss.xml.ts`**

```ts
import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'
import type { APIContext } from 'astro'
import { sortByDateDesc } from '../lib/posts'

export async function GET(context: APIContext) {
  const posts = sortByDateDesc(await getCollection('posts'))
  return rss({
    title: '架构图谱 · Awesome Architecture',
    description: '专注架构思维的中文知识库:40 章教程、31 张架构地图、6 个案例。',
    site: context.site!,
    items: posts.map((post) => {
      const channel = post.data.kind === 'template' ? 'templates' : post.data.kind === 'case' ? 'cases' : 'tutorial'
      const slug = post.id.split('/').pop()
      return {
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `${import.meta.env.BASE_URL}${channel}/${slug}/`,
      }
    }),
    customData: '<language>zh-cn</language>',
  })
}
```

- [ ] **Step 2: 写 `Comments.astro`**

```astro
---
const base = import.meta.env.BASE_URL
const repoId = import.meta.env.PUBLIC_GISCUS_REPO_ID ?? ''
const categoryId = import.meta.env.PUBLIC_GISCUS_CATEGORY_ID ?? ''
const enabled = Boolean(repoId && categoryId)
---
{enabled ? (
  <section class="section" style="border-bottom:0">
    <div class="section__head"><b>评论</b><i>DISCUSSIONS</i></div>
    <div id="giscus-host"></div>
    <script define:vars={{ repoId, categoryId }}>
      (() => {
        const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
        const host = document.getElementById('giscus-host')
        if (!host) return
        const s = document.createElement('script')
        s.src = 'https://giscus.app/client.js'
        s.async = true
        s.crossOrigin = 'anonymous'
        s.dataset.repo = 'PenglongHuang/awesome-architecture-blog'
        s.dataset.repoId = repoId
        s.dataset.category = 'Announcements'
        s.dataset.categoryId = categoryId
        s.dataset.mapping = 'pathname'
        s.dataset.strict = '0'
        s.dataset.reactionsEnabled = '1'
        s.dataset.emitMetadata = '0'
        s.dataset.inputPosition = 'top'
        s.dataset.theme = theme()
        s.dataset.lang = 'zh-CN'
        host.appendChild(s)
        window.addEventListener('themechange', (e) => {
          const frame = document.querySelector('iframe.giscus-frame')
          if (frame) frame.contentWindow?.postMessage({ giscus: { setConfig: { theme: e.detail } } }, 'https://giscus.app')
        })
      })()
    </script>
  </section>
) : (
  <p class="dek" style="margin-top:32px">评论尚未配置(需要设置 PUBLIC_GISCUS_REPO_ID 与 PUBLIC_GISCUS_CATEGORY_ID)。</p>
)}
```

- [ ] **Step 3: 构建并检查 RSS**

Run: `pnpm build && node -e "const s=require('fs').readFileSync('dist/rss.xml','utf8'); console.log((s.match(/<item>/g)||[]).length)"`
Expected: `80`。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "feat: add RSS feed and giscus comments"
```

---

## Task 15: 404、About 与许可

**Files:**
- Create: `src/pages/404.astro`, `src/pages/about.astro`, `LICENSE`
- Modify: `src/components/Footer.astro`(如有需要)

- [ ] **Step 1: 写 `404.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
import { href } from '../lib/urls'
---
<BaseLayout title="页面走丢了">
  <div class="hero">
    <p class="kicker">404</p>
    <h1>这一页不在图里。</h1>
    <p>可能是链接旧了,或者这篇文章还没写。回到地图上重新出发。</p>
    <div><a class="cta" href={href('/')}>回首页 →</a> <a class="cta" href={href('/tutorial/')}>看教程 →</a></div>
  </div>
</BaseLayout>
```

- [ ] **Step 2: 写 `about.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro'
---
<BaseLayout title="关于">
  <div class="section">
    <p class="kicker">About</p>
    <h1 style="font-size:38px;font-weight:400;margin:10px 0 18px">关于这个站</h1>
    <div class="prose">
      <p>这是一个专注「架构思维」的中文知识库:40 章教程、31 张真实系统架构地图、6 个端到端案例。它只讨论系统该长什么样、为什么这样取舍,不讨论具体语法。</p>
      <p>站点由 <a href="https://github.com/PenglongHuang">Penglong Huang</a> 用 Astro 搭建,设计方向为「纸本杂志」。</p>
      <h2>来源与许可</h2>
      <p>本站内容整理自 <a href="https://github.com/study8677/awesome-architecture">study8677/awesome-architecture</a>,原作者为 JingWen Fan (study8677),采用 <strong>MIT 许可</strong>。转载与再发布遵守 MIT 要求,保留原始版权声明。</p>
      <p>原始许可文本见仓库根目录 <code>LICENSE</code>。</p>
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 3: 复制原始 LICENSE**

Run: `cp "D:/hpl/projects/architect/awesome-architecture/LICENSE" LICENSE`
Expected: 文件内容为 MIT 许可,版权行保持 `Copyright (c) 2026 JingWen Fan (study8677)`。

- [ ] **Step 4: 构建并检查**

Run: `pnpm build && ls dist/404.html dist/about/index.html`
Expected: 两个文件都存在。

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "feat: add 404, about page and license"
```

---

## Task 16: E2E 冒烟测试

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: 写配置**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:4321/awesome-architecture-blog/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4321',
    url: 'http://localhost:4321/awesome-architecture-blog/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
```

- [ ] **Step 2: 写冒烟测试**

```ts
import { test, expect } from '@playwright/test'

test('首页 → 系列 → 文章', async ({ page }) => {
  await page.goto('')
  await expect(page.getByRole('heading', { name: /先看清系统/ })).toBeVisible()
  await page.getByRole('link', { name: /入门篇/ }).first().click()
  await expect(page.getByRole('heading', { name: '入门篇' })).toBeVisible()
  await page.getByRole('link', { name: /为什么先有架构思维/ }).click()
  await expect(page.getByRole('heading', { name: '为什么先有架构思维' })).toBeVisible()
  await expect(page.getByText('本页目录')).toBeVisible()
})

test('Quiz 可以判分并展开解析', async ({ page }) => {
  await page.goto('tutorial/why-architecture-first/')
  const quiz = page.locator('.quiz').first()
  await quiz.locator('.quiz__opt').nth(1).click()
  await quiz.locator('.quiz__check').click()
  await expect(quiz.locator('.quiz__feedback')).toHaveText('答对了。')
  await expect(quiz.locator('.quiz__expl')).toBeVisible()
})

test('主题切换会持久化', async ({ page }) => {
  await page.goto('')
  const html = page.locator('html')
  const before = await html.getAttribute('data-theme')
  await page.getByRole('button', { name: '切换深浅色' }).click()
  const after = await html.getAttribute('data-theme')
  expect(after).not.toBe(before)
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', after!)
})

test('搜索能返回结果', async ({ page }) => {
  await page.goto('search/')
  await page.getByPlaceholder(/一致性/).fill('一致性')
  await expect(page.locator('.search-hit').first()).toBeVisible()
})
```

- [ ] **Step 3: 安装浏览器并运行**

Run: `pnpm exec playwright install chromium && pnpm test:e2e`
Expected: 4 passed。

- [ ] **Step 4: 提交**

```bash
git add -A
git commit -m "test: add Playwright smoke tests"
```

---

## Task 17: CI 与部署流水线

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

- [ ] **Step 1: 写 `ci.yml`**

```yaml
name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm validate
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 2: 写 `deploy.yml`**

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm validate
      - run: pnpm test
      - run: pnpm build
        env:
          PUBLIC_GISCUS_REPO_ID: ${{ vars.GISCUS_REPO_ID }}
          PUBLIC_GISCUS_CATEGORY_ID: ${{ vars.GISCUS_CATEGORY_ID }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "ci: add validation, test and GitHub Pages deploy"
```

---

## Task 18: 创建 GitHub 仓库并首次部署

**Files:** 无代码改动;仅仓库与配置。

- [ ] **Step 1: 创建公开仓库并推送**

```bash
gh repo create PenglongHuang/awesome-architecture-blog --public --source=. --remote=origin --push
```

Expected: 输出仓库 URL。

- [ ] **Step 2: 开启 Discussions**

```bash
gh api -X PATCH repos/PenglongHuang/awesome-architecture-blog -f has_discussions=true
```

- [ ] **Step 3: 设置 Pages 为 GitHub Actions**

```bash
gh api -X POST repos/PenglongHuang/awesome-architecture-blog/pages -f build_type=workflow
```

若返回 409(已存在),改用:

```bash
gh api -X PUT repos/PenglongHuang/awesome-architecture-blog/pages -f build_type=workflow
```

- [ ] **Step 4: 获取 giscus 所需的仓库与分类 ID**

```bash
gh api graphql -f query='query { repository(owner:"PenglongHuang", name:"awesome-architecture-blog") { id } }'
gh api graphql -f query='query { repository(owner:"PenglongHuang", name:"awesome-architecture-blog") { discussionCategories(first:20) { nodes { id name } } } }'
```

记录 `repository.id` 与 `Announcements` 分类的 `id`。

- [ ] **Step 5: 写入仓库变量**

```bash
gh variable set GISCUS_REPO_ID --body "<上一步的 repository id>"
gh variable set GISCUS_CATEGORY_ID --body "<Announcements 的 id>"
```

- [ ] **Step 6: 请用户安装 giscus App**

把 `https://github.com/apps/giscus` 发给用户,请其安装并授权 `PenglongHuang/awesome-architecture-blog`。**这一步无法用 CLI 完成。**

- [ ] **Step 7: 触发部署并验证**

```bash
gh workflow run deploy.yml
gh run watch
```

Expected: workflow 成功;浏览器打开 `https://penglonghuang.github.io/awesome-architecture-blog/` 可见首页。

---

## Task 19: 内容 QA 与收尾

**Files:** 可能修改 `src/content/posts/**`(仅 ASCII 对齐问题)。

- [ ] **Step 1: 检查迁移报告**

Run: `cat scripts/import-report.json`
Expected: `posts: 80`,`quizzes: 115`,`decisions: 1`,`unmapped: []`。

- [ ] **Step 2: ASCII 图 CJK 抽检**

Run: `node -e "const r=require('./scripts/import-report.json'); console.log(r.cjkPre.length)"`
对报告中的每一处,在浏览器里打开对应文章,确认方块字符与中文混排时没有错位;若错位,把图内中文改成英文缩写并重新构建。

- [ ] **Step 3: 移动端与深色检查**

在 Chrome DevTools 中：
- 390px 宽度:首页、系列页、文章页无横向溢出;ASCII 图在自己的 `pre` 内滚动;
- 深色模式:正文、表格、Quiz、代码块对比度正常;
- 主题切换后刷新不闪白。

- [ ] **Step 4: Lighthouse**

Run: `npx lighthouse https://penglonghuang.github.io/awesome-architecture-blog/ --only-categories=performance,accessibility,seo --quiet --chrome-flags="--headless"`
Expected: Performance ≥ 95、Accessibility ≥ 95。

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "chore: content QA fixes" || true
git push
```

---

## 验收清单

- [ ] 80/80 篇正文,115/115 Quiz,1 个 DecisionCard
- [ ] `pnpm validate` 通过,内部链接 0 死链
- [ ] 首页 / 频道页 / 系列页 / 文章页 / 搜索 / 404 六套模板齐全
- [ ] 搜索、深色、RSS、评论可用
- [ ] PR 触发 CI,main 触发部署
- [ ] `/about` 与页脚包含来源与 MIT 署名
- [ ] Lighthouse Performance ≥ 95、Accessibility ≥ 95
