import { visit } from 'unist-util-visit'

/**
 * Wrap tables in a scroll container so wide tables scroll horizontally on
 * narrow screens instead of overflowing the article column.
 */
export default function rehypeTableWrap() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.tagName !== 'table') return
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
      }
      return index + 1
    })
  }
}
