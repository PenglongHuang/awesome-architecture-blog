export function readingMinutes(body: string): number {
  const chars = body.replace(/\s/g, '').length
  return Math.max(1, Math.round(chars / 400))
}
