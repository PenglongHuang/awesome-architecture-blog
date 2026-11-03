import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseAllDocuments } from '../../scripts/shims/yaml.mjs'

it('has one valid lock document matching the project dependency specifications', () => {
  const root = new URL('../../', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  const docs = parseAllDocuments(readFileSync(new URL('pnpm-lock.yaml', root), 'utf8'))
  expect(docs).toHaveLength(1)
  expect(docs[0].errors).toHaveLength(0)
  const importer = docs[0].toJS().importers['.']
  for (const section of ['dependencies', 'devDependencies']) {
    expect(Object.keys(importer[section]).sort()).toEqual(Object.keys(manifest[section]).sort())
    for (const [name, specifier] of Object.entries(manifest[section])) {
      expect(importer[section][name].specifier).toBe(specifier)
    }
  }
})
