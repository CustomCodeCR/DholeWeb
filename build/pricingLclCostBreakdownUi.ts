import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

export function pricingLclCostBreakdownUi(): Plugin {
  return {
    name: 'dhole-pricing-lcl-cost-breakdown-ui',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(LCL_SELECTOR_PATH)) return null

      let code = source

      const columnAnchor = "  { key: 'cost', label: 'Costo base/CBM', align: 'right', width: '150px' },"
      if (code.split(columnAnchor).length - 1 !== 1) {
        throw new Error('[pricingLclCostBreakdownUi] Expected one own-LCL cost column anchor.')
      }
      code = code.replace(
        columnAnchor,
        "  { key: 'cost', label: 'Desglose costo / CBM', align: 'right', width: '300px' },",
      )

      const cellAnchor = `<template #cell-cost="{ row }"><span class="font-black">USD {{ money((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1)) }}</span></template>`
      if (code.split(cellAnchor).length - 1 !== 1) {
        throw new Error('[pricingLclCostBreakdownUi] Expected one own-LCL cost cell anchor.')
      }

      const cellReplacement = `<template #cell-cost="{ row }">
          <div class="space-y-0.5 text-right">
            <p class="font-black">Panamá USD {{ money(row.panamaBaseCostPerCbm ?? ((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1))) }}</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Ocean {{ money(row.oceanCostPerCbm ?? (n(row.oceanFreight) / Math.max(n(row.maximumCbm), 1))) }} · Destino {{ money(row.destinationCostPerCbm ?? (n(row.carrierDestinationCostTotal) / Math.max(n(row.maximumCbm), 1))) }}</p>
            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Panamá → CR {{ money(row.panamaToCostaRicaCostPerCbm ?? ((n(row.panamaToCostaRicaCost) + n(row.bunkerCost)) / Math.max(n(row.costaRicaTransferBaseCbm), 1))) }} · CR {{ money(row.costaRicaProjectedCostPerCbm ?? 0) }}</p>
          </div>
        </template>`

      code = code.replace(cellAnchor, cellReplacement)
      return { code, map: null }
    },
  }
}
