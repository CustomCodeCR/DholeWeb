import type { Plugin } from 'vite'

const WIZARD_SUFFIX = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

// A missing function must fail the build, not fail only after a user clicks Save.
export function validatePricingModificationSaveBindings(source: string): void {
  const scriptStart = source.indexOf('<script setup')
  const scriptEnd = source.indexOf('</script>', scriptStart)
  if (scriptStart < 0 || scriptEnd < 0) {
    throw new Error('[pricing-save-binding] Wizard script setup was not found')
  }
  const script = source.slice(scriptStart, scriptEnd)
  // Pricing FCL state is injected by a pre-Vue transform. Another transform
  // replaces the carrier filter block, so guard the final SFC before Vue compiles.
  if (script.includes('function chooseFclRateBundle(bundle: FclRateBundle)')) {
    const definitions = script.match(/\bconst\s+selectedFclBundlesByOption\s*=\s*ref\s*</g) ?? []
    const restoreBinding = script.includes('restoreFclBundleForOption = (poeId, carrierId) =>')
    const exactRateIds = script.includes('selectedFclBundlesByOption.value[optionKey]')
    if (definitions.length !== 1 || !restoreBinding || !exactRateIds) {
      throw new Error('[pricing-fcl-selection-binding] FCL selected RateIds must be declared, restored and saved per POE/carrier after all Vite transforms')
    }
  }
  const definitions = script.match(/\basync\s+function\s+retrySavedModificationDelivery\s*\(/g) ?? []
  const references = script.match(/\bretrySavedModificationDelivery\s*\(/g) ?? []
  if (definitions.length !== 1 || references.length < 2) {
    throw new Error('[pricing-save-binding] retrySavedModificationDelivery is not declared and invoked in the transformed wizard')
  }
  const handlerAt = script.indexOf('async function handleSaveRateClick()')
  const saveAt = script.indexOf('async function saveRate()')
  if (handlerAt < 0 || saveAt < 0) {
    throw new Error('[pricing-save-binding] Wizard save handlers were not found')
  }
  const handler = script.slice(handlerAt, handlerAt + 1400)
  if (!/if \(pendingModificationDelivery\.value\) \{[\s\S]*?await retrySavedModificationDelivery\(\)/.test(handler)) {
    throw new Error('[pricing-save-binding] Saved seller revisions require an explicit send action')
  }
  // CRM and commercial-country validation can precede pending-delivery and
  // exceed 600 characters. Verify the actual branch, not a fixed-size prelude.
  const pendingAt = script.indexOf('if (pendingModificationDelivery.value) {', saveAt)
  const pendingEnd = pendingAt >= 0 ? script.indexOf('\n  }', pendingAt) : -1
  if (pendingAt < 0 || pendingAt >= handlerAt || pendingEnd < 0 || pendingEnd >= handlerAt) {
    throw new Error('[pricing-save-binding] Pending revision guard was not found inside saveRate')
  }
  const pendingGuard = script.slice(pendingAt, pendingEnd + 4)
  if (pendingGuard.includes('retrySavedModificationDelivery(')) {
    throw new Error('[pricing-save-binding] Save must not automatically deliver a pending revision')
  }
}

export function pricingModificationSaveBindingGuard(): Plugin {
  return {
    name: 'dhole-pricing-modification-save-binding-guard',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD_SUFFIX)) return null
      validatePricingModificationSaveBindings(source)
      return null
    },
  }
}
