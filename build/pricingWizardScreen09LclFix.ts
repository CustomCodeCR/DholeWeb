import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardScreen09LclFix] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">Equipo</span><p class="mt-1 font-bold">{{ editingRate.containerQuantity }} × {{ editingRate.containerTypeName }}</p></div>`,
    `<div><span class="text-[10px] font-black uppercase text-[var(--dh-text-muted)]">{{ editingRate.shipmentMode === 'Lcl' ? 'Embarque' : 'Equipo' }}</span><p class="mt-1 font-bold">{{ editingRate.shipmentMode === 'Lcl' ? \`LCL · ${'${Number(editingRate.chargeableQuantity || 0).toFixed(3)}'} CBM cobrable\` : \`${'${editingRate.containerQuantity}'} × ${'${editingRate.containerTypeName}'}\` }}</p></div>`,
    'Pantalla 09 LCL equipment summary',
  )

  const fclIcon = `              <span v-if="option.value === 'FCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="Contenedor completo">
                <svg viewBox="0 0 56 40" class="h-9 w-12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="4" y="8" width="48" height="25" rx="2" />
                  <path d="M10 9v23M16 9v23M22 9v23M28 9v23M34 9v23M40 9v23M46 9v23M4 33h48" />
                </svg>
              </span>`
  const fixedFclIcon = `              <span v-if="option.value === 'FCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="FCL · contenedor completo cerrado">
                <svg viewBox="0 0 64 44" class="h-9 w-14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <rect x="6" y="7" width="52" height="30" rx="2" />
                  <path d="M11 12h42M11 32h42M16 8v28M23 8v28M30 8v28" opacity=".7" />
                  <path d="M37 8v28M47 8v28M42 21h1M52 21h1" />
                </svg>
              </span>`
  code = replaceOne(code, fclIcon, fixedFclIcon, 'FCL closed-container icon')

  const lclIcon = `              <span v-else-if="option.value === 'LCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="Contenedor con puertas abiertas">
                <svg viewBox="0 0 64 44" class="h-9 w-14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M17 8h30v27H17zM22 9v25M28 9v25M34 9v25M40 9v25" />
                  <path d="M17 10 5 5v31l12-3M47 10l12-5v31l-12-3" />
                  <path d="M8 10v20M56 10v20" />
                </svg>
              </span>`
  const fixedLclIcon = `              <span v-else-if="option.value === 'LCL'" class="mb-3 inline-flex h-12 w-14 items-center justify-center rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-primary)]" aria-label="LCL · carga consolidada con puertas abiertas">
                <svg viewBox="0 0 72 48" class="h-9 w-14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M21 9h30v30H21z" />
                  <path d="M21 13 6 7v34l15-5M51 13l15-6v34l-15-5" />
                  <path d="M9 13v22M63 13v22" opacity=".75" />
                  <path d="M26 30h9v7h-9zM37 25h9v12h-9zM29 20h8v8h-8z" />
                </svg>
              </span>`
  code = replaceOne(code, lclIcon, fixedLclIcon, 'LCL open consolidated-cargo icon')

  // Pantalla 9: en móvil las líneas se muestran como tarjetas completas para que
  // conceptos como Manejos/HBL sean visibles sin desplazar una tabla de 1180px.
  const detailTableAnchor = `            <div class="border-b border-[var(--dh-border)] px-5 py-4">\n              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>\n            </div>\n            <div class="overflow-x-auto">\n              <table class="min-w-[1180px] w-full text-left text-xs">`
  const detailTableReplacement = `            <div class="border-b border-[var(--dh-border)] px-5 py-4">\n              <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>\n            </div>\n            <div class="space-y-3 p-4 md:hidden">\n              <article v-for="line in includedLines" :key="\`mobile:${'${line.key}'}\`" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">\n                <div class="flex items-start justify-between gap-3">\n                  <div class="min-w-0">\n                    <p class="break-words text-sm font-black text-[var(--dh-text)]">{{ line.name }}</p>\n                    <p class="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">{{ detailTypeLabel(line.costDetailType) }} · {{ chargeBasisLabel(line.chargeBasis) }}</p>\n                  </div>\n                  <span class="shrink-0 rounded-full bg-[var(--dh-input)] px-2.5 py-1 text-[10px] font-black">{{ detailCurrencyValue(line) }}</span>\n                </div>\n                <p v-if="line.notes" class="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[var(--dh-input)] px-3 py-2 text-[10px] font-semibold leading-relaxed text-[var(--dh-text-muted)]">{{ line.notes }}</p>\n                <div class="mt-3 grid grid-cols-2 gap-2">\n                  <div class="rounded-xl border border-[var(--dh-border)] p-2.5">\n                    <span class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Cantidad</span>\n                    <p class="mt-1 text-sm font-black">{{ quantityForChargeBasis(line.chargeBasis).toLocaleString('es-CR') }}</p>\n                  </div>\n                  <div class="rounded-xl border border-[var(--dh-border)] p-2.5">\n                    <span class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Costo unit.</span>\n                    <p class="mt-1 text-sm font-black">{{ formatMoney(number(line.costAmount), detailCurrencyValue(line)) }}</p>\n                  </div>\n                  <div class="rounded-xl border border-[var(--dh-border)] p-2.5">\n                    <span class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Venta subtotal</span>\n                    <p class="mt-1 text-sm font-black">{{ formatMoney(number(line.saleAmount) * quantityForChargeBasis(line.chargeBasis), detailCurrencyValue(line)) }}</p>\n                  </div>\n                  <div class="rounded-xl border border-[var(--dh-border)] p-2.5">\n                    <span class="text-[9px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">IVA</span>\n                    <p class="mt-1 text-sm font-black" :class="lineTaxTotalAmount(line) > 0 ? 'text-[var(--dh-primary)]' : ''">{{ formatMoney(lineTaxTotalAmount(line), detailCurrencyValue(line)) }}</p>\n                  </div>\n                </div>\n                <div class="mt-2 flex items-center justify-between gap-3 rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.07)] px-3 py-3">\n                  <span class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">Venta total</span>\n                  <strong class="text-base text-[var(--dh-primary)]">{{ formatMoney(lineSaleWithTax(line) * quantityForChargeBasis(line.chargeBasis), detailCurrencyValue(line)) }}</strong>\n                </div>\n              </article>\n              <div v-if="!includedLines.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-5 text-center text-sm font-bold text-[var(--dh-text-muted)]">Esta tarifa no tiene líneas guardadas.</div>\n            </div>\n            <div class="hidden overflow-x-auto md:block">\n              <table class="min-w-[1180px] w-full text-left text-xs">`
  code = replaceOne(code, detailTableAnchor, detailTableReplacement, 'responsive rate-detail table')

  // Los totales también se muestran como filas verticales en móvil. En escritorio
  // se mantiene la tabla USD/CRC existente.
  const totalsAnchor = `            <div class="mt-4 overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">\n              <div class="min-w-[520px]">`
  const totalsReplacement = `            <div class="mt-4 space-y-2 md:hidden">\n              <div class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">\n                <strong>Subtotal</strong>\n                <div class="text-right"><strong class="block">{{ formatMoney(totalSaleBeforeTaxUsd, 'USD') }}</strong><span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatMoney(totalSaleBeforeTaxCrc, 'CRC') }}</span></div>\n              </div>\n              <div class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">\n                <strong>IVA</strong>\n                <div class="text-right"><strong class="block">{{ formatMoney(totalTaxUsd, 'USD') }}</strong><span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatMoney(totalTaxCrc, 'CRC') }}</span></div>\n              </div>\n              <div class="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--dh-primary-rgb)/0.2)] bg-[rgb(var(--dh-primary-rgb)/0.07)] px-4 py-4">\n                <strong class="text-base">Total</strong>\n                <div class="text-right"><strong class="block text-lg text-[var(--dh-primary)]">{{ formatMoney(totalSaleUsd, 'USD') }}</strong><span class="text-[10px] font-black text-[var(--dh-primary)]">{{ formatMoney(totalSaleCrc, 'CRC') }}</span></div>\n              </div>\n            </div>\n            <div class="mt-4 hidden overflow-x-auto rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] md:block">\n              <div class="min-w-[520px]">`
  code = replaceOne(code, totalsAnchor, totalsReplacement, 'responsive offer totals')

  return code
}

export function pricingWizardScreen09LclFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-screen09-lcl-fix',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}