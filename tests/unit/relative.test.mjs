import { describe, it, expect } from 'vitest'
import { resolveRelative } from '../../scripts/lib/relative.mjs'

describe('resolveRelative', () => {
  it('resolves a same-directory link', () => {
    expect(resolveRelative('tutorial/01-a.md', '02-b.md')).toBe('tutorial/02-b.md')
  })
  it('resolves a parent-directory link', () => {
    expect(resolveRelative('tutorial/01-a.md', '../templates/x/README.md')).toBe('templates/x/README.md')
  })
  it('normalizes a ./ prefix', () => {
    expect(resolveRelative('cases/x/README.md', './y.md')).toBe('cases/x/y.md')
  })
})
