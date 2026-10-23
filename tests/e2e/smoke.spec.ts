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
  await expect(page.getByText('共 1 门')).toBeVisible()

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
  await expect(page.getByText('项目学习 · 1 门')).toBeVisible()
  await page.getByRole('link', { name: /LiteLLM 内部漫游指南/ }).click()
  await expect(page).toHaveURL(/learning\/litellm\/$/)
  await expect(page).toHaveTitle(/LiteLLM 内部漫游指南/)
  await expect(page.getByRole('heading', { name: /跟着一个请求/ })).toBeVisible()

  await page.getByRole('link', { name: '返回项目学习' }).click()
  await expect(page).toHaveURL(/learning\/$/)
})

test('项目学习可按方向与标签筛选并同步 URL', async ({ page }) => {
  await page.goto('learning/')
  const filter = page.locator('[data-course-filter]')
  await expect(filter).toBeVisible()
  await expect(page.locator('[data-course-card]')).toHaveCount(1)

  const allTracks = filter.getByRole('button', { name: /^全部/ }).first()
  await expect(allTracks).toHaveAttribute('aria-pressed', 'true')

  const aiTrack = filter.getByRole('button', { name: /AI 基础设施/ })
  await aiTrack.click()
  await expect(aiTrack).toHaveAttribute('aria-pressed', 'true')
  await expect(allTracks).toHaveAttribute('aria-pressed', 'false')
  expect(new URL(page.url()).searchParams.get('track')).toBe('ai-infra')

  const tagButton = filter.getByRole('button', { name: 'AI 网关' })
  const limitTag = filter.getByRole('button', { name: '限流' })
  await tagButton.click()
  await limitTag.click()
  await expect(tagButton).toHaveAttribute('aria-pressed', 'true')
  await expect(limitTag).toHaveAttribute('aria-pressed', 'true')
  await expect(tagButton.locator('.filter-chip__x')).toBeVisible()
  await expect(limitTag.locator('.filter-chip__x')).toBeVisible()
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual([
    'ai-gateway',
    'rate-limiting',
  ])
  await expect(page.locator('[data-course-summary]')).toHaveText('显示 1 门 · 2 个标签')
  await expect(page.locator('[data-course-card]')).toHaveCount(1)

  await page.reload()
  await expect(filter.getByRole('button', { name: /AI 基础设施/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(filter.getByRole('button', { name: 'AI 网关' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(filter.getByRole('button', { name: '限流' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual([
    'ai-gateway',
    'rate-limiting',
  ])
  await expect(page.locator('[data-course-card]')).toHaveCount(1)

  await tagButton.click()
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['rate-limiting'])
  await expect(tagButton).toHaveAttribute('aria-pressed', 'false')
  await expect(tagButton.locator('.filter-chip__x')).toBeHidden()
  await expect(limitTag).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '清除筛选' }).click()
  await expect(page).toHaveURL(/learning\/$/)
  await expect(page.locator('[data-course-summary]')).toHaveText('显示 1 门')
  await expect(page.locator('[data-course-card]')).toHaveCount(1)
})

test('课程卡片上的标签可直接筛选', async ({ page }) => {
  await page.goto('learning/')
  const card = page.locator('[data-course-card]').first()
  await card.getByRole('button', { name: 'AI 网关' }).click()
  await card.getByRole('button', { name: '限流' }).click()

  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual([
    'ai-gateway',
    'rate-limiting',
  ])
  await expect(
    page.locator('[data-course-filter]').getByRole('button', { name: 'AI 网关' })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.locator('[data-course-filter]').getByRole('button', { name: '限流' })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-course-card]')).toHaveCount(1)
})

test('课程卡片标签支持键盘筛选', async ({ page }) => {
  await page.goto('learning/')
  const tag = page.locator('[data-course-card] [data-tag-filter]').first()
  await expect(tag).toHaveAttribute('role', 'button')

  await tag.focus()
  await page.keyboard.press('Enter')

  expect(new URL(page.url()).searchParams.get('tag')).toBe('ai-gateway')
  await expect(
    page.locator('[data-course-filter]').getByRole('button', { name: 'AI 网关' })
  ).toHaveAttribute('aria-pressed', 'true')
})

test('旧的中文标签 URL 会规范化为标签 id', async ({ page }) => {
  await page.goto('learning/?tag=AI%20%E7%BD%91%E5%85%B3')
  const filter = page.locator('[data-course-filter]')

  await expect(filter.getByRole('button', { name: 'AI 网关' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(new URL(page.url()).searchParams.getAll('tag')).toEqual(['ai-gateway'])
})

test.describe('项目学习无 JS 降级', () => {
  test.use({ javaScriptEnabled: false })

  test('筛选栏隐藏且课程仍然可见', async ({ page }) => {
    await page.goto('learning/')
    await expect(page.locator('[data-course-filter]')).toBeHidden()
    await expect(page.locator('[data-course-card]')).toBeVisible()
    await expect(page.getByRole('link', { name: 'LiteLLM 内部漫游指南' })).toBeVisible()
    await expect(
      page.locator('[data-course-card] [data-tag-filter]').first()
    ).not.toHaveAttribute('role', 'button')
  })
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
