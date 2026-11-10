import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const detail = readFileSync(new URL('../src/modules/crm/views/CrmRecordDetailView.vue', import.meta.url), 'utf8')

test('detail resolves client, owner, contact, and opportunity from authorized CRM sources', () => {
  assert.match(detail, /crmPath\('calendar\/labels'\)/)
  assert.match(detail, /crmPath\('contacts', String\(item.contactId\)\)/)
  assert.match(detail, /agendaClientName\(\)/)
  assert.match(detail, /agendaOwnerName\(\)/)
})

test('activity detail loads saved meeting minutes, agreements and dated commitments', () => {
  assert.match(detail, /crmPath\('activities', String\(item.id\), 'notes'\)/)
  assert.match(detail, /crmPath\('activities', String\(item.id\), 'commitments'\)/)
  assert.match(detail, /data-crm-activity-full-detail/)
  assert.match(detail, /commitment.status === 'Completed'/)
})

test('linked followup exposes its parent activity and the full reminder cadence', () => {
  assert.match(detail, /crmPath\('followups', String\(item.id\), 'parent-activity'\)/)
  assert.match(detail, /agendaParent\.activityId/)
  assert.match(detail, /agendaCadence\(item.reminderRepeatMinutes, 'minutos'\)/)
})
