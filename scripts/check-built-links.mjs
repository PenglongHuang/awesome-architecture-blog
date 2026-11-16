import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'parse5'
import { createSiteUrls } from '../src/lib/site-urls.mjs'

const root = path.resolve('dist')
const urls = createSiteUrls({ base: process.env.BASE_PATH })
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file) : file.endsWith('.html') ? [file] : []
  })
}
function elements(node, acc = []) {
  if (node.tagName) acc.push(node)
  for (const child of node.childNodes ?? []) elements(child, acc)
  return acc
}
const documents = new Map()
function document(file) {
  if (!documents.has(file)) {
    const nodes = elements(parse(fs.readFileSync(file, 'utf8')))
    documents.set(file, {
      ids: new Set(nodes.flatMap(node => node.attrs.filter(attr => attr.name === 'id' || (node.tagName === 'a' && attr.name === 'name')).map(attr => attr.value))),
      links: nodes.filter(node => node.tagName === 'a').flatMap(node => node.attrs.filter(attr => attr.name === 'href').map(attr => attr.value)),
    })
  }
  return documents.get(file)
}
const errors = []
const files = walk(root).filter(file => !path.relative(root, file).startsWith(`learning${path.sep}`))
for (const file of files) {
  const route = path.relative(root, file).split(path.sep).join('/').replace(/index\.html$/, '')
  for (const href of document(file).links) {
    // Only local links: external origins are not checked over the network.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue
    let target
    try { target = new URL(href, `https://local.invalid${urls.base}${route}`) }
    catch { errors.push(`${route}: invalid URL ${href}`); continue }
    const pathname = decodeURIComponent(target.pathname)
    if (!pathname.startsWith(urls.base)) { errors.push(`${route}: link escapes site base: ${href}`); continue }
    const relative = pathname.slice(urls.base.length)
    const destination = path.resolve(root, relative)
    if (destination !== root && !destination.startsWith(root + path.sep)) { errors.push(`${route}: invalid target ${href}`); continue }
    const candidates = [destination, path.join(destination, 'index.html')]
    const existing = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    if (!existing) { errors.push(`${route}: missing target ${href}`); continue }
    // Generated courses are maintained by their skill; check entry existence only.
    if (target.hash && existing.endsWith('.html') && !relative.startsWith('learning/')) {
      const fragment = decodeURIComponent(target.hash.slice(1)).split(':~:text=')[0]
      if (fragment && !document(existing).ids.has(fragment)) errors.push(`${route}: missing anchor ${href}`)
    }
  }
}
if (errors.length) {
  console.error([...new Set(errors)].join('\n'))
  process.exit(1)
}
console.log(`Validated local links and anchors in ${files.length} built pages`)
