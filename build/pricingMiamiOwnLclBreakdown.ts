import type { Plugin } from 'vite'

// Miami LCL commercial breakdown belongs in Pantalla 8, not Pantalla 6.
// This transform runs after the other pricing wizard UI transforms.
const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// miami-own-lcl-breakdown-screen8-20261016'
const HELPERS = String.raw`
// miami-own-lcl-breakdown-screen8-20261016
const showMiamiOwnLclBreakdown = computed(() =>
  isMiamiLcl.value && shipmentModeForApi.value === 'Lcl' && isOwnLclMatrixContext(),
)
const miamiOwnLclBreakdownRows = computed(() => {
  if (!showMiamiOwnLclBreakdown.value) return []
  // Exactly the same included lines and quantities used by the save payload
  // and by the existing Pantalla 8 totals; no extra synthetic freight/sales.
  return includedLines.value.map((line) => {
    const quantity = Math.max(0, number(quantityForRateLine(line)))
    const fixedQty = String(line.notes ?? '').match(/cantidad aplicada:\s*(\d+(?:\.\d+)?)/i)
    const displayQuantity = fixedQty && !/Per(?:Chargeable)?(?:Cbm|Cft)/i.test(line.chargeBasis)
      ? Math.max(1, number(fixedQty[1]))
      : quantity
    return {
      key: line.key,
      name: line.name,
      freight: line.costDetailType === 'Freight',
      basis: chargeBasisLabel(effectiveChargeBasisForLine(line)),
      quantity: displayQuantity,
      currency: canonicalCurrencyCode(line),
      cost: number(line.costAmount) * quantity,
      subtotal: number(line.saleAmount) * quantity,
      tax: lineTaxTotalAmount(line),
      total: lineSaleWithTax(line) * quantity,
    }
  })
})
const miamiOwnLclFreightBasis = computed(() => {
  const rate = miamiCommercialRate.value
  if (rate.little) return 'Venta según escala CARGAS LITTLE'
  const unit = 'Tarifa comercial: USD ' + rate.salePerCft.toFixed(2) + '/CFT'
  return miamiFreightCalculated.value < rate.minimumFreightSale
    ? unit + ' · mínimo de flete aplicado: USD ' + rate.minimumFreightSale.toFixed(2)
    : unit
})
`;
const TEMPLATE = String.raw`
          <section v-if="showMiamiOwnLclBreakdown" class="crystal-soft overflow-hidden p-0">
            <div class="border-b border-[var(--dh-border)] px-5 py-4">
              <h3 class="text-base font-black">Desglose final de venta · LCL propio Miami</h3>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ miamiCommercialRate.label }} · Cada concepto se factura por separado; el mínimo del flete no modifica la tarifa comercial por CFT.
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-left text-xs">
                <thead class="bg-[var(--dh-card-hover)] text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
                  <tr>
                    <th class="px-4 py-3">Concepto</th>
                    <th class="px-4 py-3">Base</th>
                    <th class="px-4 py-3 text-right">Cantidad</th>
                    <th class="px-4 py-3">Divisa</th>
                    <th class="px-4 py-3 text-right">Costo total</th>
                    <th class="px-4 py-3 text-right">Venta subtotal</th>
                    <th class="px-4 py-3 text-right">IVA</th>
                    <th class="px-4 py-3 text-right">Venta total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="line in miamiOwnLclBreakdownRows" :key="line.key" class="border-t border-[var(--dh-border)]">
                    <td class="px-4 py-3">
                      <strong class="block">{{ line.name }}</strong>
                      <span v-if="line.freight" class="mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ miamiOwnLclFreightBasis }}</span>
                    </td>
                    <td class="px-4 py-3">{{ line.basis }}</td>
                    <td class="px-4 py-3 text-right">{{ line.quantity.toLocaleString('es-CR', { maximumFractionDigits: 3 }) }}</td>
                    <td class="px-4 py-3 font-bold">{{ line.currency }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(line.cost, line.currency) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(line.subtotal, line.currency) }}</td>
                    <td class="px-4 py-3 text-right">{{ formatMoney(line.tax, line.currency) }}</td>
                    <td class="px-4 py-3 text-right font-black">{{ formatMoney(line.total, line.currency) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="border-t border-[var(--dh-border)] bg-[var(--dh-input)] px-5 py-4">
              <p class="text-xs font-black uppercase tracking-wide text-[var(--dh-text-muted)]">Totales de los conceptos</p>
              <div class="mt-3 grid gap-3 sm:grid-cols-3">
                <div><span class="text-[11px] font-semibold">Venta sin IVA (USD)</span><strong class="block text-base">{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong></div>
                <div><span class="text-[11px] font-semibold">IVA (USD)</span><strong class="block text-base">{{ formatMoney(totalTaxUsd, 'USD') }}</strong></div>
                <div><span class="text-[11px] font-semibold">Total final (USD)</span><strong class="block text-base">{{ formatMoney(totalSaleUsd, 'USD') }}</strong></div>
              </div>
              <p class="mt-3 text-xs font-semibold text-[var(--dh-text-muted)]">Los importes CRC equivalentes se muestran en Totales de la oferta. Los cargos adicionales y el seguro se incluyen únicamente cuando corresponden.</p>
            </div>
          </section>
`;
function patch(code: string) {
  if (code.includes(MARKER)) return code
  const start = code.indexOf('<div v-else-if="step === 8" class="space-y-6">')
  const end = code.indexOf('<div v-else-if="step === 9', start)
  if (start < 0 || end <= start) {
    throw new Error('[pricingMiamiOwnLclBreakdown] Pantalla 8 anchors missing')
  }
  const original = code.slice(start, end)
  let screen = original

  // Replace the generalized sale presentation with the line-by-line breakdown.
  // Keep all customer details, commercial conditions, totals and other sections.
  const generalPanel = '<div class="crystal-soft p-5">'
  if (screen.split(generalPanel).length < 2) {
    throw new Error('[pricingMiamiOwnLclBreakdown] General sale panel not found')
  }
  screen = screen.replace(generalPanel,
    TEMPLATE + '\n          <div v-if="!showMiamiOwnLclBreakdown" class="crystal-soft p-5">')

  // The old full-lines table is already superseded by this detailed Miami table,
  // so do not duplicate it; preserve the following commercial terms selector.
  const standardTable = /<section class="crystal-soft overflow-hidden p-0">(?=[\s\S]{0,1200}Líneas (?:completas|comerciales) de la tarifa)/g
  if (standardTable.test(screen)) {
    screen = screen.replace(standardTable,
      '<section v-if="!showMiamiOwnLclBreakdown" class="crystal-soft overflow-hidden p-0">')
  }

  const helperAnchor = 'const providerCost = computed(() =>'
  if (code.split(helperAnchor).length !== 2) {
    throw new Error('[pricingMiamiOwnLclBreakdown] Missing computed anchor')
  }
  return code.replace(helperAnchor, HELPERS + '\n' + helperAnchor)
    .replace(original, screen)
}
export function pricingMiamiOwnLclBreakdown(): Plugin {
  return {
    name: 'dhole-pricing-miami-own-lcl-breakdown',
    transform(source, id) {
      if (id.includes('?') || !id.replace(/\\/g, '/').endsWith(WIZARD)) return null
      return { code: patch(source), map: null }
    },
  }
}
