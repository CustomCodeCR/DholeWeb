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
