import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isBalboaOwnLclPoe } from '../src/modules/pricing/utils/ownLclPoeEligibility.ts'

test('consolidado LCL propio disponible solamente para POE Balboa (POD independiente)', () => {
  for (const [code, name] of [
    ['PABLB', 'Balboa, Panamá'],
    ['PA-BLB', 'Balboa, Panama'],
    ['BLB', null],
    ['POE-2026-01', 'Puerto de Balboa, Panamá'],
    [null, 'Port of Balboa, Panama'],
  ] as const) {
    assert.equal(isBalboaOwnLclPoe(code, name), true)
  }

  for (const [code, name] of [
    ['CRCAL', 'Puerto Caldera, Costa Rica'],
    [null, 'San José, Costa Rica'],
    ['PAMIT', 'Manzanillo, Panamá'],
    [null, 'Puerto Caldera vía Balboa'],
    [null, null],
  ] as const) {
    assert.equal(isBalboaOwnLclPoe(code, name), false)
  }
})

test('wizard entrega el POE y selector oculta y bloquea propio fuera de Balboa', () => {
  const wizard = readFileSync(new URL('../build/pricingWizardEnhancements.ts', import.meta.url), 'utf8')
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
  assert.ok(wizard.includes(':poe-code="selectedDestination?.code ?? null"'))
  assert.ok(wizard.includes(':poe-name="displayValue(selectedDestination)"'))
  assert.ok(selector.includes('if (!ownPoeEligible.value) return []'))
  assert.ok(selector.includes('!ownPoeEligible.value ? Promise.resolve([] as OwnLclConsolidationDto[])'))
  assert.ok(selector.includes('if (!ownPoeEligible.value || !ownConsolidationSupportsPoe(row)'))
  assert.ok(selector.includes('<button v-if="ownPoeEligible"'))
})
