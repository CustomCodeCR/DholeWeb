import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardPanamaContinuation] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// dhole-panama-screen5-ab')) return code

  // POD terminal type follows the continuation selected on Pantalla 3:
  // MaritimeLand => SD, DoubleMaritime => CY.
  code = replaceRequired(
    code,
    `const maritimePodCatalog = computed(() => routeItemsByTerminal(catalogs.pod, 'SD', 'SD'))`,
    `const maritimeLandPodCatalog = computed(() => routeItemsByTerminal(catalogs.pod, 'SD', 'SD'))
const doubleMaritimePodCatalog = computed(() => routeItemsByTerminal(catalogs.pod, 'CY', 'SD'))
const maritimePodCatalog = computed(() =>
  isPanamaMultimodal.value && form.panamaContinuationMode === 'DoubleMaritime'
    ? doubleMaritimePodCatalog.value
    : maritimeLandPodCatalog.value,
)`,
    'dynamic Panama POD catalog',
  )

  code = replaceRequired(
    code,
    `terminal-type="SD"
                :optional="true"
                :options="podOptions"`,
    `:terminal-type="isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime' ? 'CY' : 'SD'"
                :optional="true"
                :options="podOptions"`,
    'dynamic Panama POD terminal badge',
  )

  // Remap an already selected POD when the user toggles SD <-> CY.
  const resetAnchor = `function resetWizard() {`
  const terminalWatcher = `// dhole-panama-screen5-ab
watch(
  () => form.panamaContinuationMode,
  (mode) => {
    if (!isPanamaMultimodal.value) return
    if (mode !== 'DoubleMaritime' && mode !== 'MaritimeLand') return

    const currentPod = findById(catalogs.pod, form.podId)
    if (!currentPod) return

    const targetCatalog = mode === 'DoubleMaritime'
      ? doubleMaritimePodCatalog.value
      : maritimeLandPodCatalog.value
    const equivalentPod = findEquivalent(targetCatalog, currentPod)
    form.podId = equivalentPod?.id ?? ''
  },
)

${resetAnchor}`
  code = replaceRequired(code, resetAnchor, terminalWatcher, 'Panama terminal mode watcher')

  // Pantalla 5 in double-maritime mode must be complete only after both legs are selected.
  const canNextStart = code.indexOf(`const canNext = computed(() => {`)
  if (canNextStart < 0) {
    throw new Error('[pricingWizardPanamaContinuation] canNext block not found.')
  }
  const genericStepFive = code.indexOf(`  if (step.value === 5`, canNextStart)
  if (genericStepFive < 0) {
    throw new Error('[pricingWizardPanamaContinuation] generic Pantalla 5 validation not found.')
  }
  const doubleMaritimeGuard = `  if (
    step.value === 5
    && isPanamaMultimodal.value
    && form.panamaContinuationMode === 'DoubleMaritime'
  ) {
    return Boolean(form.selectedImportRateId && form.selectedContinuationImportRateId)
  }
`
  code = code.slice(0, genericStepFive) + doubleMaritimeGuard + code.slice(genericStepFive)

  // Bottom "Atrás" on 5B returns to 5A instead of jumping to Pantalla 4.
  code = replaceRequired(
    code,
    `function previous() {`,
    `function previous() {
  if (
    step.value === 5
    && isPanamaMultimodal.value
    && form.panamaContinuationMode === 'DoubleMaritime'
    && panamaDoubleMaritimeStage.value === 'B'
  ) {
    returnToPanamaFirstLeg()
    return
  }`,
    'Pantalla 5B previous navigation',
  )

  const screenFiveStart = code.indexOf(`<div v-else-if="step === 5"`)
  if (screenFiveStart < 0) throw new Error('[pricingWizardPanamaContinuation] Pantalla 5 not found.')

  let screenSixStart = code.indexOf(`<div v-else-if="step === 6"`, screenFiveStart)
  if (screenSixStart < 0) throw new Error('[pricingWizardPanamaContinuation] Pantalla 6 not found.')

  const kicker = `<p class="crystal-kicker">Pantalla 5</p>`
  const kickerIndex = code.indexOf(kicker, screenFiveStart)
  if (kickerIndex < 0 || kickerIndex > screenSixStart) {
    throw new Error('[pricingWizardPanamaContinuation] Pantalla 5 kicker not found.')
  }
  code = code.slice(0, kickerIndex)
    + `<p class="crystal-kicker">{{ isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime' ? 'Pantalla 5' + panamaDoubleMaritimeStage : 'Pantalla 5' }}</p>`
    + code.slice(kickerIndex + kicker.length)

  screenSixStart = code.indexOf(`<div v-else-if="step === 6"`, screenFiveStart)
  const headerCloseMarker = '          </div>'
  const updatedKickerIndex = code.indexOf(`<p class="crystal-kicker">`, screenFiveStart)
  const headerClose = code.indexOf(headerCloseMarker, updatedKickerIndex)
  if (headerClose < 0 || headerClose > screenSixStart) {
    throw new Error('[pricingWizardPanamaContinuation] Pantalla 5 header close not found.')
  }
  const headerInsertion = headerClose + headerCloseMarker.length

  const stageNavigator = `

          <div
            v-if="isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime'"
            class="grid gap-2 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.18)] bg-[rgb(var(--dh-primary-rgb)/0.04)] p-2 sm:grid-cols-[1fr_auto_1fr]"
          >
            <button
              type="button"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition"
              :class="panamaDoubleMaritimeStage === 'A'
                ? 'bg-[rgb(var(--dh-primary-rgb)/0.14)] ring-1 ring-[rgb(var(--dh-primary-rgb)/0.36)]'
                : 'hover:bg-[rgb(var(--dh-primary-rgb)/0.07)]'"
              @click="returnToPanamaFirstLeg"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[rgb(var(--dh-primary-rgb)/0.12)] text-xs font-black text-[var(--dh-primary)]">5A</span>
              <span class="min-w-0">
                <strong class="block text-sm">POL → POE</strong>
                <span class="mt-0.5 block truncate text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ displayValue(selectedOrigin) || 'POL' }} → {{ selectedImportRate?.poe || 'POE Panamá' }}
                </span>
              </span>
            </button>

            <div class="hidden items-center text-[var(--dh-text-muted)] sm:flex">→</div>

            <button
              type="button"
              class="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45"
              :class="panamaDoubleMaritimeStage === 'B'
                ? 'bg-[rgb(var(--dh-primary-rgb)/0.14)] ring-1 ring-[rgb(var(--dh-primary-rgb)/0.36)]'
                : 'hover:bg-[rgb(var(--dh-primary-rgb)/0.07)]'"
              :disabled="!selectedImportRate"
              @click="openPanamaSecondLeg"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[rgb(var(--dh-primary-rgb)/0.12)] text-xs font-black text-[var(--dh-primary)]">5B</span>
              <span class="min-w-0">
                <strong class="block text-sm">POE → POD</strong>
                <span class="mt-0.5 block truncate text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ selectedImportRate?.poe || 'POE Panamá' }} → {{ displayValue(selectedPod) || 'POD final' }}
                </span>
              </span>
            </button>
          </div>`

  code = code.slice(0, headerInsertion) + stageNavigator + code.slice(headerInsertion)

  // Everything already rendered by Pantalla 5 belongs to 5A. Hide it while 5B is active.
  const firstLegStart = headerInsertion + stageNavigator.length
  code = code.slice(0, firstLegStart)
    + `
          <div
            v-if="!(isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime' && panamaDoubleMaritimeStage === 'B')"
            class="contents"
          >`
    + code.slice(firstLegStart)

  screenSixStart = code.indexOf(`<div v-else-if="step === 6"`, firstLegStart)
  const screenFiveOuterClose = code.lastIndexOf('\n        </div>', screenSixStart)
  if (screenFiveOuterClose < 0 || screenFiveOuterClose < firstLegStart) {
    throw new Error('[pricingWizardPanamaContinuation] Pantalla 5 outer close not found.')
  }

  const secondLegPanel = `
          </div>

          <div
            v-if="isPanamaMultimodal && form.panamaContinuationMode === 'DoubleMaritime' && panamaDoubleMaritimeStage === 'B'"
            data-panama-screen-5b
            class="space-y-5"
          >
            <div class="flex flex-col gap-3 rounded-2xl border border-[rgb(var(--dh-primary-rgb)/0.20)] bg-[rgb(var(--dh-primary-rgb)/0.05)] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--dh-primary)]">Pantalla 5B · Segundo tramo marítimo</p>
                <h3 class="mt-1 text-lg font-black">Tarifas desde el POE hasta el POD</h3>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  El POE de la tarifa escogida en 5A se convierte en el POL de este segundo tramo.
                </p>
              </div>
              <DhButton type="button" variant="secondary" @click="returnToPanamaFirstLeg">
                Cambiar tarifa 5A
              </DhButton>
            </div>

            <div v-if="selectedImportRate" class="grid gap-3 md:grid-cols-3">
              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
                <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">POL original</span>
                <strong class="mt-1 block text-sm">{{ displayValue(selectedOrigin) || selectedImportRate.pol }}</strong>
              </div>
              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
                <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">POE / nuevo POL</span>
                <strong class="mt-1 block text-sm">{{ selectedImportRate.poe || selectedImportRate.pod || 'Panamá' }}</strong>
              </div>
              <div class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3">
                <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">POD final</span>
                <strong class="mt-1 block text-sm">{{ displayValue(selectedPod) || 'POD' }}</strong>
              </div>
            </div>

            <div v-if="loadingContinuationRates" class="py-14 text-center">
              <p class="text-sm font-black">Buscando tarifas POE → POD…</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Validando equipo, vigencia y destino final.</p>
            </div>

            <template v-else-if="sortedContinuationRates.length">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-sm font-black">{{ sortedContinuationRates.length }} tarifa{{ sortedContinuationRates.length === 1 ? '' : 's' }} para el segundo tramo</p>
                  <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione la tarifa que llevará la carga desde Panamá hasta el POD.</p>
                </div>
                <DhBadge variant="primary">5B · POE → POD</DhBadge>
              </div>

              <div class="grid gap-4 lg:grid-cols-2">
                <button
                  v-for="rate in sortedContinuationRates"
                  :key="'panama-5b:' + rate.id"
                  type="button"
                  class="crystal-rate-card text-left"
                  :class="form.selectedContinuationImportRateId === rate.id ? 'crystal-rate-card--active' : ''"
                  @click="chooseContinuationRate(rate)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-black">{{ rate.carrier || 'Naviera' }}</p>
                      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                        {{ rate.pol }} → {{ rate.poe || rate.pod }} · {{ rate.containerType }}
                      </p>
                    </div>
                    <DhBadge :variant="rate.status === 'PreAuthorized' ? 'warning' : 'success'">
                      {{ rate.status === 'PreAuthorized' ? 'Preautorizada' : 'Preaprobada' }}
                    </DhBadge>
                  </div>

                  <p class="mt-5 text-2xl font-black">
                    {{ formatMoney(rate.oceanFreight ?? rate.freight, displayValue(findById(catalogs.currencies, rate.currencyId)) || rate.currency || 'USD') }}
                  </p>
                  <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
                    Vigencia {{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}
                    <template v-if="rate.transitDays"> · {{ rate.transitDays }} días</template>
                  </p>
                  <p v-if="rate.spaceComment" class="mt-3 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold text-[var(--dh-text-muted)]">
                    Comentario: {{ rate.spaceComment }}
                  </p>
                  <p class="mt-3 text-[11px] font-bold text-[var(--dh-text-muted)]">Fuente: {{ importSourceTitle(rate) }}</p>
                </button>
              </div>
            </template>

            <div v-else class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
              <p class="font-black">No hay tarifas vigentes para el tramo POE → POD</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                No se encontró un segundo flete marítimo compatible con el POE seleccionado en 5A, el POD final, el equipo y la fecha de carga.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <DhButton type="button" variant="secondary" @click="returnToPanamaFirstLeg">Volver a 5A</DhButton>
                <DhButton
                  v-if="selectedImportRate"
                  type="button"
                  variant="secondary"
                  :disabled="loadingContinuationRates"
                  @click="openPanamaSecondLeg"
                >
                  Reintentar
                </DhButton>
              </div>
            </div>
          </div>
`

  code = code.slice(0, screenFiveOuterClose) + secondLegPanel + code.slice(screenFiveOuterClose)

  return code
}

export function pricingWizardPanamaContinuation(): Plugin {
  return {
    name: 'dhole-pricing-wizard-panama-continuation',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
