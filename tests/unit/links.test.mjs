import { describe, it, expect } from 'vitest'
import { rewriteLink } from '../../scripts/lib/links.mjs'

const map = {
  'tutorial/02-b.md': '/tutorial/two/',
  'templates/x/README.md': '/templates/x/',
}

describe('rewriteLink', () => {
  it('rewrites a mapped same-directory link', () => {
    expect(rewriteLink({ link: '02-b.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/tutorial/two/' })
  })
  it('rewrites a mapped relative link', () => {
    expect(rewriteLink({ link: '../templates/x/README.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/templates/x/' })
  })
  it('preserves anchors', () => {
    expect(rewriteLink({ link: '02-b.md#section', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: '/tutorial/two/#section' })
  })
  it('leaves external links untouched', () => {
    expect(rewriteLink({ link: 'https://example.com/a.md', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: 'https://example.com/a.md' })
  })
  it('leaves non-md links untouched', () => {
    expect(rewriteLink({ link: './image.png', fromFile: 'tutorial/01-a.md', map }))
      .toEqual({ ok: true, href: './image.png' })
  })
  it('fails loudly on unmapped targets', () => {
    const r = rewriteLink({ link: 'nope.md', fromFile: 'tutorial/01-a.md', map })
    expect(r.ok).toBe(false)
    expect(r.reason).toContain('tutorial/nope.md')
  })
})
