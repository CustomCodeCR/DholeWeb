import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const model = readFileSync('src/modules/crm/model/crmAddressLocation.ts', 'utf8')
const picker = readFileSync('src/modules/crm/components/CrmAddressLocationFields.vue', 'utf8')
const view = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')

test('CRM addresses have cascaded administrative divisions and independent free-text directions', () => {
  assert.match(picker, /País de la dirección/)
  assert.match(picker, /selectFirst/)
  assert.match(picker, /selectSecond/)
  assert.match(picker, /selectThird/)
  assert.match(picker, /Código postal/)
  assert.match(view, /<CrmAddressLocationFields/)
  assert.match(view, /addressText: drafts\.addressText/)
  assert.match(view, /countryId: addressLocation\.value\.countryId/)
})
test('Costa Rica postal codes preserve five digits and are linked to district', () => {
  assert.match(model, /String\(canton\)\.padStart\(2, '0'\)/)
  assert.match(model, /String\(district\)\.padStart\(2, '0'\)/)
  assert.match(picker, /costaRicaPostalCode\(updated\)/)
})
test('country selection resets descendants to prevent mixed-country addresses', () => {
  assert.match(picker, /emptyAddressLocation\(\), countryId: id, countryCode: iso/)
  assert.match(picker, /admin2Code: '', admin2Name: '', admin3Code: '', admin3Name: '', postalCode: ''/)
  assert.match(picker, /requestVersion/)
})
