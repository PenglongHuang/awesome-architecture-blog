// Home page motion + the route picker.
// Everything here is progressive: without this script the page is fully
// readable (entrances only hide content after `html.js` is set, the band
// shows its first image, and the route stops are plain links).

// -- entrances: heading, then text, then figure, staggered -------------------
// The fade is opacity-only (safe for reduced motion); the CSS drops the
// 16px travel when the visitor prefers reduced motion.

// Articles render their body as markdown; tag the prose children so long
// chapters still get the staggered entrance instead of a static wall.
for (const prose of document.querySelectorAll<HTMLElement>('.prose')) {
  ;[...prose.children].forEach((child) => {
    if (!child.hasAttribute('data-in')) child.setAttribute('data-in', '')
  })
}

const toReveal = Array.from(document.querySelectorAll<HTMLElement>('[data-in]'))
if ('IntersectionObserver' in window) {
  // The bottom margin fires 15% early so content is already visible (or
  // settling) by the time a fast scroll or a screenshot reaches it.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        ;(entry.target as HTMLElement).classList.add('is-in')
        io.unobserve(entry.target)
      }
    },
    { threshold: 0.05, rootMargin: '0px 0px 15% 0px' },
  )
  // siblings tagged with data-in get a 60ms stagger inside their section
  const groups = new Map<Element, number>()
  for (const el of toReveal) {
    const parent = el.closest('section, header, footer, main') ?? document.body
    const next = (groups.get(parent) ?? 0)
    el.style.setProperty('--d', `${(next % 4) * 60}ms`)
    groups.set(parent, next + 1)
    io.observe(el)
  }
  // safety net: never leave content hidden for more than 1.5s after load
  window.setTimeout(() => {
    for (const el of toReveal) {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight * 1.2) el.classList.add('is-in')
    }
  }, 1500)
} else {
  for (const el of toReveal) el.classList.add('is-in')
}

// -- route picker -------------------------------------------------------------
const route = document.querySelector<HTMLElement>('.route')
if (route) {
  const stops = Array.from(route.querySelectorAll<HTMLAnchorElement>('.route__stop'))
  const result = route.querySelector<HTMLElement>('.route__result')
  let payload: Record<string, { label: string; chapter: string; href: string; minutes: number }> = {}
  try {
    payload = JSON.parse(route.dataset.routes ?? '{}')
  } catch {
    payload = {}
  }
  for (const stop of stops) {
    stop.addEventListener('click', (event) => {
      const info = payload[stop.dataset.stop ?? '']
      if (!info || !result) return // no JS data: let the link navigate
      event.preventDefault()
      for (const other of stops) other.classList.toggle('is-active', other === stop)
      result.hidden = false
      result.replaceChildren()
      const text = document.createElement('span')
      text.textContent = `从《${info.chapter}》开始，${info.label}全程约 ${info.minutes} 分钟。`
      const go = document.createElement('a')
      go.className = 'route__go'
      go.href = info.href
      go.textContent = '去读第一章 →'
      result.append(text, go)
    })
  }
}
