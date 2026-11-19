import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { incotermClientPaysMainTransport } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const customsTransform = readFileSync(
  new URL('../build/pricingCustomsOnlyWizard.ts', import.meta.url), 'utf8',
)
const wizard = readFileSync(
  new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8',
)

test('DDP exports always allow international freight billed to exporter', () => {
  assert.equal(incotermClientPaysMainTransport('Export', 'DDP'), true)
  assert.equal(incotermClientPaysMainTransport('Import', 'DDP'), false)
  assert.equal(incotermClientPaysMainTransport('Import', 'EXW'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'EXW'), false)
  assert.equal(incotermClientPaysMainTransport('TransitDomestic', 'DDP'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'CIF'), true)
  assert.equal(incotermClientPaysMainTransport('Import', 'CIF'), false)
})

test('customs-only transform derives exporter/importer before filtering freight', () => {
  assert.match(customsTransform, /const freightNotRequiredByIncoterm = computed/)
  assert.match(customsTransform, /const origin = selectedOrigin\.value/)
  assert.match(customsTransform, /const destination = selectedPod\.value \?\? selectedDestination\.value/)
  assert.match(customsTransform, /operationForClientCountry\(/)
  assert.match(customsTransform, /!incotermClientPaysMainTransport\(perspective, match\[2\]\.toUpperCase\(\)\)/)
  assert.doesNotMatch(customsTransform, /return \/\(\^\|\[\^a-z\]\)\(CFR\|CIF\|CPT\|CIP\|DAP\|DPU\|DDP\)/)
  assert.match(customsTransform, /!catalogs\.services\.length && form\.serviceIds\.length > 0/)
})

test('freight inputs, pricing lines, and quote persistence use the same selected-service guard', () => {
  assert.match(customsTransform, /const hasInternationalTransportService = computed/)
  assert.match(customsTransform, /const visibility = tag\.includes\('v-model\.number="form\.transitDays"'\)/)
  assert.match(customsTransform, /form\.freightCost = 0/)
  assert.match(customsTransform, /form\.freightSale = 0/)
  assert.match(customsTransform, /hasInternationalTransportService\.value \|\| line\.costDetailType !== 'Freight'/)
  assert.match(customsTransform, /hasInternationalTransportService\.value \? 5 : 6/)
  assert.match(wizard, /incotermClientPaysMainTransport\(operationType\.value, selectedIncotermCode\.value\)/)
})
