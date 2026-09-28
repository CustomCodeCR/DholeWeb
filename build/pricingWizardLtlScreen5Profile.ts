import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardLtlScreen5Profile] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchLtlState(source: string) {
  let code = source

  code = replaceOnce(
    code,
    "const landLtlCommercialProfile = ref<LandCommercialProfile>('FinalClient')",
    "const landLtlCommercialProfile = ref<LandCommercialProfile | ''>('')",
    'LTL profile state',
  )

  code = replaceOnce(
    code,
    "    const isLandLtl = shipmentModeForApi.value === 'Ltl'\n    const equipmentClass = isLandLtl ? 'LTL_CBM' : (() => {",
    "    const isLandLtl = shipmentModeForApi.value === 'Ltl'\n\n    if (isLandLtl && !landLtlCommercialProfile.value) {\n      form.manualRate = false\n      form.freightCost = 0\n      form.freightSale = 0\n      form.transitDays = 0\n      return\n    }\n\n    const equipmentClass = isLandLtl ? 'LTL_CBM' : (() => {",
    'LTL profile-first lookup guard',
  )

  const canNextAnchor = "  if (step.value === 5) return Boolean(form.selectedImportRateId || form.manualRate || availableRates.value.length === 0)"
  code = replaceOnce(
    code,
    canNextAnchor,
    "  if (step.value === 5 && shipmentModeForApi.value === 'Ltl') return Boolean(landLtlCommercialProfile.value && resolvedFtlTariff.value)\n" + canNextAnchor,
    'LTL step 5 validation',
  )

  return code
}

function patchStep5(source: string) {
  const startTag = '<div v-else-if="step === 5" class="space-y-6">'
  const nextTag = '<div v-else-if="step === 6" class="space-y-6">'
  const start = source.indexOf(startTag)
  if (start < 0) throw new Error('[pricingWizardLtlScreen5Profile] Pantalla 5 start not found.')

  const next = source.indexOf(nextTag, start + startTag.length)
  if (next < 0) throw new Error('[pricingWizardLtlScreen5Profile] Pantalla 6 start not found.')

  const currentBlock = source.slice(start, next)
  const lastClose = currentBlock.lastIndexOf('</div>')
  if (lastClose < 0) throw new Error('[pricingWizardLtlScreen5Profile] Pantalla 5 closing div not found.')

  const existingInner = currentBlock.slice(startTag.length, lastClose)

  const replacement = `${startTag}
          <template v-if="shipmentModeForApi === 'Ltl'">
            <div>
              <p class="crystal-kicker">Pantalla 5</p>
              <h2 class="crystal-title">Seleccione la tarifa LTL</h2>
              <p class="crystal-description">
                La ruta y los datos de carga ya están definidos. Seleccione Cliente o NVOCC para calcular la tarifa.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                class="crystal-choice min-h-[96px] text-left"
                :class="landLtlCommercialProfile === 'FinalClient' ? 'crystal-choice--active' : ''"
                :disabled="loadingRates"
                @click="chooseLandLtlCommercialProfile('FinalClient')"
              >
                <strong class="block text-base">Cliente</strong>
                <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">
                  Usa el Consolidado Cliente de la matriz LTL.
                </span>
              </button>

              <button
                type="button"
                class="crystal-choice min-h-[96px] text-left"
                :class="landLtlCommercialProfile === 'Nvocc' ? 'crystal-choice--active' : ''"
                :disabled="loadingRates"
                @click="chooseLandLtlCommercialProfile('Nvocc')"
              >
                <strong class="block text-base">NVOCC</strong>
                <span class="mt-1 block text-xs font-semibold text-[var(--dh-text-muted)]">
                  Usa el Consolidado NVOCC de la matriz LTL.
                </span>
              </button>
            </div>

            <div v-if="!landLtlCommercialProfile" class="crystal-soft px-5 py-6 text-center">
              <p class="font-black">Seleccione Cliente o NVOCC</p>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
                La tarifa se consulta automáticamente para la ruta de la cotización.
              </p>
            </div>

            <div v-else-if="loadingRates" class="py-12 text-center text-sm font-semibold text-[var(--dh-text-muted)]">
              Calculando tarifa LTL…
            </div>

            <div v-else-if="resolvedFtlTariff" class="space-y-4">
              <div class="crystal-rate-card crystal-rate-card--active text-left">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="font-black">
                      {{ landLtlCommercialProfile === 'Nvocc' ? 'Tarifa NVOCC' : 'Tarifa Cliente' }}
                    </p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                      {{ resolvedFtlTariff.originName }} → {{ resolvedFtlTariff.destinationName }}
                    </p>
                  </div>
                  <DhBadge variant="success">Tarifario LTL</DhBadge>
                </div>

                <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Venta / CBM</span>
                    <strong class="mt-1 block text-lg">
                      {{ formatMoney(resolvedFtlTariff.priceAmount, resolvedFtlTariff.currencyCode || 'USD') }}
                    </strong>
                  </div>
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Mínimo</span>
                    <strong class="mt-1 block text-lg">
                      {{ formatMoney(resolvedFtlTariff.minimumAmount || 0, resolvedFtlTariff.currencyCode || 'USD') }}
                    </strong>
                  </div>
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">CBM tarifado</span>
                    <strong class="mt-1 block text-lg">{{ landLtlBillableCbm(resolvedFtlTariff).toFixed(3) }}</strong>
                    <small class="mt-1 block text-[var(--dh-text-muted)]">{{ number(resolvedFtlTariff.weightKgPerCbm || 330) }} kg/CBM</small>
                  </div>
                  <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tránsito</span>
                    <strong class="mt-1 block text-lg">
                      {{ resolvedFtlTariff.transitDays != null ? resolvedFtlTariff.transitDays + ' días' : 'Por confirmar' }}
                    </strong>
                  </div>
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <div class="crystal-metric crystal-metric--cost">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em]">Costo calculado</span>
                    <strong class="mt-1 block text-xl">
                      {{ formatMoney(form.freightCost, resolvedFtlTariff.currencyCode || 'USD') }}
                    </strong>
                    <small>Incluye costo/CBM, Stuffing, DUA, DUCA-T y recargo Panamá cuando corresponda.</small>
                  </div>
                  <div class="crystal-metric crystal-metric--sale">
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em]">Venta calculada</span>
                    <strong class="mt-1 block text-xl">
                      {{ formatMoney(form.freightSale, resolvedFtlTariff.currencyCode || 'USD') }}
                    </strong>
                    <small>Aplica el mayor entre CBM × venta y mínimo, más Stuffing de venta.</small>
                  </div>
                </div>

                <p v-if="resolvedFtlTariff.warehouseName" class="mt-3 text-xs font-bold text-[var(--dh-text-muted)]">
                  Almacén: {{ resolvedFtlTariff.warehouseName }}
                </p>
              </div>

              <div class="flex justify-end">
                <DhButton :disabled="lclChargeableCbm <= 0" @click="next">Usar tarifa LTL y continuar</DhButton>
              </div>
            </div>

            <div v-else class="crystal-empty p-8 text-center">
              <p class="text-lg font-black">No existe tarifa LTL para esta combinación</p>
              <p class="mt-2 text-sm font-semibold text-[var(--dh-text-muted)]">
                No se encontró una tarifa activa de
                {{ landLtlCommercialProfile === 'Nvocc' ? 'NVOCC' : 'Cliente' }}
                para la ruta y fecha seleccionadas.
              </p>
              <p class="mt-2 text-xs font-bold text-[var(--dh-text-muted)]">
                Configure la ruta en Consolidados propios → LTL y vuelva a seleccionar el perfil.
              </p>
            </div>
          </template>

          <template v-else>
${existingInner}
          </template>
        </div>

        `

  return source.slice(0, start) + replacement + source.slice(next)
}

function patchWizard(source: string) {
  let code = patchLtlState(source)
  code = patchStep5(code)
  return code
}

export function pricingWizardLtlScreen5Profile(): Plugin {
  return {
    name: 'dhole-pricing-wizard-ltl-screen5-profile',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
