import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardOwnLclExcelOnly] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingWizardOwnLclExcelOnly(): Plugin {
  return {
    name: 'dhole-pricing-wizard-own-lcl-excel-only',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(LCL_SELECTOR_PATH)) return null

      let code = source

      // Las líneas calculadas por la matriz/Excel del consolidado propio no son costos fijos
      // del catálogo "Costos y recargos". Deben persistirse como líneas calculadas sin CostId.
      code = replaceOne(
        code,
        `      costType: variable ? 'Variable' : 'Fixed',`,
        `      costType: 'Variable',`,
        'own-LCL calculated line type',
      )

      return { code, map: null }
    },
  }
}
