import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const hub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')

test('account change history is separate from the commercial route history', () => {
  assert.match(hub, /key: 'history' as const/)
  assert.match(hub, /key: 'changes' as const/)
  assert.match(hub, /activeTab === 'changes'/)
  assert.match(hub, /activeTab === 'history'/)
})

test('account history loads from the protected CRM endpoint, not local state', () => {
  assert.match(hub, /crmPath\('accounts', accountId, 'change-history'\)/)
  assert.match(hub, /accountChangesTotal/)
  assert.match(hub, /accountChangesPage/)
  assert.match(hub, /accountChangesGeneration/)
})

test('audit display shows actor and before/after values', () => {
  assert.match(hub, /entry\.actorDisplayName/)
  assert.match(hub, /entry\.createdAt/)
  assert.match(hub, /accountAuditValue\(change\.before, change\.field\)/)
  assert.match(hub, /accountAuditValue\(change\.after, change\.field\)/)
  assert.match(hub, /Los cambios anteriores a la activación del historial no están disponibles/)
})
