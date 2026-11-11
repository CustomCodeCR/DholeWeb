import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync('src/modules/crm/components/CrmDocumentsPanel.vue', 'utf8')
const storage = readFileSync('src/core/services/storageService.ts', 'utf8')
const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const hub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')

test('CRM documents reuse Storage and bind to the exact entity record', () => {
  assert.match(storage, /getFilesByEntity\(sourceService: string, entityType: string, entityId: string\)/)
  assert.match(storage, /\/api\/v1\/storage\/files\/by-entity/)
  assert.match(component, /crmPath\('documents\/' \+ kind, recordId, 'access'\)/)
  assert.match(component, /'DholeCRMService', 'crm\.' \+ kind, recordId/)
  assert.match(component, /entityId: props\.recordId/)
  assert.match(component, /storage\.files\.create/)
  assert.match(component, /storage\.files\.view/)
  assert.match(component, /storage\.files\.download/)
})

test('accounts, leads, contacts, activities and followups expose documents in record UI', () => {
  assert.match(hub, /key: 'documents' as const/)
  assert.match(hub, /<CrmDocumentsPanel kind="account"/)
  assert.match(detail, /<CrmDocumentsPanel kind="lead"/)
  assert.match(detail, /<CrmDocumentsPanel v-if="section === 'contacts'" kind="contact"/)
  assert.match(detail, /:kind="section === 'activities' \? 'activity' : 'followup'"/)
})

test('agenda preserves created identity on file-upload retries', () => {
  assert.match(calendar, /const pendingDocumentRecord = ref/)
  assert.match(calendar, /if \(!pendingDocumentRecord\.value\)/)
  assert.match(calendar, /createdActivity\.id/)
  assert.match(calendar, /createdFollowup\.id/)
  assert.match(calendar, /StorageService\.uploadFile\(/)
  assert.match(calendar, /Adjuntos|Documentos adjuntos|Documentos/)
})

test('procedure documents can be previewed and the panel uses record-level access', () => {
  assert.match(component, /'followup' \| 'procedure'/)
  assert.match(component, /StorageFileViewer/)
  assert.match(component, /storagePreviewKind/)
  assert.match(component, /canPreview\(file\)/)
  assert.match(component, /@click="preview\(file\)"/)
})
