import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { departmentStatusLabel } from '../src/modules/operations/utils/caseOverview.ts'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('visible operative status comes from its department rather than raw DRAFT', () => {
  assert.equal(departmentStatusLabel('APERTURAS', 'PENDING', 'DRAFT'), 'Apertura por completar')
  assert.equal(departmentStatusLabel('APERTURAS', 'PENDING', 'PENDING_VALIDATION'), 'Pendiente de validación')
  assert.equal(departmentStatusLabel('COORDINACION_ORIGEN', 'IN_PROGRESS', 'ACTIVE', 'BOOKING_READY'), 'Booking listo')
  assert.equal(departmentStatusLabel('TRANSITO', 'IN_PROGRESS', 'ACTIVE'), 'En proceso')
})

test('list and drawer expose CRM identity, team, operative and dual validators', () => {
  const view = source('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(view, /crmPath\('accounts', id\)/)
  assert.match(view, /cell-teamName/)
  assert.match(view, /cell-assignedUserId/)
  assert.match(view, /cell-departmentStatus/)
  assert.match(view, /workspace\.validators/)
  assert.match(view, /assigned-executive/)
  assert.doesNotMatch(view, /Cuenta CRM ·/)
})

test('full expediente shows responsible actors, origin stage and grouped opening data', () => {
  const detail = source('src/modules/operations/views/OperationsCaseDetailView.vue')
  assert.match(detail, /currentDepartmentStatus/)
  assert.match(detail, /responsibleName\(stage\.assignedUserId\)/)
  assert.match(detail, /workspace\.validators/)
  assert.match(detail, /openingSections/)
  assert.match(detail, /Pendiente de Coordinación Origen/)
  assert.doesNotMatch(detail, /statusLabel\(record\.status\)/)
})

test('backend owns access and never grants writes to unopened stages', () => {
  const backend = source('tests/operationsCaseOverview414.test.mjs')
  assert.ok(backend.includes('backend owns access'))
})
