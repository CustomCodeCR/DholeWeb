import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardOwnLclExcelOnly] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchSelector(source: string) {
  let code = source

  // Las líneas calculadas por la matriz/Excel del consolidado propio no son costos fijos
  // del catálogo "Costos y recargos". Deben persistirse como líneas calculadas sin CostId.
  code = replaceOne(
    code,
    `      costType: variable ? 'Variable' : 'Fixed',`,
    `      costType: 'Variable',`,
    'own-LCL calculated line type',
  )

  // Marcar TODAS las líneas del consolidado propio, incluso las bases por CBM, para que
  // backend, pantalla 09 y PDF identifiquen la matriz Excel como única fuente comercial.
  code = replaceOne(
    code,
    `      notes: sourceBasis.includes('cbm') ? null : \`Base del Excel: \${line.chargeBasis}; cantidad aplicada: 1.\`,`,
    `      notes: sourceBasis.includes('cbm')\n        ? \`LCL PROPIO · Base del Excel: \${line.chargeBasis}.\`\n        : \`LCL PROPIO · Base del Excel: \${line.chargeBasis}; cantidad aplicada: 1.\`,`,
    'own-LCL Excel marker',
  )

  return code
}

function patchWizard(source: string) {
  return replaceOne(
    source,
    `const includedLines = computed(() => rateLines.value.filter((line) => line.included))`,
    `const isOwnLclExcelRate = computed(() =>\n  shipmentModeForApi.value === 'Lcl'\n  && (\n    String(editingRate.value?.agentCode ?? '').trim().toUpperCase() === 'GCF'\n    || String(editingRate.value?.agentName ?? '').toUpperCase().includes('GRUPO CASTRO FALLAS')\n    || rateLines.value.some((line) => !line.costId && /LCL\\s*PROPIO|Base del Excel/i.test(String(line.notes ?? '')))\n  ),\n)\nconst includedLines = computed(() => rateLines.value.filter((line) =>\n  line.included && (!isOwnLclExcelRate.value || !line.costId),\n))`,
    'own-LCL included lines filter',
  )
}

export function pricingWizardOwnLclExcelOnly(): Plugin {
  return {
    name: 'dhole-pricing-wizard-own-lcl-excel-only',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(LCL_SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      return null
    },
  }
}
