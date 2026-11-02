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

test('SRM uses Dhole multi-selects and preserves legacy single-value fields', () => {
  assert.match(view, /<DhMultiSelect v-model="supplierType"/)
  assert.match(view, /<DhMultiSelect v-model="shipmentModes"/)
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

test('SRM offers one air mode and maps previous air-consolidated records', () => {
  assert.match(view, /\{ value: 'Air', label: 'Aéreo' \}/)
  assert.doesNotMatch(view, /Aéreo consolidado/)
  assert.match(view, /mode === 'AirConsol' \? 'Air' : mode/)
  assert.match(view, /shipmentModes\.value = normalizeSupplierModes\(info\.shipmentModes\)/)
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
