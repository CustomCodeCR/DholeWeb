import test from 'node:test'
import assert from 'node:assert/strict'
import { crmAgreementDrafts, crmAgreementDueLocal } from '../src/modules/crm/model/crmAgreementParser.ts'

test('map a container need for 10 November into a client commitment', () => {
  const rows = crmAgreementDrafts('El cliente dijo que el 10 de noviembre necesita un contenedor', new Date(2026, 10, 3))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].dueLocal, '2026-11-10T09:00')
  assert.equal(rows[0].hasExplicitTime, false)
  assert.match(rows[0].title, /contenedor/)
})

test('multiple agreements stay as separate dated tasks', () => {
  const rows = crmAgreementDrafts('Enviar propuesta el 10/11/2026 a las 3 pm; Confirmar reserva 12 de noviembre', new Date(2026, 10, 3))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].dueLocal, '2026-11-10T15:00')
  assert.equal(rows[1].dueLocal, '2026-11-12T09:00')
})

test('not invent a due date for undated agreement', () => {
  assert.equal(crmAgreementDrafts('Cliente solicita seguimiento', new Date(2026, 10, 3))[0].dueLocal, '')
})

test('year resolution and invalid dates', () => {
  assert.equal(crmAgreementDueLocal('el 5 de enero', new Date(2026, 10, 3)).dueLocal, '2027-01-05T09:00')
  assert.equal(crmAgreementDueLocal('el 31 de febrero', new Date(2026, 10, 3)).dueLocal, '')
})
