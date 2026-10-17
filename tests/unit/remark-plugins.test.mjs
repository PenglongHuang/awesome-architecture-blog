import { describe, it, expect } from 'vitest'
import remarkQuiz from '../../src/plugins/remark-quiz.mjs'
import remarkBaseLinks from '../../src/plugins/remark-base-links.mjs'
import remarkAsciiFigure from '../../src/plugins/remark-ascii-figure.mjs'
import { renderQuizHtml } from '../../src/lib/quiz-html.mjs'

function root(children) { return { type: 'root', children } }

describe('remark-quiz', () => {
  it('replaces a quiz code block with html', () => {
    const tree = root([{ type: 'code', lang: 'quiz', value: JSON.stringify({ question: 'Q', options: ['A', 'B'], answer: 1, explanation: 'E' }) }])
    remarkQuiz()(tree)
    expect(tree.children[0].type).toBe('html')
    expect(tree.children[0].value).toContain('class="quiz"')
    expect(tree.children[0].value).toContain('data-answer="1"')
  })
  it('escapes html in options', () => {
    const html = renderQuizHtml({ question: '<q>', options: ['<b>'], answer: 0, explanation: '&' })
    expect(html).toContain('&lt;q&gt;')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('&amp;')
  })
})

describe('remark-base-links', () => {
  it('prefixes root-relative links only', () => {
    const tree = root([
      { type: 'link', url: '/tutorial/x/', children: [] },
      { type: 'link', url: 'https://example.com/', children: [] },
    ])
    remarkBaseLinks({ base: '/awesome-architecture-blog/' })(tree)
    expect(tree.children[0].url).toBe('/awesome-architecture-blog/tutorial/x/')
    expect(tree.children[1].url).toBe('https://example.com/')
  })
})

describe('remark-ascii-figure', () => {
  it('wraps box-drawing code blocks in a figure', () => {
    const tree = root([{ type: 'code', lang: null, value: '┌──┐\n│x │\n└──┘' }])
    remarkAsciiFigure()(tree)
    expect(tree.children[0].type).toBe('html')
    expect(tree.children[0].value).toContain('<figure>')
    expect(tree.children[0].value).toContain('图 1')
  })
  it('leaves ordinary code blocks alone', () => {
    const code = { type: 'code', lang: 'js', value: 'const x = 1' }
    const tree = root([code])
    remarkAsciiFigure()(tree)
    expect(tree.children[0]).toBe(code)
  })
})
