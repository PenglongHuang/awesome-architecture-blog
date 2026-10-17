import { visit } from 'unist-util-visit'

const RE = /\*\*([^*\n]+?)\*\*/g

/**
 * CommonMark leaves `**bold**` literal when the closing delimiter is followed
 * by a CJK character (e.g. `**Reward（奖励）**是`). Re-tokenize those leftovers
 * into strong nodes. Only visits text nodes, so code blocks are untouched.
 */
export default function remarkCjkStrong() {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      const value = node.value
      if (!value.includes('**')) return

      const children = []
      let last = 0
      let m
      RE.lastIndex = 0
      while ((m = RE.exec(value))) {
        if (m.index > last) children.push({ type: 'text', value: value.slice(last, m.index) })
        children.push({ type: 'strong', children: [{ type: 'text', value: m[1] }] })
        last = m.index + m[0].length
      }
      if (children.length === 0) return
      if (last < value.length) children.push({ type: 'text', value: value.slice(last) })
      parent.children.splice(index, 1, ...children)
      return index + children.length
    })
  }
}
