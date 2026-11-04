import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../public/theme.js', import.meta.url), 'utf8')

function mount({ stored, systemDark = false, blockedStorage = false } = {}) {
  const root = { dataset: {} }
  const attrs = new Map()
  const emitted = []
  const added = []
  const documentListeners = new Map()
  const windowListeners = new Map()
  let saved = stored
  let active = null

  function createElement(tag) {
    const el = {
      tagName: tag,
      dataset: {},
      style: {},
      children: [],
      attrs: new Map(),
      listeners: new Map(),
      _text: '',
      className: '',
      offsetWidth: 172,
      offsetHeight: 160,
      removed: false,
      get textContent() { return el._text + el.children.map((child) => child.textContent).join('') },
      set textContent(value) { el._text = value },
      appendChild(child) { el.children.push(child); return child },
      remove() { el.removed = true },
      contains(node) {
        if (el === node) return true
        return el.children.some((child) => child.contains(node))
      },
      querySelectorAll(selector) {
        const matches = (node) => {
          if (selector === '[data-theme-option]' && node.dataset.themeOption) return true
          if (selector === '[data-theme-icon]' && node.dataset.themeIcon !== undefined) return true
          if (selector === '[role="menuitemradio"]' && node.attrs.get('role') === 'menuitemradio') return true
          return false
        }
        const walk = (nodes) => nodes.flatMap((node) => [...(matches(node) ? [node] : []), ...walk(node.children)])
        return walk(el.children)
      },
      querySelector(selector) { return el.querySelectorAll(selector)[0] ?? null },
      setAttribute(name, value) { el.attrs.set(name, String(value)) },
      getAttribute(name) { return el.attrs.get(name) ?? null },
      addEventListener(name, listener) {
        const list = el.listeners.get(name) ?? []
        el.listeners.set(name, [...list, listener])
      },
      removeEventListener() { /* the script never removes button listeners. */ },
      focus() { active = el },
      getBoundingClientRect: () => ({ left: 960, top: 20, width: 32, height: 32, bottom: 52 }),
    }
    return el
  }

  const button = createElement('button')
  const icon = createElement('span')
  icon.dataset.themeIcon = ''
  button.appendChild(icon)
  const fire = (listeners, name, event) => (listeners.get(name) ?? []).forEach((listener) => listener(event))
  const run = (name, event = {}) => fire(documentListeners, name, event)
  const runWindow = (name, event = {}) => fire(windowListeners, name, event)
  const buttonClick = () => fire(button.listeners, 'click', {})

  runInNewContext(source, {
    document: {
      documentElement: root,
      body: { appendChild: (el) => added.push(el) },
      createElement,
      querySelectorAll: () => [button],
      addEventListener: (name, listener) => documentListeners.set(name, [...(documentListeners.get(name) ?? []), listener]),
      removeEventListener: (name, listener) => {
        documentListeners.set(name, (documentListeners.get(name) ?? []).filter((item) => item !== listener))
      },
      get activeElement() { return active },
    },
    localStorage: {
      getItem: () => { if (blockedStorage) throw new Error('disabled'); return saved },
      setItem: (_, value) => { if (blockedStorage) throw new Error('disabled'); saved = value },
    },
    matchMedia: () => ({ matches: systemDark }),
    window: {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: (name, listener) => windowListeners.set(name, [...(windowListeners.get(name) ?? []), listener]),
      removeEventListener: (name, listener) => {
        windowListeners.set(name, (windowListeners.get(name) ?? []).filter((item) => item !== listener))
      },
      dispatchEvent: (event) => emitted.push(event),
    },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail } },
  })

  return {
    root,
    icon,
    button,
    attrs: button.attrs,
    emitted,
    added,
    saved: () => saved,
    active: () => active,
    ready: () => run('DOMContentLoaded'),
    click: () => buttonClick(),
    pick: (id) => {
      const panel = added.at(-1)
      const option = panel.querySelectorAll('[data-theme-option]').find((item) => item.dataset.themeOption === id)
      fire(option.listeners, 'click', {})
    },
    optionsOf: () => added.at(-1).querySelectorAll('[data-theme-option]'),
    press: (key) => run('keydown', { key, preventDefault: () => {} }),
    pointerdown: (target) => run('pointerdown', { target }),
    scroll: () => runWindow('scroll'),
  }
}

describe('shared theme', () => {
  it('applies the saved preference before controls are mounted', () => {
    const page = mount({ stored: 'sepia' })
    expect(page.root.dataset.theme).toBe('sepia')
  })

  it('ignores invalid stored preferences and follows the system', () => {
    expect(mount({ stored: 'purple', systemDark: true }).root.dataset.theme).toBe('dark')
    expect(mount().root.dataset.theme).toBe('light')
  })

  it('marks toggle buttons as picker launchers', () => {
    const page = mount({ stored: 'dark' })
    page.ready()
    expect(page.icon.textContent).toBe('●')
    expect(page.attrs.get('aria-label')).toBe('选择主题风格')
    expect(page.attrs.get('aria-haspopup')).toBe('menu')
    expect(page.attrs.get('aria-expanded')).toBe('false')
  })

  it('opens a picker listing every style with the current one checked', () => {
    const page = mount({ stored: 'dark' })
    page.ready()
    page.click()
    const picker = page.added.at(-1)
    expect(picker.className).toBe('theme-picker')
    expect(picker.attrs.get('role')).toBe('menu')
    const options = page.optionsOf()
    expect(options.map((option) => option.textContent)).toEqual(['明亮', '暗黑', '羊皮纸', '护眼绿'])
    expect(options.map((option) => option.attrs.get('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
    expect(page.attrs.get('aria-expanded')).toBe('true')

    page.click()
    expect(picker.removed).toBe(true)
    expect(page.attrs.get('aria-expanded')).toBe('false')
  })

  it('persists a picked style and notifies theme consumers such as comments', () => {
    const page = mount()
    page.ready()
    page.click()
    page.pick('green')
    expect(page.root.dataset.theme).toBe('green')
    expect(page.saved()).toBe('green')
    expect(page.emitted[0]).toMatchObject({ type: 'themechange', detail: 'green' })
    expect(page.added.at(-1).removed).toBe(true)
    expect(page.attrs.get('aria-expanded')).toBe('false')
    expect(page.active()).toBe(page.button)
  })

  it('moves keyboard focus through the picker options', () => {
    const page = mount()
    page.ready()
    page.click()
    const picker = page.added.at(-1)
    page.press('ArrowDown')
    expect(page.active()).toBe(picker.querySelectorAll('[role="menuitemradio"]')[0])
    page.press('ArrowDown')
    expect(page.active()).toBe(picker.querySelectorAll('[role="menuitemradio"]')[1])
    page.press('ArrowUp')
    expect(page.active()).toBe(picker.querySelectorAll('[role="menuitemradio"]')[0])
    expect(page.root.dataset.theme).toBe('light')
  })

  it('closes on Escape or outside pointerdown without changing the style', () => {
    const page = mount({ stored: 'sepia' })
    page.ready()
    page.click()
    const picker = page.added.at(-1)
    page.press('Escape')
    expect(picker.removed).toBe(true)
    expect(page.root.dataset.theme).toBe('sepia')

    page.click()
    const second = page.added.at(-1)
    expect(second.removed).toBe(false)
    page.pointerdown(page.added[0]) // not inside the picker or the button
    expect(second.removed).toBe(true)
    expect(page.root.dataset.theme).toBe('sepia')
  })

  it('closes when the page scrolls away from the anchored panel', () => {
    const page = mount()
    page.ready()
    page.click()
    const picker = page.added.at(-1)
    page.scroll()
    expect(picker.removed).toBe(true)
  })

  it('still follows system preferences and switches when storage is blocked', () => {
    const page = mount({ blockedStorage: true, systemDark: true })
    page.ready()
    expect(page.root.dataset.theme).toBe('dark')
    page.click()
    page.pick('light')
    expect(page.root.dataset.theme).toBe('light')
    expect(page.saved()).toBe(undefined)
  })
})
