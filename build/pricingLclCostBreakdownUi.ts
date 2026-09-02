import type { Plugin } from 'vite'

const LCL_SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingLclCostBreakdownUi] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

export function pricingLclCostBreakdownUi(): Plugin {
  return {
    name: 'dhole-pricing-lcl-cost-breakdown-ui',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(LCL_SELECTOR_PATH)) return null

      let code = source

      code = replaceOne(
        code,
        "  { key: 'cost', label: 'Costo base/CBM', align: 'right', width: '150px' },",
        "  { key: 'cost', label: 'Costo ruta / CBM', align: 'right', width: '330px' },",
        'own-LCL route cost column',
      )

      code = replaceOne(
        code,
        "const error = ref('')",
        `const error = ref('')\nconst ownPreviewById = ref<Record<string, OwnLclQuoteCalculationDto>>({})`,
        'own-LCL preview state',
      )

      const previewHelpersAnchor = `function cargoForCbm(cbm: number) {\n  return [{ description: 'Cotización LCL', units: 1, totalWeightKg: 0, lengthCm: 100, widthCm: 100, heightCm: cbm * 100 }]\n}`
      const previewHelpersReplacement = `${previewHelpersAnchor}\n\nfunction ownPreview(row: OwnLclConsolidationDto) {\n  return ownPreviewById.value[row.id] ?? null\n}\n\nfunction destinationDisplay(code: string | null | undefined) {\n  const label = String(props.destinationLabel ?? '').trim()\n  if (label) return label\n  const key = String(code ?? '').toUpperCase()\n  if (key === 'CR') return 'Costa Rica / GAM'\n  if (key === 'PA') return 'Panamá'\n  if (key === 'NI') return 'Nicaragua / Managua'\n  if (key === 'HN') return 'Honduras / San Pedro Sula'\n  if (key === 'GT') return 'Guatemala'\n  if (key === 'SV') return 'El Salvador'\n  return 'Destino final'\n}\n\nfunction selectedPolDisplay(preview: OwnLclQuoteCalculationDto | null) {\n  const label = String(props.polCode ?? '').trim()\n  if (label) return label\n  return preview?.polCode ?? 'Shanghai, China'\n}\n\nasync function loadOwnPreviews(rows: OwnLclConsolidationDto[]) {\n  const destination = destinationCode()\n  if (!destination || !rows.length) {\n    ownPreviewById.value = {}\n    return\n  }\n\n  const cbm = requested()\n  const cargoLines = props.cargoLines.length ? props.cargoLines : cargoForCbm(cbm)\n  const results = await Promise.allSettled(rows.map((row) =>\n    OwnLclConsolidationService.calculate(row.id, {\n      destinationCode: destination,\n      incoterm: props.incotermCode || 'FOB',\n      cargoLines,\n      polCode: canonicalChinaOwnLclOrigin(props.polCode || row.polCode).toUpperCase(),\n      salePerCbm: null,\n      sets: 1,\n      hbl: 1,\n      pickupCost: 0,\n      pickupSale: 0,\n      discount: 0,\n    }),\n  ))\n\n  const next: Record<string, OwnLclQuoteCalculationDto> = {}\n  results.forEach((result, index) => {\n    if (result.status === 'fulfilled') next[rows[index].id] = result.value\n  })\n  ownPreviewById.value = next\n}`
      code = replaceOne(code, previewHelpersAnchor, previewHelpersReplacement, 'own-LCL preview helpers')

      code = replaceOne(
        code,
        `    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'`,
        `    await loadOwnPreviews(ownRows.value)\n    if (!filteredOwn.value.length && filteredColoaders.value.length) tab.value = 'Coloader'`,
        'load selected-route previews',
      )

      const routeAnchor = `<template #cell-route="{ row }">\n          <div><p class="font-bold">{{ row.polName || row.polCode }} → {{ row.poeName || row.poeCode || 'Panamá' }} / Centroamérica</p><p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">{{ row.carrierName || row.carrierCode || 'Naviera pendiente' }} · ETD {{ row.etd || '—' }}</p></div>\n        </template>`
      const routeReplacement = `<template #cell-route="{ row }">\n          <div>\n            <p class="font-bold">{{ selectedPolDisplay(ownPreview(row)) }} → {{ destinationDisplay(ownPreview(row)?.destinationCode) }}</p>\n            <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">Base física Shanghai → Balboa · {{ row.carrierName || row.carrierCode || 'Naviera pendiente' }} · ETD {{ row.etd || '—' }}</p>\n          </div>\n        </template>`
      code = replaceOne(code, routeAnchor, routeReplacement, 'selected own-LCL route label')

      const cellAnchor = `<template #cell-cost="{ row }"><span class="font-black">USD {{ money((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1)) }}</span></template>`
      const cellReplacement = `<template #cell-cost="{ row }">\n          <div v-if="ownPreview(row)" class="space-y-0.5 text-right">\n            <p class="font-black">{{ destinationDisplay(ownPreview(row)?.destinationCode) }} USD {{ money(ownPreview(row)?.routeCostPerCbm) }}</p>\n            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Ocean {{ money(ownPreview(row)?.baseOceanCostPerCbm) }} · Origen +{{ money(ownPreview(row)?.originSurchargePerCbm) }} · Destino {{ money(ownPreview(row)?.destinationCostPerCbm) }}</p>\n            <p v-if="n(ownPreview(row)?.routeTransferCostPerCbm) || n(ownPreview(row)?.routeWarehouseCostPerCbm) || n(ownPreview(row)?.routeInlandCostPerCbm)" class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Traslado {{ money(ownPreview(row)?.routeTransferCostPerCbm) }} · Bodega {{ money(ownPreview(row)?.routeWarehouseCostPerCbm) }} · Inland {{ money(ownPreview(row)?.routeInlandCostPerCbm) }}</p>\n            <p class="text-[10px] font-black text-[var(--dh-primary)]">Venta sugerida USD {{ money(ownPreview(row)?.recommendedSalePerCbm) }} / CBM</p>\n          </div>\n          <div v-else class="space-y-0.5 text-right">\n            <p class="font-black">Base Panamá USD {{ money(row.panamaBaseCostPerCbm ?? ((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1))) }}</p>\n            <p class="text-[10px] font-semibold text-[var(--dh-text-muted)]">Calculando ruta seleccionada…</p>\n          </div>\n        </template>`
      code = replaceOne(code, cellAnchor, cellReplacement, 'selected own-LCL route breakdown')

      code = replaceOne(
        code,
        `watch(() => [props.polId, props.poeId, props.podId, props.incotermId, props.quoteDate], () => void load())`,
        `watch(() => [props.polId, props.polCode, props.poeId, props.podId, props.destinationLabel, props.incotermId, props.incotermCode, props.quoteDate, props.requestedCbm], () => void load())`,
        'own-LCL route preview watcher',
      )

      return { code, map: null }
    },
  }
}
