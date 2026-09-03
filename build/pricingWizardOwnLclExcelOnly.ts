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
  let code = source

  // Mantener TODAS las líneas incluidas para el trabajo interno de Pricing (costo, margen,
  // persistencia, impuestos y edición). La salida comercial es una colección separada.
  code = replaceOne(
    code,
    `const includedLines = computed(() => rateLines.value.filter((line) => line.included))`,
    `const isOwnLclExcelRate = computed(() =>\n  shipmentModeForApi.value === 'Lcl'\n  && (\n    String(editingRate.value?.agentCode ?? '').trim().toUpperCase() === 'GCF'\n    || String(editingRate.value?.agentName ?? '').toUpperCase().includes('GRUPO CASTRO FALLAS')\n    || rateLines.value.some((line) => !line.costId && /LCL\\s*PROPIO|Base del Excel/i.test(String(line.notes ?? '')))\n  ),\n)\nconst includedLines = computed(() => rateLines.value.filter((line) => line.included))\nconst commercialOutputLines = computed(() => includedLines.value.filter((line) =>\n  !isOwnLclExcelRate.value || !line.costId,\n))`,
    'own-LCL commercial output lines',
  )

  // Pantalla 09 debe totalizar exactamente las mismas líneas comerciales que se muestran
  // y que el backend utiliza para el PDF, sin contaminar los totales internos del wizard.
  code = replaceOne(
    code,
    `const totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))`,
    `function sumCommercialLinesInCurrency(amount: (line: RateLine) => number, target: 'USD' | 'CRC') {\n  return commercialOutputLines.value.reduce((sum, line) => {\n    const quantity = Math.max(0, number(quantityForChargeBasis(line.chargeBasis)))\n    const lineTotal = number(amount(line)) * quantity\n    return sum + convertUsdCrc(lineTotal, canonicalCurrencyCode(line), target)\n  }, 0)\n}\nconst commercialSaleBeforeTaxUsd = computed(() => sumCommercialLinesInCurrency((line) => number(line.saleAmount), 'USD'))\nconst commercialSaleBeforeTaxCrc = computed(() => sumCommercialLinesInCurrency((line) => number(line.saleAmount), 'CRC'))\nconst commercialTaxUsd = computed(() => sumCommercialLinesInCurrency(lineTaxAmount, 'USD'))\nconst commercialTaxCrc = computed(() => sumCommercialLinesInCurrency(lineTaxAmount, 'CRC'))\nconst commercialSaleUsd = computed(() => commercialSaleBeforeTaxUsd.value + commercialTaxUsd.value)\nconst commercialSaleCrc = computed(() => commercialSaleBeforeTaxCrc.value + commercialTaxCrc.value)\nconst totalCostUsd = computed(() => sumLinesInCurrency((line) => number(line.costAmount), 'USD'))`,
    'own-LCL commercial totals',
  )

  code = replaceOne(
    code,
    `<p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>`,
    `<p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas comerciales de la tarifa</p>\n              <p v-if="isOwnLclExcelRate" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">Para LCL propio se muestran únicamente los conceptos calculados por la matriz Excel del Incoterm seleccionado (EXW, FCA o FOB).</p>`,
    'screen 09 commercial lines title',
  )

  code = replaceOne(
    code,
    `<tr v-for="line in includedLines" :key="line.key" class="border-t border-[var(--dh-border)]">`,
    `<tr v-for="line in commercialOutputLines" :key="line.key" class="border-t border-[var(--dh-border)]">`,
    'screen 09 commercial rows',
  )

  const screen09Totals = `<div class="crystal-soft p-5">\n            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Totales de la oferta</p>\n            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">\n              <div class="min-w-[520px]">\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-[10px] font-black uppercase text-[var(--dh-text-muted)]"><span>Concepto</span><span>USD</span><span>CRC</span></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>Subtotal</strong><strong>{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</strong></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>IVA</strong><strong>{{ formatMoney(totalTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(totalTaxCrc, 'CRC') }}</strong></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-4 text-base"><strong>Total</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleUsd, 'USD') }}</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(totalSaleCrc, 'CRC') }}</strong></div>\n              </div>\n            </div>\n            <div class="mt-4 grid gap-3 md:grid-cols-3 text-sm">\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Costo</span><p class="mt-1 font-black">{{ formatMoney(totalCostUsd, 'USD') }} / {{ formatMoney(totalCostCrc, 'CRC') }}</p></div>\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Utilidad</span><p class="mt-1 font-black">{{ formatMoney(totalUtilityUsd, 'USD') }} / {{ formatMoney(totalUtilityCrc, 'CRC') }}</p></div>\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Margen</span><p class="mt-1 font-black">{{ totalMarginPercentage.toFixed(2) }}%</p></div>\n            </div>\n          </div>`

  const screen09CommercialTotals = `<div class="crystal-soft p-5">\n            <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Totales de la oferta</p>\n            <p v-if="isOwnLclExcelRate" class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">Estos totales corresponden únicamente a las líneas comerciales de la matriz Excel mostradas arriba.</p>\n            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">\n              <div class="min-w-[520px]">\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-[10px] font-black uppercase text-[var(--dh-text-muted)]"><span>Concepto</span><span>USD</span><span>CRC</span></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>Subtotal</strong><strong>{{ formatMoney(commercialSaleBeforeTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(commercialSaleBeforeTaxCrc, 'CRC') }}</strong></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 border-b border-[var(--dh-border)] px-4 py-3 text-sm"><strong>IVA</strong><strong>{{ formatMoney(commercialTaxUsd, 'USD') }}</strong><strong>{{ formatMoney(commercialTaxCrc, 'CRC') }}</strong></div>\n                <div class="grid grid-cols-[minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-3 bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-4 text-base"><strong>Total</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(commercialSaleUsd, 'USD') }}</strong><strong class="text-[var(--dh-primary)]">{{ formatMoney(commercialSaleCrc, 'CRC') }}</strong></div>\n              </div>\n            </div>\n            <div class="mt-4 grid gap-3 md:grid-cols-3 text-sm">\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Costo interno</span><p class="mt-1 font-black">{{ formatMoney(totalCostUsd, 'USD') }} / {{ formatMoney(totalCostCrc, 'CRC') }}</p></div>\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Utilidad interna</span><p class="mt-1 font-black">{{ formatMoney(totalUtilityUsd, 'USD') }} / {{ formatMoney(totalUtilityCrc, 'CRC') }}</p></div>\n              <div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Margen interno</span><p class="mt-1 font-black">{{ totalMarginPercentage.toFixed(2) }}%</p></div>\n            </div>\n          </div>`

  code = replaceOne(code, screen09Totals, screen09CommercialTotals, 'screen 09 commercial totals')

  return code
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
