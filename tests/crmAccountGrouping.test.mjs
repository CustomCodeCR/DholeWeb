import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const manager = readFileSync('src/modules/crm/components/CrmAccountGroupManager.vue', 'utf8')
const dashboard = readFileSync('src/modules/crm/components/CrmAccountQuotesDashboard.vue', 'utf8')

test('account grouping preserves separate customer records and uses Dhole modal', () => {
  assert.match(manager, /<DhModal :open="open" title="Agrupar cuentas comerciales"/)
  assert.match(manager, /group\/members/)
  assert.match(manager, /expectedVersion: selected\.value\.rowVersion/)
  assert.match(manager, /:can-manage=/)
  assert.match(manager, /'DELETE'/)
  assert.match(manager, /Cada una conserva su razón social/)
})

test('commercial account hub reads and displays all authorized group members', () => {
  assert.match(hub, /CrmAccountGroupManager/)
  assert.match(hub, /accountGroupIds\(accountId\)/)
  assert.match(hub, /Promise\.allSettled\(ids\.map/)
  assert.match(hub, /:account-ids="groupAccountIds"/)
  assert.match(hub, /pricingQuoteTotal\.value/)
})

test('Pricing indicators aggregate linked accounts without changing linked quote ownership', () => {
  assert.match(dashboard, /accountIds\?: string\[\]/)
  assert.match(dashboard, /props\.accountIds\?\.length/)
  assert.match(dashboard, /Promise\.allSettled/)
  assert.match(dashboard, /total: sum\('total'\)/)
})
