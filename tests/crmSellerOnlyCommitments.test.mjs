import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
test('CRM calendar assignees are eligible by effective scopes, not named roles', () => {
  assert.ok(calendar.includes("['crm.activity.read', 'crm.activity.read-all', 'crm.followup.manage']"))
  assert.ok(!calendar.includes("['Vendedor', 'Vendedores', 'Vendedor Supervisor', 'Vendedor Jefe', 'SuperUsuario']"))
  assert.ok(calendar.includes('<label class="calendar-label">Responsable'))
  assert.ok(calendar.includes('const ownerChoices = computed(() => calendarDirectory.value.map'))
  assert.ok(calendar.includes('sellerDirectory.value.map(user => user.id)'))
  assert.ok(calendar.includes('eligibleSeller(data.ownerId)'))
  assert.ok(!calendar.includes('...rows.value.map(x => x.ownerId)'))
})
test('Activity editors can complete linked commitments', () => {
  assert.ok(detail.includes("can('crm.activity.update')"))
  assert.ok(detail.includes("crmPath('followups', String(commitment.id), 'complete')"))
  assert.ok(detail.includes("expectedVersion: Number(commitment.rowVersion ?? 0)"))
})
