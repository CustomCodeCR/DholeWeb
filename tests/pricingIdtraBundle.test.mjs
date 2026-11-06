import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

test('production bundle contains the screen 9 IDTRA action after all Vite transforms', () => {
  const assetsDir = new URL('../dist/assets/', import.meta.url)
  const scripts = readdirSync(assetsDir).filter((file) => file.endsWith('.js'))
  assert.ok(scripts.length > 0, 'Build assets must exist before this test')
  const compiled = scripts.map((file) => readFileSync(join(assetsDir.pathname, file), 'utf8')).join('\n')
  assert.ok(compiled.includes('Asignar IDTRA'), 'Compiled wizard must expose the IDTRA button')
  assert.ok(compiled.includes('pricing-screen9-idtra-action'), 'Compiled wizard must retain the screen 9 IDTRA action')
  const metadata = JSON.parse(readFileSync(new URL('../dist/version.json', import.meta.url), 'utf8'))
  const packageMetadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(metadata.version, packageMetadata.version)
})
