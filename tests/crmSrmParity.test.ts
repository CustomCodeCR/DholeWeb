import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')
const create = read('src/modules/crm/views/CrmWorkspaceView.vue')
const edit = read('src/modules/crm/components/CrmAccountEditor.vue')
const lookup = read('src/modules/crm/components/CrmHaciendaLookup.vue')
const supplier = read('src/modules/srm/views/SrmWorkspaceView.vue')

test('CRM account creation mirrors SRM functional tab navigation without stacked sections', () => {
  assert.match(supplier, /role="tablist"/)
  assert.match(create, /data-crm-account-tabs/)
  assert.match(create, /role="tablist"/)
  for (const tab of ['identity', 'commercial', 'contacts', 'addresses']) {
    assert.match(create, new RegExp("accountFormTab === '" + tab + "'"))
  }
  assert.match(create, /:aria-selected="accountFormTab === item.key"/)
  assert.match(create, /role="tabpanel"/)
  assert.match(create, /:is="item.icon"/)
  assert.match(create, /focusAccountSection\(item.key\)/)
  assert.doesNotMatch(create, /Navigation shortcuts scroll; all sections stay visible/)
})

test('CRM account editing uses the same SRM-style top tab strip and keeps scopes', () => {
  assert.match(edit, /data-crm-editor-tabs/)
  assert.match(edit, /data-crm-editor-nav/)
  assert.match(edit, /role="tablist"/)
  assert.match(edit, /:aria-selected="activeEditorSection === section.id"/)
  assert.match(edit, /v-show="activeEditorSection==='identity'"/)
  assert.match(edit, /v-show="activeEditorSection==='commercial'"/)
  assert.match(edit, /v-show="activeEditorSection==='credit'"/)
  assert.match(edit, /can\('crm.credit.read'\)/)
  assert.match(edit, /crmPatch<CrmRow>\('accounts'/)
  assert.match(edit, /CrmCreditCoverageManager/)
})

test('Hacienda lookup is automatic, race-safe, and the API response applies immediately', () => {
  assert.match(lookup, /setTimeout\(\(\) =>/)
  assert.match(lookup, /650/)
  assert.match(lookup, /retryCrmHaciendaNetwork\(/)
  assert.match(lookup, /crmHaciendaRequest<HaciendaResult>/)
  assert.match(lookup, /crmHaciendaErrorMessage\(cause\)/)
  assert.match(read('src/modules/crm/services/crmApi.ts'), /'\/api\/crm\/hacienda\/lookup\?'/)
  assert.match(lookup, /version !== lookupVersion/)
  assert.match(lookup, /props.countryId !== countryId/)
  assert.match(lookup, /digits.value !== identification/)
  assert.match(lookup, /response.identification.replace/)
  assert.match(lookup, /emit\('resolved', response\)/)
  assert.match(lookup, /defineExpose\(\{ ensureVerified \}\)/)
  assert.doesNotMatch(lookup, /Consultar cédula/)
  assert.match(lookup, /Volver a consultar/)
  assert.match(lookup, /Hacienda no devolvió actividades económicas/)
})

test('account and lead save await Hacienda; country and identification types remain authoritative', () => {
  assert.match(create, /await accountHaciendaLookupRef.value\?\.ensureVerified\(\)/)
  assert.match(create, /await leadHaciendaLookupRef.value\?\.ensureVerified\(\)/)
  assert.match(create, /form.legalName = upperAccountName\(result.name\)/)
  assert.match(create, /form.displayName = upperAccountName\(result.name\)/)
  assert.match(create, /form.companyName = upperAccountName\(result.name\)/)
  assert.match(create, /normalizeIdentificationType\(result.identificationType\)/)
  assert.match(edit, /await haciendaLookupRef.value\?\.ensureVerified\(\)/)
  assert.match(edit, /accountDraft.legalName = upperAccountName\(data.name\)/)
  assert.match(create, /:allow-institutional="true"/)
  assert.match(create, /workspaceDraft.commit\(\)/)
})
