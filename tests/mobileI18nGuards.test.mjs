import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')

test('AI translation is absent from the application shell', () => {
  for (const path of ['src/main.ts', 'src/shared/components/organisms/DhTopbar.vue', 'src/core/i18n/uiTextBridge.ts']) {
    const source = read(path)
    assert.doesNotMatch(source, /dhole:translate-content|dhole:restore-content|VITE_CONTENT_TRANSLATION_PROFILE_KEY|contentTranslationBusy|parseContentTranslationResponse|AiService\.executeChat/)
  }
  assert.doesNotMatch(read('src/main.ts'), /responsive-i18n\.css/)
  assert.match(read('src/main.ts'), /mobile-layout\.css/)
})

test('English and Spanish dictionaries contain the same topbar, tabs and dashboard keys', () => {
  const es = JSON.parse(read('src/core/i18n/es.json'))
  const en = JSON.parse(read('src/core/i18n/en.json'))
  for (const area of ['topbar','tabs','dashboard']) {
    assert.deepEqual(Object.keys(es[area]).sort(),Object.keys(en[area]).sort())
  }
  for (const locale of [es,en]) {
    assert.ok(locale.tabs.closeAll)
    assert.ok(locale.dashboard.seller)
    assert.ok(locale.topbar.unknownUser)
    assert.ok(!('translateContent' in locale.topbar))
  }
})

test('shell translations use locale keys, not Spanish-only strings', () => {
  assert.match(read('src/shared/components/organisms/DhWorkspaceTabs.vue'), /t\('tabs\.closeAll'\)/)
  assert.match(read('src/modules/dashboard/views/DashboardView.vue'), /t\('dashboard\.welcome'\)/)
  assert.match(read('src/modules/dashboard/views/DashboardView.vue'), /t\('dashboard\.seller'\)/)
})

test('mobile layout maintains overlay scrolling and avoids flattening every form grid', () => {
  const css = read('src/assets/mobile-layout.css')
  assert.match(css, /\[data-dh-overlay="modal"\]/)
  assert.match(css, /\[data-dh-overlay="drawer"\]/)
  assert.match(css, /overflow-y:\s*auto/)
  assert.match(css, /max-width:\s*767px/)
  assert.match(css, /max-width:\s*479px/)
  assert.doesNotMatch(read('src/assets/responsive.css'), /#app form :where\(\.grid\) \{\s*grid-template-columns/)
  assert.doesNotMatch(read('src/shared/components/layouts/MainLayout.vue'), /<main class="min-w-0 overflow-x-clip/)
})

test('operational dashboards do not force all dates to Spanish formatting', () => {
  for (const path of [
    'src/modules/dashboard/components/PricingRoleDashboard.vue',
    'src/modules/dashboard/components/SellerRoleDashboard.vue',
    'src/modules/dashboard/components/RateOperationalReportsPanel.vue',
    'src/modules/pricing/components/PricingRateRequestsPanel.vue',
  ]) {
    assert.match(read(path), /localeStore\.locale === 'en'/)
    assert.doesNotMatch(read(path), /(?:toLocaleDateString|toLocaleString|DateTimeFormat)\('es-CR'/)
  }
})
