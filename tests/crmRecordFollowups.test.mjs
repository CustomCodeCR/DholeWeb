import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(path, 'utf8')
const lead = read('src/modules/crm/views/CrmRecordDetailView.vue')
const account = read('src/modules/crm/components/CrmAccountHub.vue')
const history = read('src/modules/crm/components/CrmRecordFollowups.vue')

test('both CRM record types offer a permissioned Seguimientos tab', () => {
  assert.match(lead, /key: 'followups' as const, label: 'Seguimientos'/)
  assert.match(account, /key: 'followups' as const, label: locale\.value === 'en' \? 'Follow-ups' : 'Seguimientos'/)
  assert.match(lead, /leadTab === 'followups'/)
  assert.match(account, /activeTab === 'followups'/)
  assert.match(lead, /<CrmRecordFollowups :lead-id="id"/)
  assert.match(account, /<CrmRecordFollowups :account-id="String\(account\.id\)" :account-ids="groupAccountIds"/)
  assert.match(lead, /crm\.bitacora\.read/)
  assert.match(account, /crm\.followup\.manage/)
})

test('history uses the existing CRM REST endpoints and record ownership filters', () => {
  assert.match(history, /resource: 'activities\/bitacora'/)
  assert.match(history, /resource: 'activities'/)
  assert.match(history, /resource: 'followups'/)
  assert.match(history, /recordBelongsTo\(item\)/)
  assert.match(history, /props\.leadId/)
  assert.match(history, /props\.accountId/)
  assert.match(history, /props\.accountIds/)
  assert.match(history, /crmPath\('calendar\/labels'\)/)
  assert.match(history, /Promise\.allSettled/)
  assert.match(history, /source === 'bitacora'/)
})

test('history supports search, status and type filters with paging and detail links', () => {
  assert.match(history, /v-model="search"/)
  assert.match(history, /v-model="statusFilter"/)
  assert.match(history, /v-model="sourceFilter"/)
  assert.match(history, /const pageSize = 20/)
  assert.match(history, /<RouterLink :to="item\.href"/)
  assert.match(history, /role="alert"/)
  assert.match(history, /function formattedDate\(/)
})
