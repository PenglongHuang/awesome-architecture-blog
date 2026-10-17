import { visit } from 'unist-util-visit'
import { renderQuizHtml, renderDecisionHtml } from '../lib/quiz-html.mjs'

export default function remarkQuiz() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.lang !== 'quiz' && node.lang !== 'decision') return
      const data = JSON.parse(node.value)
      const html = node.lang === 'quiz' ? renderQuizHtml(data) : renderDecisionHtml(data)
      parent.children[index] = { type: 'html', value: html }
    })
  }
}
