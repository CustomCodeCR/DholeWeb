import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePricingModificationSaveBindings } from '../build/pricingModificationSaveBindingGuard.ts'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')

test('modified quote has a bound retry function and a distinct send handler', () => {
  assert.doesNotThrow(() => validatePricingModificationSaveBindings(wizard))
})

test('build fails rather than shipping an unbound delivery call', () => {
  const broken = wizard.replace(
    'async function retrySavedModificationDelivery() {',
    'async function missingDeliveryBinding() {',
  )
  assert.notEqual(broken, wizard)
  assert.throws(() => validatePricingModificationSaveBindings(broken), /retrySavedModificationDelivery/)
})

test('saving again does not silently send the already-persisted revision', () => {
  const anchor = "    toastStore.warning('Revisión ya guardada',"
  const broken = wizard.replace(anchor, '    await retrySavedModificationDelivery()\n' + anchor)
  assert.notEqual(broken, wizard)
  assert.throws(() => validatePricingModificationSaveBindings(broken), /must not automatically deliver/)
})
