import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync(new URL('../src/modules/crm/components/CrmSalesCalendar.vue', import.meta.url), 'utf8')

test('backdated activities are not automatically moved forward', () => {
  assert.match(view, /data\.type === 'FOLLOWUP' && !userEditedStart\.value/)
  assert.match(view, /data\.type === 'FOLLOWUP' && start\.getTime\(\) < Date\.now\(\) - 60000/)
  assert.match(view, /data\.type !== 'FOLLOWUP' && \(!Number\.isFinite\(end\.getTime\(\)\) \|\| end <= start\)/)
})

test('completed historical activity sends original end as occurredAt', () => {
  assert.match(view, /const historicalActivity = requiresSchedule && data\.type !== 'FOLLOWUP'/)
  assert.match(view, /occurredAt: !requiresSchedule \? new Date\(\)\.toISOString\(\) : historicalActivity \? end\.toISOString\(\) : null/)
  assert.match(view, /no generar|sin avisos retroactivos/i)
})

test('past activities are explained in the form; future commitments keep validation', () => {
  assert.match(view, /historicalActivityDraft/)
  assert.match(view, /'Revisá cada acuerdo y asignale una fecha futura válida/)
  assert.match(view, /commitmentDue\.getTime\(\) <= end\.getTime\(\)/)
})

test('bitácora completes entries without scheduling or reminders', () => {
  assert.match(view, /const creatingReminder = computed/)
  assert.match(view, /setReminderMode\(false\)/)
  assert.match(view, /Crear recordatorio/)
  assert.match(view, /v-if="creatingReminder" class="calendar-label">Inicio/)
  assert.match(view, /scheduledStartAt: requiresSchedule \? start\.toISOString\(\) : null/)
  assert.match(view, /scheduledEndAt: requiresSchedule \? end\.toISOString\(\) : null/)
  assert.match(view, /reminderLeadMinutes: requiresSchedule \? data\.reminderMinutes : null/)
  assert.match(view, /agreementCommitments: requiresSchedule \? agreementDrafts\.value/)
  assert.match(view, /Registro en bitácora · Sin recordatorios/)
})
