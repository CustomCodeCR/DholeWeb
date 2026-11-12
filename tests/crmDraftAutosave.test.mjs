import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../src/modules/crm/', import.meta.url)
const source = (name) => readFileSync(new URL(name, root), 'utf8')

test('CRM draft engine isolates browser drafts by tenant, user, form and record', () => {
  const code = source('utils/crmDraftAutosave.ts')
  assert.match(code, /encodeURIComponent\(String\(auth\.clientId/)
  assert.match(code, /encodeURIComponent\(userId\)/)
  assert.match(code, /encodeURIComponent\(scope\)/)
  assert.match(code, /MAX_AGE_MS/)
  assert.match(code, /MAX_DRAFT_LENGTH/)
  assert.match(code, /window\.confirm/)
})

test('CRM drafts are persisted synchronously and cleared only after confirmed saves', () => {
  const code = source('utils/crmDraftAutosave.ts')
  assert.match(code, /watch\(options\.capture, persist, \{ deep: true, flush: 'sync' \}\)/)
  assert.match(code, /function begin\(\)/)
  assert.match(code, /function commit\(\)/)
  assert.match(code, /function stop\(\)/)
  assert.match(code, /onBeforeUnmount\(stop\)/)
  assert.match(code, /auth\.isAuthenticated/)
})

for (const [path, scope, expected] of [
  ['views/CrmWorkspaceView.vue', 'workspaceDraft', 'optionalAddresses.value'],
  ['components/CrmAccountEditor.vue', 'accountAutosave', 'profileDraft'],
  ['components/CrmContactForm.vue', 'contactAutosave', 'operationKey'],
  ['views/CrmContactDetailView.vue', 'contactAutosave', 'contactId.value'],
  ['components/CrmActivityFullEditor.vue', 'activityDraft', 'noteDrafts.value'],
  ['components/CrmSalesCalendar.vue', 'calendarDraft', 'pendingDocumentRecord.value'],
  ['views/CrmRecordDetailView.vue', 'relatedAutosave', 'addressLocation.value'],
  ['components/CrmSpecificProceduresManager.vue', 'procedureAutosave', 'draft'],
  ['components/CrmLeadLocations.vue', 'locationAutosave', 'location.value'],
  ['components/CrmLeadCommercialPanel.vue', 'routeAutosave', 'routeDraft'],
  ['components/CrmQuoteDeliveryPanel.vue', 'deliveryAutosave', 'selectedContactIds.value'],
]) {
  test('CRM autosave wiring: ' + path, () => {
    const code = source(path)
    assert.ok(code.includes('useCrmDraftAutosave'), 'must use shared draft engine')
    assert.ok(code.includes(scope + '.begin()'), 'must support recovery')
    assert.ok(code.includes(scope + '.commit()'), 'must clear successful saves')
    assert.ok(code.includes(expected), 'must capture relevant state')
  })
}

test('CRM calendar warns when attached files must be selected again', () => {
  const code = source('components/CrmSalesCalendar.vue')
  assert.match(code, /draftHadAttachments/)
  assert.match(code, /Volvé a seleccionar los documentos adjuntos/)
})
