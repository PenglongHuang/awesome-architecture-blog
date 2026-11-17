import { readdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { parse } from 'parse5'
import { COURSES } from '../../src/data/courses'

const files = readdirSync(new URL('../../src/content/posts/', import.meta.url), { recursive: true }).map(file => String(file).replaceAll('\\', '/')).filter(file => file.endsWith('.md'))
const englishCount = files.filter(file => file.startsWith('en/')).length
const chineseCount = files.length - englishCount

const article = 'tutorial/why-architecture-first/'

test('language switching preserves the article and English interactions work', async ({ page }) => {
  await page.goto(article)
  await page.getByRole('navigation', { name: '切换语言' }).getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(new RegExp(`/en/${article}$`))
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { name: /Why Architectural Thinking Comes First/ })).toBeVisible()
  await expect(page.locator('.toc-desktop b')).toHaveText('On this page')
  await page.getByRole('button', { name: 'Choose a theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Sepia' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sepia')
  const quiz = page.locator('.quiz').first()
  await quiz.getByRole('button', { name: 'Check answer' }).click()
  await expect(quiz.locator('.quiz__feedback')).toHaveText('Choose an option first.')
  await quiz.locator('.quiz__opt').nth(1).click()
  await quiz.getByRole('button', { name: 'Check answer' }).click()
  await expect(quiz.locator('.quiz__feedback')).toHaveText('Correct.')
  await quiz.getByRole('button', { name: 'Try again' }).click()
  await expect(quiz.locator('.quiz__feedback')).toBeHidden()
  await page.getByRole('navigation', { name: 'Change language' }).getByRole('link', { name: '简体中文' }).click()
  await expect(page).not.toHaveURL(/\/en\//)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
})

test('English series and previous/next stay in English across every channel', async ({ page }) => {
  await page.goto('en/')
  await page.locator('.home-rail').getByRole('link', { name: /Tutorials/ }).click()
  await page.getByRole('link', { name: /Foundations/ }).click()
  await expect(page.locator('.post-list li')).toHaveCount(9)
  const links = await page.locator('.post-list a').evaluateAll(anchors => anchors.map(a => a.getAttribute('href')))
  expect(links.every(link => link?.includes('/en/tutorial/'))).toBe(true)
  await page.locator('.post-list a').first().click()
  await page.locator('.nav-pair').getByRole('link', { name: /Next/ }).click()
  await expect(page).toHaveURL(/\/en\/tutorial\/architects-thinking-framework\/$/)
  for (const link of await page.locator('.related-knowledge a, .nav-pair a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))) {
    expect(link).toContain('/en/tutorial/')
  }
  await page.goto('tutorial/hard-truths-of-distributed-systems/')
  await page.getByRole('navigation', { name: '切换语言' }).getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL(/\/en\/tutorial\/hard-truths-of-distributed-systems\/$/)
  await expect(page.locator('.translation-note')).toHaveCount(0)
  for (const channel of ['templates', 'cases']) {
    await page.goto(`en/${channel}/`)
    if (channel === 'templates') await page.locator('.series-card').first().click()
    await page.locator('.post-list a').first().click()
    await expect(page).toHaveURL(new RegExp(`/en/${channel}/[^/]+/$`))
    const counterpart = await page.locator('[data-language-link]').getAttribute('href')
    expect(counterpart).not.toContain('/en/')
    await page.locator('[data-language-link]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  }
})

test('every article has a built, reciprocal translation with its own canonical URL', async ({ request }) => {
  expect(englishCount).toBe(chineseCount)
  // Inspect the generated HTML for every pair; this also exercises all channel routes.
  const posts = files.filter(file => !file.startsWith('en/'))
  const attrs = (html: string, tag: string) => {
    const found: Record<string, string>[] = []
    const walk = (node: any) => {
      if (node.tagName === tag) found.push(Object.fromEntries(node.attrs.map((a: any) => [a.name, a.value])))
      for (const child of node.childNodes ?? []) walk(child)
    }
    walk(parse(html))
    return found
  }
  for (let i = 0; i < posts.length; i += 6) {
    await Promise.all(posts.slice(i, i + 6).map(async file => {
      const route = file.replace(/\.md$/, '').toLowerCase() + '/'
      const responses = await Promise.all([request.get(route), request.get(`en/${route}`)])
      expect(responses.every(response => response.ok()), route).toBe(true)
      const [zh, en] = await Promise.all(responses.map(response => response.text()))
      expect(attrs(zh, 'html')[0].lang).toBe('zh-CN')
      expect(attrs(en, 'html')[0].lang).toBe('en')
      const zhLinks = attrs(zh, 'link'), enLinks = attrs(en, 'link')
      const zhCanonical = zhLinks.find(link => link.rel === 'canonical')!.href
      const enCanonical = enLinks.find(link => link.rel === 'canonical')!.href
      expect(enCanonical).toContain(`/en/${route}`)
      expect(enCanonical).not.toBe(zhCanonical)
      expect(zhLinks.find(link => link.hreflang === 'en')?.href).toBe(enCanonical)
      expect(enLinks.find(link => link.hreflang === 'zh-CN')?.href).toBe(zhCanonical)
      expect(en).not.toContain('No English translation yet')
    }))
  }
})

test('both home pages have matching navigation, featured series, and recent articles', async ({ page }) => {
  const counts: number[][] = []
  for (const path of ['', 'en/']) {
    await page.goto(path)
    counts.push(await Promise.all(['.home-rail__stop', '.featured-card', '.home-recent .post-list li'].map(selector => page.locator(selector).count())))
    for (const link of await page.locator('.home-rail a, .featured-card, .home-recent .post-list a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))) {
      expect(link?.includes('/en/')).toBe(path === 'en/')
    }
    expect(await page.locator('.featured-card__k').allTextContents()).not.toEqual(expect.arrayContaining([expect.stringMatching(/\b0 articles\b/)]))
  }
  expect(counts[0]).toEqual([4, 5, 4])
  expect(counts[1]).toEqual(counts[0])
})

for (const language of ['', 'en/']) {
  test(`header controls stay aligned and content fits the viewport: ${language || 'zh-CN'}`, async ({ page }) => {
    for (const width of [320, 375, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['', 'learning/', 'tutorial/why-architecture-first/']) {
        await page.goto(language + path)
        const geometry = await page.evaluate(() => {
          const rects = ['.masthead__brand', '.masthead__nav', '.masthead__actions'].map(selector => document.querySelector(selector)!.getBoundingClientRect())
          const overlap = rects.some((a, i) => rects.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1))
          const controls = [...document.querySelectorAll('.masthead__tool, .language-switch')].map(el => el.getBoundingClientRect().height)
          return { overlap, controls, overflow: document.documentElement.scrollWidth > innerWidth }
        })
        expect(geometry.overlap, `${language}${path} at ${width}px`).toBe(false)
        expect(geometry.overflow, `${language}${path} at ${width}px`).toBe(false)
        expect(Math.max(...geometry.controls) - Math.min(...geometry.controls)).toBeLessThanOrEqual(1)
        await expect(page.locator('.masthead__nav a')).toHaveCount(4)
        await expect(page.locator('.language-switch [aria-current="true"]')).toHaveCount(1)
      }
    }
  })
}

test('English course filters work and switching language preserves the selection', async ({ page }) => {
  await page.goto('en/learning/')
  await expect(page.locator('[data-course-card]')).toHaveCount(COURSES.length)
  await expect(page.locator('.course-language')).toHaveText(COURSES.map(() => 'Chinese course'))
  const filter = page.locator('[data-course-filter]')
  await filter.getByRole('button', { name: /AI infrastructure/ }).click()
  await filter.getByRole('button', { name: /^AI gateway/ }).click()
  await filter.getByRole('button', { name: /^Rate limiting/ }).click()
  await expect(page.locator('[data-course-summary]')).toHaveText('Showing 1 course · 2 tags')
  await expect(page.locator('[data-course-card]:visible')).toHaveCount(1)
  await page.locator('[data-language-link]').click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  expect(new URL(page.url()).searchParams.get('track')).toBe('ai-infra')
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['ai-gateway', 'rate-limiting'])
  await expect(page.locator('[data-course-summary]')).toHaveText('显示 1 门 · 2 个标签')
  await page.locator('[data-language-link]').click()
  await expect(page.locator('[data-course-card]:visible')).toHaveCount(1)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('[data-course-card]:visible')).toHaveCount(COURSES.length)
  await page.getByRole('link', { name: 'Inside LiteLLM', exact: true }).click()
  await expect(page).toHaveURL(/\/learning\/litellm\/$/)
})

test('Pagefind selects the current language index and feeds are separated', async ({ page, request }) => {
  await page.goto('en/search/')
  await page.getByRole('searchbox', { name: 'Search keywords' }).fill('architecture')
  await expect(page.locator('.search-hit').first()).toBeVisible()
  const links = await page.locator('.search-hit a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))
  expect(links.length).toBeGreaterThan(0)
  expect(links.every(link => link?.includes('/en/'))).toBe(true)
  await page.goto('search/')
  await page.getByRole('searchbox', { name: '搜索关键词' }).fill('一致性')
  await expect(page.locator('.search-hit').first()).toBeVisible()
  expect((await page.locator('.search-hit a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).every(link => !link?.includes('/en/'))).toBe(true)
  const englishFeed = await (await request.get('en/rss.xml')).text()
  const chineseFeed = await (await request.get('rss.xml')).text()
  expect(englishFeed.match(/<item>/g)).toHaveLength(englishCount)
  expect(chineseFeed.match(/<item>/g)).toHaveLength(chineseCount)
  expect(englishFeed).toContain('<language>en</language>')
  expect(chineseFeed).not.toContain('/en/tutorial/')
})

test('article alternates are reciprocal with separate canonical URLs', async ({ page }) => {
  await page.goto(article)
  const zhCanonical = await page.locator('link[rel="canonical"]').getAttribute('href')
  const enAlternate = await page.locator('link[rel="alternate"][hreflang="en"]').getAttribute('href')
  expect(enAlternate).toContain(`/en/${article}`)
  await page.goto(`en/${article}`)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', enAlternate!)
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og-default-en\.svg$/)
  await expect(page.locator('link[rel="alternate"][hreflang="zh-CN"]')).toHaveAttribute('href', zhCanonical!)
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => {
    const value = JSON.parse(text); return Array.isArray(value) ? value : [value]
  })
  expect(schemas.find(schema => schema['@type'] === 'BlogPosting').inLanguage).toBe('en')
  await page.goto('en/search/')
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
})

test('English navigation works on a small screen and without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.goto(`${test.info().project.use.baseURL}en/tutorial/foundations/`)
  await expect(page.locator('.post-list a')).toHaveCount(9)
  await page.locator('.post-list a').first().click()
  await expect(page.getByRole('heading', { name: /Why Architectural Thinking Comes First/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Change language' }).getByRole('link')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.goto(`${test.info().project.use.baseURL}en/learning/`)
  await expect(page.locator('[data-course-filter]')).toBeHidden()
  await expect(page.locator('[data-course-card]')).toHaveCount(COURSES.length)
  await expect(page.getByRole('link', { name: 'Inside LiteLLM', exact: true })).toBeVisible()
  await context.close()
})

test('English illustrations load and contain English diagram text', async ({ page, request }) => {
  for (const slug of ['41-ai-human-cognitive-risks', '42-protect-human-core-capabilities', '43-human-ai-collaboration-playbook']) {
    await page.goto(`en/tutorial/${slug}/`)
    const illustration = page.locator('.prose img').first()
    await illustration.scrollIntoViewIfNeeded()
    await expect(illustration).toBeVisible()
    await expect.poll(() => illustration.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    const source = await illustration.getAttribute('src')
    const diagram = await request.get(source!)
    expect(diagram.ok()).toBe(true)
    const svg = await diagram.text()
    expect(svg).toContain('<svg')
    expect(svg).not.toMatch(/[\u3400-\u9fff]/)
  }
})

test('completed long-form English articles render without Chinese leftovers or mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const completed = files.filter(file => /^en\/tutorial\/(?:T\d|4[123]-)/.test(file))
  expect(completed).toHaveLength(14)
  for (const file of completed) {
    await page.goto(file.replace(/\.md$/, '/').toLowerCase())
    await expect(page.locator('.prose h2').first()).toBeVisible()
    expect(await page.locator('article > div.prose').innerText(), file).not.toMatch(/[\u3400-\u9fff]/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file).toBe(true)
  }
})

test('shared pages switch language and keyboard search opens the current-language index', async ({ page, request }) => {
  for (const path of ['', 'tutorial/', 'templates/', 'cases/', 'learning/', 'search/', 'about/']) {
    await page.goto(`en/${path}`)
    await page.locator('[data-language-link]').click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.locator('[data-language-link]').click()
    await expect(page).toHaveURL(new RegExp(`/en/${path}$`))
  }
  await page.keyboard.press('Control+k')
  await expect(page).toHaveURL(/\/en\/search\/$/)
  for (const path of ['404.html', 'en/404/']) {
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('lang', path.startsWith('en/') ? 'en' : 'zh-CN')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,follow')
    await expect(page.locator('[data-language-link]')).toBeVisible()
  }
  const sitemap = await request.get('sitemap-0.xml')
  expect(sitemap.ok()).toBe(true)
  const xml = await sitemap.text()
  expect(xml).not.toMatch(/\/(?:search|404(?:\.html)?)\/?<\/loc>/)
  expect(xml).toContain('/en/tutorial/why-architecture-first/')
})
