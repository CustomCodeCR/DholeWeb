import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, before: string, after: string, label: string): string {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error('[pricingWizardStep5ValidityComments] ' + label + ': expected 1 anchor, found ' + count)
  return source.replace(before, after)
}

function wrapSelectableCard(source: string, listName: string, replacementList: string, onSelect: string): string {
  const marker = 'v-for="' + listName + '"'
  const index = source.indexOf(marker)
  if (index < 0 || source.indexOf(marker, index + marker.length) >= 0) throw new Error('Missing/duplicate rate card: ' + listName)
  const start = source.lastIndexOf('<button', index)
  const end = source.indexOf('>', index)
  if (start < 0 || end < 0 || index - start > 150) throw new Error('Missing rate card opening tag: ' + listName)
  const original = source.slice(start, end + 1)
  const selectAttr = '@click="' + onSelect + '"'
  if (!original.includes('type="button"') || !original.includes(selectAttr)) {
    throw new Error('Unsupported rate card markup: ' + listName)
  }
  const opening = original
    .replace('<button', '<div')
    .replace(marker, 'v-for="' + replacementList + '"')
    .replace('type="button"', 'role="button" tabindex="0"')
    .replace(selectAttr, selectAttr + '\n                @keydown.enter.self="' + onSelect + '"\n                @keydown.space.self.prevent="' + onSelect + '"')
  let code = source.slice(0, start) + opening + source.slice(end + 1)
  // The card is the only button in its original body. Close it before inserting
  // the independent comment-toggle buttons to avoid nested interactive markup.
  const closing = '\n              </button>'
  const closeIndex = code.indexOf(closing, start + opening.length)
  if (closeIndex < 0) throw new Error('Missing rate card closing tag: ' + listName)
  code = code.slice(0, closeIndex) + '\n              </div>' + code.slice(closeIndex + closing.length)
  return code
}

export function patchPricingWizardStep5ValidityComments(source: string): string {
  let code = source

  const state = 'const rateCarrierFilter = ref(\'\')'
  const logic = `
const step5ValidityFrom = ref('')
const step5ValidityTo = ref('')
const step5ExpandedComments = reactive<Record<string, boolean>>({})

// A source alternative is still represented by its group's single card.
// Highlight a card ONLY when its exact source rate was chosen on this POE.
type Step5CarrierCard = FclRateBundle & {
  groupedAlternatives: FclRateBundle[]
  alternativeOffers: Array<FclRateBundle & { groupedAlternatives: FclRateBundle[] }>
  offerCount: number
  sourceRecordCount: number
}
// Selection means an exact source RateId for every equipment on this POE.
// Simply adding a carrier to the list of planned navieras MUST NOT paint
// all its unrelated rates as preselected.
function step5IsBundleSelected(bundle: Step5CarrierCard): boolean {
  const options = [bundle, ...bundle.alternativeOffers]
    .flatMap((offer) => [offer, ...offer.groupedAlternatives])
  return options.some((option) => step5IsSelectedOffer(option))
}

// A specific offer must match the original RateId, not merely the carrier.
function step5IsSelectedOffer(offer: FclRateBundle): boolean {
  if (!multiCarrierSelectionMode.value) {
    return selectedFclBundleKey.value === offer.key
      && offer.lines.every((line) => fclSelectedImportRateIds.value[line.containerTypeId] === line.rate.id)
  }
  const catalogId = resolveConfiguredCarrierId(offer.carrierId, offer.carrier)
  if (!catalogId) return false
  const selected = selectedFclBundlesByOption.value[carrierRouteKey(form.destinationId, catalogId)]
  return Boolean(selected && selected.bundleKey === offer.key
    && offer.lines.every((line) => selected.rateIds[line.containerTypeId] === line.rate.id))
}

const step5InvalidDateRange = computed(() =>
  Boolean(step5ValidityFrom.value && step5ValidityTo.value && step5ValidityFrom.value > step5ValidityTo.value),
)

// Filters only the displayed supplier rate validity. Does NOT change form.loadDate
// or request another API query: the backend already loads rates for the shipment date.
function step5RateMatchesDates(validFrom: string | null | undefined, validTo: string | null | undefined): boolean {
  const from = String(validFrom ?? '').slice(0, 10)
  const to = String(validTo ?? '').slice(0, 10)
  if (!step5ValidityFrom.value && !step5ValidityTo.value) return true
  if (step5InvalidDateRange.value || (!from && !to) || (from && to && from > to)) return false
  if (step5ValidityFrom.value && to && to < step5ValidityFrom.value) return false
  if (step5ValidityTo.value && from && from > step5ValidityTo.value) return false
  return true
}

function step5ClearDates() {
  step5ValidityFrom.value = ''
  step5ValidityTo.value = ''
}

function step5ToggleComment(key: string) {
  step5ExpandedComments[key] = !step5ExpandedComments[key]
}

const step5VisibleAvailableRates = computed(() =>
  sortedAvailableRates.value.filter((rate) => step5RateMatchesDates(rate.validFrom, rate.validTo)),
)
// Deduplicate AFTER the FCL combination engine, carrier filter and date filter.
// Only the final visible cards reflect the commercial offer the customer sees.
const step5VisibleFclRateBundles = computed(() =>
  groupFclCarrierCards(uniqueVisibleFclBundles(
    visibleFclRateBundles.value.filter((bundle) => step5RateMatchesDates(bundle.validFrom, bundle.validTo)),
  )),
)
const step5UniqueFclBundleCount = computed(() =>
  groupFclCarrierCards(uniqueVisibleFclBundles(visibleFclRateBundles.value)).length,
)
`
  code = replaceOnce(code, state, state + logic, 'date and comment state')

  // A grouped source can be chosen independently, while its displayed card
  // continues to show the selection ring and the selected badge.
  code = code.replaceAll(
    'multiCarrierSelectionMode ? isSelectedFclBundle(bundle.carrierId, bundle.carrier, bundle.key) : selectedFclBundleKey === bundle.key',
    'step5IsBundleSelected(bundle)',
  )
  code = code.replaceAll(
    'multiCarrierSelectionMode && isSelectedFclBundle(bundle.carrierId, bundle.carrier, bundle.key)',
    'multiCarrierSelectionMode && step5IsBundleSelected(bundle)',
  )

  code = wrapSelectableCard(code, 'bundle in visibleFclRateBundles', 'bundle in step5VisibleFclRateBundles', 'chooseFclRateBundle(bundle)')
  code = wrapSelectableCard(code, 'rate in sortedAvailableRates', 'rate in step5VisibleAvailableRates', 'chooseRate(rate)')

  code = replaceOnce(code, 'v-if="!visibleFclRateBundles.length"', 'v-if="!step5VisibleFclRateBundles.length"', 'FCL filtered empty state')
  code = replaceOnce(code, 'v-if="!sortedAvailableRates.length"', 'v-if="!step5VisibleAvailableRates.length"', 'single filtered empty state')

  const dateFields = `
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <DhInput v-model="step5ValidityFrom" type="date" label="Vigencia desde" />
                <DhInput v-model="step5ValidityTo" type="date" label="Vigencia hasta" :min="step5ValidityFrom || undefined" />
                <DhButton type="button" variant="secondary" :disabled="!step5ValidityFrom && !step5ValidityTo" @click="step5ClearDates">Limpiar fechas</DhButton>
              </div>
              <p v-if="step5InvalidDateRange" class="text-xs font-bold text-red-500" role="alert">La fecha final no puede ser anterior a la inicial.</p>`
  // Within the FCL filter panel, insert dates directly below the carrier selector.
  const fclSection = '<template v-else-if="shipmentModeForApi === \'Fcl\' && fclRateBundles.length">'
  const start = code.indexOf(fclSection)
  const description = '              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">'
  const insertion = code.indexOf(description, start)
  if (start < 0 || insertion < 0 || insertion - start > 4500) throw new Error('Missing FCL filter panel')
  code = code.slice(0, insertion) + dateFields + '\n' +
    '              <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ step5VisibleFclRateBundles.length }} de {{ step5UniqueFclBundleCount }} navieras disponibles · ofertas diferentes dentro de cada naviera.</p>\n' +
    code.slice(insertion)

  // The single-rate selection has its own carrier bar, so date fields are
  // shared controls immediately below that bar.
  const singleEmptyState = '            <div v-if="!step5VisibleAvailableRates.length" class="crystal-empty p-7 text-center">'
  code = replaceOnce(code, singleEmptyState,
    '            <div class="crystal-soft space-y-3 p-4">' + dateFields + '\n' +
    '              <p class="text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ step5VisibleAvailableRates.length }} de {{ sortedAvailableRates.length }} tarifas en el rango seleccionado.</p>\n' +
    '            </div>\n\n' + singleEmptyState, 'single-rate date controls')

  // Group visually identical offers, but retain source selection on demand.
  // Show every different price/condition under its carrier rather than
  // rendering a second MSC/PIL card. Identical imported sources remain in
  // the separate disclosure and never masquerade as new commercial offers.
  const alternativeOffers = `
                <div v-if="bundle.alternativeOffers.length" class="mt-3 rounded-lg border border-[var(--dh-border)] px-3 py-2">
                  <button type="button" class="flex w-full items-center justify-between gap-2 text-left text-xs font-bold"
                    :aria-expanded="Boolean(step5ExpandedComments['offers:' + bundle.key])"
                    @click.stop="step5ToggleComment('offers:' + bundle.key)">
                    <span>Otras ofertas de {{ bundle.carrier }} ({{ bundle.alternativeOffers.length }})</span>
                    <ChevronRight class="h-4 w-4 transition-transform" :class="step5ExpandedComments['offers:' + bundle.key] ? 'rotate-90' : ''" />
                  </button>
                  <div v-if="step5ExpandedComments['offers:' + bundle.key]" class="mt-2 grid gap-2">
                    <div v-for="alternative in bundle.alternativeOffers" :key="'offer:' + alternative.key"
                      class="rounded-lg border border-[var(--dh-border)] p-2">
                      <button type="button" class="w-full text-left text-xs font-bold"
                        :aria-pressed="step5IsSelectedOffer(alternative)"
                        @click.stop="chooseFclRateBundle(alternative)">
                        {{ formatMoney(alternative.totalCost, alternative.currency) }} · {{ alternative.freeDays || 0 }} días libres
                        · {{ formatDate(alternative.validFrom) }} – {{ formatDate(alternative.validTo) }}
                        <span class="block text-[var(--dh-text-muted)]">{{ alternative.preAuthorized ? 'Preautorizada' : 'Preaprobada' }} · {{ alternative.agent || 'Sin agente asignado' }}</span>
                        <span v-if="step5IsSelectedOffer(alternative)" class="block text-[var(--dh-primary)]">Tarifa elegida</span>
                      </button>
                      <button v-if="alternative.groupedAlternatives.length" type="button"
                        class="mt-2 text-xs text-[var(--dh-text-muted)] underline"
                        @click.stop="step5ToggleComment('offer-sources:' + alternative.key)">
                        {{ alternative.groupedAlternatives.length }} registros equivalentes de origen
                      </button>
                      <div v-if="step5ExpandedComments['offer-sources:' + alternative.key]" class="mt-2 grid gap-1">
                        <button v-for="source in alternative.groupedAlternatives" :key="'offer-source:' + source.key"
                          type="button" class="rounded border border-[var(--dh-border)] px-2 py-1 text-left text-xs"
                          @click.stop="chooseFclRateBundle(source)">
                          {{ formatDate(source.validFrom) }} – {{ formatDate(source.validTo) }} · {{ formatMoney(source.totalCost, source.currency) }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
`
  code = replaceOnce(code, fclFooter, alternativeOffers + fclFooter, 'FCL carrier offers disclosure')

  const fclFooter = '                <div class="mt-4 flex flex-col gap-3 border-t border-[var(--dh-border)] pt-4 sm:flex-row sm:items-end sm:justify-between">'
  const groupedSources = `
                <div v-if="bundle.groupedAlternatives.length" class="mt-3 rounded-lg border border-[var(--dh-border)] px-3 py-2">
                  <button type="button" class="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold"
                    :aria-expanded="Boolean(step5ExpandedComments['sources:' + bundle.key])"
                    @click.stop="step5ToggleComment('sources:' + bundle.key)">
                    <span>{{ bundle.groupedAlternatives.length }} fuente{{ bundle.groupedAlternatives.length === 1 ? '' : 's' }} adicional{{ bundle.groupedAlternatives.length === 1 ? '' : 'es' }} agrupada{{ bundle.groupedAlternatives.length === 1 ? '' : 's' }}</span>
                    <ChevronRight class="h-4 w-4 transition-transform" :class="step5ExpandedComments['sources:' + bundle.key] ? 'rotate-90' : ''" />
                  </button>
                  <div v-if="step5ExpandedComments['sources:' + bundle.key]" class="mt-2 grid gap-2">
                    <button v-for="alternative in bundle.groupedAlternatives" :key="'source:' + alternative.key"
                      type="button" class="rounded-md border border-[var(--dh-border)] px-2 py-2 text-left text-xs font-semibold"
                      @click.stop="chooseFclRateBundle(alternative)">
                      {{ alternative.carrier }} · {{ formatMoney(alternative.totalCost, alternative.currency) }} ·
                      {{ formatDate(alternative.validFrom) }} – {{ formatDate(alternative.validTo) }}
                      <span v-if="alternative.transitDays !== bundle.transitDays" class="block">Tránsito: {{ alternative.transitDays }} días</span>
                    </button>
                  </div>
                </div>
`
  code = replaceOnce(code, fclFooter, groupedSources + fclFooter, 'FCL grouped rate alternatives')

  const fclComment = `<strong class="block font-black">Comentarios de la tarifa</strong>
                          <span class="mt-0.5 block whitespace-pre-line font-semibold">{{ line.rate.spaceComment || 'Sin observaciones registradas' }}</span>`
  const fclToggle = `<button type="button" class="flex w-full items-center justify-between gap-2 text-left font-black text-[var(--dh-text)]"
                            :aria-expanded="Boolean(step5ExpandedComments['fcl:' + bundle.key + ':' + line.containerTypeId])"
                            @click.stop="step5ToggleComment('fcl:' + bundle.key + ':' + line.containerTypeId)">
                            <span>Comentarios de la tarifa</span>
                            <ChevronRight class="h-4 w-4 shrink-0 transition-transform" :class="step5ExpandedComments['fcl:' + bundle.key + ':' + line.containerTypeId] ? 'rotate-90' : ''" />
                          </button>
                          <p v-if="step5ExpandedComments['fcl:' + bundle.key + ':' + line.containerTypeId]" class="mt-2 whitespace-pre-line break-words font-semibold">{{ line.rate.spaceComment || 'Sin observaciones registradas' }}</p>`
  code = replaceOnce(code, fclComment, fclToggle, 'FCL comment toggle')

  const singleComment = `<strong class="block font-black text-[var(--dh-text)]">Comentarios de la tarifa</strong>
                  <span class="mt-1 block whitespace-pre-line font-semibold">{{ rate.spaceComment || 'Sin comentarios registrados' }}</span>`
  const singleToggle = `<button type="button" class="flex w-full items-center justify-between gap-2 text-left font-black text-[var(--dh-text)]"
                    :aria-expanded="Boolean(step5ExpandedComments['single:' + rate.id])"
                    @click.stop="step5ToggleComment('single:' + rate.id)">
                    <span>Comentarios de la tarifa</span>
                    <ChevronRight class="h-4 w-4 shrink-0 transition-transform" :class="step5ExpandedComments['single:' + rate.id] ? 'rotate-90' : ''" />
                  </button>
                  <p v-if="step5ExpandedComments['single:' + rate.id]" class="mt-2 whitespace-pre-line break-words font-semibold">{{ rate.spaceComment || 'Sin comentarios registrados' }}</p>`
  code = replaceOnce(code, singleComment, singleToggle, 'single-rate comment toggle')

  // Distinguish dates from carrier-only empty results without hiding all rates.
  code = replaceOnce(code, 'No hay combinaciones completas para las navieras seleccionadas',
    '{{ step5ValidityFrom || step5ValidityTo ? "No hay combinaciones para ese rango de vigencia" : "No hay combinaciones completas para las navieras seleccionadas" }}',
    'FCL empty label')
  code = replaceOnce(code, 'No hay tarifas para la naviera seleccionada',
    '{{ step5ValidityFrom || step5ValidityTo ? "No hay tarifas para ese rango de vigencia" : "No hay tarifas para la naviera seleccionada" }}',
    'single-rate empty label')

  return code
}

export function pricingWizardStep5ValidityComments(): Plugin {
  return {
    name: 'dhole-pricing-wizard-step5-validity-comments',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchPricingWizardStep5ValidityComments(source), map: null }
    },
  }
}
