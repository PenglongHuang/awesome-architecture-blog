import { test, expect } from '@playwright/test'

test('首页 → 系列 → 文章', async ({ page }) => {
  await page.goto('')
  await expect(page.getByRole('heading', { name: /先看清系统/ })).toBeVisible()
  await page.getByRole('link', { name: /入门篇/ }).first().click()
  await expect(page.getByRole('heading', { name: '入门篇' })).toBeVisible()
  await page.getByRole('link', { name: /为什么先有架构思维/ }).click()
  await expect(page.getByRole('heading', { name: '为什么先有架构思维' })).toBeVisible()
  await expect(page.locator('.toc-desktop b')).toHaveText('本页目录')
})

test('新导航名称并进入项目学习', async ({ page }) => {
  await page.goto('')
  await expect(page.getByRole('link', { name: 'AI架构师之路' })).toBeVisible()
  await expect(page.getByRole('link', { name: '入门教程' })).toBeVisible()

  await page.getByRole('link', { name: '系统设计' }).click()
  await expect(page).toHaveURL(/cases\/$/)
  await expect(page.getByRole('heading', { name: '把架构从答案写成推理过程' })).toBeVisible()

  const mapLink = page.getByRole('link', { name: '架构地图' })
  await expect(mapLink).toBeVisible()
  await mapLink.click()
  await expect(page).toHaveURL(/templates\/$/)
  await expect(page.getByRole('heading', { name: '真实系统长什么样' })).toBeVisible()

  await page.getByRole('link', { name: '项目学习' }).click()
  await expect(page).toHaveURL(/learning\/$/)
  await expect(page.getByRole('heading', { name: /在真实项目里/ })).toBeVisible()
})

test('项目学习课程页可打开并返回', async ({ page }) => {
  await page.goto('learning/')
  await page.getByRole('link', { name: /LiteLLM 内部漫游指南/ }).click()
  await expect(page).toHaveURL(/learning\/litellm\/$/)
  await expect(page).toHaveTitle(/LiteLLM 内部漫游指南/)
  await expect(page.getByRole('heading', { name: /跟着一个请求/ })).toBeVisible()

  await page.getByRole('link', { name: '返回项目学习' }).click()
  await expect(page).toHaveURL(/learning\/$/)
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

test('搜索页被预渲染并预加载 Pagefind', async ({ page }) => {
  await page.goto('')

  const rules = page.locator('script[type="speculationrules"]')
  await expect(rules).toHaveCount(1)
  const json = JSON.parse((await rules.textContent()) ?? '{}')
  const pattern = json.prerender?.[0]?.where?.href_matches
  expect(pattern).toContain('search')
  expect(json.prerender?.[0]?.eagerness).toBe('moderate')

  const searchUrl = new URL('search/', page.url()).href
  const matches = await page.evaluate(
    ({ p, u }) => new (window as any).URLPattern({ pathname: p }).test(u),
    { p: pattern, u: searchUrl }
  )
  expect(matches).toBe(true)

  await page.goto('search/')
  const inHead = await page.evaluate(() =>
    Boolean(
      document.head.querySelector(
        'link[rel="modulepreload"][href*="_pagefind/pagefind.js"]'
      )
    )
  )
  expect(inHead).toBe(true)
})
