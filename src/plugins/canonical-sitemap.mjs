import { readFile, writeFile } from 'node:fs/promises'

/**
 * Sitemap's serialize hook rewrites page entries, but its index still uses the
 * deployment origin/base. Keep the index locations on the same canonical host.
 * @param {(path: string) => string} canonical
 * @returns {import('astro').AstroIntegration}
 */
export default function canonicalSitemap(canonical) {
  return {
    name: 'canonical-sitemap-index',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const index = new URL('sitemap-index.xml', dir)
        const xml = await readFile(index, 'utf8')
        await writeFile(index, xml.replace(/<loc>([^<]+)<\/loc>/g, (_, location) =>
          `<loc>${canonical(new URL(location).pathname).replace(/&/g, '&amp;')}</loc>`))
      },
    },
  }
}
