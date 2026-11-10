import type { APIContext } from 'astro'

export function GET({ site }: APIContext) {
  const configuredSite = import.meta.env.PUBLIC_CANONICAL_SITE || String(site || 'https://penglonghuang.github.io')
  const origin = configuredSite.endsWith('/') ? configuredSite.slice(0, -1) : configuredSite
  const rawBase = import.meta.env.PUBLIC_CANONICAL_BASE || import.meta.env.BASE_URL
  const base = rawBase === '/' ? '' : `/${String(rawBase).split('/').filter(Boolean).join('/')}`
  const sitemap = new URL(`${base}/sitemap-index.xml`, origin).href
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    'User-agent: OAI-SearchBot',
    'Allow: /',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n')

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
