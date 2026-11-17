import { describe, expect, it } from 'vitest'
import { localeFromPath, localePath, messagesFor } from '../../src/lib/i18n.mjs'
import { channelStaticPaths } from '../../src/lib/routes'
import { postAlternates, postsForLocale, postsInSeries, translationKey } from '../../src/lib/posts'
import { renderQuizHtml } from '../../src/lib/quiz-html.mjs'
import remarkQuiz from '../../src/plugins/remark-quiz.mjs'
import { contentRevision, validateTranslations } from '../../scripts/lib/translations.mjs'

const series = [{ id: 'foundations', translations: { en: { title: 'Foundations', description: 'Description' } } }]
function pair() {
  const zh = { rel: 'tutorial/a.md', raw: 'Chinese source\n', body: '```quiz\n{}\n```', data: { kind: 'tutorial', series: 'foundations', order: 1 } }
  const en = { rel: 'en/tutorial/a.md', raw: 'English source', body: '```quiz\n{}\n```', data: { ...zh.data, locale: 'en', translationKey: 'tutorial/a', sourceHash: contentRevision(zh.raw) } }
  return { zh, en }
}
function post(id, locale, order = 1) {
  return { id, body: '', data: { locale, kind: 'tutorial', series: 'foundations', order } }
}

describe('locale routing and collections', () => {
  it('recognizes the language after the deployment base', () => {
    expect(localeFromPath('/blog/en/tutorial/', '/blog/')).toBe('en')
    expect(localeFromPath('/en/tutorial/', '/')).toBe('en')
    expect(localeFromPath('/enough/', '/')).toBe('zh-CN')
    expect(localeFromPath('/en/tutorial/', '/en/')).toBe('zh-CN')
    expect(localePath('/tutorial/a/', 'en')).toBe('/en/tutorial/a/')
    expect(localePath('/en/tutorial/a/', 'zh-CN')).toBe('/tutorial/a/')
  })
  it('keeps lists, siblings and generated paths in the requested language', () => {
    const posts = [post('tutorial/a', 'zh-CN'), post('en/tutorial/a', 'en'), post('en/tutorial/b', 'en', 2)]
    expect(postsForLocale(posts)).toEqual([posts[0]])
    expect(postsInSeries(posts, 'foundations', 'en')).toEqual(posts.slice(1))
    expect(channelStaticPaths('tutorial', posts).filter(path => path.props.type === 'post')).toHaveLength(1)
    expect(channelStaticPaths('tutorial', posts, 'en').filter(path => path.props.type === 'post')).toHaveLength(2)
    expect(translationKey(posts[0])).toBe(translationKey(posts[1]))
    expect(postAlternates(posts[0], posts).en).toMatch(/\/en\/tutorial\/a\/$/)
    expect(postAlternates(posts[2], posts)['zh-CN']).toBeUndefined()
  })
  it('renders English interaction labels from Markdown frontmatter', () => {
    const quiz = { question: '<question>', options: ['A', 'B'], answer: 1, explanation: '&' }
    const tree = { type: 'root', children: [{ type: 'code', lang: 'quiz', value: JSON.stringify(quiz) }] }
    remarkQuiz()(tree, { data: { astro: { frontmatter: { locale: 'en' } } } })
    expect(tree.children[0].value).toContain('Check answer')
    expect(tree.children[0].value).toContain('data-locale="en"')
    expect(tree.children[0].value).toContain('&lt;question&gt;')
    expect(renderQuizHtml(quiz)).toContain('确认')
    expect(Object.keys(messagesFor('en')).sort()).toEqual(Object.keys(messagesFor()).sort())
  })
})

describe('translation review checks', () => {
  it('accepts complete reviewed pairs and unpublished English series', () => {
    const { zh, en } = pair()
    expect(validateTranslations([zh, en], series)).toEqual([])
    expect(validateTranslations([{ ...zh, data: { ...zh.data, series: 'advanced' } }], [])).toEqual([])
    expect(contentRevision('a\r\nb\r\n')).toBe(contentRevision('a\nb\n'))
  })
  it('rejects stale translations, orphan entries and duplicate keys', () => {
    const { zh, en } = pair()
    expect(validateTranslations([{ ...zh, raw: 'Changed source' }, en], series).join()).toContain('stale')
    expect(validateTranslations([en], series).join()).toContain('missing Chinese counterpart')
    expect(validateTranslations([zh, en, { ...en, rel: 'en/tutorial/b.md' }], series).join()).toContain('duplicate translation key')
    expect(validateTranslations([zh], series).join()).toContain('English series is missing')
  })
  it('rejects mismatched component counts and accidental Chinese links', () => {
    const { zh, en } = pair()
    en.body = '[Other article](/tutorial/other/)'
    const errors = validateTranslations([zh, en], series).join()
    expect(errors).toContain('quiz count differs')
    expect(errors).toContain('cross-language link must be marked')
    en.body = zh.body + '\n[Other article (Chinese)](/tutorial/other/)'
    expect(validateTranslations([zh, en], series)).toEqual([])
  })
  it('rejects omitted sections and illustrations, without counting fenced examples as headings', () => {
    const { zh, en } = pair()
    zh.body = '## Section\n### Detail\n![Diagram](a.svg)\n```text\n## Not a section\n```'
    en.body = '## Section'
    expect(validateTranslations([zh, en], series).join()).toContain('h3 structure differs')
    expect(validateTranslations([zh, en], series).join()).toContain('images structure differs')
    expect(validateTranslations([zh, en], series).join()).toContain('code structure differs')
    en.body = '## Section\n### Detail\n![Diagram](a-en.svg)\n```text\n## Not a section\n```'
    expect(validateTranslations([zh, en], series)).toEqual([])
  })
})
