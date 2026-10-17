import { describe, it, expect } from 'vitest'
import {
  extractTitle, stripTitle, extractDescription,
  parseArrayLiteral, convertComponents,
} from '../../scripts/lib/frontmatter.mjs'

const sample = `# 01 · 测试标题

> 这是**导语**,带一个[链接](02-b.md)。

---

正文。

<Quiz
  question="选哪个?"
  :options="['A 选项', 'B 选项', 'C 选项']"
  :answer="1"
  explanation="因为 B。"
/>

<DecisionCard title="同步还是事件?" a="同步" aDesc="直接等" b="事件" bDesc="广播" verdict="简单就同步。" />
`

describe('frontmatter', () => {
  it('extracts and strips the H1', () => {
    expect(extractTitle(sample)).toBe('01 · 测试标题')
    expect(stripTitle(sample).startsWith('> 这是')).toBe(true)
  })
  it('extracts a cleaned description', () => {
    expect(extractDescription(sample)).toBe('这是导语,带一个链接。')
  })
  it('parses a JS string array literal', () => {
    expect(parseArrayLiteral("['a', 'b\\'c', \"d\"]")).toEqual(['a', "b'c", 'd'])
  })
  it('converts quiz and decision components to fenced blocks', () => {
    const { md, quizzes, decisions } = convertComponents(sample)
    expect(quizzes).toBe(1)
    expect(decisions).toBe(1)
    expect(md).toContain('```quiz')
    expect(md).toContain('"answer": 1')
    expect(md).toContain('```decision')
    expect(md).not.toContain('<Quiz')
  })
})
