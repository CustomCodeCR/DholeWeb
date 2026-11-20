import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { inlandBillingParty, incotermOperationExplanation, incotermClientSections, incotermClientPaysMainTransport, normalizeIncotermCode } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const wizard = read('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue')
const input = read('../src/modules/pricing/components/PricingInlandServiceLocation.vue')
const dto = read('../src/core/interfaces/pricing.ts')
const preview = read('../src/modules/pricing/components/PricingSellerHandoffPreview.vue')

test('Incoterms retain ICC meanings from import/export client perspectives', () => {
  assert.equal(inlandBillingParty('Import', 'EXW'), 'Importer')
  assert.equal(inlandBillingParty('Export', 'DDP'), 'Exporter')
  assert.equal(inlandBillingParty('Export', 'EXW'), 'Importer')
  assert.equal(inlandBillingParty('Import', 'DDP'), 'Exporter')
  assert.equal(inlandBillingParty('TransitDomestic', 'EXW'), 'Both')
  assert.equal(inlandBillingParty('TransitDomestic', 'DDP'), 'Both')
  assert.equal(inlandBillingParty('Import', 'FOB'), 'ByAgreement')
  assert.match(incotermOperationExplanation('Import', 'EXW'), /importador/i)
  assert.match(incotermOperationExplanation('Export', 'DDP'), /exportador/i)
  assert.match(incotermOperationExplanation('TransitDomestic', 'DDP'), /híbrida/i)
})

test('pickup and delivery services accept separate multi-stop lists', () => {
  assert.match(wizard, /inlandPickupLocations: \[\] as RateInlandServiceLocation\[\]/)
  assert.match(wizard, /inlandDeliveryLocations: \[\] as RateInlandServiceLocation\[\]/)
  assert.match(wizard, /v-model:locations="form.inlandPickupLocations"/)
  assert.match(wizard, /v-model:locations="form.inlandDeliveryLocations"/)
  assert.match(wizard, /inlandPickupLocations: inlandPickupServiceSelected.value/g)
  assert.match(wizard, /inlandDeliveryLocations: inlandDeliveryServiceSelected.value/g)
  assert.match(wizard, /form.inlandPickupLocations = \(rate.inlandPickupLocations/)
  assert.match(wizard, /form.inlandDeliveryLocations = \(rate.inlandDeliveryLocations/)
  assert.match(dto, /inlandPickupLocations\?: RateInlandServiceLocation\[\]/)
  assert.match(dto, /inlandDeliveryLocations\?: RateInlandServiceLocation\[\]/)
})

test('each stop requires cargo type and preserves map optionality', () => {
  assert.match(wizard, /inlandStopListReady/)
  assert.match(wizard, /point.cargoCondition === 'FiscalCargo'/)
  assert.match(wizard, /point.cargoCondition === 'NationalizedCargo'/)
  assert.match(input, /editPoint\(index/)
  assert.match(input, /removePoint\(index/)
  assert.match(input, /update:locations/)
  assert.match(input, /Seleccione el tipo de carga/)
  assert.match(input, /PricingInteractiveOsmMap/)
  assert.match(preview, /inlandPickups.length/)
  assert.match(preview, /inlandDeliveries.length/)
})

test('cost sections change with the party receiving the quotation', () => {
  assert.equal(incotermClientSections('Import', 'EXW').length, 5)
  assert.equal(incotermClientSections('Export', 'DDP').length, 5)
  assert.equal(incotermClientSections('Import', 'DDP').length, 0)
  assert.equal(incotermClientSections('Export', 'EXW').length, 0)
  assert.equal(incotermClientSections('TransitDomestic', 'DDP').length, 5)
  assert.equal(incotermClientPaysMainTransport('Import', 'EXW'), true)
  assert.equal(incotermClientPaysMainTransport('Export', 'DDP'), true)
  assert.equal(incotermClientPaysMainTransport('Import', 'DDP'), false)
  assert.equal(incotermClientPaysMainTransport('Export', 'EXW'), false)
})

test('opaque Incoterm catalogue codes resolve all 11 ICC terms and wizard permits quoted freight', () => {
  for (const term of ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP']) {
    assert.equal(normalizeIncotermCode('INC-2026-001', `Incoterm ${term}`), term)
  }
  assert.match(wizard, /if \(internationalTransportQuoted\) allowed\.add\('international_freight'\)/)
  assert.match(wizard, /normalizeIncotermCode\(\s*selectedIncoterm\.value\?\.code/)
})
