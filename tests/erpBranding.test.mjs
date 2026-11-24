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

test('supplied SVG geometry remains intact and follows the theme', () => {
  const logo = source('src/assets/dhole-logo.svg')
  const mark = source('public/dhole-mark.svg')
  const theme = source('src/assets/theme.css')
  const favicon = readFileSync(new URL('../public/favicon.ico', import.meta.url))
  assert.match(logo, /viewBox="0 0 1463 509"/)
  assert.match(logo, /id="red" fill="#A90E19" fill-rule="evenodd"/)
  assert.match(logo, /id="black" fill="#000000" fill-rule="evenodd"/)
  assert.equal((logo.match(/<path /g) || []).length, 2)
  assert.doesNotMatch(logo, /<rect\b|<mask\b/)
  assert.match(theme, /\.dhole-brand-lockup svg #red \{ fill: var\(--dh-primary\); \}/)
  assert.match(theme, /\.dhole-brand-lockup svg #black \{ fill: var\(--dh-text\); \}/)
  assert.match(mark, /viewBox="-53 0 470 470"/)
  assert.equal(mark.match(/d="([^"]+)"\/>/)[1], logo.match(/id="red"[^>]+ d="([^"]+)"/)[1])
  assert.match(theme, /background-color: var\(--dh-primary\)/)
  assert.equal(favicon.readUInt16LE(2), 1)
  assert.equal(favicon.readUInt16LE(4), 3)
  assert.ok(favicon.includes(Buffer.from([169, 14, 25])))
  assert.match(source('index.html'), /href="\/favicon\.ico\?v=/)
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  assert.match(sidebar, /v-if="compact" role="img"[^>]+dhole-brand-mark/)
  assert.match(sidebar, /v-if="!compact"[\s\S]*?dhole-brand-lockup[^>]+v-html="dholeLogo\.replace/)
})

test('brand description is only shown in the logo tooltip', () => {
  for (const path of ['src/shared/components/layouts/AuthLayout.vue', 'src/shared/components/organisms/DhSidebar.vue']) {
    const view = source(path)
    assert.ok(view.includes("[t('app.subtitle'), t('app.meaning')]"))
    assert.ok(!view.includes("{{ t('app.subtitle') }}"))
    assert.ok(!view.includes("{{ t('app.meaning') }}"))
  }
})
