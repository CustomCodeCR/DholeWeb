import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../src/core/interfaces/pricing.ts', import.meta.url), 'utf8')
test('carrier details are editable, persisted and reloaded', () => {
  for (const field of ['carrierRoute', 'carrierComments']) {
    assert.ok(wizard.includes('form.' + field + ' = rate.' + field))
    assert.ok(wizard.includes(field + ': form.' + field + '.trim()'))
    assert.ok(contracts.includes(field + '?: string | null'))
    assert.ok(wizard.includes('v-model="form.' + field + '"'))
  }
  assert.ok(wizard.indexOf('v-model.number="form.transitDays"') < wizard.indexOf('v-model="form.carrierRoute"'))
})
