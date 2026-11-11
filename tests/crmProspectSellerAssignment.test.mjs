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
  assert.doesNotMatch(workspace, /:allow-institutional="false"/)
  assert.match(workspace, /\['accounts', 'leads'\].includes\(section.value\)/)
  assert.match(workspace, /body.assignToCastroFallas = true/)
  assert.match(detail, /crmPath\('leads', id.value, 'assign'\)/)
  assert.match(detail, /leadExecutiveName/)
})
test('Castro Fallas appears for creation and reassignment and never goes as an Auth GUID', () => {
  assert.match(picker, /props.allowInstitutional !== false/)
  assert.match(picker, /CASTRO_FALLAS_SELLER = '__castro_fallas__'/)
  assert.doesNotMatch(detail, /:allow-institutional="section === 'accounts'"/)
  assert.match(detail, /assignToCastroFallas: selectedExecutive.value === '__castro_fallas__'/)
  assert.match(detail, /executiveUserId: selectedExecutive.value === '__castro_fallas__' \? null/)
})
