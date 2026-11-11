import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const zone = readFileSync('src/modules/crm/components/CrmFileDropzone.vue', 'utf8')
const documents = readFileSync('src/modules/crm/components/CrmDocumentsPanel.vue', 'utf8')
const procedures = readFileSync('src/modules/crm/components/CrmSpecificProceduresManager.vue', 'utf8')
const agenda = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')

test('file picker and native drag/drop share one controlled unlimited queue', () => {
  assert.match(zone, /type="file" multiple/)
  assert.match(zone, /@dragenter\.prevent\.stop="onDragEnter"/)
  assert.match(zone, /@dragover\.prevent\.stop/)
  assert.match(zone, /@dragleave\.prevent\.stop="onDragLeave"/)
  assert.match(zone, /@drop\.prevent\.stop="onDrop"/)
  assert.match(zone, /event\.dataTransfer\?\.files/)
  assert.match(zone, /emit\('update:modelValue', merged\)/)
  assert.match(zone, /file\.lastModified/)
  assert.match(zone, /100 \* 1024 \* 1024/)
  assert.match(zone, /Sin límite de cantidad/)
  assert.doesNotMatch(zone, /maxFiles|MAX_FILES|length > 10/)
})

test('documents of accounts, leads, contacts and activities have the dropzone and viewer', () => {
  assert.match(documents, /<CrmFileDropzone v-model="selectedFiles"/)
  assert.match(documents, /StorageFileViewer/)
  assert.match(documents, /storagePreviewKind/)
  assert.match(documents, /@click="preview\(file\)"/)
  assert.match(documents, /StorageService\.downloadFile/)
  assert.match(documents, /storage\.files\.create/)
})

test('each procedure can queue unlimited documents and view or download its saved files', () => {
  assert.match(procedures, /<CrmFileDropzone v-model="pendingDocuments"/)
  assert.match(procedures, /<CrmDocumentsPanel kind="procedure" :record-id="procedure\.id"/)
  assert.match(procedures, /entityType: 'crm\.procedure'/)
  assert.match(procedures, /pendingDocuments\.value = failed/)
  assert.doesNotMatch(procedures, /hasta 10 documentos|Máximo 10 archivos|current\.length \+ unique\.length > 10/)
})

test('commercial calendar uses drag/drop without losing safe retry of uploaded files', () => {
  assert.match(agenda, /<CrmFileDropzone v-model="attachedDocuments"/)
  assert.match(agenda, /if \(!pendingDocumentRecord\.value\)/)
  assert.match(agenda, /StorageService\.uploadFile/)
  assert.match(agenda, /attachedDocuments\.value = attachedDocuments\.value\.filter/)
})
