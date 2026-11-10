import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { hasCrmCalendarAdministratorRole } from '../src/modules/crm/model/crmCalendarAdministrator.ts'

const read = (name: string) => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8')
const view = read('modules/crm/views/CrmRecordDetailView.vue')
const calendar = read('modules/crm/components/CrmSalesCalendar.vue')
const workspace = read('modules/crm/views/CrmWorkspaceView.vue')
const route = read('core/router/index.ts')

test('administrator and superuser roles can browse calendars without broad CRM scopes', () => {
  for (const name of ['Administrador','Administrator','Admin','SuperUsuario','SuperAdmin','SuperAdministrador']) {
    assert.equal(hasCrmCalendarAdministratorRole(role => role === name), true, name)
  }
  for (const name of ['Vendedor','Pricing','Cuenta']) {
    assert.equal(hasCrmCalendarAdministratorRole(role => role === name), false, name)
  }
})
test('calendar supports all active users even without current events and safe admin-only filters', () => {
  assert.match(calendar, /crmPath\('calendar\/users'\)/)
  assert.match(calendar, /calendarAdmin\.value \|\| can\('crm\.activity\.read-all'\)/)
  assert.match(calendar, /calendarDirectory\.value\.map\(user => user\.id\)/)
  assert.match(calendar, /eventOwnerChoices/)
  assert.match(calendar, /calendarDirectoryQuery/)
})
test('calendar routes and CRM workspace allow administrator read access', () => {
  assert.match(route, /calendarAdministratorAccess/)
  assert.match(workspace, /calendarAdmin\.value && \['activities','followups'\]/)
  assert.match(view, /const calendarAdmin = computed/)
})
test('historical automatic followups render a title and policy context', () => {
  assert.match(view, /saved \|\| \(periodical \? 'Seguimiento periódico' : 'Seguimiento comercial'\)/)
  assert.match(view, /Frecuencia de la política actual/)
  assert.match(view, /agendaLinkedActivityNotes/)
  assert.match(calendar, /item\.policyId \? 'Seguimiento periódico'/)
})
