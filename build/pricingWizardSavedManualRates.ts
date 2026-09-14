import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardSavedManualRates] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// dhole-saved-manual-rates-state')) return code

  const stateAnchor = `const availableRates = ref<ImportRateSelectDto[]>([])`
  const stateReplacement = `${stateAnchor}
// dhole-saved-manual-rates-state
const availableSavedManualRates = ref<RateDto[]>([])
const selectedSavedManualRateId = ref('')
const selectedSavedManualRate = computed(() =>
  availableSavedManualRates.value.find((rate) => rate.id === selectedSavedManualRateId.value) ?? null,
)`
  code = replaceRequired(code, stateAnchor, stateReplacement, 'saved manual rate state')

  const importedSearchAnchor = `async function searchApprovedRates() {`
  code = replaceRequired(
    code,
    importedSearchAnchor,
    `async function searchImportedApprovedRates() {`,
    'approved rate search function',
  )

  const chooseRateAnchor = `function chooseRate(rate: ImportRateSelectDto) {`
  const helpers = `function savedManualRateFreight(rate: RateDto) {
  return rate.rateDetails.find((detail) => detail.costDetailType === 'Freight') ?? null
}

function savedManualRateCurrency(rate: RateDto) {
  return rate.currencyCode || rate.currencyName || savedManualRateFreight(rate)?.currencyCode || 'USD'
}

function savedManualRateContainerLabel(rate: RateDto) {
  if (rate.containers?.length) {
    return rate.containers
      .map((container) => \`${'${container.quantity}'} × ${'${container.containerTypeName || container.containerTypeCode}'}\`)
      .join(' + ')
  }
  return rate.containerTypeName || rate.containerTypeCode || 'Equipo'
}

function savedManualRateTransitDays(rate: RateDto) {
  const match = String(rate.transitTime ?? '').match(/\\d+/)
  return match ? Number(match[0]) : 0
}

function savedManualRateComment(rate: RateDto) {
  const comments = rate.rateDetails
    .map((detail) => String(detail.notes ?? '').trim())
    .filter(Boolean)
  return [...new Set(comments)].join(' | ')
}

function savedManualRateMatchesContext(rate: RateDto) {
  // Pantalla 5 trata estas tarifas como alternativas oficiales guardadas. Las que
  // nacieron de una importación ya están cubiertas por selectImportRates y se
  // excluyen aquí para no duplicarlas.
  if (rate.sourceImportFclRateId) return false
  if (!['Open', 'ApprovedByManagement'].includes(rate.status)) return false
  if (rate.shipmentMode !== shipmentModeForApi.value) return false
  if (rate.polId !== form.originId || rate.poeId !== form.destinationId) return false

  // Igual que la búsqueda de tarifas importadas, POD solo restringe cuando el
  // usuario realmente seleccionó uno. No se filtra por Incoterm ni operationType
  // porque Pantalla 5 debe presentar todas las alternativas tarifarias vigentes
  // para la ruta/equipo y dejar la composición comercial para las pantallas siguientes.
  if (form.podId && rate.podId && rate.podId !== form.podId) return false

  const quoteDate = new Date(\`${'${form.loadDate}'}T12:00:00\`).getTime()
  const validFrom = new Date(rate.validFrom).getTime()
  const validTo = new Date(rate.validTo).getTime()
  if (Number.isFinite(quoteDate) && Number.isFinite(validFrom) && quoteDate < validFrom) return false
  if (Number.isFinite(quoteDate) && Number.isFinite(validTo) && quoteDate > validTo) return false

  if (rate.rateDetails.some((detail) => normalizeCatalogValue(detail.name).includes('solicitud pendiente de pricing'))) {
    return false
  }
  if (!rate.rateDetails.some((detail) => number(detail.costAmount) > 0 || number(detail.saleAmount) > 0)) return false

  if (shipmentModeForApi.value === 'Fcl') {
    if (fclContainerAllocations.value.length !== 1) return false
    const requirement = fclContainerAllocations.value[0]
    const containers = rate.containers?.length
      ? rate.containers
      : [{ containerTypeId: rate.containerTypeId, quantity: rate.containerQuantity }]
    return containers.some((container) => container.containerTypeId === requirement.containerTypeId)
  }

  if (shipmentModeForApi.value !== 'Lcl' && selectedEquipment.value?.id && rate.containerTypeId !== selectedEquipment.value.id) {
    return false
  }
  return true
}

async function searchSavedManualRates() {
  availableSavedManualRates.value = []
  selectedSavedManualRateId.value = ''

  if (!form.originId || !form.destinationId || !shipmentModeForApi.value) return

  try {
    const result = await PricingService.browseRates({
      pageNumber: 1,
      pageSize: 500,
      polId: form.originId,
      poeId: form.destinationId,
      quoteDate: form.loadDate,
    })
    availableSavedManualRates.value = result.items
      .filter(savedManualRateMatchesContext)
      .sort((left, right) => {
        const validityDays = remainingValidityDays(right.validTo) - remainingValidityDays(left.validTo)
        if (validityDays !== 0) return validityDays
        const validity = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
        if (validity !== 0) return validity
        const comment = rateCommentRank(savedManualRateComment(right)) - rateCommentRank(savedManualRateComment(left))
        if (comment !== 0) return comment
        const price = number(savedManualRateFreight(left)?.costAmount) - number(savedManualRateFreight(right)?.costAmount)
        if (price !== 0) return price
        return String(left.rateCode ?? left.id).localeCompare(String(right.rateCode ?? right.id), 'es')
      })
  } catch (error) {
    availableSavedManualRates.value = []
    toastStore.backendError(error, 'No se pudieron consultar las tarifas manuales guardadas.')
  }
}

async function searchApprovedRates() {
  availableSavedManualRates.value = []
  selectedSavedManualRateId.value = ''
  await searchImportedApprovedRates()

  try {
    loadingRates.value = true
    await searchSavedManualRates()
  } finally {
    loadingRates.value = false
  }

  if (availableSavedManualRates.value.length) form.manualRate = false
}

function chooseSavedManualRate(rate: RateDto) {
  const freight = savedManualRateFreight(rate)
  selectedSavedManualRateId.value = rate.id
  form.selectedImportRateId = ''
  form.manualRate = false
  selectedFclBundleKey.value = ''
  fclSelectedImportRateIds.value = {}

  form.freightCost = number(freight?.costAmount ?? 0)
  form.freightSale = number(freight?.saleAmount ?? freight?.costAmount ?? 0)
  form.freeDays = number(rate.freeDays)
  form.transitDays = savedManualRateTransitDays(rate)
  if (rate.validTo) form.validTo = rate.validTo.slice(0, 10)

  if (rate.agentId && catalogs.agents.some((item) => item.id === rate.agentId)) {
    form.agentId = rate.agentId
  } else if (rate.agentName) {
    const agent = catalogs.agents.find((item) => normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(rate.agentName ?? ''))
    if (agent) form.agentId = agent.id
  }

  if (rate.carrierId && catalogs.carriers.some((item) => item.id === rate.carrierId)) {
    form.carrierId = rate.carrierId
  } else if (rate.carrierName) {
    const carrier = catalogs.carriers.find((item) => normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(rate.carrierName ?? ''))
    if (carrier) form.carrierId = carrier.id
  }

  if (rate.currencyId && catalogs.currencies.some((item) => item.id === rate.currencyId)) {
    form.currencyId = rate.currencyId
  }

  step.value = 6
}

function hydrateSavedManualRateLines(rate: RateDto) {
  rateLines.value = rate.rateDetails.map((detail) => ({
    key: \`saved-manual:${'${rate.id}'}:${'${detail.id}'}\`,
    section: sectionForDetail(detail.costDetailType, detail.name),
    name: detail.name,
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    chargeBasis: detail.chargeBasis ?? defaultChargeBasis(detail.costDetailType),
    costId: detail.costId ?? null,
    notes: detail.notes?.trim() || null,
    billToClient: detail.billToClient?.trim() || null,
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    amountCurrencyCode: detail.currencyCode,
    costAmount: number(detail.costAmount),
    saleAmount: number(detail.saleAmount),
    included: true,
    optional: detail.costType === 'Optional',
    manual: !detail.costId,
    applyDestinationTax: Boolean(detail.applyDestinationTax),
    destinationTaxRate: number(detail.destinationTaxRate),
  }))

  rateLines.value.forEach((line) => enforceLineCurrency(line))
}

${chooseRateAnchor}`
  code = replaceRequired(code, chooseRateAnchor, helpers, 'manual rate helpers')

  // Choosing an imported rate or switching to a fully manual capture must clear a
  // previously selected saved manual tariff.
  code = code.replace(
    `function chooseRate(rate: ImportRateSelectDto) {\n`,
    `function chooseRate(rate: ImportRateSelectDto) {\n  selectedSavedManualRateId.value = ''\n`,
  )
  code = code.replace(
    `function continueManual() {\n`,
    `function continueManual() {\n  selectedSavedManualRateId.value = ''\n`,
  )

  const nextIndex = code.indexOf(`async function next() {`)
  if (nextIndex < 0) throw new Error('[pricingWizardSavedManualRates] next function not found.')
  const stepSixAnchor = `  if (step.value === 6) {`
  const stepSixIndex = code.indexOf(stepSixAnchor, nextIndex)
  if (stepSixIndex < 0) throw new Error('[pricingWizardSavedManualRates] step 6 transition not found.')
  const stepSixReplacement = `${stepSixAnchor}
    if (selectedSavedManualRate.value) {
      await loadApplicableCosts()
      hydrateSavedManualRateLines(selectedSavedManualRate.value)
      if (step.value < 8) step.value += 1
      return
    }`
  code = code.slice(0, stepSixIndex) + stepSixReplacement + code.slice(stepSixIndex + stepSixAnchor.length)

  const stepFiveIndex = code.indexOf(`<div v-else-if="step === 5"`)
  if (stepFiveIndex < 0) throw new Error('[pricingWizardSavedManualRates] screen 5 not found.')
  const loadingIfIndex = code.indexOf(`<div v-if="loadingRates`, stepFiveIndex)
  const loadingElseIfIndex = code.indexOf(`<div v-else-if="loadingRates`, stepFiveIndex)
  const loadingIndex = [loadingIfIndex, loadingElseIfIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? -1
  if (loadingIndex < 0) throw new Error('[pricingWizardSavedManualRates] screen 5 loading block not found.')

  const manualCards = `          <div v-if="!loadingRates && availableSavedManualRates.length" class="space-y-3">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p class="text-sm font-black">Tarifas manuales guardadas</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Se muestran todas las tarifas oficiales manuales vigentes que coinciden con POL, POE y equipo. Se ordenan por días disponibles, comentarios y precio.</p>
              </div>
              <DhBadge variant="primary">{{ availableSavedManualRates.length }} tarifa{{ availableSavedManualRates.length === 1 ? '' : 's' }}</DhBadge>
            </div>

            <div class="grid gap-4 xl:grid-cols-2">
              <button
                v-for="rate in availableSavedManualRates"
                :key="'saved-manual:' + rate.id"
                type="button"
                class="crystal-rate-card text-left"
                :class="selectedSavedManualRateId === rate.id ? 'crystal-rate-card--active' : ''"
                @click="chooseSavedManualRate(rate)"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p class="text-lg font-black">{{ rate.carrierName || rate.rateName || 'Tarifa manual' }}</p>
                    <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                      {{ rate.polName }} → {{ rate.poeName }}<template v-if="rate.podName"> → {{ rate.podName }}</template> · {{ savedManualRateContainerLabel(rate) }}
                    </p>
                    <p class="mt-1 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ rate.rateCode }} · {{ rate.rateName }}</p>
                  </div>
                  <DhBadge variant="success">{{ rate.status === 'ApprovedByManagement' ? 'Preaprobada manual' : 'Manual vigente' }}</DhBadge>
                </div>

                <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <span class="block text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Precio / flete</span>
                    <strong class="mt-1 block text-2xl">{{ formatMoney(savedManualRateFreight(rate)?.costAmount || 0, savedManualRateCurrency(rate)) }}</strong>
                  </div>
                  <div class="flex flex-col items-end gap-1 text-right">
                    <DhBadge :variant="validityTone(rate.validTo)">{{ remainingValidityDays(rate.validTo) }} días disponibles</DhBadge>
                    <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vigencia</span>
                    <strong class="block text-sm">{{ formatDate(rate.validFrom) }} – {{ formatDate(rate.validTo) }}</strong>
                  </div>
                </div>

                <div class="mt-3 rounded-xl border border-[var(--dh-border)] bg-black/[0.025] px-3 py-2 text-left text-xs text-[var(--dh-text-muted)] dark:bg-white/[0.04]">
                  <strong class="block font-black text-[var(--dh-text)]">Comentarios de la tarifa</strong>
                  <span class="mt-1 block whitespace-pre-line font-semibold">{{ savedManualRateComment(rate) || 'Sin comentarios registrados' }}</span>
                </div>
              </button>
            </div>
          </div>

`

  // Some earlier transforms turn the loading block into v-else-if as part of the
  // LCL selector chain. Insert the manual-rate cards before the chain starts so
  // Vue's v-if / v-else-if adjacency remains valid.
  const lclSelectorIndex = code.lastIndexOf(`<PricingLclRateSourceSelector`, loadingIndex)
  const insertionIndex = lclSelectorIndex >= stepFiveIndex ? lclSelectorIndex : loadingIndex
  code = code.slice(0, insertionIndex) + manualCards + code.slice(insertionIndex)

  // When the imported-rate engine has no candidates but a saved manual tariff was
  // found, do not render the contradictory empty-state panels underneath it.
  code = code.replace(
    `v-else-if="shipmentModeForApi === 'Fcl' && fclRateRequirements.length"`,
    `v-else-if="shipmentModeForApi === 'Fcl' && fclRateRequirements.length && !availableSavedManualRates.length"`,
  )

  const noRatesText = `No existen tarifas vigentes para esa ruta y equipo`
  const noRatesTextIndex = code.indexOf(noRatesText, stepFiveIndex)
  if (noRatesTextIndex >= 0) {
    const emptyDivIndex = code.lastIndexOf(`<div v-else class="crystal-empty`, noRatesTextIndex)
    if (emptyDivIndex >= stepFiveIndex) {
      code = code.slice(0, emptyDivIndex)
        + code.slice(emptyDivIndex).replace(
          `<div v-else class="crystal-empty`,
          `<div v-else-if="!availableSavedManualRates.length" class="crystal-empty`,
        )
    }
  }

  return code
}

export function pricingWizardSavedManualRates(): Plugin {
  return {
    name: 'dhole-pricing-wizard-saved-manual-rates',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
