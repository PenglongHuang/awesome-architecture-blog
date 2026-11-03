import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../../public/theme.js', import.meta.url), 'utf8')

function mount({ stored, systemDark = false, blockedStorage = false } = {}) {
  const root = { dataset: {} }
  const icon = { textContent: '' }
  const attrs = new Map()
  const listeners = new Map()
  const emitted = []
  const button = {
    querySelector: () => icon,
    setAttribute: (name, value) => attrs.set(name, value),
    addEventListener: (name, listener) => listeners.set(name, listener),
  }
  let onReady
  let saved = stored
  runInNewContext(source, {
    document: {
      documentElement: root,
      querySelectorAll: () => [button],
      addEventListener: (_, listener) => { onReady = listener },
    },
    localStorage: {
      getItem: () => { if (blockedStorage) throw new Error('disabled'); return saved },
      setItem: (_, value) => { if (blockedStorage) throw new Error('disabled'); saved = value },
    },
    matchMedia: () => ({ matches: systemDark }),
    window: { dispatchEvent: event => emitted.push(event) },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail } },
  })
  return { root, icon, attrs, emitted, ready: () => onReady(), click: () => listeners.get('click')(), saved: () => saved }
}

describe('shared theme', () => {
  it('applies the saved preference before controls are mounted', () => {
    const page = mount({ stored: 'dark' })
    expect(page.root.dataset.theme).toBe('dark')
    page.ready()
    expect(page.icon.textContent).toBe('☀')
    expect(page.attrs.get('aria-label')).toBe('切换到明亮主题')
  })

  it('ignores invalid stored preferences and follows the system', () => {
    expect(mount({ stored: 'purple', systemDark: true }).root.dataset.theme).toBe('dark')
    expect(mount().root.dataset.theme).toBe('light')
  })

  it('persists toggles and notifies theme consumers such as comments', () => {
    const page = mount()
    page.ready()
    page.click()
    expect(page.root.dataset.theme).toBe('dark')
    expect(page.saved()).toBe('dark')
    expect(page.emitted[0]).toMatchObject({ type: 'themechange', detail: 'dark' })
    expect(page.attrs.get('aria-label')).toBe('切换到明亮主题')
    page.click()
    expect(page.saved()).toBe('light')
  })

  it('still follows system preferences and switches when storage is blocked', () => {
    const page = mount({ blockedStorage: true, systemDark: true })
    page.ready()
    expect(page.root.dataset.theme).toBe('dark')
    page.click()
    expect(page.root.dataset.theme).toBe('light')
    expect(page.icon.textContent).toBe('☾')
  })
})
