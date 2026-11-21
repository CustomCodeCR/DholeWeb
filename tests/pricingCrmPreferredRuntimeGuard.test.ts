import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { assertCrmPreferentialPricingLoader } from '../build/pricingCrmPreferredRuntimeGuard.ts'

// A green type-check of the original Vue source did not detect the production bug;
// validate the actual FCL/FTL Vite-generated loader instead.
const loader = (pref: string) => `
function customerPreferentialAmounts() {}
function customerManualPreferentialRates() {}
async function loadApplicableCosts() {
  const activeContext = activeCostContextKey()
  try {
    ${pref}
    if (activeContext !== activeCostContextKey()) return false
    costs.value = [...mergedCosts.values()].map(cost => cost)
    return true
  } catch (error) {
    return false
  }
}
function rebuildRateLines() {}
`

test('final compiled loader MUST ask CRM before applying ordinary catalog costs', () => {
  assert.doesNotThrow(() => assertCrmPreferentialPricingLoader(loader('await loadCustomerPreferentialRates()')))
  assert.throws(() => assertCrmPreferentialPricingLoader(loader('')), /must fetch CRM customer benefits/)
  assert.throws(() => assertCrmPreferentialPricingLoader(loader('costs.value = [...mergedCosts.values()]\nawait loadCustomerPreferentialRates()')), /must fetch CRM customer benefits/)
})

test('the FCL\/FTL source replacement includes the benefits load inside its generated loader', () => {
  const transform = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
  const start = transform.indexOf('async function loadApplicableCosts() {')
  const firstCostQuery = transform.indexOf('PricingService.selectWizardCosts(contextualQuery)', start)
  const preferredLoad = transform.indexOf('await loadCustomerPreferentialRates()', start)
  assert.ok(start >= 0 && preferredLoad > start && firstCostQuery > preferredLoad,
    'loadCustomerPreferentialRates() must be inside the final loader before Pricing retrieves costs')
  assert.match(transform.slice(start, firstCostQuery), /activeContext !== activeCostContextKey\(\)/)
})

test('customer switch and malformed CRM responses cannot silently reuse standard pricing', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const build = readFileSync(new URL('../build/pricingFtlLandCostsFix.ts', import.meta.url), 'utf8')
  const cacheKey = wizard.slice(wizard.indexOf('function activeCostContextKey(): string {'),
    wizard.indexOf('async function loadCostsForSelectedAlternative'))
  assert.match(cacheKey,/form\.crmClientKind, form\.clientId/)
  const compiledKey = build.slice(build.indexOf('function currentCostContextKey() {'),
    build.indexOf('function costResolvedByBackendContext'))
  assert.match(compiledKey,/form\.crmClientKind,[\s\S]*form\.clientId/)
  assert.match(wizard,/if \(!response \|\| !Array\.isArray\(response\.rates\)\)/)
  assert.match(wizard,/customerPreferentialCatalogContext\(selectedContext, costs\.value/)
})
