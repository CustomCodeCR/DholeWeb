import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = source('src/modules/operations/views/OperationsManualCreateView.vue')
const operationsApi = source('src/modules/operations/services/operationsApi.ts')

test('Manual aperture no longer has any dedicated services or coordination screen', () => {
  assert.match(opening, /label: 'Cliente, ruta y servicios'/)
  assert.match(opening, /label: 'Carga y condiciones'/)
  assert.match(opening, /label: 'Revisión'/)
  assert.ok(opening.indexOf('<DhCard title="Servicios solicitados y proveedores"') < opening.indexOf('<div v-show="activeStep === 2"'))
  assert.doesNotMatch(opening, /Servicios contratados|PricingCrystalMultiSelect|serviceChoices|serviceCatalog/)
  assert.doesNotMatch(opening, /Recolecta \(según servicios contratados\)|Dirección de entrega final/)
  assert.doesNotMatch(opening, /label="Agente de origen"|label="Merchant \/ referencia"/)
  assert.ok(opening.includes('<DhSelect v-if="showCarrier" searchable :model-value="form.carrierId"'))
  assert.ok(opening.includes('label="Naviera"'))
  assert.ok(opening.includes("editingId.value ? isMaritime.value : effectiveShipment.value === 'FCL'"))
  assert.doesNotMatch(opening, /label="Prioridad"|label="Puntos de complejidad"|Solicitar revisión comercial en Pricing/)
  assert.doesNotMatch(opening, /fieldTitle\('Servicios'/)
  assert.doesNotMatch(opening, /pickupIncluded|deliveryIncluded|serviceChoices/)
  assert.doesNotMatch(opening, /if \(pickupIncluded\.value/)
  assert.doesNotMatch(opening, /v-show="activeStep === [456]"/)
})

test('Consolidated and full FCA manual openings use WHS; legacy edits preserve FCA', () => {
  assert.match(opening, /const requiresWarehouse = computed/)
  assert.match(opening, /const selectedIncoterm = computed/)
  assert.match(opening, /normalizeIncotermCode\(form\.value\.incoterm, form\.value\.incotermName\)/)
  assert.match(opening, /requiresWarehouse = computed\(\(\) => \['LCL', 'LTL'\]\.includes\(effectiveShipment\.value\)/)
  assert.match(opening, /selectedIncoterm\.value === 'FCA' && \(needsEquipment\.value \|\| Boolean\(editingId\.value\)\)/)
  assert.ok(opening.includes('if (requiresWarehouse.value && !(warehouse.value'))
  assert.match(opening, /<DhCard v-if="requiresWarehouse"/)
  assert.match(opening, /label="WHS global"/)
  assert.match(opening, /const warehouseGroups =/)
})

test('Opening draft and existing persisted optional data remain compatible', () => {
  assert.match(opening, /operationsApi\.createAperture/)
  assert.match(opening, /operationsApi\.updateCase/)
  assert.match(opening, /completionStatus: blockers\.value\.length/)
  assert.match(opening, /missingFields: blockers\.value/)
  assert.match(opening, /commercialStatus: 'SIN_QUO'/)
  assert.match(opening, /services: \[\] as string\[\]/)
  assert.match(opening, /form\.value = \{ \.\.\.form\.value, \.\.\.parsed \}/)
  assert.match(opening, /Crear y enviar a Coordinación Origen/)
  assert.match(opening, /StorageService\.uploadFile/)
  assert.match(opening, /api\/pricing\/cabys/)
  assert.match(operationsApi, /createAperture: \(body:/)
})
