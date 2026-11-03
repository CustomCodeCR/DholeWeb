import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = (file: string) => readFileSync(file, 'utf8')
const layout = read('src/shared/components/layouts/MainLayout.vue')
const sidebar = read('src/core/composables/useSidebarItems.ts')
const router = read('src/core/router/index.ts')
const view = read('src/modules/srm/views/SrmWorkspaceView.vue')
const client = read('src/modules/srm/services/srmApi.ts')
test('SRM has one supplier directory; old URLs redirect safely', () => {
  assert.match(layout, /label: t\('srm.suppliers'\), path: '\/srm\/suppliers'/)
  assert.doesNotMatch(layout, /srmChildren.push/)
  assert.match(sidebar, /to: '\/srm\/suppliers'/)
  assert.doesNotMatch(sidebar, /to: '\/srm\/performance'|to: '\/srm\/contracts'/)
  assert.match(router, /path: 'srm',\s*name: 'srm-home',\s*redirect:/)
  assert.match(router, /'srm\/performance', 'srm\/contracts'/)
  assert.doesNotMatch(view, /<RouterLink v-for="item in sections"/)
})
test('supplier directory uses fixed categories, persists in Config and retains legacy links', () => {
  assert.match(client, /\/api\/config\/srm/)
  assert.match(view, /SrmApi.list\('suppliers'\)/)
  assert.match(view, /SrmApi.create\('suppliers'/)
  assert.match(view, /SrmApi.updateSupplier/)
  assert.match(view, /resolvedSupplierTypes/)
  assert.match(view, /SrmApi.importLegacyPartner/)
})
test('SRM supplier pages require dedicated scopes and Dhole drawers', () => {
  assert.match(view, /srm.supplier.read/)
  assert.match(view, /srm.supplier.create/)
  assert.match(view, /srm.supplier.update/)
  assert.match(client, /fetchClient/)
  assert.match(view, /<DhDrawer :open="formVisible"/)
})

test('SRM uses Dhole multi-selects for categories and countries and preserves legacy fields', () => {
  assert.match(view, /<DhMultiSelect v-model="supplierType"/)
  assert.match(view, /<DhMultiSelect v-model="countryIds"/)
  assert.match(view, /supplierTypes: selectedTypes/)
  assert.match(view, /countryIds: selectedCountries/)
  assert.match(view, /supplierType: selectedTypes\[0\]/)
  assert.match(view, /countryId: selectedCountries\[0\]/)
  assert.match(view, /supplierCategories\(item\)/)
  assert.match(view, /supplierCountries\(selected\)/)
  assert.doesNotMatch(view, /<select v-model="countryId"/)
  assert.doesNotMatch(view, /<input v-model="shipmentModes" type="checkbox"/)
})

test('SRM does not request or render shipment modes and retains historical metadata', () => {
  assert.doesNotMatch(view, /<DhMultiSelect v-model="shipmentModes"/)
  assert.doesNotMatch(view, /const shipmentModes = ref|const modeOptions =|normalizeSupplierModes/)
  assert.doesNotMatch(view, /Modalidades|Shipment modes|!shipmentModes\.length|!shipmentModes\.value\.length/)
  assert.doesNotMatch(view, /shipmentModes: \[\.\.\.new Set\(shipmentModes\.value\)\]/)
  assert.match(view, /const retained = editing\.value \? metadata\(editing\.value\) : \{\}/)
  assert.match(view, /\.\.\.retained,/)
  assert.match(view, /if \(!countryIds\.value\.length\)/)
})

test('SRM category picker has exactly seven fixed options and safely maps legacy categories', () => {
  const expected = [
    ['agent', 'Agente'],
    ['coloader', 'Coloader'],
    ['road', 'Transportista'],
    ['carrier', 'Naviera'],
    ['airline', 'Aerolínea'],
    ['sister-company', 'Empresa hermana'],
    ['other', 'Otros'],
  ]
  const categoryList = view.match(/const categoryOptions = \[([\s\S]*?)\]/)?.[1] ?? ''
  const values = [...categoryList.matchAll(/\{ value: '([^']+)', label: '([^']+)' \}/g)]
    .map((match) => [match[1], match[2]])
  assert.deepEqual(values, expected)
  assert.doesNotMatch(view, /customSupplierType|__custom__/)
  assert.match(view, /normalizeSupplierCategory/)
  assert.match(view, /legacySupplierTypes/)
})

test('supplier forms hide tax IDs and website without losing historical metadata', () => {
  assert.doesNotMatch(view, /v-model="taxId"|v-model="website"/)
  assert.doesNotMatch(view, /Identificación fiscal|Fiscal identification|Sitio web/)
  assert.doesNotMatch(view, /taxId:\s*taxId\.value|website:\s*website\.value/)
  assert.match(view, /const retained = editing\.value \? metadata\(editing\.value\) : \{\}/)
  assert.match(view, /\.\.\.retained,/)
})

test('supplier contacts are optional and empty rows do not block saving', () => {
  assert.match(view, /Contactos del proveedor <span[^>]+>\(opcional\)<\/span>/)
  assert.match(view, /const filledContacts = contacts\.value\.map/)
  assert.match(view, /\.filter\(contact => contact\.name \|\| contact\.email \|\| contact\.phone \|\| contact\.role\)/)
  assert.match(view, /contacts: filledContacts/)
  assert.match(view, /filledContacts\[0\]\?\.name/)
  assert.doesNotMatch(view, /!contacts\.value\.length|!contacts\.length/)
  assert.match(view, /:required="Boolean\(contact\.email\.trim\(\) \|\| contact\.phone\.trim\(\) \|\| contact\.role\.trim\(\)\)"/)
})

test('SRM has a clean directory layout without visible internal codes or dashboard cards', () => {
  const template = view.split('<template>')[1] ?? ''
  assert.match(template, /Directorio de proveedores/)
  assert.match(template, /Seleccioná un proveedor/)
  assert.match(template, /filteredSuppliers\.length/)
  assert.match(template, /openDetails\(item\)/)
  assert.doesNotMatch(template, /selected\.code|item\.code|row\.code|legacyCode/)
  assert.doesNotMatch(template, /Origen de la información|Proveedores disponibles|Incorporación a SRM|<nav/)
  assert.doesNotMatch(template, /Condiciones comerciales|Ficha proveedor/)
  assert.match(template, /Historial comercial/)
  assert.match(view, /SrmApi\.importLegacyPartner/)
})

test('SRM supplier uses the CRM credit fields, catalog currency and coverage pickers', () => {
  assert.match(view, /CrmCatalogPicker from '@\\/modules\\/crm\\/components\\/CrmCatalogPicker\\.vue'/)
  assert.match(view, /CrmCreditCoveragePicker from '@\\/modules\\/crm\\/components\\/CrmCreditCoveragePicker\\.vue'/)
  assert.match(view, /creditCoverageLabel/)
  assert.match(view, /const creditEnabled = ref\\(false\\)/)
  assert.match(view, /v-model="creditEnabled" type="checkbox"/)
  assert.match(view, /v-model="creditDays"/)
  assert.match(view, /v-model="creditLimit"/)
  assert.match(view, /v-model="monthlyFinancing"/)
  assert.match(view, /v-model="lateInterest"/)
  assert.match(view, /v-model="creditNotes"/)
  assert.match(view, /v-model="creditReviewAt"/)
  assert.match(view, /<CrmCatalogPicker v-model="creditCurrency"/)
  assert.match(view, /catalog-group-slug="currencies" value-kind="value"/)
  assert.match(view, /<CrmCreditCoveragePicker v-model="includedCreditModel"/)
  assert.match(view, /<CrmCreditCoveragePicker v-model="excludedCreditModel"/)
  assert.doesNotMatch(view, /<DhSelect v-model="paymentType"/)
})
test('SRM credit retains historic terms, persists CRM-equivalent fields, and validates them', () => {
  assert.match(view, /info.creditDays \\?\\? info.days/)
  assert.match(view, /info.creditLimit \\?\\? info.limit/)
  assert.match(view, /info.paymentConditions/)
  assert.match(view, /creditEnabled.value = terms.paymentType === 'credit'/)
  assert.match(view, /creditDays.value = terms.days === null/)
  assert.match(view, /creditIncluded.value = \\[\\.\\.\\.terms.includedServices\\]/)
  assert.match(view, /totalDays > 3650/)
  assert.match(view, /validCreditPrecision\\(limit, 2\\)/)
  assert.match(view, /validCreditPrecision\\(monthly, 4\\)/)
  assert.match(view, /creditIncluded.value.some\\(code => creditExcluded.value.includes\\(code\\)\\)/)
  assert.match(view, /creditTerms:|creditTerms,/)
  assert.match(view, /creditDays: Number\\(creditDays.value\\)/)
  assert.match(view, /creditLimit: Number\\(creditLimit.value\\)/)
  assert.match(view, /monthlyFinancingPct: Number\\(monthlyFinancing.value\\)/)
  assert.match(view, /lateInterestMonthlyPct: Number\\(lateInterest.value\\)/)
  assert.match(view, /paymentConditions: creditNotes.value.trim\\(\\)/)
  assert.match(view, /includedServices: \\[\\.\\.\\.new Set\\(creditIncluded.value\\)\\]/)
  assert.match(view, /excludedServices: \\[\\.\\.\\.new Set\\(creditExcluded.value\\)\\]/)
  assert.match(view, /reviewAt: creditReviewAt.value/)
  assert.match(view, /supplierCreditTerms\\(selected\\)\\.includedServices/)
  assert.match(view, /supplierCreditTerms\\(selected\\)\\.excludedServices/)
})
