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
  assert.match(sidebar, /v-if="compact" key="compact" role="img"[^>]+dhole-brand-mark/)
  assert.match(sidebar, /v-else key="expanded"[\s\S]*?dhole-brand-lockup[^>]+v-html="dholeLogo\.replace/)
})

test('brand description is only shown in the logo tooltip', () => {
  for (const path of ['src/shared/components/layouts/AuthLayout.vue', 'src/shared/components/organisms/DhSidebar.vue']) {
    const view = source(path)
    assert.ok(view.includes("[t('app.subtitle'), t('app.meaning')]"))
    assert.ok(!view.includes("{{ t('app.subtitle') }}"))
    assert.ok(!view.includes("{{ t('app.meaning') }}"))
  }
})

test('sidebar logo is 15 percent smaller and animates compact and expanded states', () => {
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  assert.match(sidebar, /<Transition name="sidebar-brand" mode="out-in">/)
  assert.match(sidebar, /\.sidebar-brand-lockup \{ width: 85%; \}/)
  assert.match(sidebar, /\.sidebar-brand-mark \{ width: 2\.125rem; height: 2\.125rem; \}/)
  assert.match(sidebar, /transition: opacity 180ms ease-out, transform 180ms ease-out/)
  assert.match(sidebar, /transition: opacity 120ms ease-in, transform 120ms ease-in/)
  assert.match(sidebar, /prefers-reduced-motion: reduce/)
  assert.match(sidebar, /transition-\[width,transform\] duration-300 ease-in-out/)
})

test('system version uses a shared compact card between notifications and user', () => {
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  const topbar = source('src/shared/components/organisms/DhTopbar.vue')
  const card = source('src/shared/components/molecules/DhCard.vue')
  assert.doesNotMatch(sidebar, /APP_VERSION|APP_CHANNEL|APP_COMMIT|sidebar-version/)
  const version = topbar.split('data-testid="topbar-version"')[1].split('</DhCard>')[0]
  assert.match(version, /APP_VERSION_DETAIL/)
  assert.match(version, /APP_VERSION/)
  assert.match(version, /APP_CHANNEL !== 'production'/)
  assert.match(version, /lg:flex/)
  assert.match(version, /h-11 w-fit shrink-0/)
  const opening = version.split('>')[0]
  assert.doesNotMatch(opening, /(?:^|\s):?title=/, 'DhCard title is a visible header, not a tooltip')
  assert.match(version, /<div[^>]*:title="APP_VERSION_DETAIL"/)
  assert.match(version, /leading-none/)
  assert.equal((version.match(/v\{\{ APP_VERSION \}\}/g) || []).length, 1)
  assert.doesNotMatch(version, /\{\{ APP_VERSION_DETAIL \}\}/)
  assert.match(topbar, /<DhCard\s+as="div"\s+padding="compact"\s+data-testid="topbar-version"/)
  assert.match(card, /padding === 'compact' && 'px-3 py-2'/)
  const position = topbar.indexOf('data-testid="topbar-version"')
  assert.ok(topbar.indexOf('ref="inboxRoot"') < position)
  assert.ok(position < topbar.indexOf('<DhAvatar'))
  assert.equal((topbar.match(/data-testid="topbar-version"/g) || []).length, 1)
  assert.ok(topbar.includes("${APP_VERSION_DETAIL}"))
})

test('sidebar logo is centered in the entire card independently of its controls', () => {
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  assert.match(sidebar, /relative flex min-h-16 items-center justify-center/)
  assert.match(sidebar, /sidebar-brand-expanded flex min-w-0 flex-1 justify-center/)
  assert.match(sidebar, /\.sidebar-brand-expanded \.sidebar-brand-lockup \{ max-width: calc\(100% - 5rem\); \}/)
  assert.equal((sidebar.match(/absolute right-2\.5 top-1\/2/g) || []).length, 2)
  assert.match(sidebar, /\.sidebar-brand-lockup \{ width: 85%; \}/)
})

test('compact sidebar uses bundled current logo instead of a cacheable public mask', () => {
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  const theme = source('src/assets/theme.css')
  assert.ok(sidebar.includes('dholeLogo.match(/<path id="red"'))
  assert.ok(sidebar.includes('viewBox="-53 0 470 470"'))
  assert.ok(sidebar.includes('encodeURIComponent(compactBrandSvg)'))
  assert.ok(sidebar.includes("'--dh-brand-mask': compactBrandMask"))
  assert.ok(sidebar.includes("compact ? 'px-1.5' : 'px-2.5'"))
  assert.ok(theme.includes('mask: var(--dh-brand-mask, none) center / contain no-repeat'))
  assert.ok(!theme.includes('url("/dhole-mark.svg")'))
})
