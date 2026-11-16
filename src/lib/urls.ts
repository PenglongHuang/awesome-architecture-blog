import { createSiteUrls } from './site-urls.mjs'

export const siteUrls = createSiteUrls({
  site: import.meta.env.SITE_URL,
  base: import.meta.env.BASE_URL,
  canonicalSite: import.meta.env.PUBLIC_CANONICAL_SITE,
  canonicalBase: import.meta.env.PUBLIC_CANONICAL_BASE,
})
export const href = siteUrls.href
export const canonicalUrl = siteUrls.canonical
