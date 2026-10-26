import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (file: string) => readFileSync(file, 'utf8')
const layout = read('src/shared/components/layouts/MainLayout.vue')
const router = read('src/core/router/index.ts')
const view = read('src/modules/srm/views/SrmWorkspaceView.vue')
const translations = read('src/modules/srm/i18n.ts')

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
test('SRM only reads real Config suppliers with permission and never fabricates storage', () => {
  assert.match(view, /CatalogItemsService.getByGroupSlug\('agents'\)/)
  assert.match(view, /CatalogItemsService.getByGroupSlug\('carriers'\)/)
  assert.match(view, /CONFIG_SCOPES.catalogItems.view/)
  assert.match(view, /Promise.allSettled/)
  assert.doesNotMatch(view, /localStorage|mockSuppliers|seedSuppliers|faker/i)
  assert.doesNotMatch(view, /\.create\(|\.update\(|\.delete\(/)
})
test('CRM/SRM translations include Spanish and English', () => {
  assert.match(translations, /es: \{/)
  assert.match(translations, /en: \{/)
  assert.match(translations, /contracts: 'Contratos y acuerdos'/)
})
