import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const manager = read('src/modules/crm/components/CrmCommercialBenefitsManager.vue')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')

test('Account detail owns preferential benefits without touching Pricing', () => {
  assert.ok(hub.includes("key: 'benefits' as const"))
  assert.ok(hub.includes('<CrmCommercialBenefitsManager'))
  assert.ok(hub.includes(':account-id="String(account.id)"'))
  assert.ok(manager.includes("crmPath('accounts', props.accountId, 'commercial-benefits')"))
  assert.doesNotMatch(manager, /\/api\/pricing/)
})

test('CRM supports five modalities, insurance and all Miami tiers', () => {
  for (const value of ['FCL', 'LCL', 'FTL', 'LTL', 'AIR'])
    assert.ok(manager.includes("key: '" + value + "'"))
  for (const value of ['A', 'B', 'C', 'D', 'NVOCC-A', 'NVOCC-B', 'LITTLE'])
    assert.ok(manager.includes("value: '" + value + "'"))
  assert.ok(manager.includes("value: 'INSURANCE'"))
  assert.ok(manager.includes("value: 'INSURANCE_PERCENT'"))
  assert.ok(manager.includes("value: 'MIAMI'"))
})

test('Benefits have real persistence, versioned updates and status controls', () => {
  for (const marker of [
    'expectedVersion: settings.value?.rowVersion',
    'expectedVersion: recordVersion.value',
    "editingId.value ? 'PUT' : 'POST'",
    'rates.value = response.rates',
    'validFrom: toUtc(draft.validFrom)',
    'validUntil: toUtc(draft.validUntil)',
    'isActive: active',
    'Beneficio desactivado; se conservó el historial',
  ]) assert.ok(manager.includes(marker), marker)
  assert.ok(manager.includes("crm.account.update"))
})
