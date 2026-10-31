import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (p: string) => readFileSync(p, 'utf8')
const calendar = read('src/modules/crm/components/CrmSalesCalendar.vue')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')
const contact = read('src/modules/crm/views/CrmContactDetailView.vue')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
const viewers = read('src/modules/crm/components/CrmAccountViewerManager.vue')
const phone = read('src/modules/crm/utils/crmPhone.ts')

test('Month drag and week/day half-hour drops persist via optimistic concurrency', () => {
  for (const fragment of [
    "onDragStart($event,event)", "onDrop($event,day)", "onSlotDrop($event,slotDate(day,slot))",
    "crmPath('activities', item.id, 'reschedule')", "crmPath('followups', item.id, 'reschedule')",
    "expectedVersion: item.rowVersion", "scheduledEndAt: new Date(proposed.getTime()",
    "onDragEnd", "applyManualMove()", "slotEvents(day,slot)",
    "openCreation(slotDate(day,slot),true)",
  ]) assert.ok(calendar.includes(fragment), fragment)
})

test('Calendar is scoped to the originating customer and tabs are visible', () => {
  assert.ok(calendar.includes('accountId: props.accountId || undefined'))
  assert.ok(calendar.includes("query: props.accountId ? { fromAccount: props.accountId }"))
  assert.ok(hub.includes('<CrmSalesCalendar :account-id="String(account.id)"'))
  assert.ok(hub.includes('hub-sticky-tabs sticky'))
  assert.ok(hub.includes('flex-wrap gap-2 rounded-xl'))
  assert.ok(hub.includes('returnToAccount(entry.href)'))
})

test('Contact detail returns to account when launched from that account', () => {
  assert.ok(contact.includes('route.query.fromAccount'))
  assert.ok(contact.includes("linkedAccounts.value.some"))
  assert.ok(contact.includes("Volver a la cuenta"))
  assert.ok(detail.includes('route.query.fromAccount'))
})

test('Castro Fallas access is global and restricted to administrators', () => {
  assert.ok(workspace.includes('<CrmAccountViewerManager'))
  assert.ok(workspace.includes("can('crm.account.assign') && can('auth.users.view')"))
  assert.ok(viewers.includes("crmPath('institutional-viewers')"))
  assert.ok(!viewers.includes('props.accountId'))
  assert.ok(!detail.includes('<CrmAccountViewerManager'))
})

test('Country calling prefix uses an external public API with fallback', () => {
  assert.ok(phone.includes('https://restcountries.com/v3.1/alpha/'))
  assert.ok(phone.includes('dialCodeForCountry(country)'))
  assert.ok(phone.includes('AbortController'))
})
