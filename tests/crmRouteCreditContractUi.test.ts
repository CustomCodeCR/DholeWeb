import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')
const credit = read('src/modules/crm/components/CrmCreditCoverageManager.vue')
const editor = read('src/modules/crm/components/CrmAccountEditor.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')

test('Frequent routes select maritime, land or air and save POL/POE/POD without measures', () => {
  assert.ok(hub.includes('data-crm-route-form'))
  assert.ok(hub.includes('Modalidad de transporte'))
  assert.ok(hub.includes("mode.code"))
  assert.ok(hub.includes("routeTerminalType"))
  assert.ok(hub.includes("routeNeedsPod"))
  assert.ok(hub.includes('polCode: originCode.value'))
  assert.ok(hub.includes('poeCode: poeCode.value'))
  assert.ok(hub.includes('podCode: routeNeedsPod.value ? podCode.value : null'))
  assert.ok(!hub.includes('Volumen habitual'))
  assert.ok(!hub.includes('v-model="expectedVolume"'))
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

test('Credit submit does not rely on native form submission or hide errors', () => {
  assert.ok(credit.includes('data-crm-credit-submit @click.stop="proposeNew"'))
  assert.ok(credit.includes('novalidate data-crm-credit-proposal'))
  assert.ok(credit.includes('Tu usuario no tiene permiso para solicitar crédito'))
})

test('Contract accepts drop and browse while hiding technical file identifiers', () => {
  const dropzone = read('src/modules/crm/components/CrmContractFileDropzone.vue')
  assert.ok(dropzone.includes('data-crm-contract-dropzone'))
  assert.ok(dropzone.includes('@drop.prevent="onDrop"'))
  assert.ok(dropzone.includes('@change="fromInput"'))
  assert.ok(dropzone.includes('file.size > 25 * 1024 * 1024'))
  assert.ok(detail.includes('<CrmContractFileDropzone v-model="signedContractFile"'))
  assert.ok(detail.includes('selectExistingContractFile'))
})

test('Calendar validates types against Config and uses one modal title', () => {
  const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
  assert.ok(calendar.includes('loadConfiguredActivityTypes'))
  assert.ok(calendar.includes('CatalogItemsService.select'))
  assert.ok(calendar.includes('configuredActivityTypes.value.some'))
  assert.ok(calendar.includes('selectableActivityTypes'))
  assert.ok(!calendar.includes('<h3 class="text-lg font-extrabold">Programar actividad</h3>'))
})

test('Customer sheet keeps relevant fields and removes legacy operational blocks', () => {
  const sheet = read('src/modules/crm/components/CrmDynamicsAccountSheet.vue')
  for (const label of ['Teléfono', 'Correo electrónico', 'Sitio web', 'Seguimiento de la cuenta']) {
    assert.ok(sheet.includes(label))
  }
  for (const legacy of ['Historia de la empresa', 'Análisis operativo e instrucciones', 'Líneas de productos o mercancías', 'Estrategia comercial']) {
    assert.ok(!sheet.includes(legacy))
  }
})

test('CRM agenda defaults to local current time and ends an hour later', () => {
  const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
  assert.ok(calendar.includes('const now = new Date()'))
  assert.ok(calendar.includes('now.getHours(), now.getMinutes()'))
  assert.ok(calendar.includes('when.getTime() + 60 * 60000'))
  assert.ok(calendar.includes('watch(() => editor.value.start'))
  assert.ok(!calendar.includes('Se vinculará automáticamente sin volver a ingresar la cédula'))
})
test('Credit request visibly verifies API write and shows backend error', () => {
  assert.ok(credit.includes('proposalStatus'))
  assert.ok(credit.includes('const created = await crmRequest<CrmRow>'))
  assert.ok(credit.includes('if (!created?.id)'))
  assert.ok(credit.includes('proposalFailure(cause)'))
})
