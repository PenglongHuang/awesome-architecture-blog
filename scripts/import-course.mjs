import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const COURSE_ROOT =
  process.argv[2] || process.env.COURSE_SRC || 'D:/hpl/projects/architect/courses'
const source = path.join(COURSE_ROOT, 'litellm-learning/litellm-course.html')
const destDir = path.join(ROOT, 'public/learning/litellm')
const dest = path.join(destDir, 'index.html')

if (!fs.existsSync(source)) {
  console.error(`Course source not found: ${source}`)
  console.error('Pass the courses directory as the first argument, or set COURSE_SRC.')
  process.exit(1)
}

let html = fs.readFileSync(source, 'utf8')

// The course originally loaded four font families from Google Fonts. That
// render-blocking stylesheet is the first-load bottleneck on networks where
// Google Fonts is unreachable, so drop it and rely on local/system fallbacks.
html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/g, '\n')
html = html.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/g, '\n')
html = html.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">\s*/g, '\n')

replaceOnce(
  "--font-display:  'Bricolage Grotesque', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;",
  "--font-display:  'Bricolage Grotesque', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;",
  'display font fallback'
)

replaceOnce(
  "--font-body:     'DM Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;",
  "--font-body:     'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;",
  'body font fallback'
)

replaceOnce(
  "--font-mono:     'JetBrains Mono', 'Fira Code', 'Consolas', monospace;",
  "--font-mono:     'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;",
  'mono font fallback'
)

function replaceOnce(from, to, label) {
  if (!html.includes(from)) {
    console.warn(`[skip] ${label}: pattern not found`)
    return
  }
  html = html.replace(from, to)
}

replaceOnce(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<meta name="description" content="LiteLLM 内部漫游指南:跟着一个 /v1/chat/completions 请求,走完 AI 网关的鉴权、限流、翻译、路由与计价。">',
  'meta description'
)

replaceOnce(
  '<main>',
  '<main data-pagefind-body>',
  'Pagefind body scope'
)

replaceOnce(
  '<span class="pill">📂 已克隆到本地</span>',
  '<span class="pill">📂 开源仓库</span>',
  'hero repo pill'
)

replaceOnce(
  '仓库位置：<code>D:\\hpl\\projects\\architect\\litellm</code> · 所有代码片段均原样摘自该仓库',
  '源码：<a href="https://github.com/BerriAI/litellm" target="_blank" rel="noopener">BerriAI/litellm</a> · 所有代码片段均原样摘自该仓库',
  'hero repo link'
)

const backLink = `
<a class="course-back" href="../" aria-label="返回项目学习">← 项目学习</a>
<style>
  .course-back {
    position: fixed; right: 18px; bottom: 18px; z-index: 9500;
    padding: 9px 14px; border: 1px solid #E5DFD6; border-radius: 999px;
    background: rgba(250, 247, 242, .92); color: #6B6560;
    font: 500 12px/1 "DM Sans", "Noto Sans SC", sans-serif;
    text-decoration: none; backdrop-filter: blur(8px);
  }
  .course-back:hover { color: #D94F30; border-color: #D94F30; }
</style>
`

if (!html.includes('class="course-back"')) {
  html = html.replace('</body>', `${backLink}</body>`)
}

fs.mkdirSync(destDir, { recursive: true })
fs.writeFileSync(dest, html)
console.log(`Imported ${source} -> ${dest}`)
