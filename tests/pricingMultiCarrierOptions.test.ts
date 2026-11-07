import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  carrierRouteKey, normalizePoeCarrierIds, poeCarrierSelectionComplete,
} from '../src/modules/pricing/utils/pricingMultiCarrierOptions.ts'

test('multiple navieras are unique per POE and preserve selection order', () => {
  assert.deepEqual(
    normalizePoeCarrierIds(['msc', 'one', 'msc', 'missing', ''], ['one', 'msc', 'hapag']),
    ['msc', 'one'],
  )
  assert.notEqual(carrierRouteKey('caldera', 'msc'), carrierRouteKey('moin', 'msc'))
  assert.notEqual(carrierRouteKey('a', 'bc'), carrierRouteKey('ab', 'c'))
})

test('all POE need at least one naviera before moving to Screen 6', () => {
  assert.equal(poeCarrierSelectionComplete(['caldera', 'moin'], { caldera: ['msc'] }), false)
  assert.equal(poeCarrierSelectionComplete(['caldera', 'moin'], { caldera: ['msc', 'one'], moin: ['one'] }), true)
  assert.equal(poeCarrierSelectionComplete([], {}), false)
})

test('wizard has per-POE multiselect, independent route drafts and fail-closed group save', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  const plugin = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  assert.match(wizard, /@click="toggleManualCarrier\(carrier.value\)"/)
  assert.match(wizard, /Configurar \{\{ carrierRouteCount \}\} alternativas/)
  assert.match(wizard, /poeCarrierSelectionComplete\(selectedPoeIds.value, selectedCarriersByPoe.value\)/)
  assert.match(wizard, /optionDrafts.value\[carrierRouteKey\(poeId, carrierId\)\]/)
  assert.match(wizard, /role="tablist" aria-label="Alternativas por POE y naviera"/)
  assert.match(wizard, /selectedPoeIds.value.length > 1 \|\| carrierRouteCount.value > 1/)
  assert.match(plugin, /registerSelectedFclBundleOption\(selectedCarrierOptionId, bundle.key\)/)
  assert.match(plugin, /step.value = 5 \/\/ Add another naviera/)
})


test('manual carrier picker is independent of pre-approved rate cards and supports all selected carriers', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(wizard, /role="group" aria-label="Navieras manuales disponibles"/)
  assert.match(wizard, /:aria-pressed="currentPoeCarrierIds.includes\(carrier.value\)"/)
  assert.match(wizard, /toggleManualCarrier\(carrier.value\)/)
  assert.match(wizard, /setCurrentPoeCarrierIds\(\[\]\)/)
  assert.match(wizard, /v-if="!multiCarrierSelectionMode" class="space-y-4"/)
  assert.match(wizard, /form.manualRate = true/)
  assert.match(wizard, /form.selectedImportRateId = ''/)
  assert.match(wizard, /No necesita escoger una tarifa preaprobada/)
})

test('manual option navigation isolates costs and editable fields per carrier and POE', () => {
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(wizard, /optionDrafts.value\[carrierRouteKey\(poeId, carrierId\)\]/)
  assert.match(wizard, /costs: \[\.\.\.costs.value\]/)
  assert.match(wizard, /rateLines.value = copyPoeLines\(draft.lines\)/)
  assert.match(wizard, /costs.value = \[\.\.\.\(draft.costs \?\? \[\]\)\]/)
  assert.match(wizard, /agentId: '', selectedImportRateId: '', manualRate: true/)
  assert.match(wizard, /moveToManualCarrier\(-1\)/)
  assert.match(wizard, /moveToManualCarrier\(1\)/)
  assert.match(wizard, /Costos exclusivos de esta alternativa/)
  assert.match(wizard, /selectedPoeIds.value.length > 1 \|\| carrierRouteCount.value > 1/)
})
