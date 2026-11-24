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

test('transparent brand responds to current theme and keeps favicon original', () => {
  const logo = source('src/assets/dhole-logo.svg')
  const mark = source('public/dhole-mark.svg')
  const theme = source('src/assets/theme.css')
  const favicon = readFileSync(new URL('../public/favicon.ico', import.meta.url))
  assert.match(logo, /var\(--dh-primary, #a80e18\)/)
  assert.match(logo, /var\(--dh-text, #000000\)/)
  assert.doesNotMatch(logo, /fill="#ffffff"|<mask\b/)
  assert.doesNotMatch(mark, /<rect\b/)
  assert.equal((mark.match(/<path /g) || []).length, 10)
  assert.match(theme, /\.dhole-brand-mark\s*\{[^}]*background-color: var\(--dh-primary\)/)
  assert.match(theme, /mask: url\("\/dhole-mark\.svg"\)/)
  assert.equal(favicon.readUInt16LE(2), 1)
  assert.equal(favicon.readUInt16LE(4), 3)
  assert.ok(favicon.includes(Buffer.from([24, 14, 168])))
  assert.match(source('index.html'), /href="\/favicon\.ico\?v=/)
})

test('official brand uses rectangular mark and square O and expands the complete lockup', () => {
  const logo = source('src/assets/dhole-logo.svg')
  const mark = source('public/dhole-mark.svg')
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  assert.match(logo, /data-brand-shape="square-o"><path d="M837\.45 617\.65h166\.46v166\.46h-166\.46Z"/)
  assert.equal((mark.match(/<path d="M[\d.]+ [\d.]+h[\d.]+v[\d.]+h-[\d.]+Z"/g) || []).length, 10)
  assert.match(sidebar, /v-if="compact" role="img"[^>]+dhole-brand-mark/)
  assert.match(sidebar, /v-if="!compact"[\s\S]*?dhole-brand-lockup[^>]+v-html="dholeLogo"/)
})
