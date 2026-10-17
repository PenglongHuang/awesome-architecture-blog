import path from 'node:path'

export function resolveRelative(fromFile, target) {
  const dir = path.posix.dirname(fromFile)
  return path.posix.normalize(path.posix.join(dir, target))
}
