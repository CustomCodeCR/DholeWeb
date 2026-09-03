import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const SELECTOR_PATH = '/src/modules/pricing/components/PricingLclRateSourceSelector.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardLclStableFlow] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // There is one owner for the transition. The selector calls applyLclRateSource
  // directly with the complete calculated payload. Hydration finishes first and
  // only then Pantalla 5 advances to Pantalla 6.
  const hydrationEnd = `  rateLines.value = selection.lines.map((line) => ({ ...line })) as RateLine[]\n  draftCommercialTermsInitialized.value = false\n}`
  const hydrationEndReplacement = `  rateLines.value = selection.lines.map((line) => ({ ...line })) as RateLine[]\n  draftCommercialTermsInitialized.value = false\n  step.value = 6\n}`
  code = replaceOne(code, hydrationEnd, hydrationEndReplacement, 'LCL hydration completion')

  // pricingWizardLclAtomicSelection previously depended on Vue's custom select
  // event. Replace that listener with a direct function prop so unmounting Pantalla
  // 5 cannot interrupt delivery of the calculated consolidation object.
  code = replaceOne(
    code,
    `            @select="(selection) => { applyLclRateSource(selection); step = 6 }"`,
    `            :on-resolved-selection="applyLclRateSource"`,
    'direct LCL resolved selection binding',
  )

  // Mobile: the 8-step bar must scroll instead of squeezing every step into tiny boxes.
  code = replaceOne(
    code,
    `    <div class="crystal-stepbar grid grid-cols-2 gap-2 p-2 sm:grid-cols-4" :class="viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'">`,
    `    <div class="crystal-stepbar flex snap-x gap-2 overflow-x-auto p-2 sm:grid sm:grid-cols-4 sm:overflow-visible" :class="viewOnly ? 'xl:grid-cols-9' : 'xl:grid-cols-8'">`,
    'responsive wizard stepbar',
  )
  code = replaceOne(
    code,
    `        class="crystal-step"`,
    `        class="crystal-step min-w-[132px] shrink-0 snap-start sm:min-w-0 sm:shrink"`,
    'responsive wizard step',
  )
  code = replaceOne(
    code,
    `    <section class="crystal-panel min-h-[470px] p-5 md:p-8"`,
    `    <section class="crystal-panel min-h-[470px] p-3 sm:p-5 md:p-8"`,
    'responsive wizard panel padding',
  )
  code = replaceOne(
    code,
    `          <div class="crystal-soft grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 md:p-5">`,
    `          <div class="crystal-soft grid min-w-0 gap-4 p-3 sm:p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">`,
    'responsive provider grid',
  )

  return code
}

function patchSelector(source: string) {
  let code = source

  // Direct callback supplied by the Wizard. It is intentionally independent of
  // emit('select') and v-model, which remain only for backwards compatibility and
  // visual selected-state updates.
  code = replaceOne(
    code,
    `  cargoLines?: OwnLclCargoLineRequest[]\n}>(), {`,
    `  cargoLines?: OwnLclCargoLineRequest[]\n  onResolvedSelection?: (selection: LclRateSourceSelection) => void\n}>(), {`,
    'selector direct callback prop',
  )

  code = replaceOne(
    code,
    `    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)`,
    `    props.onResolvedSelection?.(selection)\n    emit('update:modelValue', \`Own:\${row.id}\`)\n    emit('select', selection)`,
    'own direct selection callback',
  )
  code = replaceOne(
    code,
    `  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)`,
    `  props.onResolvedSelection?.(selection)\n  emit('update:modelValue', \`Coloader:\${rate.id}\`)\n  emit('select', selection)`,
    'coloader direct selection callback',
  )

  code = replaceOne(
    code,
    `<section class="space-y-4">`,
    `<section class="lcl-source-selector min-w-0 space-y-4">`,
    'selector root',
  )
  code = replaceOne(
    code,
    `<DhButton label="Actualizar tarifas" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />`,
    `<DhButton class="w-full lg:w-auto" label="Actualizar tarifas" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />`,
    'mobile refresh button',
  )
  code = replaceOne(
    code,
    `<div class="flex gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5">`,
    `<div class="grid grid-cols-1 gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-1.5 sm:grid-cols-2">`,
    'responsive source tabs',
  )

  const ownClose = `      </DhDataTable>\n    </div>\n\n    <div v-else>`
  const ownCards = `      </DhDataTable>\n      <div class="grid gap-3 md:hidden">\n        <article v-for="row in filteredOwn" :key="row.id" class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">\n          <div class="flex min-w-0 items-start justify-between gap-3">\n            <div class="min-w-0">\n              <p class="break-words text-base font-black">{{ row.name }}</p>\n              <p class="mt-1 break-all text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ row.matrixVersion }} · {{ row.booking || 'Sin booking' }}</p>\n            </div>\n            <Ship class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />\n          </div>\n          <div class="mt-4 space-y-2 text-sm">\n            <p class="break-words font-bold">{{ selectedPolDisplay(ownPreview(row)) }} → {{ destinationDisplay(ownPreview(row)?.destinationCode) }}</p>\n            <p class="break-words text-xs font-semibold text-[var(--dh-text-muted)]">Base física Shanghai → Balboa · {{ row.carrierName || row.carrierCode || 'Naviera pendiente' }} · ETD {{ row.etd || '—' }}</p>\n            <div class="grid grid-cols-2 gap-2 pt-1">\n              <div class="rounded-xl bg-[var(--dh-input)] p-3">\n                <span class="block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Capacidad</span>\n                <strong class="mt-1 block">{{ n(row.maximumCbm).toFixed(2) }} CBM</strong>\n              </div>\n              <div class="rounded-xl bg-[var(--dh-input)] p-3">\n                <span class="block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Costo ruta / CBM</span>\n                <strong v-if="ownPreview(row)" class="mt-1 block break-words">USD {{ money(ownPreview(row)?.routeCostPerCbm) }}</strong>\n                <strong v-else class="mt-1 block text-xs text-[var(--dh-text-muted)]">Calculando…</strong>\n              </div>\n            </div>\n            <p v-if="ownPreview(row)" class="text-xs font-black text-[var(--dh-primary)]">Venta sugerida USD {{ money(ownPreview(row)?.recommendedSalePerCbm) }} / CBM</p>\n          </div>\n          <DhButton class="mt-4 w-full" :label="modelValue === \`Own:\${row.id}\` ? 'Seleccionado' : 'Seleccionar'" :icon="modelValue === \`Own:\${row.id}\` ? Check : undefined" :loading="selecting === \`Own:\${row.id}\`" @click="chooseOwn(row)" />\n        </article>\n        <div v-if="!loading && !filteredOwn.length" class="rounded-2xl border border-[var(--dh-border)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">No hay consolidados propios disponibles para este POL.</div>\n      </div>\n    </div>\n\n    <div v-else>`
  code = replaceOne(code, ownClose, ownCards, 'own mobile cards')
  code = replaceOne(
    code,
    `<div v-if="tab === 'Own'">\n      <DhDataTable`,
    `<div v-if="tab === 'Own'">\n      <div class="hidden md:block">\n      <DhDataTable`,
    'own desktop table wrapper',
  )
  code = replaceOne(
    code,
    `      </DhDataTable>\n      <div class="grid gap-3 md:hidden">`,
    `      </DhDataTable>\n      </div>\n      <div class="grid gap-3 md:hidden">`,
    'own desktop table close',
  )

  const coloaderClose = `      </DhDataTable>\n    </div>\n  </section>`
  const coloaderCards = `      </DhDataTable>\n      </div>\n      <div class="grid gap-3 md:hidden">\n        <article v-for="row in filteredColoaders" :key="row.id" class="min-w-0 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">\n          <div class="flex min-w-0 items-start justify-between gap-3">\n            <div class="min-w-0">\n              <p class="break-words text-base font-black">{{ row.providerName || row.providerCode || 'Coloader' }}</p>\n              <p class="mt-1 break-all text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ row.rateCode }} · {{ row.carrierName || row.carrierCode || 'Sin naviera' }}</p>\n            </div>\n            <Building2 class="h-5 w-5 shrink-0 text-[var(--dh-primary)]" />\n          </div>\n          <div class="mt-4 space-y-2 text-sm">\n            <p class="break-words font-bold">{{ row.polName }} → {{ row.podName || row.poeName }}</p>\n            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Vigencia {{ row.validFrom }} – {{ row.validTo }}</p>\n            <div class="rounded-xl bg-[var(--dh-input)] p-3">\n              <span class="block text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Venta base</span>\n              <strong class="mt-1 block text-base">{{ row.currencyCode }} {{ money(row.totalSaleAmount) }}</strong>\n            </div>\n          </div>\n          <DhButton class="mt-4 w-full" :label="modelValue === \`Coloader:\${row.id}\` ? 'Seleccionado' : 'Seleccionar'" :icon="modelValue === \`Coloader:\${row.id}\` ? Check : undefined" @click="chooseColoader(row)" />\n        </article>\n        <div v-if="!loading && !filteredColoaders.length" class="rounded-2xl border border-[var(--dh-border)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">No hay tarifarios LCL de coloader vigentes para esta ruta.</div>\n      </div>\n    </div>\n  </section>`
  code = replaceOne(code, coloaderClose, coloaderCards, 'coloader mobile cards')
  code = replaceOne(
    code,
    `<div v-else>\n      <DhDataTable :columns="coloaderColumns"`,
    `<div v-else>\n      <div class="hidden md:block">\n      <DhDataTable :columns="coloaderColumns"`,
    'coloader desktop table wrapper',
  )

  return code
}

export function pricingWizardLclStableFlow(): Plugin {
  return {
    name: 'dhole-pricing-wizard-lcl-stable-flow',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (normalizedId.endsWith(WIZARD_PATH)) return { code: patchWizard(source), map: null }
      if (normalizedId.endsWith(SELECTOR_PATH)) return { code: patchSelector(source), map: null }
      return null
    },
  }
}
