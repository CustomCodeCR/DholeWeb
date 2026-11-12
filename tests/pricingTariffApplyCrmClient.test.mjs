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

test('Dedicated tariff DhModal has an opaque surface and enough width', () => {
  const container = readFileSync(new URL('../src/shared/components/containers/DhModalContainer.vue', import.meta.url), 'utf8')
  const store = readFileSync(new URL('../src/core/stores/modalStore.ts', import.meta.url), 'utf8')
  assert.match(store, /surface: 'glass' \| 'solid'/)
  assert.match(store, /this\.surface = input\.surface \?\? 'glass'/)
  assert.match(container, /modalStore\.surface === 'solid'/)
  for (const path of [
    '../src/modules/pricing/views/PricingTariffsView.vue',
    '../src/modules/pricing/views/PricingRatesView.vue',
    '../src/modules/pricing/components/PricingRateDetailDrawer.vue',
    '../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    '../src/modules/pricing/components/PricingRateExistingWizardStable.vue',
    '../src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
  ]) {
    const view = readFileSync(new URL(path, import.meta.url), 'utf8')
    assert.match(view, /component: PricingApplyTariffModal,\s+size: 'lg',\s+surface: 'solid'/, path)
  }
})

test('CRM results remain scrollable in the modal instead of being clipped', () => {
  const picker = readFileSync(new URL('../src/modules/pricing/components/PricingCrmClientSelect.vue', import.meta.url), 'utf8')
  assert.match(picker, /inlineResults\?: boolean/)
  assert.match(picker, /inlineResults \? 'relative z-10 max-h-60' : 'absolute z-\[150\] max-h-72'/)
  assert.match(modal, /:inline-results="true"/)
  assert.match(modal, /bg-\[var\(--dh-card-solid\)\]/)
})
