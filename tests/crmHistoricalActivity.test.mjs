import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync(new URL('../src/modules/crm/components/CrmSalesCalendar.vue', import.meta.url), 'utf8')

test('backdated activities are not automatically moved forward', () => {
  assert.match(view, /data\.type === 'FOLLOWUP' && !userEditedStart\.value/)
  assert.match(view, /data\.type === 'FOLLOWUP' && start\.getTime\(\) < Date\.now\(\) - 60000/)
  // An explicit end time is now required for follow-ups as well as activities.
  assert.match(view, /\(!Number\.isFinite\(end\.getTime\(\)\) \|\| end <= start\)/)
  assert.match(view, /startAt: start\.toISOString\(\), dueAt: end\.toISOString\(\)/)
})

test('server determines actual occurrence for logs and historical activities', () => {
  assert.match(view, /const historicalActivity = requiresSchedule && data\.type !== 'FOLLOWUP'/)
  // Explicit null delegates to CRM's UTC clock; scheduled historical dates are
  // inferred by the API so a fast workstation clock cannot trigger future errors.
  assert.match(view, /occurredAt: null/)
  assert.doesNotMatch(view, /occurredAt:\s*!requiresSchedule\s*\?\s*new Date\(\)\.toISOString\(\)/)
  assert.match(view, /scheduledStartAt: requiresSchedule \? start\.toISOString\(\) : null/)
  assert.match(view, /scheduledEndAt: requiresSchedule \? end\.toISOString\(\) : null/)
  assert.match(view, /sin avisos retroactivos/i)
})

test('past activities are explained in the form; future commitments keep validation', () => {
  assert.match(view, /historicalActivityDraft/)
  assert.match(view, /Las tareas con vencimiento futuro necesitan un nombre/)
  assert.match(view, /commitmentDue\.getTime\(\) <= end\.getTime\(\)/)
})

test('bitácora completes entries without scheduling or reminders', () => {
  assert.match(view, /const creatingReminder = computed/)
  assert.match(view, /setReminderMode\(false\)/)
  assert.match(view, /Crear recordatorio/)
  assert.match(view, /v-if="creatingReminder" class="calendar-label">Inicio/)
  assert.match(view, /scheduledStartAt: requiresSchedule \? start\.toISOString\(\) : null/)
  assert.match(view, /scheduledEndAt: requiresSchedule \? end\.toISOString\(\) : null/)
  assert.match(view, /reminderLeadMinutes: requiresSchedule \|\| taskDrafts\.length \? data\.reminderMinutes : null/)
  assert.match(view, /agreementCommitments: taskDrafts\.map/)
  assert.match(view, /Gestión registrada en bitácora, sin cita ni avisos para la gestión/)
})
