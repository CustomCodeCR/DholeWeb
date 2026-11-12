import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync(new URL('../src/modules/pricing/components/PricingApplyTariffModal.vue', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/core/interfaces/pricing.ts', import.meta.url), 'utf8')

test('Tarifario must select a real CRM account or lead, never free-type a client', () => {
  assert.match(modal, /<PricingCrmClientSelect[\s\S]*mode="create"/)
  assert.match(modal, /v-model="selectedClientId"/)
  assert.match(modal, /@selected="selectClient"/)
  assert.doesNotMatch(modal, /v-model="form\.clientName"/)
  assert.doesNotMatch(modal, /v-model="form\.executiveName"/)
  assert.match(modal, /:inline-results="true"/)
  assert.match(modal, /aria-live="polite"/)
  assert.match(modal, /ownerName \|\| 'Seleccioná un cliente/)
  assert.doesNotMatch(modal, /<DhInput/)
  assert.match(modal, /Ejecutivo comercial · CRM/)
})

test('Recheck CRM permission and seller before applying a master tariff', () => {
  assert.match(modal, /crmPath\('pricing-client-options'\)/)
  assert.match(modal, /selectedClientId: selectedClientId\.value/)
  assert.match(modal, /client\.isCastroFallasExecutive[\s\S]*'Castro Fallas'/)
  assert.match(modal, /clientAccountId: client\.kind === 'account' \? client\.id : null/)
  assert.match(modal, /clientLeadId: client\.kind === 'lead' \? client\.id : null/)
  assert.match(pricing, /export interface DuplicateRateRequest[\s\S]*clientAccountId\?: string \| null/)
  assert.match(pricing, /export interface DuplicateRateRequest[\s\S]*clientLeadId\?: string \| null/)
})
