import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { contentRevision } from './lib/translations.mjs'

const file = process.argv[2]
if (!file || !/^(tutorial|templates|cases)\/[a-zA-Z0-9-]+\.md$/.test(file)) {
  console.error('Usage: pnpm translation:hash tutorial/why-architecture-first.md')
  process.exit(1)
}
const source = fileURLToPath(new URL(`../src/content/posts/${file}`, import.meta.url))
console.log(contentRevision(fs.readFileSync(source, 'utf8')))
