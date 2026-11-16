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

test('activity completion uses server UTC clock and active configured result code', () => {
  assert.match(detail, /CatalogItemsService\.select\(\{ catalogGroupSlug: 'crm-activity-outcomes' \}\)/)
  assert.match(detail, /activityOutcomeOptions\.value = Array\.from/)
  assert.match(detail, /outcome: 'COMPLETED'/)
  assert.match(detail, /async function completeActivity\(\)/)
  assert.match(detail, /occurredAt: null, note: drafts\.note \|\| null/)
  assert.doesNotMatch(detail, /occurredAt: new Date\(\)\.toISOString\(\), note: drafts\.note/)
  assert.match(detail, /:options="activityOutcomeOptions"/)
  assert.match(detail, /item\.value === drafts\.outcome/)
})

test('completion status is confirmed from CRM after a rejected request or another tab', () => {
  assert.match(detail, /async function refreshActivityState\(showFeedback = false\)/)
  assert.match(detail, /const updated = await crmGet\('activities', activityId\)/)
  assert.match(detail, /if \(updated.status === 'Completed'\)/)
  assert.match(detail, /const confirmed = await refreshActivityState\(false\)/)
  assert.match(detail, /window.addEventListener\('focus', syncActivityOnFocus\)/)
  assert.match(detail, /window.removeEventListener\('focus', syncActivityOnFocus\)/)
  assert.match(detail, /data-crm-completion-confirmed/)
  assert.match(detail, /label="Verificar estado en CRM"/)
})

test('CRM detail localizes commercial followups and displays real completion date only when saved', () => {
  assert.match(detail, /COMMERCIAL_FOLLOWUP:'Seguimiento comercial'/)
  assert.match(detail, /if \(activity && item.occurredAt\) fields.push/)
  assert.match(detail, /activityOutcomeOptions.value.find\(option => option.value === item.outcome\)/)
})
