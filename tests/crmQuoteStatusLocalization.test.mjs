import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const labels = readFileSync('src/modules/pricing/utils/pricingFormat.ts', 'utf8')
const hub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const legacy = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')

test('commercial quote statuses use the same Spanish labels as Pricing', () => {
  const expected = {
    AcceptedByClient: 'Aceptada',
    RejectedByClient: 'No aceptada',
    Sent: 'Enviada',
    Expired: 'Vencida',
    Open: 'Abierta',
    Cancelled: 'Cancelada',
    PendingApproval: 'Pendiente de aprobación',
    RequestedByClient: 'Solicitada por cliente',
    ApprovedByManagement: 'Aprobada por gerencia',
    RejectedByManagement: 'Rechazada por gerencia',
    Closed: 'No aceptada',
  }
  for (const [enumValue, spanishLabel] of Object.entries(expected)) {
    assert.ok(labels.includes(enumValue + ": ['" + spanishLabel + "'"),
      enumValue + ' should have the Pricing user-facing label')
  }
  assert.match(labels, /commercialRateStatusLabel\(value: unknown, locale = 'es'\)/)
  assert.match(labels, /locale\.toLowerCase\(\)\.startsWith\('en'\)/)
  assert.match(labels, /return locale\.toLowerCase\(\)\.startsWith\('en'\) \? labels\[1\] : labels\[0\]/)
})

test('legacy already-localized plural statuses are also normalized', () => {
  for (const alias of ['Enviadas', 'Vencidas', 'Aceptadas', 'Abiertas', 'Canceladas']) {
    assert.ok(labels.includes(alias + ": '"), alias + ' should normalize')
  }
  assert.match(labels, /if \(!raw\) return '—'/)
})

test('CRM linked quote history and summary never print enum status directly', () => {
  assert.match(hub, /commercialRateStatusLabel\(quote\.commercialStatusSnapshot, locale\)/)
  assert.match(hub, /commercialRateStatusLabel\(q\.commercialStatusSnapshot, locale\)/)
  assert.doesNotMatch(hub, /text\((?:q|quote)\.commercialStatusSnapshot\)/)
})

test('both admin migration tables use localized status slots', () => {
  assert.equal((legacy.match(/#cell-commercialStatusSnapshot="\{ row \}"/g) ?? []).length, 2)
  assert.equal((legacy.match(/commercialRateStatusLabel\(row\.commercialStatusSnapshot, locale\)/g) ?? []).length, 2)
  assert.match(legacy, /useI18n\(\)/)
})
