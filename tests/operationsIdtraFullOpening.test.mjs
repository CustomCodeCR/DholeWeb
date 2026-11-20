import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

test('manual IDTRA uses full-screen capture, not old modal or series picker', () => {
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  const form = read('src/modules/operations/views/OperationsManualOpeningView.vue')
  const router = read('src/core/router/index.ts')
  const api = read('src/modules/operations/services/operationsApi.ts')
  assert.match(cases, /name: 'operations-case-create'/)
  assert.doesNotMatch(cases, /OperationsManualCreateModal/)
  assert.doesNotMatch(form, /<DhModal|seriesCode/)
  assert.match(router, /path: 'operations\/cases\/new'/)
  assert.match(router, /path: 'operations\/cases\/:id\/edit'/)
  assert.match(form, /synchronizeIdtraCounter/)
  assert.match(form, /Guardar borrador/)
  assert.match(form, /Enviar a validación/)
  assert.match(api, /apertures\/idtra-counter\/synchronize/)
})
test('all cargo fields, route and multi-equipment are captured from shared Config catalogs', () => {
  const form = read('src/modules/operations/views/OperationsManualOpeningView.vue')
  for (const field of [
    'clientPoReference', 'crmDivisionId', 'shipmentTypeCode',
    'transportTypeCode', 'incotermCode', 'polCode', 'poeCode', 'podCode',
    'cargoDescription', 'weightValue', 'volumeValue', 'packageCount',
    'equipment', 'serviceCodes', 'requiresPickup', 'pickupAddress',
    'warehouseName', 'consolidationReference', 'isImo', 'imoClass',
    'unNumber', 'stackable', 'isOverweight', 'overweightNotes',
    'carrierCode', 'agentCode', 'merchantCode', 'estimatedDepartureAtUtc',
    'estimatedArrivalAtUtc', 'operationalContactIds'
  ]) assert.ok(form.includes(field), 'missing capture field: ' + field)
  assert.match(form, /CatalogItemsService\.select/)
  assert.match(form, /PricingLocationSearchSelect/)
  assert.match(form, /operationsApi\.updateApertureDetails/)
  assert.match(form, /operationsApi\.submitAperture/)
})
