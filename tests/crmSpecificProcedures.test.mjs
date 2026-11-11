import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const manager = readFileSync('src/modules/crm/components/CrmSpecificProceduresManager.vue', 'utf8')

test('specific procedures are a dedicated tab for each customer', () => {
  assert.match(hub, /key: 'procedures' as const/)
  assert.match(hub, /activeTab === 'procedures'/)
  assert.match(hub, /<CrmSpecificProceduresManager/)
  assert.match(hub, /:account-id="String\(account.id\)"/)
})

test('each account supports multiple cards with details and team assignment', () => {
  assert.match(manager, /v-for="procedure in shown"/)
  assert.match(manager, /Nombre del procedimiento/)
  assert.match(manager, /Detalle del procedimiento/)
  assert.match(manager, /Equipo asignado/)
  assert.match(manager, /Nuevo procedimiento/)
  assert.match(manager, /lg:grid-cols-2/)
  assert.match(manager, /crm\.account\.update/)
})

test('writes use account-scoped REST routes and optimistic concurrency', () => {
  assert.match(manager, /crmPath\('accounts', props\.accountId, 'specific-procedures'\)/)
  assert.match(manager, /expectedVersion: previous\?\.rowVersion/)
  assert.match(manager, /'PUT' : 'POST'/)
  assert.match(manager, /'DELETE'/)
  assert.match(manager, /Confirmar eliminación/)
})

test('procedure documents are bound to the saved procedure and can be retried safely', () => {
  assert.match(manager, /CrmDocumentsPanel kind="procedure" :record-id="procedure.id"/)
  assert.match(manager, /sourceService: 'DholeCRMService', entityType: 'crm.procedure'/)
  assert.match(manager, /crmPath\('documents\/procedure', result\.id, 'access'\)/)
  assert.match(manager, /editingId\.value = result\.id/)
  assert.match(manager, /pendingDocuments\.value = failed/)
  assert.match(manager, /multiple :disabled="saving"/)
})
