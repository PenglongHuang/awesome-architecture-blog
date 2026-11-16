function focusSearch(event: Event) {
  const search = document.querySelector<HTMLAnchorElement>('.nav-search')
  if (!search) return false
  event.preventDefault()
  search.click()
  return true
}

document.addEventListener('keydown', (event) => {
  // ⌘K / Ctrl+K：任意位置聚焦搜索
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    focusSearch(event)
    return
  }
  // "/"：非输入状态下聚焦搜索
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]')) return
  focusSearch(event)
})

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-language-link]')) {
  const syncQuery = () => { link.search = window.location.search }
  for (const event of ['click', 'pointerdown', 'contextmenu', 'focus']) link.addEventListener(event, syncQuery)
}
