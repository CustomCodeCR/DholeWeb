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

      // Pantalla 5: en móvil no renderizar una tabla de escritorio comprimida. Cada
      // consolidado se presenta como una tarjeta legible; la tabla completa se conserva
      // desde md en adelante para no alterar la experiencia de escritorio.
      code = replaceOne(
        code,
        `    <div class="flex gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5">`,
        `    <div class="grid grid-cols-2 gap-1.5 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5">`,
        'responsive LCL source tabs',
      )

      code = replaceOne(
        code,
        `    <div v-if="tab === 'Own'">\n      <DhDataTable :columns="ownColumns" :rows="filteredOwn" :loading="loading" empty-text="No hay consolidados propios disponibles para este POL.">`,
        `    <div v-if="tab === 'Own'">\n      <div class="space-y-3 md:hidden">\n        <div v-if="loading" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">Cargando consolidados…</div>\n        <div v-else-if="!filteredOwn.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">No hay consolidados propios disponibles para este POL.</div>\n        <article\n          v-for="row in filteredOwn"\n          v-else\n          :key="\`own-mobile:${'${row.id}'}\`"\n          class="rounded-[22px] border bg-[var(--dh-card)] p-4 shadow-sm transition"\n          :class="modelValue === \`Own:${'${row.id}'}\` ? 'border-[var(--dh-primary)] ring-2 ring-[rgb(var(--dh-primary-rgb)/0.12)]' : 'border-[var(--dh-border)]'"\n        >\n          <div class="flex items-start justify-between gap-3">\n            <div class="min-w-0">\n              <p class="break-words text-base font-black text-[var(--dh-text)]">{{ row.name }}</p>\n              <p class="mt-1 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ row.matrixVersion }} · {{ row.booking || 'Sin booking' }}</p>\n            </div>\n            <DhBadge v-if="modelValue === \`Own:${'${row.id}'}\`" label="Seleccionado" variant="success" />\n          </div>\n          <div class="mt-4 rounded-2xl bg-[var(--dh-input)] p-3">\n            <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ruta cotizada</span>\n            <p class="mt-1 break-words text-sm font-black leading-snug">{{ selectedPolDisplay(ownPreview(row)) }} → {{ destinationDisplay(ownPreview(row)?.destinationCode) }}</p>\n            <p class="mt-1 break-words text-[11px] font-semibold leading-relaxed text-[var(--dh-text-muted)]">Base física Shanghai → Balboa · {{ row.carrierName || row.carrierCode || 'Naviera pendiente' }}</p>\n          </div>\n          <div class="mt-3 grid grid-cols-2 gap-2">\n            <div class="rounded-xl border border-[var(--dh-border)] p-3">\n              <span class="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Capacidad</span>\n              <p class="mt-1 text-sm font-black">{{ n(row.maximumCbm).toFixed(2) }} CBM</p>\n            </div>\n            <div class="rounded-xl border border-[var(--dh-border)] p-3">\n              <span class="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">ETD</span>\n              <p class="mt-1 text-sm font-black">{{ row.etd || '—' }}</p>\n            </div>\n            <div class="col-span-2 rounded-xl border border-[var(--dh-border)] p-3">\n              <span class="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo ruta / CBM</span>\n              <p class="mt-1 text-sm font-black">USD {{ money(ownPreview(row)?.routeCostPerCbm ?? row.panamaBaseCostPerCbm ?? ((n(row.oceanFreight) + n(row.carrierDestinationCostTotal)) / Math.max(n(row.maximumCbm), 1))) }}</p>\n              <p v-if="ownPreview(row)" class="mt-1 text-[10px] font-semibold leading-relaxed text-[var(--dh-text-muted)]">Ocean {{ money(ownPreview(row)?.baseOceanCostPerCbm) }} · Origen +{{ money(ownPreview(row)?.originSurchargePerCbm) }} · Destino {{ money(ownPreview(row)?.destinationCostPerCbm) }}</p>\n              <p v-if="ownPreview(row)" class="mt-1 text-[11px] font-black text-[var(--dh-primary)]">Venta sugerida USD {{ money(ownPreview(row)?.recommendedSalePerCbm) }} / CBM</p>\n            </div>\n          </div>\n          <DhButton class="mt-4 w-full" :label="modelValue === \`Own:${'${row.id}'}\` ? 'Seleccionado' : 'Seleccionar consolidado'" :icon="modelValue === \`Own:${'${row.id}'}\` ? Check : undefined" :loading="selecting === \`Own:${'${row.id}'}\`" @click="chooseOwn(row)" />\n        </article>\n      </div>\n      <DhDataTable class="hidden md:block" :columns="ownColumns" :rows="filteredOwn" :loading="loading" empty-text="No hay consolidados propios disponibles para este POL.">`,
        'own-LCL mobile cards',
      )

      code = replaceOne(
        code,
        `    <div v-else>\n      <DhDataTable :columns="coloaderColumns" :rows="filteredColoaders" :loading="loading" empty-text="No hay tarifarios LCL de coloader vigentes para esta ruta.">`,
        `    <div v-else>\n      <div class="space-y-3 md:hidden">\n        <div v-if="loading" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">Cargando tarifarios coloader…</div>\n        <div v-else-if="!filteredColoaders.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] bg-[var(--dh-card)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">No hay tarifarios LCL de coloader vigentes para esta ruta.</div>\n        <article\n          v-for="row in filteredColoaders"\n          v-else\n          :key="\`coloader-mobile:${'${row.id}'}\`"\n          class="rounded-[22px] border bg-[var(--dh-card)] p-4 shadow-sm transition"\n          :class="modelValue === \`Coloader:${'${row.id}'}\` ? 'border-[var(--dh-primary)] ring-2 ring-[rgb(var(--dh-primary-rgb)/0.12)]' : 'border-[var(--dh-border)]'"\n        >\n          <div class="flex items-start justify-between gap-3">\n            <div class="min-w-0">\n              <p class="break-words text-base font-black">{{ row.providerName || row.providerCode || 'Coloader' }}</p>\n              <p class="mt-1 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ row.rateCode }} · {{ row.carrierName || row.carrierCode || 'Sin naviera' }}</p>\n            </div>\n            <DhBadge v-if="modelValue === \`Coloader:${'${row.id}'}\`" label="Seleccionado" variant="success" />\n          </div>\n          <div class="mt-4 rounded-2xl bg-[var(--dh-input)] p-3">\n            <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Ruta</span>\n            <p class="mt-1 break-words text-sm font-black leading-snug">{{ row.polName }} → {{ row.podName || row.poeName }}</p>\n          </div>\n          <div class="mt-3 grid grid-cols-2 gap-2">\n            <div class="rounded-xl border border-[var(--dh-border)] p-3">\n              <span class="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Vigencia</span>\n              <p class="mt-1 text-xs font-black">{{ row.validFrom }} – {{ row.validTo }}</p>\n            </div>\n            <div class="rounded-xl border border-[var(--dh-border)] p-3">\n              <span class="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Venta</span>\n              <p class="mt-1 text-sm font-black">{{ row.currencyCode }} {{ money(row.totalSaleAmount) }}</p>\n            </div>\n          </div>\n          <DhButton class="mt-4 w-full" :label="modelValue === \`Coloader:${'${row.id}'}\` ? 'Seleccionado' : 'Seleccionar coloader'" :icon="modelValue === \`Coloader:${'${row.id}'}\` ? Check : undefined" @click="chooseColoader(row)" />\n        </article>\n      </div>\n      <DhDataTable class="hidden md:block" :columns="coloaderColumns" :rows="filteredColoaders" :loading="loading" empty-text="No hay tarifarios LCL de coloader vigentes para esta ruta.">`,
        'coloader mobile cards',
      )

      return { code, map: null }
    },
  }
}