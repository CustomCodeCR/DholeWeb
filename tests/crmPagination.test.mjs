import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(path, 'utf8')
const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
const contacts = read('src/modules/crm/views/CrmContactsDirectory.vue')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')

test('CRM list pages share DhPagination and server-selected page sizes', () => {
  assert.equal((workspace.match(/<DhPagination\b/g) ?? []).length, 2)
  assert.match(workspace, /pageSize: pageSize\.value, q: search\.value\.trim\(\)/)
  assert.match(workspace, /filtered\.slice\(\(page\.value - 1\) \* pageSize\.value, page\.value \* pageSize\.value\)/)
  assert.match(workspace, /section\.value === 'finance' \|\| section\.value === 'settings'/)
  assert.doesNotMatch(workspace, /page\*25 >= total/)
})
test('Contacts directory keeps backend pagination and shows shared controls', () => {
  assert.match(contacts, /<DhPagination\b/)
  assert.match(contacts, /pageSize: pageSize\.value/)
  assert.match(contacts, /@update:page="changeContactsPage"/)
  assert.doesNotMatch(contacts, /page \* 25 >= total/)
})
test('Account contacts and page-based audit and route history share paging UI', () => {
  assert.equal((hub.match(/<DhPagination\b/g) ?? []).length, 3)
  assert.match(hub, /pageSize=' \+ accountChangesPageSize\.value/)
  assert.match(hub, /pageSize=' \+ routeHistoryPageSize\.value/)
  assert.match(hub, /v-for="contact in pagedContacts"/)
  assert.doesNotMatch(hub, /changeRouteHistoryPage\(-1\)|changeAccountChangesPage\(-1\)/)
})
test('Detail related records are paginated without modifying CRM REST endpoint', () => {
  assert.match(detail, /v-for="item in pagedRelationRows"/)
  assert.match(detail, /<DhPagination v-if="relationRows\.length > relationPageSize"/)
  assert.match(detail, /crmRequest<CrmRow\[\] \| CrmRow>\(endpoint\(relation\.value\)\)/)
})
