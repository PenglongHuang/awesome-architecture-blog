import { describe, it, expect } from 'vitest'
import remarkCjkStrong from '../../src/plugins/remark-cjk-strong.mjs'

describe('remark-cjk-strong', () => {
  it('converts literal bold markers followed by CJK into strong nodes', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: '**Reward（奖励）**是对' }] }],
    }
    remarkCjkStrong()(tree)
    const [strong, rest] = tree.children[0].children
    expect(strong.type).toBe('strong')
    expect(strong.children[0].value).toBe('Reward（奖励）')
    expect(rest.value).toBe('是对')
  })

  it('splits text around multiple leftovers', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', value: '前**甲**中**乙**后' }] }],
    }
    remarkCjkStrong()(tree)
    const kinds = tree.children[0].children.map((n) => n.type)
    expect(kinds).toEqual(['text', 'strong', 'text', 'strong', 'text'])
  })

  it('leaves code blocks untouched', () => {
    const code = { type: 'code', value: '**x**是' }
    const tree = { type: 'root', children: [code] }
    remarkCjkStrong()(tree)
    expect(tree.children[0]).toBe(code)
  })
})
