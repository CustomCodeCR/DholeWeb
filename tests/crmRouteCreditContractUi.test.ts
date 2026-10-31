import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')
const credit = read('src/modules/crm/components/CrmCreditCoverageManager.vue')
const editor = read('src/modules/crm/components/CrmAccountEditor.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')

test('Route creation follows clear service, origin/destination, volume steps', () => {
  assert.ok(hub.includes('data-crm-route-form'))
  assert.ok(hub.includes('Servicio y frecuencia'))
  assert.ok(hub.includes('Trayecto'))
  assert.ok(hub.includes('Volumen habitual'))
  assert.ok(hub.includes('v-if="serviceCode"'))
  assert.ok(hub.includes('v-if="originCode"'))
  assert.ok(hub.includes('routeFormError'))
  assert.ok(hub.includes("crmPath('accounts', rowId(props.account.id), 'trade-profiles')"))
})

test('Credit creation is accessible on account and gives inline actionable errors', () => {
  assert.ok(hub.includes(':editable="has(\'crm.credit.manage\')"'))
  assert.ok(credit.includes('data-crm-credit-proposal'))
  assert.ok(credit.includes("proposalOperationKey.value"))
  assert.ok(credit.includes('proposalError'))
  assert.ok(credit.includes('Solicitar crédito'))
  assert.ok(credit.includes('await refresh()'))
  assert.ok(editor.includes("activeEditorSection!=='credit'"))
})

test('Signed contracts upload through Storage without user-visible UUID fields', () => {
  assert.ok(detail.includes('data-crm-contract-form'))
  assert.ok(detail.includes('StorageService.uploadFile'))
  assert.ok(detail.includes("entityType: 'CreditContract'"))
  assert.ok(detail.includes('newlyCreatedContractId.value'))
  assert.ok(detail.includes('contractRenewalDrafts'))
  assert.ok(detail.includes('Adjuntar contrato firmado'))
  assert.ok(!detail.includes('v-model.trim="drafts.fileId"'))
  assert.ok(!detail.includes("t('crm.signedFileId')"))
  assert.ok(detail.includes('Guardar contrato'))
})
