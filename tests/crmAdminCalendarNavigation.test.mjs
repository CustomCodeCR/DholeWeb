import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const nav = readFileSync(new URL('../src/modules/crm/components/CrmModuleNavigation.vue', import.meta.url), 'utf8')
const roles = readFileSync(new URL('../src/modules/crm/model/crmCalendarAdministrator.ts', import.meta.url), 'utf8')
test('CRM navigation includes both calendar routes for Auth calendar administrators', () => {
  assert.match(nav, /\['\/crm\/activities', '\/crm\/followups'\]/)
  assert.match(nav, /hasCrmCalendarAdministratorRole\(role => auth\.hasRole\(role\)\)/)
  assert.match(nav, /item\.scopes\.some\(scope => auth\.hasScope\(scope\)\)/)
  assert.match(roles, /'Administrador'/)
  assert.match(roles, /'SuperUsuario'/)
})
