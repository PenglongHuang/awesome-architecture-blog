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
