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


test('FCL selection survives the carrier filter rewrite and is bound to exact RateIds', () => {
  const plugin = readFileSync(new URL('../build/pricingWizardFclRateBundles.ts', import.meta.url), 'utf8')
  const carrierRewrite = readFileSync(new URL('../build/pricingWizardMixedCarrierExpiry.ts', import.meta.url), 'utf8')
  const declaration = plugin.indexOf('const selectedFclBundlesByOption = ref<')
  const filterBlock = plugin.indexOf('const fclCarrierFilterOptions = computed')
  const chooser = plugin.indexOf('function chooseFclRateBundle(bundle: FclRateBundle)')
  assert.ok(declaration > 0 && declaration < filterBlock, 'FCL selection must exist before the replaceable filter block')
  assert.ok(plugin.indexOf('restoreFclBundleForOption = (poeId, carrierId) =>') < filterBlock)
  assert.ok(chooser > filterBlock)
  assert.match(carrierRewrite, /const fclCarrierFilterOptions = computed/)
  assert.match(carrierRewrite, /function chooseFclRateBundle\(bundle: FclRateBundle\)/)

  const injected = wizard.replace(
    "const rateCarrierFilter = ref('')",
    [
      "const rateCarrierFilter = ref('')",
      'const selectedFclBundlesByOption = ref<Record<string, { bundleKey: string }>>({})',
      'restoreFclBundleForOption = (poeId, carrierId) => {}',
      'function chooseFclRateBundle(bundle: FclRateBundle) {',
      '  selectedFclBundlesByOption.value[optionKey] = { bundleKey: bundle.key }',
      '}',
    ].join('\n'),
  )
  assert.notEqual(injected, wizard)
  assert.doesNotThrow(() => validatePricingModificationSaveBindings(injected))
  assert.throws(() => validatePricingModificationSaveBindings(
    injected.replace('const selectedFclBundlesByOption =', 'const missingFclSelectionState ='),
  ), /pricing-fcl-selection-binding/)
  assert.throws(() => validatePricingModificationSaveBindings(
    injected.replace('restoreFclBundleForOption = (poeId, carrierId) =>', 'missingRestore = (poeId, carrierId) =>'),
  ), /pricing-fcl-selection-binding/)
})
