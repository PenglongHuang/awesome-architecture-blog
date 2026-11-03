import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseAllDocuments } from '../../scripts/shims/yaml.mjs'

it('preserves pnpm 12 manager and project locks matching the manifest', () => {
  const root = new URL('../../', import.meta.url)
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  const docs = parseAllDocuments(readFileSync(new URL('pnpm-lock.yaml', root), 'utf8'))
  // pnpm 12 stores its own package-manager lock before the project lock.
  expect(docs).toHaveLength(2)
  for (const doc of docs) expect(doc.errors).toHaveLength(0)
  const manager = docs[0].toJS().importers['.'].packageManagerDependencies.pnpm
  expect(`pnpm@${manager.specifier}`).toBe(manifest.packageManager)
  expect(manager.version).toBe(manager.specifier)
  const importer = docs[1].toJS().importers['.']
  for (const section of ['dependencies', 'devDependencies']) {
    expect(Object.keys(importer[section]).sort()).toEqual(Object.keys(manifest[section]).sort())
    for (const [name, specifier] of Object.entries(manifest[section])) {
      expect(importer[section][name].specifier).toBe(specifier)
    }
  }
})
