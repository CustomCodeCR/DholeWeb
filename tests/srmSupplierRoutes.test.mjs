import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const view = read('src/modules/srm/views/SrmWorkspaceView.vue')
const panel = read('src/modules/srm/components/SrmSupplierRoutesPanel.vue')
const api = read('src/modules/srm/services/srmApi.ts')

test('SRM extends service categories while preserving multiselect and legacy history', () => {
  const categories = [
    'Transporte Internacional Aéreo', 'Transporte Internacional Marítimo',
    'Transporte Internacional Terrestre', 'Almacén Fiscal', 'Almacén General',
    'Abogado', 'Transporte Local Terrestre', 'Agencia de Aduanas',
    'Consolidadora de Carga', 'Control de Inventario',
  ]
  for (const label of categories) assert.ok(view.includes(label), label)
  assert.doesNotMatch(view, /\{ value: 'road', label: 'Transportista' \}/)
  assert.match(view, /road-legacy/)
  assert.match(view, /<DhMultiSelect v-model="supplierType"/)
  assert.match(view, /legacySupplierTypes/)
})

test('SRM drawers expose profile and route tabs without supplier modals', () => {
  assert.match(view, /<DhDrawer :open="formVisible"/)
  assert.match(view, /<DhDrawer :open="detailsVisible/)
  assert.match(view, /formTab === 'routes'/)
  assert.match(view, /detailsTab === 'routes'/)
  assert.match(view, /<SrmSupplierRoutesPanel/)
  assert.doesNotMatch(view, /<DhModal :open="formVisible"/)
  assert.doesNotMatch(view, /<DhModal :open="detailsVisible/)
})

test('route editor binds Config POL, POE and POD with typed CRUD', () => {
  for (const slug of ["'pol'", "'poe'", "'pod'"]) assert.ok(panel.includes(slug))
  assert.match(panel, /<DhMultiSelect v-model="originIds"/)
  assert.match(panel, /<DhMultiSelect v-model="destinationIds"/)
  assert.match(panel, /SrmApi\.listSupplierRoutes/)
  assert.match(panel, /SrmApi\.createSupplierRoute/)
  assert.match(panel, /SrmApi\.updateSupplierRoute/)
  assert.match(panel, /SrmApi\.deleteSupplierRoute/)
  assert.match(view, /:can-manage="canEditSuppliers"/)
  assert.match(api, /async pricingSupplierCoverage/)
})
