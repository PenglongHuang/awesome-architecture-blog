export function extractTitle(md) {
  const m = md.match(/^#\s+(.+)$/m)
  if (!m) throw new Error('missing H1')
  return m[1].trim()
}

export function stripTitle(md) {
  return md.replace(/^#\s+.+\r?\n(\r?\n)?/, '')
}

function cleanInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

export function extractDescription(md) {
  const lines = md.split(/\r?\n/)
  let i = 0
  while (i < lines.length && !/^#\s+/.test(lines[i])) i++
  i++
  while (i < lines.length && lines[i].trim() === '') i++

  const quote = []
  while (i < lines.length && /^>\s?/.test(lines[i])) {
    quote.push(lines[i].replace(/^>\s?/, ''))
    i++
  }
  if (quote.length) {
    const text = cleanInline(quote.join(' '))
    if (text) return text.slice(0, 300)
  }

  while (i < lines.length && lines[i].trim() === '') i++
  const para = []
  while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s/.test(lines[i])) {
    para.push(lines[i])
    i++
  }
  const text = cleanInline(para.join(' '))
  if (!text) throw new Error('missing description')
  return text.slice(0, 300)
}

export function parseArrayLiteral(src) {
  const s = src.trim()
  if (!s.startsWith('[') || !s.endsWith(']')) throw new Error(`not an array literal: ${s}`)
  const inner = s.slice(1, -1)
  const out = []
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && (inner[i] === ',' || /\s/.test(inner[i]))) i++
    if (i >= inner.length) break
    const q = inner[i]
    if (q !== "'" && q !== '"') throw new Error(`only string arrays are supported: ${s}`)
    i++
    let buf = ''
    let closed = false
    while (i < inner.length) {
      const c = inner[i]
      if (c === '\\') { buf += inner[i + 1]; i += 2; continue }
      if (c === q) { i++; closed = true; break }
      buf += c
      i++
    }
    if (!closed) throw new Error(`unterminated string in array: ${s}`)
    out.push(buf)
  }
  return out
}

function parseAttributes(raw) {
  const attrs = {}
  const re = /(:?)([A-Za-z][\w-]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
  let m
  while ((m = re.exec(raw))) {
    const bound = m[1] === ':'
    const quote = m[3][0]
    const value = m[3].slice(1, -1).replace(/\\(.)/g, '$1')
    attrs[m[2]] = { bound, value }
  }
  return attrs
}

export function convertComponents(md) {
  let quizzes = 0
  let decisions = 0

  let out = md.replace(/<Quiz\b([\s\S]*?)\/>/g, (_, raw) => {
    const a = parseAttributes(raw)
    if (!a.question || !a.options || !a.answer) throw new Error('Quiz missing question/options/answer')
    const quiz = {
      question: a.question.value,
      options: parseArrayLiteral(a.options.value),
      answer: Number(a.answer.value),
      explanation: a.explanation?.value ?? '',
    }
    if (!Number.isInteger(quiz.answer) || quiz.answer < 0 || quiz.answer >= quiz.options.length) {
      throw new Error('Quiz answer out of range')
    }
    quizzes++
    return ['```quiz', JSON.stringify(quiz, null, 2), '```'].join('\n')
  })

  out = out.replace(/<DecisionCard\b([\s\S]*?)\/>/g, (_, raw) => {
    const a = parseAttributes(raw)
    const card = {
      title: a.title?.value ?? '',
      a: a.a?.value ?? '',
      aDesc: a.aDesc?.value ?? '',
      b: a.b?.value ?? '',
      bDesc: a.bDesc?.value ?? '',
      verdict: a.verdict?.value ?? '',
    }
    decisions++
    return ['```decision', JSON.stringify(card, null, 2), '```'].join('\n')
  })

  return { md: out, quizzes, decisions }
}
