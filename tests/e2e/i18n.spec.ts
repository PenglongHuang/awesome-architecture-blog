import { readdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'

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

test('English pilot lists and previous/next stay in English; missing translations are explicit', async ({ page }) => {
  await page.goto('en/')
  await page.getByRole('link', { name: 'Read Foundations' }).click()
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
  await expect(page.getByRole('navigation', { name: '切换语言' })).toHaveText('暂无英文版')
  await expect(page.locator('.translation-note')).toContainText('暂无英文版')
  await expect(page.locator('link[hreflang="en"]')).toHaveCount(0)
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
  await context.close()
})
