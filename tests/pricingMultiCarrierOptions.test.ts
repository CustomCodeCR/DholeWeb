import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carrierRouteKey, normalizePoeCarrierIds, poeCarrierSelectionComplete,
  nextPoeInSelection, nextCarrierRoute, mergeOptionCostLines, pricingCostContextKey,
} from '../src/modules/pricing/utils/pricingMultiCarrierOptions.ts'

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

test('multi-rate save stays fail-closed until Pricing supports grouped transaction', () => {
  assert.match(wizard, /selectedPoeIds\.value\.length > 1 \|\| carrierRouteCount\.value > 1/)
  assert.match(wizard, /No se creó ninguna tarifa: es necesario implementar la API/)
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

test('Multi-POE creation is restricted to maritime FCL, never LCL, land or air', () => {
  assert.match(wizard, /const fclMultiPoeEnabled = computed/)
  assert.match(wizard, /form\.modality === 'Maritime' && shipmentModeForApi\.value === 'Fcl'/)
  assert.match(wizard, /v-if="!isEditing && !sellerRequestMode && fclMultiPoeEnabled"/)
  assert.match(wizard, /if \(!fclMultiPoeEnabled\.value\) return/)
  assert.match(wizard, /selectedCarriersByPoe\.value = \{\}/)
})

test('Loaded and manually selected carrier cards visibly reflect the POE selection', () => {
  assert.match(wizard, /function isCarrierSelectedFcl\(/)
  assert.match(wizard, /function isManualCarrierSelectedFcl\(/)
  assert.match(wizard, /function isSelectedFclBundle\(/)
  assert.match(wizard, /forgetFclBundleForOption\?\.\(/)
  assert.match(plugin, /Tarifa seleccionada/)
  assert.match(plugin, /Naviera seleccionada \(manual\)/)
  assert.match(plugin, /isCarrierSelectedFcl\(bundle\.carrierId, bundle\.carrier\)/)
  assert.match(plugin, /:aria-pressed=/)
  assert.match(wizard, /if \(ratePod && !multiCarrierSelectionMode\.value\)/)
  assert.match(wizard, /if \(freightValidFrom && !multiCarrierSelectionMode\.value\)/)
})

test('Haulage chosen on Screen 4 is inherited by each new FCL route', () => {
  assert.match(wizard, /const defaultFclHaulageMode = ref/)
  assert.match(wizard, /defaultFclHaulageMode\.value = form\.merchantHaulage/)
  assert.match(wizard, /defaultFclHaulageMode\.value = form\.carrierHaulage/)
  assert.match(wizard, /merchantHaulage: defaultFclHaulageMode\.value === 'merchant'/)
  assert.match(wizard, /carrierHaulage: defaultFclHaulageMode\.value === 'carrier'/)
  assert.match(wizard, /syncHaulageOptionalLines\(\)/)
  const haulagePlugin = readFileSync(new URL('../build/pricingCargoHaulageKeywordFix.ts', import.meta.url), 'utf8')
  assert.match(haulagePlugin, /conditions\.includes\('MerchantHaulage'\)/)
  assert.match(haulagePlugin, /conditions\.includes\('CarrierHaulage'\)/)
})

test('FCL route navigation is pinned on all devices with POE/naviera progress', () => {
  assert.match(wizard, /crystal-footer--pinned/)
  assert.match(wizard, /\.crystal-footer--pinned \{\s*position: fixed;/)
  assert.match(wizard, /Naviera anterior/)
  assert.match(wizard, /Siguiente naviera/)
  assert.match(wizard, /POE anterior/)
  assert.match(wizard, /Editar POE \/ POD/)
  assert.match(wizard, /previousSequentialWizard\(\)/)
  assert.match(wizard, /advanceSequentialWizard/)
})

test('FCL Screen 8 uses a single standard full-width accordion per subtariff', () => {
  assert.match(wizard, /aria-label="Tarifa principal y subtarifas FCL"/)
  assert.match(wizard, /<details v-for="preview in alternativePreviewCards"/)
  assert.match(wizard, /:open="preview\.index === 0"/)
  assert.match(wizard, /<table class="w-full min-w-\[770px\]/)
  assert.match(wizard, /preview\.saleCrc/)
  assert.match(wizard, /preview\.utilityCrc/)
  assert.match(wizard, /Editar proveedor/)
  assert.match(wizard, /Editar costos/)
})
