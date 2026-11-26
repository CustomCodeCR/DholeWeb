import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { summaryMeasure, isPendingOperationsTask } from '../src/modules/operations/utils/caseOverview.ts'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('missing measurements are not zero and units are displayed together', () => {
  assert.equal(summaryMeasure('', 'KG'), '')
  assert.equal(summaryMeasure('100', 'LB'), '100 LB')
  assert.equal(summaryMeasure('35.315', 'CFT'), '35.315 CFT')
  assert.equal(summaryMeasure('0', 'KG'), '0 KG')
})
test('pending tasks exclude completed and cancelled tasks', () => {
  assert.equal(isPendingOperationsTask({status:'PENDING',completedAtUtc:null}), true)
  assert.equal(isPendingOperationsTask({status:'COMPLETED',completedAtUtc:null}), false)
  assert.equal(isPendingOperationsTask({status:'CANCELLED',completedAtUtc:null}), false)
  assert.equal(isPendingOperationsTask({status:'PENDING',completedAtUtc:'2026-11-26'}), false)
})
test('summary prioritizes logistics and quote, drawer reads authoritative completeness and differentiates weights', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  const drawer = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.ok(detail.indexOf('title="Información logística"') < detail.indexOf('title="Datos de apertura"'))
  assert.ok(detail.indexOf('title="Cotización y seguimiento comercial"') < detail.indexOf('title="Validación de apertura"'))
  assert.match(detail, /fieldAliases/)
  assert.match(drawer, /operationsApi\.openingCompleteness\(id\)/)
  assert.match(drawer, /drawerEstimatedWeight/)
  assert.match(drawer, /drawerActualWeight/)
  assert.match(drawer, /drawerPendingTasks/)
  assert.match(drawer, /useOperationsCaseRealtime/)
  assert.doesNotMatch(drawer, /openingMissing/)
})
