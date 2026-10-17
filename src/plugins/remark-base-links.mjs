import { visit } from 'unist-util-visit'

export default function remarkBaseLinks({ base = '/' } = {}) {
  const prefix = base.replace(/\/$/, '')
  return (tree) => {
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('/') && !node.url.startsWith('//')) {
        node.url = prefix + node.url
      }
    })
  }
}
