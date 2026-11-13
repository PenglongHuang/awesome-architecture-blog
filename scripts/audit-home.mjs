// Measure homepage clutter: link counts, first-viewport composition, type scale.
// Usage: node scripts/audit-home.mjs <urlBase>
import { chromium } from '@playwright/test'

const base = process.argv[2] ?? 'http://localhost:4321/awesome-architecture-blog/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(base, { waitUntil: 'load', timeout: 60000 })
await page.waitForTimeout(800)

const report = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a[href]')]
  const inView = (el) => {
    const r = el.getBoundingClientRect()
    return r.top < window.innerHeight && r.bottom > 0
  }
  const text = (el) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const sections = [...document.querySelectorAll('main section, main > div > section, main > div > div')].map((s) => {
    const r = s.getBoundingClientRect()
    return { cls: s.className, top: Math.round(r.top + window.scrollY), height: Math.round(r.height), links: s.querySelectorAll('a[href]').length }
  })
  const firstScreenLinks = links.filter((a) => {
    const r = a.getBoundingClientRect()
    return r.top >= 0 && r.top < window.innerHeight && r.width > 0
  })
  const sizes = [...document.querySelectorAll('h1,h2,h3,p,a')].filter((el) => el.offsetParent !== null)
  return {
    totalLinks: links.length,
    firstScreenLinks: firstScreenLinks.map((a) => ({ t: text(a), cls: a.className.slice(0, 40) })),
    sections,
    headlineSizes: [...new Set(sizes.map((el) => {
      const cs = getComputedStyle(el)
      return `${el.tagName} ${cs.fontSize} w${cs.fontWeight}`
    }))].slice(0, 30),
    pageHeight: Math.round(document.documentElement.scrollHeight),
  }
})
console.log(JSON.stringify(report, null, 1))
await browser.close()
