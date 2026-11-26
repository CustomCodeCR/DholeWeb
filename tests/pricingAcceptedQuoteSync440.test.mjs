import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const active = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue','utf8')
const router = readFileSync('src/modules/pricing/views/PricingOverviewView.vue','utf8')
const operationsConfig = readFileSync('docs/releases/DH-20261124-OPS-QUOTE-ACCEPTANCE-440.json','utf8')

test('active Pricing wizard resolves existing Operations IDTRAs without free-text assignment', () => {
  assert.match(router, /PricingAlternativeWizardCrystal/)
  assert.doesNotMatch(active, /<DhButton[^>]+>Asignar IDTRA<\/DhButton>/)
  assert.doesNotMatch(active, /function openAssignIdtra/)
  assert.match(active, /pricing-screen9-operations-idtra-status/)
  assert.match(active, /Apertura aún no confirmada por Operations/)
  assert.match(active, /operationsApi\.cases\(page, \{ q: identity.parent \}, 50\)/)
  assert.match(active, /operationsApi\.linkQuote\(target.id, identity.option, target.version\)/)
  assert.match(active, /row.sourceQuoteId === identity.parent/)
  assert.match(active, /row.sourceQuoteOptionId === identity.option/)
  assert.match(active, /name: 'operations-case-detail'/)
  assert.match(active, /operationsLookupGeneration/)
  assert.match(active, /useRealtimeListRefresh\(/)
  assert.match(active, /name: 'operations-cases'/)
})

test('accepted QUO status is not interpreted as a verified Operations IDTRA', () => {
  const panel = active.slice(active.indexOf('async function submitCommercialDecision()'),
    active.indexOf('async function approveCurrentRate()'))
  assert.match(panel, /status: 'AcceptedByClient'/)
  assert.doesNotMatch(panel, /idtraNumber\s*:/)
  assert.match(operationsConfig, /Pending Redis acceptance events replay idempotently/)
})

test('P9 displays separate linked IDTRAs with individual navigation and separate historical references', () => {
  assert.match(active, /title="IDTRAs vinculados"/)
  assert.match(active, /v-for="linkedCase in visibleLinkedIdtras"/)
  assert.match(active, /:key="linkedCase.id"/)
  assert.match(active, /label="Abrir expediente"/)
  assert.match(active, /params: \{ id: linkedCase.id \}/)
  assert.match(active, /linkedOperationsCountLabel/)
  assert.match(active, /linkedOperationsCases.value.slice\(0, 3\)/)
  assert.match(active, /title="Vincular IDTRA manual existente"/)
  assert.match(active, /unverifiedHistoricalIdtras/)
  assert.doesNotMatch(active, /linkedOperationsCases.map\(item => item.idtra\).join/)
})
