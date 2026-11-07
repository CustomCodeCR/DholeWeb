import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carrierRouteKey, normalizePoeCarrierIds, poeCarrierSelectionComplete,
  nextPoeInSelection, nextCarrierRoute,
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
  assert.match(wizard, /class="order-3 flex flex-col/)
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
