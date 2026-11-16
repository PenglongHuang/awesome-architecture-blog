/** @param {any} file @returns {'zh-CN' | 'en'} */
export function markdownLocale(file) {
  return file?.data?.astro?.frontmatter?.locale === 'en' ? 'en' : 'zh-CN'
}
