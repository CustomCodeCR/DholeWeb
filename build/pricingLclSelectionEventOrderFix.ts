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

      // `select` is also a native DOM event name. Keep it for backwards compatibility,
      // but expose a dedicated component event that unambiguously carries the complete
      // calculated source to the wizard before modelValue triggers Pantalla 5 -> 6.
      code = replaceOne(
        code,
        `const emit = defineEmits<{\n  select: [selection: LclRateSourceSelection]\n  'update:modelValue': [value: string]\n  'update:requestedCbm': [value: number]\n}>()`,
        `const emit = defineEmits<{\n  select: [selection: LclRateSourceSelection]\n  'source-selected': [selection: LclRateSourceSelection]\n  'update:modelValue': [value: string]\n  'update:requestedCbm': [value: number]\n}>()`,
        'dedicated LCL source event declaration',
      )

      code = replaceOne(
        code,
        "    emit('update:modelValue', `Own:${row.id}`)\n    emit('select', selection)",
        "    emit('source-selected', selection)\n    emit('select', selection)\n    emit('update:modelValue', `Own:${row.id}`)",
        'own LCL resolved source order',
      )

      code = replaceOne(
        code,
        "  emit('update:modelValue', `Coloader:${rate.id}`)\n  emit('select', selection)",
        "  emit('source-selected', selection)\n  emit('select', selection)\n  emit('update:modelValue', `Coloader:${rate.id}`)",
        'coloader LCL resolved source order',
      )

      return { code, map: null }
    },
  }
}
