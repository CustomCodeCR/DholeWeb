import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guardManualOceanFreightCards, guardNoFreightFclOptionNavigation } from '../build/pricingCustomsOnlyWizard.ts'
import { incotermClientPaysMainTransport } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const manualFreightVisibility = `v-if="shipmentModeForApi === 'Fcl' && (form.modality === 'Maritime' || form.modality === 'Multimodal') && (form.manualRate || !form.selectedImportRateId)"`

test('CIF imports exclude international freight while FOB imports and CIF exports retain their applicable transport', () => {
  assert.equal(incotermClientPaysMainTransport('Import', 'CIF'), false)
  assert.equal(incotermClientPaysMainTransport('Import', 'CFR'), false)
  assert.equal(incotermClientPaysMainTransport('Import', 'FOB'), true)
  assert.equal(incotermClientPaysMainTransport('Import', 'EXW'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'CIF'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'DDP'), true)
})

test('both manual ocean freight cards are gated, not just the first one', () => {
  const screenSix = [
    `<div ${manualFreightVisibility} data-manual-ocean-freight-card>...</div>`,
    `<div ${manualFreightVisibility} data-manual-ocean-freight-final-action>...</div>`,
  ].join('\n')
  const transformed = guardManualOceanFreightCards(screenSix)
  assert.equal((transformed.match(/v-if="hasInternationalTransportService && shipmentModeForApi/g) ?? []).length, 2)
  assert.doesNotMatch(transformed, /v-if="shipmentModeForApi === 'Fcl'/)
  assert.match(transformed, /data-manual-ocean-freight-final-action/)
  assert.throws(
    () => guardManualOceanFreightCards(`<div ${manualFreightVisibility}>...</div>`),
    /Expected both manual-ocean-freight cards/,
  )
})

test('CIF without contracted transport skips rates but lets users quote customs and destination charges', () => {
  const source = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  assert.match(source, /step\.value === 4 && !hasInternationalTransportService\.value/)
  assert.match(source, /if \(!hasInternationalTransportService\.value\) \{/)
  assert.match(source, /prevent no-freight manual ocean rate creation/)
  assert.match(source, /multiCarrierSelectionMode && hasInternationalTransportService/)
  assert.match(source, /Esta cotización no incluye transporte internacional/)
  assert.match(source, /line\.costDetailType !== 'Freight'/)
})

test('CIF with 0 selected carriers uses normal navigation to screen 7 instead of blocking at 1/0', () => {
  const wizardSource = readFileSync(
    new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url),
    'utf8',
  )
  const transformed = guardNoFreightFclOptionNavigation(wizardSource)
  assert.match(transformed, /selectedPoeIds\.value\.length > 0 && hasInternationalTransportService\.value/)
  assert.match(transformed, /if \(step\.value === 6\) \{[\s\S]{0,260}if \(!\(await loadApplicableCosts\(\)\)\) return\s*rebuildRateLines\(\)/)
  assert.match(transformed, /v-else-if="!isEditing && step < 8 && !\[1, 2, 5\]\.includes\(step\)"/)
  assert.equal(transformed.includes('selectedPoeIds.value.length > 0,\n)'), false)
  assert.throws(
    () => guardNoFreightFclOptionNavigation('<script setup lang="ts"></script>'),
    /disable MultiQUO navigation/,
  )
})

test('CIF duplicate skips a new freight validation; global agents remain eligible', () => {
  const duplicate = readFileSync(new URL('../build/pricingDuplicateRateRefreshWorkflow.ts', import.meta.url), 'utf8')
  assert.match(duplicate, /shipmentModeForApi\.value === 'Fcl' && hasInternationalTransportService\.value && !hasNewDuplicatedFclFreight\(\)/)
  const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
  assert.match(wizard, /if \(isGlobalCountryAgent\(agent\)\) return true/)
  assert.match(wizard, /eligibleAgents\.value\.find\(isGlobalCountryAgent\)/)
})
