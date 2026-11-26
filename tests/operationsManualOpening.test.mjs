import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('manual opening is a full route, not an IDTRA series modal', () => {
  const view = source('src/modules/operations/views/OperationsCasesView.vue')
  const router = source('src/core/router/index.ts')
  const form = source('src/modules/operations/views/OperationsManualCreateView.vue')
  const api = source('src/modules/operations/services/operationsApi.ts')
  assert.match(view, /name: 'operations-case-create'/)
  assert.doesNotMatch(view, /OperationsManualCreateModal/)
  assert.match(router, /path: 'operations\/cases\/new'/)
  assert.match(router, /path: 'operations\/cases\/:id\/edit'/)
  assert.match(form, /Nueva apertura manual/)
  assert.match(form, /Crear y enviar a Coordinación Origen/)
  assert.match(form, /operationsApi\.createAperture/)
  assert.match(form, /operationsApi\.updateCase/)
  assert.doesNotMatch(api, /seriesCode: string/)
  assert.doesNotMatch(form, /Serie IDTRA/)
})

test('manual form captures the approved opening data domains without quoting costs', () => {
  const form = source('src/modules/operations/views/OperationsManualCreateView.vue')
  for (const key of [
    'clientPoReference','crmDivisionId','cargoDescription','transportType',
    'incoterm','pol','poe','pod','weightValue','weightUnit','volumeValue',
    'volumeUnit','equipment','services','whsName','pickupAddress',
    'isImo','imoClass','unNumber','stackable','overweight','overweightNotes',
    'carrierReference','agentReference','merchantReference','observations',
  ]) assert.ok(form.includes(key), key)
  assert.match(form, /weightValue: undefined, weightUnit: undefined, weightKg: undefined/)
  assert.doesNotMatch(form, /label="Peso bruto"/)
  assert.match(form, /0\.028316846592/)
  assert.match(form, /missingFields: blockers\.value/)
  assert.match(form, /commercialStatus: 'SIN_QUO'/)
  assert.match(form, /equipment: form\.value\.equipment\.map/)
})

test('IDTRA detail displays persisted opening fields and links to full edit route', () => {
  const detail = source('src/modules/operations/views/OperationsCaseDetailView.vue')
  assert.match(detail, /openingDataJson/)
  assert.match(detail, /title="Información logística"/)
  assert.match(detail, /name: 'operations-case-edit'/)
})
