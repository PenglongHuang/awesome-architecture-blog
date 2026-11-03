document.addEventListener('keydown', (event) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]')) return
  const search = document.querySelector<HTMLAnchorElement>('.nav-search')
  if (!search) return
  event.preventDefault()
  search.click()
})
