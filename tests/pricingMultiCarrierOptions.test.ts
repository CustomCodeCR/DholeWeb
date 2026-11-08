import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carrierRouteKey, normalizePoeCarrierIds, poeCarrierSelectionComplete,
  nextPoeInSelection, nextCarrierRoute, mergeOptionCostLines, pricingCostContextKey,
} from '../src/modules/pricing/utils/pricingMultiCarrierOptions.ts'

import { pricingCurrencyValue } from '../src/modules/pricing/utils/pricingCurrencyValue.ts'
import { haulageAssociation, keepFreshInlandPrice } from '../src/modules/pricing/utils/pricingHaulageCosts.ts'
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const plugin = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')

test('selection stays unique per POE and preserves click order', () => {
  assert.deepEqual(normalizePoeCarrierIds(['msc', 'one', 'msc', 'missing'], ['one', 'msc', 'hapag']), ['msc', 'one'])
  assert.notEqual(carrierRouteKey('caldera', 'msc'), carrierRouteKey('moin', 'msc'))
  assert.notEqual(carrierRouteKey('a', 'bc'), carrierRouteKey('ab', 'c'))
  assert.equal(poeCarrierSelectionComplete(['caldera', 'balboa'], { caldera: ['msc'] }), false)
  assert.equal(poeCarrierSelectionComplete(['caldera', 'balboa'], { caldera: ['msc'], balboa: ['one'] }), true)
})

test('Screen 5 walks Caldera, Balboa, Moin in order without skipped POE', () => {
  const poes = ['caldera', 'balboa', 'moin']
  assert.equal(nextPoeInSelection(poes, 'caldera'), 'balboa')
  assert.equal(nextPoeInSelection(poes, 'balboa'), 'moin')
  assert.equal(nextPoeInSelection(poes, 'moin'), null)
  assert.equal(nextPoeInSelection(poes, 'unknown'), null)
  assert.match(wizard, /const nextPoeId = nextPoeInSelection\(selectedPoeIds\.value, form\.destinationId\)/)
  assert.match(wizard, /await activatePoeRoute\(nextPoeId\)/)
  assert.match(wizard, /if \(!cached && destinationId && step\.value === 5\) await searchApprovedRates\(\)/)
})

test('Screens 6 and 7 process one chosen carrier at a time before Screen 8', () => {
  const routes = [
    { poeId: 'caldera', carrierId: 'msc' },
    { poeId: 'caldera', carrierId: 'one' },
    { poeId: 'balboa', carrierId: 'pil' },
    { poeId: 'moin', carrierId: 'cosco' },
  ]
  assert.deepEqual(nextCarrierRoute(routes, 'caldera', 'msc'), routes[1])
  assert.deepEqual(nextCarrierRoute(routes, 'caldera', 'one'), routes[2])
  assert.deepEqual(nextCarrierRoute(routes, 'balboa', 'pil'), routes[3])
  assert.equal(nextCarrierRoute(routes, 'moin', 'cosco'), null)
  assert.match(wizard, /async function advanceSequentialWizard\(\)/)
  assert.match(wizard, /rememberCurrentCarrierDraft\(\)/)
  assert.match(wizard, /await activateCarrierRoute\(nextRoute\.poeId, nextRoute\.carrierId\)/)
  assert.match(wizard, /step\.value \+= 1/)
  assert.match(wizard, /async function previousSequentialWizard\(\)/)
  assert.match(wizard, /await loadCostsForSelectedAlternative\(\)/)
})

test('Screen 5 displays loaded approved and preauthorized bundles first; manual carrier optional', () => {
  assert.match(wizard, /<details v-if="multiCarrierSelectionMode"/)
  assert.match(wizard, /Añadir naviera manual sin tarifa cargada/)
  assert.match(wizard, /class="order-1 space-y-4"/)
  assert.match(wizard, /@click="advanceSequentialWizard"/)
  assert.match(wizard, /@click="toggleManualCarrier\(carrier\.value\)"/)
  assert.match(wizard, /@click="advanceSequentialWizard"/)
  assert.doesNotMatch(wizard, /¿Desea añadir más navieras\?/)
  assert.doesNotMatch(wizard, /askAddMoreCarriers/)
  assert.match(plugin, /bundle\.preAuthorized \? 'Incluye preautorizada' : 'Preaprobada'/)
  assert.match(plugin, /registerSelectedFclBundleOption\(selectedCarrierOptionId, bundle\.key\)/)
})

test('imported rates do not become manual when selected; drafts keep isolated costs', () => {
  assert.match(wizard, /form\.manualRate = false/)
  assert.match(wizard, /selectedCarriersByPoe\.value = \{/)
  assert.match(wizard, /optionDrafts\.value\[carrierRouteKey\(poeId, carrierId\)\]/)
  assert.match(wizard, /costs: \[\.\.\.costs\.value\]/)
  assert.match(wizard, /rateLines\.value = copyPoeLines\(draft\.lines\)/)
  assert.match(wizard, /costs\.value = \[\.\.\.\(draft\.costs \?\? \[\]\)\]/)
  assert.match(wizard, /role="tablist" aria-label="Alternativas por POE y naviera"/)
  assert.match(wizard, /\{\{ form\.selectedImportRateId \? 'Tarifa preaprobada o preautorizada' : 'Captura manual' \}\}/)
})

test('multi-rate save submits all alternatives to the atomic Pricing API', () => {
  assert.match(wizard, /const alternatives: GroupQuoteAlternativeRequest\[\]/)
  assert.match(wizard, /PricingService\.createRateGroup/)
  assert.match(wizard, /rateId = group\.parentRateId/)
  assert.match(wizard, /saveRequestIdempotencyKey\.value/)
})

test('cost refresh merges catalog lines without destroying edited charges or manual rubros', () => {
  const oldLines = [
    { key: 'cost:123', costId: '123', costAmount: 75, saleAmount: 110, included: false },
    { key: 'manual:new', costAmount: 55, saleAmount: 70, included: true, manual: true },
  ]
  const refreshed = [
    { key: 'cost:123', costId: '123', costAmount: 20, saleAmount: 35, included: true },
    { key: 'cost:456', costId: '456', costAmount: 12, saleAmount: 25, included: true },
  ]
  assert.deepEqual(mergeOptionCostLines(oldLines, refreshed), [
    oldLines[0], refreshed[1], oldLines[1],
  ])
})

test('cost request identity isolates POE, POD, agent, naviera and service changes', () => {
  const common = {
    poeId: 'caldera', podId: 'san-jose', carrierId: 'msc', agentId: 'wvl',
    polId: 'shanghai', incotermId: 'fob', shipmentMode: 'Fcl', serviceIds: ['freight', 'inland'],
  }
  const initial = pricingCostContextKey(common)
  assert.equal(initial, pricingCostContextKey({ ...common, serviceIds: ['inland', 'freight'] }))
  for (const change of [
    { poeId: 'balboa' }, { podId: 'heredia' }, { carrierId: 'one' },
    { agentId: 'other' }, { incotermId: 'exw' }, { serviceIds: ['freight'] },
  ]) {
    assert.notEqual(initial, pricingCostContextKey({ ...common, ...change }))
  }
})

test('POE chips and top controls expose back, next and POD edits without removing selections', () => {
  assert.match(wizard, /:show-chips="true"/)
  assert.match(wizard, /\.\.\.selectedPoeIds\.value/)
  assert.match(wizard, /Editar POE \/ POD/)
  assert.match(wizard, /POE anterior/)
  assert.match(wizard, /Siguiente POE/)
  assert.match(wizard, /@click="goToStep\(3\)"/)
  assert.match(wizard, /else goToStep\(3\)/)
  assert.match(wizard, /@click="previousSequentialWizard"/)
  assert.match(wizard, /@click="reloadCurrentAlternativeCosts"/)
})

test('Screen 8 summarizes each independent subtariff, not the active one as a whole', () => {
  assert.match(wizard, /const alternativePreviewCards = computed/)
  assert.match(wizard, /v-for="preview in alternativePreviewCards"/)
  assert.match(wizard, /preview\.costUsd/)
  assert.match(wizard, /preview\.saleUsd/)
  assert.match(wizard, /preview\.utilityUsd/)
  assert.match(wizard, /preview\.lines\.length/)
  assert.match(wizard, /Tarifa principal y sus subtarifas/)
  assert.match(wizard, /Editar costos/)
  assert.match(wizard, /carrierRouteKey\(route\.poeId, route\.carrierId\)/)
  const parity = readFileSync(new URL('../build/pricingWizardUiParity.ts', import.meta.url), 'utf8')
  assert.match(parity, /v-if="!multiCarrierSelectionMode \|\| carrierRouteCount === 1"/)
})

test('FCL-only multi-POE controls keep single POE for LCL and other modalities', () => {
  assert.match(wizard, /form\.modality === 'Maritime' && shipmentModeForApi === 'Fcl'/)
  assert.match(wizard, /const multiCarrierSelectionMode = computed/)
  assert.match(wizard, /shipmentModeForApi\.value === 'Fcl'/)
})

test('all wizard navigation remains sticky and names previous/next POE or carrier', () => {
  assert.match(wizard, /crystal-footer--sticky/)
  assert.match(wizard, /position: sticky/)
  assert.match(wizard, /previousWizardAction/)
  assert.match(wizard, /nextWizardAction/)
  assert.match(wizard, /Siguiente alternativa/)
  assert.match(wizard, /Alternativa anterior/)
})

test('FCL route review follows standard full-width collapsible layout per subtariff', () => {
  assert.match(wizard, /v-for="preview in alternativePreviewCards"/)
  assert.match(wizard, /<details v-for="preview in alternativePreviewCards"/)
  assert.match(wizard, /Desglose comercial/)
  assert.match(wizard, /<table class="w-full min-w-\[650px\]/)
  assert.match(wizard, /Las tarifas son opciones independientes/)
})

test('screen 7 inherits the Carrier or Merchant selected on screen 6, without duplicate toggle buttons', () => {
  const haulagePlugin = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
  const screenSeven = wizard.split('<div v-else-if="step === 7"')[1]!.split('<div v-else-if="step === 4"')[0]!
  assert.match(screenSeven, /Transporte en destino · \{\{ form\.carrierHaulage/)
  assert.match(screenSeven, /Se conserva automáticamente la selección de Pantalla 6/)
  assert.doesNotMatch(screenSeven, /@click="toggleCarrierHaulage"/)
  assert.doesNotMatch(screenSeven, /@click="toggleMerchantHaulage"/)
  assert.match(haulagePlugin, /rememberCurrentCarrierDraft\(\)/)
  assert.doesNotMatch(haulagePlugin, /if \(changedContext\) \{[\s\S]*?form\.carrierHaulage = false/)
})

test('Caldera MSC Carrier Inland from screen 6 reaches screen 7 priced with its CostId', () => {
  const haulagePlugin = readFileSync(new URL('../build/pricingWizardHaulageComparison20261008.ts', import.meta.url), 'utf8')
  assert.match(haulagePlugin, /function dholeEnsureSelectedHaulageLines\(\)/)
  assert.match(haulagePlugin, /for \(const cost of dholeSelectedHaulageCosts\.value\)/)
  assert.match(haulagePlugin, /rateLines\.value\.find\(\(line\) => line\.costId === cost\.id\)/)
  assert.match(haulagePlugin, /key: 'cost:' \+ cost\.id/)
  assert.match(haulagePlugin, /costAmount: number\(price\.costAmount\)/)
  assert.match(haulagePlugin, /saleAmount: number\(price\.saleAmount\)/)
  assert.match(haulagePlugin, /dholeEnsureSelectedHaulageLines\(\)/)
  assert.match(haulagePlugin, /if \(props\.viewOnly \|\| !multiCarrierSelectionMode\.value \|\| step\.value !== 7\) return/)
  assert.match(wizard, /await activateCarrierRoute\(first\.poeId, first\.carrierId\)/)
  assert.match(wizard, /await loadCostsForSelectedAlternative\(\)/)
})

test('approved FCL tariff cards expose pressed status and a visible selected badge', () => {
  const bundles = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  assert.match(bundles, /:aria-pressed="multiCarrierSelectionMode/)
  assert.match(bundles, /Naviera seleccionada/)
  assert.match(wizard, /currentPoeCarrierIds\.value\.includes\(configuredId\)/)
})

test('MultiQUO always displays CatalogItem.value and never an internal CUR-2026 code', () => {
  assert.equal(pricingCurrencyValue('USD', 'CUR-2026-001'), 'USD')
  assert.equal(pricingCurrencyValue('CRC', 'USD'), 'CRC')
  assert.equal(pricingCurrencyValue('', 'USD'), 'USD')
  assert.equal(pricingCurrencyValue(null, 'CUR-2026-001'), '—')
  assert.match(wizard, /savedRateCurrencyValue\(subRate\)/)
  assert.match(wizard, /detailCurrencyValue\(line\)/)
  assert.doesNotMatch(wizard, /subRate\.currencyCode \|\| 'USD'/)
})

test('screen 8 commercial summary occupies full width with responsive columns', () => {
  assert.match(wizard, /class="crystal-soft p-5 lg:col-span-2"[^>]*>\s*<p[^>]*>Resumen comercial<\/p>/)
  assert.match(wizard, /grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4/)
})

test('route-specific Inland charge is recognized as the selected Merchant or Carrier haulage', () => {
  assert.equal(haulageAssociation('Inland Caldera a GAM (Naviera)'), 'carrier')
  assert.equal(haulageAssociation('Inland Moin a GAM (Naviera)'), 'carrier')
  assert.equal(haulageAssociation('Inland de Balboa a Colon Free Zone (Merchant)'), 'merchant')
  assert.equal(haulageAssociation('Gate + Inland GAM Merchant'), 'merchant')
  assert.equal(haulageAssociation('Inland GAM Naviera'), 'carrier')
  assert.equal(haulageAssociation('Flete Internacional'), null)
})

test('refreshing selected carrier replaces a stale zero Inland with configured cost and sale', () => {
  const previous = [{ key: 'cost:inland', name: 'Inland Caldera a GAM (Naviera)', costId: 'inland',
    costAmount: 0, saleAmount: 0, included: true }]
  const incoming = [{ ...previous[0], costAmount: 663, saleAmount: 685 }]
  const merged = mergeOptionCostLines(previous, incoming)
  assert.equal(merged[0]?.costAmount, 663)
  assert.equal(merged[0]?.saleAmount, 685)
  assert.equal(merged[0]?.included, true)
  assert.equal(keepFreshInlandPrice(previous[0]!.name, 0, 0, 663, 685), true)
  assert.equal(keepFreshInlandPrice('Despacho', 0, 0, 663, 685), false)
  // Manual price edits must not be overwritten by refreshing a real catalog cost.
  const edited = mergeOptionCostLines([{ ...previous[0]!, costAmount: 700, saleAmount: 830 }], incoming)
  assert.equal(edited[0]?.costAmount, 700)
  assert.equal(edited[0]?.saleAmount, 830)
})

test('wizard includes selected configured inland and warns about missing prices', () => {
  assert.match(wizard, /haulageAssociation\(cost\) === 'carrier'/)
  assert.match(wizard, /haulageAssociation\(cost\) === 'merchant'/)
  assert.match(wizard, /selectedHaulageMissingPrice/)
  assert.match(wizard, /line\.costId && haulageAssociation\(line\) === mode/)
})
