import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = source('src/modules/operations/views/OperationsManualCreateView.vue')
const operationsApi = source('src/modules/operations/services/operationsApi.ts')

test('Manual aperture no longer has any dedicated services or coordination screen', () => {
  assert.match(opening, /label: 'Cliente y ruta'/)
  assert.match(opening, /label: 'Carga y documentos'/)
  assert.match(opening, /label: 'Revisión'/)
  assert.doesNotMatch(opening, /label: 'Cliente, ruta y servicios'/)
  assert.doesNotMatch(opening, /Servicios contratados|PricingCrystalMultiSelect|serviceChoices|serviceCatalog/)
  assert.doesNotMatch(opening, /Recolecta \(según servicios contratados\)|Dirección de entrega final/)
  assert.doesNotMatch(opening, /label="Agente de origen"|label="Naviera"|label="Merchant \/ referencia"/)
  assert.doesNotMatch(opening, /label="Prioridad"|label="Puntos de complejidad"|Solicitar revisión comercial en Pricing/)
  assert.doesNotMatch(opening, /fieldTitle\('Servicios'/)
  assert.doesNotMatch(opening, /v-show="activeStep === [456]"/)
})

test('Mandatory FCA LCL/LTL WHS is relocated to the route, not silently lost', () => {
  assert.match(opening, /const requiresWarehouse = computed/)
  assert.match(opening, /form\.value\.incoterm === 'FCA'/)
  assert.match(opening, /if \(requiresWarehouse\.value && !form\.value\.whsName\.trim\(\)\)/)
  assert.match(opening, /<div v-if="requiresWarehouse"/)
  assert.match(opening, /label="Nombre WHS \/ referencia registrada"/)
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
  assert.match(opening, /Guardar borrador/)
  assert.match(opening, /StorageService\.uploadFile/)
  assert.match(opening, /api\/pricing\/cabys/)
  assert.match(operationsApi, /createAperture: \(body:/)
})
