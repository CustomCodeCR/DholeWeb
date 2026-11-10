import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const picker = readFileSync('src/modules/crm/components/CrmExecutivePicker.vue', 'utf8')

test('prospect list resolves assigned seller names through scoped CRM endpoint', () => {
  assert.match(workspace, /Vendedor asignado/)
  assert.match(workspace, /loadLeadSellers\(response.items\)/)
  assert.match(workspace, /crmPath\('leads', 'assigned-executives'\)/)
})
test('admin can assign new and existing prospects to sellers', () => {
  assert.match(workspace, /can\('crm.lead.assign'\)/)
  assert.match(workspace, /:allow-institutional="false"/)
  assert.match(detail, /crmPath\('leads', id.value, 'assign'\)/)
  assert.match(detail, /leadExecutiveName/)
})
test('institutional seller is hidden for prospect assignment', () => {
  assert.match(picker, /props.allowInstitutional !== false/)
})
