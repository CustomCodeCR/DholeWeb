import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { guardManualOceanFreightCards } from '../build/pricingCustomsOnlyWizard.ts'
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

test('CIF skips rate selection, supports provider choice and prevents direct manual freight persistence', () => {
  const source = readFileSync(new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8')
  assert.match(source, /step\.value === 4 && !hasInternationalTransportService\.value/)
  assert.match(source, /if \(!hasInternationalTransportService\.value\) \{/)
  assert.match(source, /prevent no-freight manual ocean rate creation/)
  assert.match(source, /multiCarrierSelectionMode && hasInternationalTransportService/)
  assert.match(source, /El flete marítimo ya está cubierto por el Incoterm/)
  assert.match(source, /line\.costDetailType !== 'Freight'/)
})
