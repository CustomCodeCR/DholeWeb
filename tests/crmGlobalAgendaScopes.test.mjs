import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const calendar = readFileSync('src/modules/crm/components/CrmSalesCalendar.vue', 'utf8')
const workspace = readFileSync('src/modules/crm/views/CrmWorkspaceView.vue', 'utf8')
test('Cross-seller calendar requires global CRM access', () => {
  assert.ok(calendar.includes("can('crm.account.read-all') && can('crm.lead.read-all')"))
  assert.ok(calendar.includes('canManageAcrossUsers.value'))
  assert.ok(calendar.includes("crmPath('calendar/users')"))
  assert.ok(!calendar.includes('can(AUTH_SCOPES.users.view)'))
  assert.ok(calendar.includes('canAssignOtherSellers.value'))
})
test('Agenda listing includes global-scope activities', () => {
  assert.ok(workspace.includes("can('crm.account.read-all') && can('crm.lead.read-all')"))
})
