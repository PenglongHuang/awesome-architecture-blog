// Capture homepage screenshots for before/after UI evidence.
// Usage: node scripts/capture-home.mjs <outdir> <urlBase>
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const outdir = process.argv[2] ?? '.taste-skill/capture'
const base = process.argv[3] ?? 'http://localhost:4321/awesome-architecture-blog/'
mkdirSync(outdir, { recursive: true })

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
]

const browser = await chromium.launch()
for (const theme of ['light', 'dark']) {
  for (const vp of viewports) {
    if (theme === 'dark' && vp.name !== 'desktop') continue
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
    await page.goto(base, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(1200)
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t)
      localStorage.setItem('theme', t)
    }, theme)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${outdir}/${theme}-${vp.name}-home-viewport.png` })
    await page.screenshot({ path: `${outdir}/${theme}-${vp.name}-home-full.png`, fullPage: true })
    await page.close()
  }
}
await browser.close()
console.log('captured to', outdir)
