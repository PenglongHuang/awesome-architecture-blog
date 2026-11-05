// Runs in the head to apply the saved preference before the first paint.
// The toggle buttons open a shared picker instead of flipping light/dark,
// so the Astro masthead and the standalone course navs stay in one code path.
(() => {
  const THEMES = [
    { id: 'light', name: '明亮' },
    { id: 'dark', name: '暗黑' },
    { id: 'sepia', name: '羊皮纸' },
    { id: 'green', name: '护眼绿' },
    { id: 'white', name: '纯白' },
  ]
  const STORAGE_KEY = 'theme'
  const root = document.documentElement
  const buttons = () => [...document.querySelectorAll('[data-theme-toggle]')]

  function storedTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (THEMES.some((theme) => theme.id === stored)) return stored
    } catch { /* Storage may be disabled. */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function syncButtons(expanded) {
    for (const button of buttons()) {
      button.querySelector('[data-theme-icon]').textContent = '●'
      button.setAttribute('aria-label', '选择主题风格')
      button.setAttribute('title', '选择主题风格')
      button.setAttribute('aria-haspopup', 'menu')
      button.setAttribute('aria-expanded', String(expanded))
    }
  }

  root.dataset.theme = storedTheme()

  let picker = null
  let anchor = null

  function select(id) {
    root.dataset.theme = id
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* The page still changes. */ }
    if (picker) {
      for (const option of picker.querySelectorAll('[data-theme-option]')) {
        option.setAttribute('aria-checked', String(option.dataset.themeOption === id))
      }
    }
    window.dispatchEvent(new CustomEvent('themechange', { detail: id }))
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      const target = anchor
      close()
      target?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const options = picker ? [...picker.querySelectorAll('[role="menuitemradio"]')] : []
    if (!options.length) return
    event.preventDefault()
    const index = options.indexOf(document.activeElement)
    const offset = event.key === 'ArrowDown' ? 1 : -1
    const next = (index + offset + options.length) % options.length
    options[next].focus()
  }

  function onPointerdown(event) {
    const target = event.target
    if (!picker.contains(target) && !(anchor && anchor.contains(target))) close()
  }

  function close() {
    if (!picker) return
    picker.remove()
    picker = null
    anchor = null
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerdown, true)
    window.removeEventListener('scroll', close, { capture: true })
    window.removeEventListener('resize', close)
    syncButtons(false)
  }

  function position() {
    if (!picker || !anchor) return
    const rect = anchor.getBoundingClientRect()
    const margin = 10
    let left = rect.left + rect.width / 2 - picker.offsetWidth / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - picker.offsetWidth - margin))
    let top = rect.bottom + 8
    const overflow = top + picker.offsetHeight - window.innerHeight + margin
    if (overflow > 0 && rect.top - picker.offsetHeight - 8 >= margin) top = rect.top - picker.offsetHeight - 8
    picker.style.left = `${Math.round(left)}px`
    picker.style.top = `${Math.round(top)}px`
  }

  function open(button) {
    close()
    anchor = button
    picker = document.createElement('div')
    picker.className = 'theme-picker'
    picker.setAttribute('role', 'menu')
    picker.setAttribute('aria-label', '主题风格')
    for (const theme of THEMES) {
      const option = document.createElement('button')
      option.type = 'button'
      option.setAttribute('role', 'menuitemradio')
      option.setAttribute('aria-checked', String(theme.id === root.dataset.theme))
      option.dataset.themeOption = theme.id
      const swatch = document.createElement('span')
      swatch.className = 'theme-swatch'
      swatch.dataset.swatch = theme.id
      swatch.setAttribute('aria-hidden', 'true')
      const name = document.createElement('span')
      name.textContent = theme.name
      option.appendChild(swatch)
      option.appendChild(name)
      option.addEventListener('click', () => {
        select(theme.id)
        const target = anchor
        close()
        target?.focus()
      })
      picker.appendChild(option)
    }
    document.body.appendChild(picker)
    position()
    syncButtons(true)
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('pointerdown', onPointerdown, true)
    window.addEventListener('scroll', close, { capture: true })
    window.addEventListener('resize', close)
  }

  document.addEventListener('DOMContentLoaded', () => {
    for (const button of buttons()) {
      button.addEventListener('click', () => {
        if (picker && anchor === button) close()
        else open(button)
      })
    }
    syncButtons(false)
  })
})()
