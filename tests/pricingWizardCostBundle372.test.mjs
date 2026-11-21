import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const wizard = read('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const ftl = read('build/pricingFtlLandCostsFix.ts')
const own = read('build/pricingOwnLtlPanamaCosts.ts')
const lcl = read('build/pricingLclColoaderAgentCosts20261009.ts')
const service = read('src/core/services/pricingService.ts')
const endpoints = read('src/core/composables/endpoints.ts')

test('Pricing bundles P7 active and contextual catalog in a single request', () => {
  assert.match(endpoints, /selectWizardCosts: \{ method: 'GET', path: '\/api\/pricing\/costs\/wizard-bundle'/)
  assert.match(service, /async selectWizardCosts\(query\?: BrowseCostsQuery\)/)
  assert.match(service, /Array\.isArray\(value\.catalog\) \|\| !Array\.isArray\(value\.applicable\)/)
  assert.match(ftl, /const bundle = await PricingService\.selectWizardCosts\(contextualQuery\)/)
  assert.match(ftl, /allCosts\.value = fullCatalog/)
  assert.match(ftl, /activeCatalogValidatedContexts\.add\(activeContext\)/)
  assert.doesNotMatch(ftl, /Promise\.allSettled\(\[\s*PricingService\.selectCosts/)
  assert.match(own, /selectLtlPanamaCosts\(contextualCosts/)
  assert.doesNotMatch(own, /selectLtlPanamaCosts\(fullCatalog/)
  assert.match(lcl, /const bundle = await PricingService\.selectWizardCosts/)
  assert.doesNotMatch(lcl, /Promise\.allSettled/)
})

test('P6 navigation retains inland, provider freight, and explains blockers', () => {
  const seq = wizard.slice(wizard.indexOf('async function advanceSequentialWizard()'),
    wizard.indexOf('async function previousSequentialWizard()'))
  assert.match(seq, /if \(!ready\) \{[\s\S]*?return/)
  assert.match(seq, /toastStore\.warning\('Faltan datos para continuar'/)
  assert.match(seq, /restoreCurrentInland\(\)/)
  assert.match(seq, /ensureProviderFreightOnScreenSeven\(\)/)
  assert.match(wizard, /step\.value < 7 \|\| !agentId/)
  assert.match(wizard, /customerPreferentialAccountId\.value && !customerPreferentialError\.value/)
})
