import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const es = JSON.parse(source('src/core/i18n/es.json'))
const en = JSON.parse(source('src/core/i18n/en.json'))

test('DHOLE ERP is the visible bilingual internal product brand', () => {
  for (const locale of [es, en]) {
    assert.equal(locale.app.name, 'DHOLE ERP')
    assert.equal(locale.app.meaning, 'Digital Hub for Operations, Logistics & Ecosystem')
    assert.equal(locale.app.pronunciation, undefined)
    assert.ok(locale.app.subtitle)
  }
  assert.equal(es.app.subtitle, 'Sistema de gestión interna')
  assert.equal(en.app.subtitle, 'Internal Management System')
})

test('brand identity is consistent across the shell, login and build metadata', () => {
  assert.match(source('index.html'), /<title>DHOLE ERP<\/title>/)
  assert.match(source('src/main.ts'), /DHOLE ERP · v/)
  assert.match(source('src/modules/auth/views/LoginView.vue'), /Bienvenido a DHOLE ERP/)
  assert.doesNotMatch(source('src/shared/components/layouts/AuthLayout.vue'), /app\.pronunciation/)
  assert.match(source('src/shared/components/layouts/AuthLayout.vue'), /\{\{ t\('app\.meaning'\) \}\}/)
  assert.match(source('src/shared/components/organisms/DhSidebar.vue'), /\{\{ t\('app\.meaning'\) \}\}/)
  assert.match(source('src/shared/components/layouts/AuthLayout.vue'), /data-testid="dhole-meaning"/)
  assert.match(source('src/shared/components/organisms/DhSidebar.vue'), /data-testid="dhole-meaning"/)
  assert.match(source('src/shared/components/organisms/DhSidebar.vue'), /app\.meaning/)
  assert.match(source('public/dhole-mark.svg'), /<title id="dhole-title">DHOLE ERP<\/title>/)
  assert.match(source('Dockerfile'), /VITE_APP_NAME="DHOLE ERP"/)
  // .env is intentionally absent from Docker build contexts; the Docker ARG is the fallback.
})

test('branding release updates web version consistently without renaming integrations', () => {
  const pkg = JSON.parse(source('package.json'))
  const lock = JSON.parse(source('package-lock.json'))
  const metadata = JSON.parse(source('version.json'))
  assert.equal(pkg.version, metadata.version)
  assert.equal(pkg.version, metadata.ecosystemVersion)
  assert.equal(pkg.version, lock.version)
  assert.equal(pkg.version, lock.packages[''].version)
  assert.equal(metadata.component, 'DholeWeb')
  assert.match(source('src/main.ts'), /dhole:stale-chunk-reload/)
})
