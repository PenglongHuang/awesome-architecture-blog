const BASE = import.meta.env.BASE_URL

export function href(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path
  return `${BASE}${path.replace(/^\//, '')}`
}
