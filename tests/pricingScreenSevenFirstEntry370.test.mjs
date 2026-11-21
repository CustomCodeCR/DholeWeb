import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const transform = readFileSync(new URL('../build/pricingWizardEnhancements.ts', import.meta.url), 'utf8')

function getBetween(text, start, end) {
  const index = text.indexOf(start)
  assert.ok(index >= 0, 'Missing function ' + start)
  const to = text.indexOf(end, index)
  assert.ok(to > index, 'Missing function end: ' + end)
  return text.slice(index, to)
}

test('P6 provider freight is built before first entry to P7, with correct cost/sale', () => {
  const wizardSequence = getBetween(wizard, 'async function advanceSequentialWizard()', 'async function previousSequentialWizard()')
  assert.match(wizardSequence, /if \(step\.value === 6\)\s*\{[\s\S]*?rebuildRateLines\(\)[\s\S]*?ensureProviderFreightOnScreenSeven\(\)/)
  assert.match(wizardSequence, /step\.value \+= 1\s*await loadCostsForSelectedAlternative\(\)/)
  const freight = getBetween(wizard, 'function ensureProviderFreightOnScreenSeven()', 'function syncDeclaredCargoInsuranceOnEdit()')
  assert.match(freight, /costAmount: number\(form\.freightCost\)/)
  assert.match(freight, /saleAmount: number\(form\.freightSale\)/)
  assert.match(freight, /rateLines\.value\.some\(line => line\.costDetailType === 'Freight' && line\.included\)/)
  assert.match(wizard, /freightExpected =/)
})

test('P6 edits replace stale freight but preserve other P7 price, CostId and inclusion drafts', () => {
  const rebuild = getBetween(wizard, 'function rebuildRateLines()', 'function ensureProviderFreightOnScreenSeven()')
  assert.match(rebuild, /line\.costDetailType !== 'Freight' \? \(sameContext \|\| line\.manual\) : step\.value !== 6 && sameContext/)
  assert.match(rebuild, /mergeOptionCostLines\(previousOptionLines, lines\)/)
  const loader = getBetween(wizard, 'async function loadCostsForSelectedAlternative(', 'async function reloadCurrentAlternativeCosts()')
  assert.match(loader, /activeCatalogValidatedContexts\.has\(context\)/)
  assert.match(loader, /alternativeCostsLoaded\.value\[key\] === context/)
  assert.match(loader, /rateLines\.value\.length > 0 && !freightExpected && !missingCatalogLines/)
  assert.match(loader, /ensureProviderFreightOnScreenSeven\(\)/)
  assert.match(loader, /rememberCurrentCarrierDraft\(\)/)
  assert.match(wizard, /costs\.value = reconcileActiveCostCatalog\(draft\.costs \?\? \[\], allCosts\.value\)/)
  assert.match(wizard, /lastIncotermRateLinesContextKey\.value = alternativeCostsLoaded\.value\[carrierRouteKey\(poeId, carrierId\)\]/)
})

test('P7 groups are explicitly named, empty blocks do not render billing forms', () => {
  assert.match(wizard, /<h3[^>]*>{{ group\.label }}<\/h3>/)
  assert.match(wizard, /<div v-if="group\.lines\.length > 0" class="flex w-full flex-col/)
  assert.match(wizard, /Sin cargos incluidos para {{ group\.label\.toLowerCase\(\) }}/)
  assert.match(wizard, /outsideIncotermCandidateLines\(group\.key\)/)
  assert.match(wizard, /Costo unitario · {{ canonicalCurrencyCode\(line\) }}/)
  assert.match(wizard, /Venta unitaria · {{ canonicalCurrencyCode\(line\) }}/)
  assert.match(wizard, /\.crystal-lines-header \{\s*\/\*[^]*?position: relative;\s*top: auto;/)
})

test('LCL legacy navigation transform recognizes provider freight guard', () => {
  assert.match(transform, /const freightSyncNextAnchor = guardedNextAnchor\.replace\(/)
  assert.match(transform, /ensureProviderFreightOnScreenSeven/)
  assert.match(transform, /if \(code\.includes\(freightSyncNextAnchor\)\)/)
})
