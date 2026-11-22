import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const es = JSON.parse(source('src/core/i18n/es.json'))
const en = JSON.parse(source('src/core/i18n/en.json'))
test('ERP branding remains bilingual without a prescribed pronunciation', () => {
  for(const lang of [es, en]) {
    assert.equal(lang.app.name, 'DHOLE ERP')
    assert.equal(lang.app.meaning, 'Digital Hub for Operations, Logistics & Ecosystem')
    assert.equal(lang.app.pronunciation, undefined)
  }
  assert.equal(es.app.subtitle, 'Sistema de gestión interna')
  assert.equal(en.app.subtitle, 'Internal Management System')
})
test('visible branding is consistent', () => {
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
  // .env is absent in Docker build contexts; the Docker ARG is authoritative.
})
test('SemVer metadata is aligned while API identifiers remain compatible', () => {
  const pkg = JSON.parse(source('package.json'))
  const lock = JSON.parse(source('package-lock.json'))
  const meta = JSON.parse(source('version.json'))
  assert.equal(pkg.version, meta.version)
  assert.equal(pkg.version, meta.ecosystemVersion)
  assert.equal(pkg.version, lock.version)
  assert.equal(pkg.version, lock.packages[''].version)
  assert.equal(meta.component, 'DholeWeb')
  assert.match(source('src/main.ts'), /dhole:stale-chunk-reload/)
})
