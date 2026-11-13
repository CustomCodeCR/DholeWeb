import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const account = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const lead = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')

test('commercial log is a separate read-only activity listing with server side filters', () => {
  assert.match(calendar, /crmList\('activities\/bitacora'/)
  assert.match(calendar, /from, to, page: logPage\.value, pageSize: logPageSize/)
  assert.match(calendar, /type: logType\.value \|\| undefined/)
  assert.match(calendar, /canSeeAllLogOwners\.value && ownerFilter\.value/)
  assert.match(calendar, /view === 'agenda' && \(item\.status === 'Completed'/)
  assert.match(calendar, /Ver detalle y documentos/)
  assert.match(calendar, /<DhModal :open="creationOpen"/)
  assert.match(calendar, /<CrmFileDropzone/)
})
test('account and prospect display their own commercial log independently from agenda', () => {
  assert.match(account, /key: 'log' as const/)
  assert.match(account, /CrmSalesCalendar view="log" :account-id/)
  assert.match(account, /scheduledTimeline/)
  assert.match(lead, /key: 'log' as const/)
  assert.match(lead, /CrmSalesCalendar view="log" :lead-id/)
})
