import { markdownLocale } from './markdown-locale.mjs'
import { visit } from 'unist-util-visit'
import { renderQuizHtml, renderDecisionHtml } from '../lib/quiz-html.mjs'

export default function remarkQuiz() {
  return (tree, file) => {
    const locale = markdownLocale(file)
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return
      if (node.lang !== 'quiz' && node.lang !== 'decision') return
      const data = JSON.parse(node.value)
      const html = node.lang === 'quiz' ? renderQuizHtml(data, locale) : renderDecisionHtml(data, locale)
      parent.children[index] = { type: 'html', value: html }
    })
  }
}
