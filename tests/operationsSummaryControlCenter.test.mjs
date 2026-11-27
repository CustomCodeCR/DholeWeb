import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { summaryMeasure, isPendingOperationsTask, commercialComparisonCounts, isOperationsCaseOnHold } from '../src/modules/operations/utils/caseOverview.ts'
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
test('compact drawer excludes operational detail and full summary retains authoritative completeness', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  const drawer = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.ok(detail.indexOf('title="Información logística"') < detail.indexOf('title="Datos de apertura"'))
  assert.ok(detail.indexOf('title="Cotización y seguimiento comercial"') < detail.indexOf('title="Validación de apertura"'))
  assert.match(detail, /fieldAliases/)
  assert.match(detail, /operationsApi\.openingCompleteness\(detail\.id\)/)
  assert.match(detail, /title="Checklist operativo"/)
  assert.match(detail, /title="Historial de anotaciones internas"/)
  assert.match(drawer, /title="Trámites vinculados"/)
  assert.match(drawer, /title="Cuenta y contactos"/)
  assert.doesNotMatch(drawer, /drawerEstimatedWeight|drawerActualWeight|drawerPendingTasks/)
  assert.match(drawer, /useOperationsCaseRealtime/)
  assert.doesNotMatch(drawer, /openingMissing/)
})

test('comparison counts are descriptive and never synthesize a backend HOLD', () => {
  assert.deepEqual(commercialComparisonCounts([{status:'MATCH'}, {status:'CHANGED'}, ...Array.from({length:6}, () => ({status:'UNCONFIRMED'}))]), {match:1,changed:1,unconfirmed:6})
  assert.equal(isOperationsCaseOnHold('IN_PROGRESS'), false)
  assert.equal(isOperationsCaseOnHold(undefined), false)
  assert.equal(isOperationsCaseOnHold('HOLD'), true)
  assert.equal(isOperationsCaseOnHold('ON_HOLD'), true)
})
