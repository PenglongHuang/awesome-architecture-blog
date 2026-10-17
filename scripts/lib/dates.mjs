const START = Date.UTC(2026, 0, 6) // 2026-01-06 Tuesday
const DAY = 86400000

export function dateForIndex(index) {
  if (!Number.isInteger(index) || index < 1) throw new Error('index must be a positive integer')
  const w = Math.floor((index - 1) / 2)
  const offset = w * 7 + ((index - 1) % 2 === 1 ? 3 : 0)
  return new Date(START + offset * DAY).toISOString().slice(0, 10)
}
