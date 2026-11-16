import { messagesFor } from '../lib/i18n.mjs'
import { markdownLocale } from './markdown-locale.mjs'
import { visit } from 'unist-util-visit'

const ASCII = /[─│┌┐└┘├┤┬┴┼▶◀▲▼→←]/
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function remarkAsciiFigure() {
  return (tree, file) => {
    const t = messagesFor(markdownLocale(file))
    let n = 0
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!ASCII.test(node.value)) return
      n++
      parent.children[index] = {
        type: 'html',
        value: `<figure><figcaption>${t.figure} ${n}</figcaption><pre class="ascii"><code>${esc(node.value)}</code></pre></figure>`,
      }
    })
  }
}
