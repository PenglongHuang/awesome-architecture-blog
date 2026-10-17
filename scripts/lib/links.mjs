import { resolveRelative } from './relative.mjs'

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i

export function rewriteLink({ link, fromFile, map }) {
  const trimmed = link.trim()
  if (!trimmed) return { ok: true, href: link }
  if (EXTERNAL.test(trimmed)) return { ok: true, href: link }

  const hashIndex = trimmed.indexOf('#')
  const anchor = hashIndex >= 0 ? trimmed.slice(hashIndex) : ''
  const withoutAnchor = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed
  const pathPart = withoutAnchor.split('?')[0]

  if (!pathPart.endsWith('.md')) return { ok: true, href: link }

  const resolved = resolveRelative(fromFile, pathPart)
  const href = map[resolved]
  if (href === undefined) {
    return { ok: false, reason: `unmapped link target: ${resolved}`, href: link }
  }
  return { ok: true, href: href + anchor }
}
