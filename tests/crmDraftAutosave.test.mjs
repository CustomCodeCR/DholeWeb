import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = new URL('../src/modules/crm/', import.meta.url)
const source = (name) => readFileSync(new URL(name, root), 'utf8')

test('CRM draft engine isolates browser drafts by tenant, user, form and record', () => {
  const code = source('utils/crmDraftAutosave.ts')
  assert.match(code, /encodeURIComponent\(String\(auth\.clientId/)
  assert.match(code, /encodeURIComponent\(userId\)/)
  assert.match(code, /encodeURIComponent\(scope\)/)
  assert.match(code, /MAX_AGE_MS/)
  assert.match(code, /MAX_DRAFT_LENGTH/)
  assert.doesNotMatch(code, /window\.(?:confirm|alert|prompt)\s*\(/)
  assert.match(code, /requestCrmDraftRecovery/)
  assert.match(code, /preserveStoredDraft/)
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

test('CRM recovery uses a shared DhModal and DhButton, never native dialogs', () => {
  const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const modal = source('components/CrmDraftRecoveryModal.vue')
  const queue = source('utils/crmDraftRecoveryDialog.ts')
  assert.match(app, /<CrmDraftRecoveryModal/)
  assert.match(modal, /<DhModal/)
  assert.match(modal, /<DhButton/)
  assert.match(modal, /choose\('restore'\)/)
  assert.match(modal, /choose\('discard'\)/)
  assert.match(modal, /choose\('later'\)/)
  assert.match(queue, /pending\.push\(request\)/)
  assert.match(queue, /cancel: \(\) => finish\(request, 'later'\)/)
  assert.doesNotMatch(modal + queue, /window\.(?:confirm|alert|prompt)\s*\(/)
})

test('CRM recovery never opens for a hidden form and never discards deferred work', () => {
  const code = source('utils/crmDraftAutosave.ts')
  assert.match(code, /if \(options\.enabled !== undefined && !toValue\(options\.enabled\)\) return/)
  assert.match(code, /if \(preserveStoredDraft\) return/)
  assert.match(code, /generation !== recoveryGeneration/)
  assert.match(code, /cancelPendingRecovery\(\)/)
})

test('Dhole source prohibits native browser modal dialogs', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
  const nativeDialog = /\\b(?:window|globalThis)\\s*\\.\\s*(?:confirm|alert|prompt)\\s*\\(/
  const violations = []
  function walk(folder) {
    for (const item of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, item.name)
      if (item.isDirectory()) {
        walk(path)
      } else if (/\\.(?:vue|ts|tsx|js|jsx)$/.test(item.name)) {
        if (nativeDialog.test(readFileSync(path, 'utf8'))) violations.push(path)
      }
    }
  }
  walk(sourceRoot)
  assert.deepEqual(violations, [], 'Use DhModal/DhButton, never a native browser modal')
})
