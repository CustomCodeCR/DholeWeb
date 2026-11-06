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
  const validations = script.indexOf('if (!validateRequiredFields()', saveAt)
  if (validations < saveAt) throw new Error('[pricing-save-binding] Validation anchor missing')
  const savePrelude = script.slice(saveAt, validations)
  if (savePrelude.includes('retrySavedModificationDelivery(')) {
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
