import type { Plugin } from 'vite'
import { pricingWizardEnhancements } from './pricingWizardEnhancements'

export function pricingWizardEnhancementsScoped(): Plugin {
  const plugin = pricingWizardEnhancements()
  const originalTransform = plugin.transform

  if (typeof originalTransform !== 'function') return plugin

  return {
    ...plugin,
    transform(source, id, ...args) {
      // Vue re-runs Vite transforms for generated script/style virtual modules.
      // The pricing transformer must mutate only the original .vue source once;
      // applying it again to ?vue&type=script/style modules makes its strict
      // source anchors fail after the first successful transformation.
      if (id.includes('?')) return null
      return originalTransform.call(this, source, id, ...args)
    },
  }
}
