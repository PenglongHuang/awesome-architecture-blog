const article = document.querySelector<HTMLElement>('.article')
if (article) {
  const sizeButton = article.querySelector<HTMLButtonElement>('[data-reading-size]')
  const focusButton = article.querySelector<HTMLButtonElement>('[data-reading-focus]')
  sizeButton?.addEventListener('click', () => {
    const enabled = article.classList.toggle('is-large')
    sizeButton.setAttribute('aria-pressed', String(enabled))
  })
  focusButton?.addEventListener('click', () => {
    const enabled = article.classList.toggle('is-focused')
    focusButton.setAttribute('aria-pressed', String(enabled))
  })

  const headings = [...article.querySelectorAll<HTMLElement>('.prose h2[id]')]
  const links = [...article.querySelectorAll<HTMLAnchorElement>('.toc a')]
  let scheduled = false
  function updateContents() {
    let active = headings[0]
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 180) active = heading
      else break
    }
    for (const link of links) {
      if (active && decodeURIComponent(link.hash.slice(1)) === active.id) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    }
    scheduled = false
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateContents) }
  }, { passive: true })
  updateContents()
}
