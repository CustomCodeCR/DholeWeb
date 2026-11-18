import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const collaboration = readFileSync('src/modules/crm/components/CrmActivityCollaboration.vue', 'utf8')

test('CRM activity editor allows multiple internal invitees from Auth while keeping one owner', () => {
  assert.match(calendar, /data-crm-internal-invitees/)
  assert.match(calendar, /crmPath\('calendar\/invitees'\)/)
  assert.match(calendar, /v-model="selectedInviteeIds"/)
  assert.match(calendar, /participantUserIds:\s*requiresSchedule/)
  assert.match(calendar, /inviteeUserIds:\s*selectedInviteeIds/)
  assert.match(calendar, /ownerUserId:\s*data\.ownerId/)
  assert.match(calendar, /selectedInviteeIds\.value\.filter\(id => id !== data\.ownerId\)/)
})

test('Shared followup invitees can be edited from calendar details', () => {
  assert.match(calendar, /crmPath\('followups', item\.id, 'invitees'\)/)
  assert.match(calendar, /'PUT',\s*\{/)
  assert.match(calendar, /v-model="detailInviteeIds"/)
})

test('Activity detail allows internal invitations without replacing external account contacts', () => {
  assert.match(collaboration, /crmPath\('calendar\/invitees'\)/)
  assert.match(collaboration, /userId, participantName: null, role: 'RESPONSIBLE'/)
  assert.match(collaboration, /v-model="selectedContactIds"/)
  assert.match(collaboration, /v-model="selectedInternalIds"/)
})
