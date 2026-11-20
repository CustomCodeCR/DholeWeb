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

test('quotation service selection allows explicit freight under every Incoterm', () => {
  assert.match(customsTransform, /const hasInternationalTransportService = computed/)
  assert.doesNotMatch(customsTransform, /freightNotRequiredByIncoterm/)
  assert.doesNotMatch(customsTransform, /!incotermClientPaysMainTransport\(perspective/)
  assert.match(customsTransform, /selectedServices\.value\.some/)
  assert.match(customsTransform, /!catalogs\.services\.length && form\.serviceIds\.length > 0/)
})

test('legacy and crystal wizards retain the selected international transport service', () => {
  const legacyWizard = readFileSync(new URL('../src/modules/pricing/components/PricingRateExistingWizardStable.vue', import.meta.url), 'utf8')
  assert.doesNotMatch(legacyWizard, /serviceCodes\.delete\('INT_TRANSPORT'\)/)
  assert.doesNotMatch(wizard, /serviceCodes\.delete\('INT_TRANSPORT'\)/)
})

test('freight inputs, pricing lines, and quote persistence use the same selected-service guard', () => {
  assert.match(customsTransform, /const hasInternationalTransportService = computed/)
  assert.match(customsTransform, /const visibility = tag\.includes\('v-model\.number="form\.transitDays"'\)/)
  assert.match(customsTransform, /form\.freightCost = 0/)
  assert.match(customsTransform, /form\.freightSale = 0/)
  assert.match(customsTransform, /hasInternationalTransportService\.value \|\| line\.costDetailType !== 'Freight'/)
  assert.match(customsTransform, /hasInternationalTransportService\.value \? 5 : 6/)
  assert.doesNotMatch(wizard, /serviceCodes\.delete\('INT_TRANSPORT'\)/,
    'explicitly contracted international transport must survive every Incoterm')
  assert.doesNotMatch(wizard, /incotermClientPaysMainTransport\(operationType\.value, selectedIncotermCode\.value\)/,
    'LCL restoration must not drop freight because of payer perspective')
})
