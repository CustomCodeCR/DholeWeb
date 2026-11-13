import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { crmAgreementDrafts, crmVisibleAgreementDrafts } from '../src/modules/crm/model/crmAgreementParser.ts'

test('excluded commitments do not alter agreement text or other commitments', () => {
  const original = 'Enviar propuesta; Confirmar reserva el 20/11/2026'
  const drafts = crmAgreementDrafts(original, new Date(2026, 10, 11))
  const remaining = crmVisibleAgreementDrafts(drafts, [drafts[0]!.key])
  assert.equal(drafts.length, 2)
  assert.equal(remaining.length, 1)
  assert.match(remaining[0]!.source, /Confirmar reserva/)
  assert.equal(original, 'Enviar propuesta; Confirmar reserva el 20/11/2026')
})

test('duplicate text remains individually removable and restorable', () => {
  const drafts = crmAgreementDrafts('Prueba\nPrueba\nLlamar', new Date(2026, 10, 11))
  assert.notEqual(drafts[0]!.key, drafts[1]!.key)
  assert.deepEqual(crmVisibleAgreementDrafts(drafts, [drafts[0]!.key]).map(row => row.source), ['Prueba', 'Llamar'])
  assert.equal(crmVisibleAgreementDrafts(drafts, []).length, 3)
})

test('calendar only excludes submitted commitments, never the saved agreements', () => {
  const source = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
  assert.match(source, /@click="removeAgreementDraft\(item\.key\)"/)
  assert.match(source, /@click="restoreAgreementDrafts"/)
  assert.match(source, /agreements: data\.agreements\.trim\(\) \|\| null/)
  assert.match(source, /agreementCommitments: taskDrafts\\.map/)
  assert.match(source, /omittedAgreementKeys\.value = \[\]/)
})


test('bitácora only schedules explicit agreement selections', () => {
  const source = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
  assert.match(source, /const logTaskKeys = ref<string\[\]>\(\[\]\)/)
  assert.match(source, /selectedLogTaskKeys: logTaskKeys\.value/)
  assert.match(source, /logTaskKeys\.value\.includes\(item\.key\)/)
  assert.match(source, /agreementCommitments: taskDrafts\.map/)
  assert.match(source, /scheduledStartAt: requiresSchedule \? start\.toISOString\(\) : null/)
  assert.match(source, /reminderLeadMinutes: requiresSchedule \|\| taskDrafts\.length/)
  assert.match(source, /Cada tarea seleccionada necesita un nombre y una fecha futura/)
})
