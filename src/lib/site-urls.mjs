export const DEFAULT_SITE = 'https://penglonghuang.github.io'
export const DEFAULT_BASE = '/awesome-architecture-blog/'

/** @param {string | undefined} value */
export function normalizeBase(value) {
  const parts = (value ?? '').trim().split('/').filter(Boolean)
  return parts.length ? `/${parts.join('/')}/` : '/'
}

/** @param {string | undefined} value */
export function normalizeSite(value) {
  const raw = value?.trim() || DEFAULT_SITE
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Site URL must be an HTTP(S) origin without a path, query or credentials')
  }
  return url.origin
}

/**
 * Paths are site-relative. An existing deployment prefix is removed once.
 * @param {{site?: string, base?: string, canonicalSite?: string, canonicalBase?: string}} options
 */
export function createSiteUrls(options = {}) {
  const base = normalizeBase(options.base?.trim() || DEFAULT_BASE)
  const site = normalizeSite(options.site)
  const canonicalSite = normalizeSite(options.canonicalSite || site)
  const canonicalBase = normalizeBase(options.canonicalBase?.trim() || base)
  /** @param {string} path */
  const relative = path => {
    const rooted = `/${path.replace(/^\/+/, '')}`
    if (base !== '/' && rooted === base.slice(0, -1)) return ''
    return (base !== '/' && rooted.startsWith(base) ? rooted.slice(base.length) : rooted.slice(1))
  }
  /** @param {string} path */
  const href = path => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(path) ? path : `${base}${relative(path)}`
  /** @param {string} path */
  const canonical = path => new URL(`${canonicalBase}${relative(path)}`, canonicalSite).href
  return { base, site, canonicalBase, canonicalSite, href, canonical }
}
