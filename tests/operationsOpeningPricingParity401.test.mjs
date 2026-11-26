import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')

test('Operations retains Pricing transport and shipment choices within three steps', () => {
  for (const label of ['Cliente y ruta', 'Carga y servicios', 'Revisión'])
    assert.ok(opening.includes(`label: '${label}'`), label)
  assert.match(opening, /<DhSelect label="Modalidad de transporte"/)
  assert.match(opening, /@update:model-value="selectTransport\(String\(\$event\)\)"/)
  assert.match(opening, /<DhSelect label="Tipo de embarque"/)
  assert.match(opening, /@update:model-value="selectShipment\(String\(\$event\)\)"/)
  assert.match(opening, /shipmentOptionsByTransport/)
  assert.match(opening, /<PricingWizardStepper/)
  assert.doesNotMatch(opening, /activeStep === [456]/)
})

test('Full equipment uses the actual Pricing selector with multiple quantities', () => {
  assert.match(opening, /import PricingContainerSelector from/)
  assert.match(opening, /<PricingContainerSelector/)
  assert.match(opening, /equipmentCatalogId/)
  assert.match(opening, /form\.value\.equipment\.push/)
  assert.match(opening, /equipment: form\.value\.equipment\.map/)
  assert.match(opening, /\['FCL','FTL'\]\.includes\(effectiveShipment\.value\)/)
})

test('Opening keeps QUO-independent persistence and Incoterm restrictions', () => {
  assert.match(opening, /operationsApi\.createAperture/)
  assert.match(opening, /operationsApi\.updateCase/)
  assert.match(opening, /commercialStatus: 'SIN_QUO'/)
  assert.match(opening, /\['FAS','FOB','CFR','CIF'\]/)
  assert.match(opening, /requiresWarehouse/)
  assert.match(opening, /missingFields: blockers\.value/)
})
