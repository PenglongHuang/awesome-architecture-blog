import { visit } from 'unist-util-visit'

const ASCII = /[─│┌┐└┘├┤┬┴┼▶◀▲▼→←]/
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export default function remarkAsciiFigure() {
  return (tree) => {
    let n = 0
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (!ASCII.test(node.value)) return
      n++
      parent.children[index] = {
        type: 'html',
        value: `<figure><figcaption>图 ${n}</figcaption><pre class="ascii"><code>${esc(node.value)}</code></pre></figure>`,
      }
    })
  }
}
