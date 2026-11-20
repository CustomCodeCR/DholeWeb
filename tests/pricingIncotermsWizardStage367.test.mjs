import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizard = readFileSync(
  new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
  'utf8',
)

test('P1-P9 retain the established wizard stages and the final review/PDF flow', () => {
  for (let stage = 1; stage <= 9; stage++) {
    assert.match(wizard, new RegExp('step === ' + stage + '\\b'))
  }
  assert.match(wizard, /Crear tarifa/)
  assert.match(wizard, /Líneas completas de la tarifa/)
  assert.match(wizard, /editingRate\.id/)
})

test('all six Incoterm logistics blocks stay available regardless of who pays', () => {
  assert.match(wizard, /const allowed = new Set<RateSection>\(sectionOrder\)/)
  for (const section of ['pickup_origin', 'origin_charges', 'international_freight', 'destination_charges', 'delivery_destination']) {
    assert.match(wizard, new RegExp("'" + section + "'"))
  }
  assert.match(wizard, /key: 'insurance', label: 'Seguro de carga'/)
  assert.match(wizard, /group\.key !== 'agent' \|\| group\.lines\.length > 0/)
  assert.match(wizard, /group\.lines\.length === 0/)
  assert.match(wizard, /no se genera un costo ficticio/i)
})

test('P6-P7 refuses stale or failed costs and retains P7 edits by context', () => {
  assert.match(wizard, /applicableToContext: true/)
  assert.match(wizard, /if \(requestContext !== activeCostContextKey\(\)\) return false/)
  assert.match(wizard, /const costsReady = await loadApplicableCosts\(\)/)
  assert.match(wizard, /if \(!costsReady\) return\s+rebuildRateLines\(\)/)
  assert.match(wizard, /lastIncotermRateLinesContextKey\.value === currentContext/)
  assert.match(wizard, /mergeOptionCostLines\(previousOptionLines, lines\)/)
})

test('changing Incoterm preserves EXW pickup and FCA warehouse draft inputs', () => {
  const watchStart = wizard.indexOf('() => selectedIncotermCode.value,\n  () => {')
  assert.notEqual(watchStart, -1)
  const excerpt = wizard.slice(watchStart, watchStart + 450)
  assert.doesNotMatch(excerpt, /pickupLocations\.value = \[\]/)
  assert.doesNotMatch(excerpt, /form\.warehouseId = ''/)
  assert.match(excerpt, /nearestPortRecommendations\.value = \[\]/)
})

test('CIF and CIP explicitly warn against duplicate insurance and unrequested freight', () => {
  assert.match(wizard, /selectedIncotermCode === 'CIF' \|\| selectedIncotermCode === 'CIP'/)
  assert.match(wizard, /no agregue una segunda prima/)
  assert.match(wizard, /const freightRequested =/)
  assert.match(wizard, /if \(visible\.has\('international_freight'\) && freightRequested\)/)
})
