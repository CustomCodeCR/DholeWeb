import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const es = JSON.parse(source('src/core/i18n/es.json'))
const en = JSON.parse(source('src/core/i18n/en.json'))
const emailView = source('src/modules/pricing/views/PricingEmailImportsView.vue')
const emailDrawer = source('src/modules/pricing/components/PricingEmailMessageDrawer.vue')

test('email inbox and drawer translations are complete and balanced in ES/EN', () => {
  assert.deepEqual(Object.keys(es.pricingEmail).sort(), Object.keys(en.pricingEmail).sort())
  for (const [file, content] of [['view', emailView], ['drawer', emailDrawer]]) {
    assert.match(content, /useI18n\(\)/, file + ' must use vue-i18n')
    assert.match(content, /data-no-auto-translate/, file + ' must not translate user data')
    const references = [...content.matchAll(/t\('pricingEmail\.([A-Za-z]+)'/g)].map(m => m[1])
    for (const key of references) {
      assert.ok(es.pricingEmail[key], file + ' missing Spanish key ' + key)
      assert.ok(en.pricingEmail[key], file + ' missing English key ' + key)
    }
  }
  for (const key of ['statusReceived', 'statusProcessing', 'statusNeedsReview', 'jobAwaitingAi', 'jobSentToPricing', 'allAccounts', 'allStatuses', 'drawerReviewInPricing']) {
    assert.ok(es.pricingEmail[key] && en.pricingEmail[key], 'Missing status: ' + key)
  }
})

test('table headings, status options, and next actions react to language changes', () => {
  assert.match(emailView, /computed<DhTableColumn<EmailMessageDto>\[\]>/)
  assert.match(emailView, /const statusOptions = computed\(/)
  assert.match(emailView, /const nextAction = computed\(/)
  assert.match(emailView, /new Intl\.DateTimeFormat\(locale\.value === 'en'/)
  assert.match(emailDrawer, /new Intl\.DateTimeFormat\(locale\.value === 'en'/)
  assert.doesNotMatch(emailView, /new Intl\.DateTimeFormat\('es-CR'/)
  assert.doesNotMatch(emailDrawer, /new Intl\.DateTimeFormat\('es-CR'/)
})

test('settings stays available from mobile topbar and sidebar', () => {
  const bar = source('src/shared/components/organisms/DhTopbar.vue')
  const sidebar = source('src/shared/components/organisms/DhSidebar.vue')
  const css = source('src/assets/mobile-layout.css')
  assert.match(bar, /class="dh-topbar-settings-mobile" @click="openSettings"/)
  assert.doesNotMatch(bar, /Settings[^\n]+class="dh-topbar-optional-mobile"/)
  assert.match(sidebar, /v-if="mobileOpen"\s+to="\/settings"/)
  assert.match(css, /\.dh-topbar-settings-mobile\s*\{\s*display:\s*inline-flex !important/)
  assert.equal(en.sidebar.settings, 'Settings')
  assert.equal(es.sidebar.settings, 'Configuración')
})

test('mobile data tables use cards and desktop tables are hidden below 640px', () => {
  const css = source('src/assets/mobile-layout.css')
  assert.match(css, /@media \(max-width: 479px\)/)
  assert.match(css, /@media \(min-width: 480px\) and \(max-width: 639px\)/)
  assert.match(css, /\.dh-data-table-mobile\s*\{\s*display:\s*grid !important/)
  assert.match(css, /\.dh-data-table-desktop\s*\{\s*display:\s*none !important/)
  assert.match(emailView, /<DhDataTable/)
  assert.match(emailDrawer, /sm:flex-row sm:items-center sm:justify-between/)
})

test('Operations Platform is never inverted back into Spanish', () => {
  const bridge = source('src/core/i18n/uiTextBridge.ts')
  assert.equal(en.app.subtitle, 'Operations Platform')
  assert.equal(es.app.subtitle, 'Plataforma de operaciones')
  assert.match(bridge, /\['Plataforma de operaciones', 'Operations Platform'\]/)
  assert.doesNotMatch(bridge, /\['Operations Platform', 'Plataforma de operaciones'\]/)
})
