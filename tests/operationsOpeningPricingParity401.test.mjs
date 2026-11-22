import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')

test('Operations follows Pricing modality and shipment selection before route and cargo', () => {
  for (const label of ['Modalidad', 'Embarque', 'Cliente y ruta', 'Carga', 'Servicios', 'Revisión'])
    assert.ok(opening.includes(`label: '${label}'`), label)
  assert.match(opening, /form\.transportType === option\.value/)
  assert.match(opening, /@click="selectTransport\(option\.value\)"/)
  assert.match(opening, /@click="selectShipment\(option\.value\)"/)
  assert.match(opening, /shipmentOptionsByTransport/)
  assert.match(opening, /<PricingWizardStepper/)
})

test('Full equipment uses the actual Pricing selector with multiple quantities', () => {
  assert.match(opening, /import PricingContainerSelector from/)
  assert.match(opening, /<PricingContainerSelector/)
  assert.match(opening, /equipmentCatalogId/)
  assert.match(opening, /form\.equipment\.push/)
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
