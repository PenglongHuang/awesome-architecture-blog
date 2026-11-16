import { describe, expect, it } from 'vitest'
import { createSiteUrls, normalizeBase, normalizeSite } from '../../src/lib/site-urls.mjs'

describe('site URLs', () => {
  it.each(['/', '/awesome-architecture-blog/'])('handles deployment base %s', base => {
    const urls = createSiteUrls({ site: 'example.com', base })
    expect(urls.href('/tutorial/a/')).toBe(`${base}tutorial/a/`)
    expect(urls.href(`${base}tutorial/a/`)).toBe(`${base}tutorial/a/`)
    expect(urls.canonical(`${base}tutorial/a/`)).toBe(`https://example.com${base}tutorial/a/`)
    expect(urls.canonical('/')).toBe(`https://example.com${base}`)
  })
  it('supports independent canonical overrides and normalizes slashes', () => {
    const urls = createSiteUrls({ site: 'mirror.example', base: '/blog/', canonicalSite: 'primary.example', canonicalBase: '//docs//' })
    expect(urls.canonical('/blog/tutorial/a/')).toBe('https://primary.example/docs/tutorial/a/')
    expect(urls.href('/tutorial/a/')).toBe('/blog/tutorial/a/')
    expect(createSiteUrls({ base: '/blog/', canonicalSite: 'primary.example' }).canonical('/')).toBe('https://primary.example/blog/')
    expect(createSiteUrls({ site: 'mirror.example', canonicalBase: '/' }).canonical('/')).toBe('https://mirror.example/')
  })
  it('uses the deployment defaults when CI variables are empty', () => {
    expect(createSiteUrls({ base: '', site: '' }).canonical('/')).toBe('https://penglonghuang.github.io/awesome-architecture-blog/')
  })
  it('preserves external, fragment and query links', () => {
    const urls = createSiteUrls()
    for (const link of ['https://example.com/a', '//cdn.example/a', 'mailto:a@example.com', '#part', '?tag=x']) expect(urls.href(link)).toBe(link)
    expect(urls.canonical('/tutorial/a/?q=x#part')).toContain('/tutorial/a/?q=x#part')
  })
  it('matches prefixes only at the beginning and at a path boundary', () => {
    const urls = createSiteUrls({ base: '/blog/' })
    expect(urls.href('/blogger/')).toBe('/blog/blogger/')
    expect(urls.href('/tutorial/blog/')).toBe('/blog/tutorial/blog/')
    expect(normalizeBase(' //docs// ')).toBe('/docs/')
    expect(() => normalizeSite('https://example.com/path')).toThrow()
  })
})
