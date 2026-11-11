import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
test('Managers with global CRM scopes can view calendars and choose active sellers', () => {
  assert.ok(calendar.includes("can('crm.account.read-all') && can('crm.lead.read-all')"))
  assert.ok(calendar.includes("crmPath('calendar/users')"))
  assert.ok(calendar.includes("canAssignOtherSellers.value"))
  assert.ok(calendar.includes("assigneeLabel(owner)"))
})
test('Agenda listing includes global-scope activities', () => {
  assert.ok(workspace.includes("can('crm.account.read-all') && can('crm.lead.read-all')"))
})
