import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const overview = read('src/modules/pricing/views/PricingOverviewView.vue')
const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const router = read('src/core/router/index.ts')
const account = read('src/modules/crm/components/CrmAccountHub.vue')

test('the read-only Pricing route renders master screen 9, not a summary drawer', () => {
  assert.ok(overview.includes('PricingAlternativeWizardCrystal'))
  assert.ok(overview.includes('PricingWizardBoundary'))
  assert.ok(overview.includes(':view-only="Boolean(rateId) && viewOnly"'))
  assert.ok(overview.includes("route.query.mode === 'view'"))
  assert.ok(!overview.includes('PricingRateReadOnlyView'))
  assert.ok(wizard.includes("step.value = props.viewOnly ? 9 : 8"))
  assert.ok(wizard.includes('step === 9 && viewOnly && editingRate'))
  assert.ok(wizard.includes('Historial de revisiones'))
})

test('CRM quotation consultation links to the same master wizard route', () => {
  assert.ok(router.includes("name: 'pricing-rate-wizard'"))
  assert.ok(router.includes("path: 'pricing/rates/:rateId/wizard'"))
  assert.ok(account.includes("'/wizard?mode=view'"))
  assert.ok(account.includes('function quoteLink'))
})
