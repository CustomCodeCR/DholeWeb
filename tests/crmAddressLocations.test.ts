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
  assert.match(view, /countryId: geo\.countryId/)
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

test('Panama uses province or comarca, district, and corregimiento selectors', () => {
  assert.match(picker, /PA: 'Provincia \/ comarca'/)
  assert.match(picker, /isPanama = computed\(\(\) => selectedIso\.value === 'PA'\)/)
  assert.match(picker, /isPanama\.value \? 'Distrito'/)
  assert.match(picker, /isPanama\.value \? 'Corregimiento'/)
  assert.match(picker, /if \(code && hasThirdLevel\.value\)/)
  assert.match(picker, /value\.countryCode === 'PA'/)
  assert.match(picker, /v-if="hasThirdLevel"/)
  assert.match(picker, /Seleccionar corregimiento/)
  assert.match(picker, /Corregimiento \(manual\)/)
})


test('postal code is editable for every country and offers verified locality candidates', () => {
  assert.ok(picker.includes('label="Código postal"'))
  assert.ok(picker.includes('placeholder="Ingresar código postal"'))
  assert.ok(picker.includes('geo/postal-codes'))
  assert.ok(picker.includes('postalSuggestions.length > 1'))
  assert.ok(picker.includes('postalSuggestions.value.length === 1'))
  assert.ok(picker.includes('!props.modelValue.postalCode.trim()'))
  assert.ok(picker.includes('No hay un código postal único'))
  assert.ok(picker.includes('Podés ingresarlo manualmente'))
})

test('Panama postal codes require a precise location, never inferred from corregimiento', () => {
  assert.ok(picker.includes("iso === 'PA'"))
  assert.ok(picker.includes('codigospostalespanama.gob.pa'))
  assert.ok(picker.includes('no solo por el corregimiento'))
})
