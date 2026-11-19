import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const forms = readFileSync('src/modules/crm/model/crmForms.ts', 'utf8')
const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const contacts = readFileSync('src/modules/crm/components/CrmLeadContacts.vue', 'utf8')
test('source, initial notes and legal name stay visible in capture', () => {
  assert.match(forms, /Fuente de captación/)
  assert.match(forms, /Notas y observaciones iniciales/)
  assert.match(forms, /Razón social \(opcional\)/)
  assert.match(workspace, /crm-lead-sources/)
})
test('prospect onboarding supports contacts and geographic divisions', () => {
  assert.match(workspace, /data-crm-prospect-relations/)
  assert.match(workspace, /CrmAddressLocationFields/)
  assert.match(workspace, /optionalContacts\.value\.map/)
  assert.match(workspace, /optionalAddresses\.value\.map/)
})
test('contact management lives within prospect details', () => {
  assert.match(detail, /CrmLeadContacts/)
  assert.match(detail, /crm-lead-panel-contacts/)
  assert.match(contacts, /canCreate && !converted/)
  assert.match(contacts, /canEdit && !converted/)
  assert.match(contacts, /crmPath\('leads', props\.leadId, 'contacts'/)
})
