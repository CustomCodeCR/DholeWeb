import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingLclSelectionEventOrderFix] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingLclSelectionEventOrderFix(): Plugin {
  return {
    name: 'dhole-pricing-lcl-selection-event-order-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(LCL_SELECTOR_PATH)) return null

      let code = source

      // Keep the original component contract. The complete source must reach the
      // parent wizard BEFORE update:modelValue advances Pantalla 5 -> Pantalla 6.
      // Emitting modelValue first unmounted Pantalla 5 before applyLclRateSource ran,
      // leaving stale RS / empty carrier / 0 freight values in Pantalla 6.
      code = replaceOne(
        code,
        "    emit('update:modelValue', `Own:${row.id}`)\n    emit('select', selection)",
        "    emit('select', selection)\n    emit('update:modelValue', `Own:${row.id}`)",
        'own LCL selection order',
      )

      code = replaceOne(
        code,
        "  emit('update:modelValue', `Coloader:${rate.id}`)\n  emit('select', selection)",
        "  emit('select', selection)\n  emit('update:modelValue', `Coloader:${rate.id}`)",
        'coloader LCL selection order',
      )

      return { code, map: null }
    },
  }
}
