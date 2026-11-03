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

test('financial credit changes show their own event and human-readable fields', () => {
  assert.match(hub, /CREDIT_APPROVED: 'Crédito aprobado'/)
  assert.match(hub, /CREDIT_REVISED: 'Modificación de crédito solicitada'/)
  assert.match(hub, /CREDIT_COVERAGE_CHANGED: 'Coberturas de crédito modificadas'/)
  assert.match(hub, /CreditLimit: 'Límite de crédito'/)
  assert.match(hub, /ApprovalReason: 'Motivo del movimiento'/)
})

test('account history is a compact, expandable timeline without repetitive boxed values', () => {
  assert.match(hub, /<details class="group/)
  assert.match(hub, /:open="index === 0"/)
  assert.match(hub, /accountAuditPreview\(entry\)/)
  assert.match(hub, /accountAuditArea\(entry.areaCode\)/)
  assert.match(hub, /accountAuditReason\(entry\)/)
  assert.match(hub, /Mostrando \{\{ \(accountChangesPage - 1\) \* 15 \+ 1 \}\}/)
  assert.doesNotMatch(hub, /Valor anterior<\/span>/)
  assert.match(hub, /Cambio|Historial de cambios/)
})
