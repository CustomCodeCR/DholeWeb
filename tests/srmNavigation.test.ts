import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (file: string) => readFileSync(file, 'utf8')
const layout = read('src/shared/components/layouts/MainLayout.vue')
const router = read('src/core/router/index.ts')
const view = read('src/modules/srm/views/SrmWorkspaceView.vue')
const translations = read('src/modules/srm/i18n.ts')
const monitoring = read('src/core/services/monitoringService.ts')

test('the actual MainLayout exposes both CRM and SRM', () => {
  assert.match(layout, /label: t\('crm.title'\)/)
  assert.match(layout, /label: t\('srm.title'\)/)
  assert.match(layout, /path: '\/crm'/)
  assert.match(layout, /path: '\/srm\/suppliers'/)
})
test('CRM and SRM sections are real authenticated workspace routes', () => {
  for (const route of ['crm', 'srm', 'srm/suppliers', 'srm/performance', 'srm/contracts']) {
    assert.ok(router.includes("path: '" + route + "'"), 'missing route ' + route)
  }
  assert.match(router, /requiresAuth: true/)
})
test('SRM only uses dedicated srm-scoped Config APIs for supplier data', () => {
  const client = read('src/modules/srm/services/srmApi.ts')
  assert.match(view, /SrmApi.list\('suppliers'\)/)
  assert.match(view, /SrmApi.list\('evaluations'\)/)
  assert.match(view, /SrmApi.list\('contracts'\)/)
  assert.match(view, /SrmApi.create\('suppliers'/)
  assert.match(view, /SrmApi.updateSupplier/)
  assert.match(view, /srm.supplier.read/)
  assert.match(view, /srm.supplier.create/)
  assert.match(view, /srm.performance.read/)
  assert.match(view, /srm.contract.read/)
  assert.match(client, /\/api\/config\/srm/)
  assert.doesNotMatch(view, /CatalogItemsService|CatalogGroupsService|localStorage|mockSuppliers|faker/i)
})

test('CRM/SRM translations include Spanish and English', () => {
  assert.match(translations, /es: \{/)
  assert.match(translations, /en: \{/)
  assert.match(translations, /contracts: 'Contratos y acuerdos'/)
})

test('CRM is monitored through the Gateway and both modules are pinned in the real sidebar', () => {
  const sidebar = read('src/shared/components/organisms/DhSidebar.vue')
  assert.match(monitoring, /key: 'crm'/)
  assert.match(monitoring, /buildGatewayHealthUrl\('crm'\)/)
  assert.ok(sidebar.indexOf('to="/crm"') < sidebar.indexOf('<nav class="dh-scrollbar'))
  assert.ok(sidebar.indexOf('to="/srm"') < sidebar.indexOf('<nav class="dh-scrollbar'))
})
