import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardFclRateBundles] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const stateAnchor = `const rateCarrierFilter = ref('')`
  const stateReplacement = `const rateCarrierFilter = ref('')

type FclRateBundleLine = {
  containerTypeId: string
  containerTypeName: string
  containerTypeCode: string
  quantity: number
  rate: ImportRateSelectDto
  unitCost: number
  unitSale: number
  totalCost: number
  totalSale: number
}

type FclRateBundle = {
  key: string
  carrierFilterKey: string
  carrierId: string
  carrier: string
  agentId: string
  agent: string
  currencyId: string
  currency: string
  lines: FclRateBundleLine[]
  totalCost: number
  totalSale: number
  validFrom: string
  validTo: string
  freeDays: number
  transitDays: number
  sourceCount: number
  preAuthorized: boolean
}

const fclRatesByContainer = ref<Record<string, ImportRateSelectDto[]>>({})
const selectedFclBundleKey = ref('')
const fclSelectedImportRateIds = ref<Record<string, string>>({})

function fclRateCarrierFilterKey(rate: ImportRateSelectDto) {
  return String(rate.carrierId || normalizeCatalogValue(String(rate.carrier ?? ''))).trim()
}

function fclRateBundleGroupKey(rate: ImportRateSelectDto) {
  const carrier = fclRateCarrierFilterKey(rate)
  const agent = String(rate.agentId || normalizeCatalogValue(String(rate.agent ?? ''))).trim()
  const currency = String(rate.currencyId || normalizeCatalogValue(String(rate.currency ?? 'USD'))).trim()
  return [carrier, agent, currency].join('|')
}

function compareFclCandidateRates(left: ImportRateSelectDto, right: ImportRateSelectDto) {
  const validityDate = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
  if (validityDate !== 0) return validityDate
  const comment = rateCommentRank(right.spaceComment) - rateCommentRank(left.spaceComment)
  if (comment !== 0) return comment
  const status = Number(right.status !== 'PreAuthorized') - Number(left.status !== 'PreAuthorized')
  if (status !== 0) return status
  return number(left.freight) - number(right.freight)
}

const fclRateRequirements = computed(() =>
  shipmentModeForApi.value === 'Fcl'
    ? fclContainerAllocations.value.map((allocation) => ({
        containerTypeId: allocation.containerTypeId,
        containerTypeName: allocation.containerTypeName,
        containerTypeCode: allocation.containerTypeCode,
        quantity: allocation.quantity,
        rates: fclRatesByContainer.value[allocation.containerTypeId] ?? [],
      }))
    : [],
)

const fclRateCoverage = computed(() =>
  fclRateRequirements.value.map((requirement) => ({
    ...requirement,
    availableCount: requirement.rates.length,
  })),
)

const fclRateBundles = computed<FclRateBundle[]>(() => {
  const requirements = fclRateRequirements.value
  if (!requirements.length || requirements.some((requirement) => !requirement.rates.length)) return []

  const groupSets = requirements.map(
    (requirement) => new Set(requirement.rates.map(fclRateBundleGroupKey)),
  )
  const commonGroups = [...groupSets[0]].filter((group) =>
    groupSets.every((candidateSet) => candidateSet.has(group)),
  )

  return commonGroups.flatMap((groupKey) => {
    const lines = requirements.flatMap((requirement) => {
      const rate = [...requirement.rates]
        .filter((candidate) => fclRateBundleGroupKey(candidate) === groupKey)
        .sort(compareFclCandidateRates)[0]
      if (!rate) return []

      const unitCost = number(rate.freight)
      const unitSale = number(rate.totalSale ?? rate.freight)
      return [{
        containerTypeId: requirement.containerTypeId,
        containerTypeName: requirement.containerTypeName,
        containerTypeCode: requirement.containerTypeCode,
        quantity: requirement.quantity,
        rate,
        unitCost,
        unitSale,
        totalCost: unitCost * requirement.quantity,
        totalSale: unitSale * requirement.quantity,
      } satisfies FclRateBundleLine]
    })

    if (lines.length !== requirements.length) return []

    const first = lines[0].rate
    const validFrom = lines
      .map((line) => String(line.rate.validFrom || ''))
      .filter(Boolean)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || ''
    const validTo = lines
      .map((line) => String(line.rate.validTo || ''))
      .filter(Boolean)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] || ''
    const freeDays = Math.min(...lines.map((line) => Math.max(0, number(line.rate.freeDays))))
    const transitDays = Math.max(...lines.map((line) => Math.max(0, number(line.rate.transitDays))))

    return [{
      key: groupKey,
      carrierFilterKey: fclRateCarrierFilterKey(first),
      carrierId: String(first.carrierId ?? ''),
      carrier: String(first.carrier ?? 'Naviera'),
      agentId: String(first.agentId ?? ''),
      agent: String(first.agent ?? ''),
      currencyId: String(first.currencyId ?? ''),
      currency: String(first.currency ?? first.currencyCode ?? 'USD'),
      lines,
      totalCost: lines.reduce((sum, line) => sum + line.totalCost, 0),
      totalSale: lines.reduce((sum, line) => sum + line.totalSale, 0),
      validFrom,
      validTo,
      freeDays,
      transitDays,
      sourceCount: new Set(lines.map((line) => line.rate.importBatchId)).size,
      preAuthorized: lines.some((line) => line.rate.status === 'PreAuthorized'),
    } satisfies FclRateBundle]
  }).sort((left, right) => {
    const validity = new Date(right.validTo).getTime() - new Date(left.validTo).getTime()
    if (validity !== 0) return validity
    return left.totalCost - right.totalCost
  })
})

const fclCarrierFilterOptions = computed(() => {
  const carriers = new Map<string, string>()
  fclRateBundles.value.forEach((bundle) => {
    if (bundle.carrierFilterKey && !carriers.has(bundle.carrierFilterKey)) {
      carriers.set(bundle.carrierFilterKey, bundle.carrier)
    }
  })
  return [
    { value: '', label: 'Todas las navieras' },
    ...[...carriers.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], 'es'))
      .map(([value, label]) => ({ value, label })),
  ]
})

const visibleFclRateBundles = computed(() =>
  fclRateBundles.value.filter(
    (bundle) => !rateCarrierFilter.value || bundle.carrierFilterKey === rateCarrierFilter.value,
  ),
)

function chooseFclRateBundle(bundle: FclRateBundle) {
  const primary = bundle.lines.find((line) => line.containerTypeId === form.equipmentId) ?? bundle.lines[0]
  if (!primary) return

  selectedFclBundleKey.value = bundle.key
  fclSelectedImportRateIds.value = Object.fromEntries(
    bundle.lines.map((line) => [line.containerTypeId, line.rate.id]),
  )

  // Mark extra equipment as independently priced before chooseRate changes the primary freight.
  fclExtraContainers.value.forEach((row) => {
    const line = bundle.lines.find((candidate) => candidate.containerTypeId === row.containerTypeId)
    if (!line) return
    row.freightCostAmount = line.unitCost
    row.freightSaleAmount = line.unitSale
    row.freightTouched = true
  })

  chooseRate(primary.rate)
  form.freeDays = bundle.freeDays
  form.transitDays = bundle.transitDays
  if (bundle.validTo) form.validTo = bundle.validTo

  const agent = catalogs.agents.find((item) => item.id === bundle.agentId)
    ?? catalogs.agents.find((item) =>
      normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(bundle.agent),
    )
  if (agent) form.agentId = agent.id
}
`
  code = replaceOne(code, stateAnchor, stateReplacement, 'FCL rate bundle state')

  const searchAnchor = `async function searchApprovedRates() {\n  availableRates.value = []\n  rateCarrierFilter.value = ''\n  form.selectedImportRateId = ''\n  form.manualRate = false`
  const searchReplacement = `async function searchApprovedRates() {\n  availableRates.value = []\n  rateCarrierFilter.value = ''\n  form.selectedImportRateId = ''\n  form.manualRate = false\n  selectedFclBundleKey.value = ''\n  fclSelectedImportRateIds.value = {}\n  fclRatesByContainer.value = {}\n\n  if (shipmentModeForApi.value === 'Fcl') {\n    if (!selectedOrigin.value || !selectedDestination.value || !fclContainerAllocations.value.length) {\n      form.manualRate = true\n      return\n    }\n\n    try {\n      loadingRates.value = true\n      const entries = await Promise.all(\n        fclContainerAllocations.value.map(async (allocation) => {\n          const container = fclContainerItem(allocation.containerTypeId)\n          if (!container) return { containerTypeId: allocation.containerTypeId, rates: [] as ImportRateSelectDto[] }\n\n          const query: BrowseImportRatesQuery = {\n            pol: catalogSearchText(selectedOrigin.value!),\n            poe: catalogSearchText(selectedDestination.value!),\n            pod: selectedPod.value ? catalogSearchText(selectedPod.value) : undefined,\n            containerType: catalogSearchText(container),\n            quoteDate: form.loadDate,\n          }\n          const rates = await PricingService.selectImportRates(query)\n          return { containerTypeId: allocation.containerTypeId, rates }\n        }),\n      )\n\n      const byContainer: Record<string, ImportRateSelectDto[]> = {}\n      const allRates = new Map<string, ImportRateSelectDto>()\n      entries.forEach((entry) => {\n        byContainer[entry.containerTypeId] = entry.rates\n        entry.rates.forEach((rate) => allRates.set(rate.id, rate))\n      })\n      fclRatesByContainer.value = byContainer\n      availableRates.value = [...allRates.values()]\n      await loadImportSources(availableRates.value)\n    } catch (error) {\n      toastStore.backendError(error, 'No se pudieron consultar las tarifas para todos los tipos de contenedor seleccionados.')\n    } finally {\n      loadingRates.value = false\n    }\n\n    if (!fclRateBundles.value.length) form.manualRate = true\n    return\n  }`
  code = replaceOne(code, searchAnchor, searchReplacement, 'multi-equipment approved rate search')

  const screenDescription = `<p class="crystal-description">La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.</p>`
  const screenDescriptionReplacement = `<p class="crystal-description">{{ shipmentModeForApi === 'Fcl' ? 'La búsqueda valida todos los tipos de contenedor seleccionados y solo ofrece combinaciones que cubren la composición FCL completa.' : 'La búsqueda usa POL, POE, equipo y fecha de carga; el POD se toma en cuenta únicamente cuando se selecciona.' }}</p>`
  code = replaceOne(code, screenDescription, screenDescriptionReplacement, 'screen 5 FCL explanation')

  const ratesTemplateAnchor = `          <template v-else-if="availableRates.length">`
  const fclTemplate = `          <template v-else-if="shipmentModeForApi === 'Fcl' && fclRateBundles.length">\n            <div class="crystal-soft space-y-4 p-4 md:p-5">\n              <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">\n                <div>\n                  <p class="text-sm font-black">Contenedores incluidos en la búsqueda</p>\n                  <div class="mt-2 flex flex-wrap gap-2">\n                    <DhBadge\n                      v-for="requirement in fclRateRequirements"\n                      :key="'required:' + requirement.containerTypeId"\n                      variant="primary"\n                    >\n                      {{ requirement.quantity }} × {{ requirement.containerTypeName }}\n                    </DhBadge>\n                  </div>\n                </div>\n                <div class="w-full xl:max-w-xs">\n                  <DhSelect v-model="rateCarrierFilter" label="Naviera" :options="fclCarrierFilterOptions" />\n                </div>\n              </div>\n              <p class="text-xs font-semibold text-[var(--dh-text-muted)]">\n                Si hay varios contenedores del mismo tipo, se usa una tarifa unitaria y se multiplica por la cantidad. Si hay tipos diferentes, Dhole exige una tarifa compatible para cada tipo dentro de la misma naviera, agente y moneda.\n              </p>\n            </div>\n\n            <div v-if="!visibleFclRateBundles.length" class="crystal-empty p-7 text-center">\n              <p class="font-black">No hay una combinación completa para la naviera seleccionada</p>\n              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione “Todas las navieras” para revisar las combinaciones completas disponibles.</p>\n            </div>\n\n            <div v-else class="grid gap-4 xl:grid-cols-2">\n              <button\n                v-for="bundle in visibleFclRateBundles"\n                :key="bundle.key"\n                type="button"\n                class="crystal-rate-card text-left"\n                :class="selectedFclBundleKey === bundle.key ? 'crystal-rate-card--active' : ''"\n                @click="chooseFclRateBundle(bundle)"\n              >\n                <div class="flex flex-wrap items-start justify-between gap-3">\n                  <div>\n                    <p class="text-lg font-black">{{ bundle.carrier }}</p>\n                    <p v-if="bundle.agent" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Agente: {{ bundle.agent }}</p>\n                  </div>\n                  <div class="flex flex-wrap justify-end gap-2">\n                    <DhBadge variant="primary">{{ fclContainerTotal }} contenedores</DhBadge>\n                    <DhBadge :variant="bundle.preAuthorized ? 'warning' : 'success'">{{ bundle.preAuthorized ? 'Incluye preautorizada' : 'Preaprobada' }}</DhBadge>\n                  </div>\n                </div>\n\n                <div class="mt-4 space-y-2">\n                  <div\n                    v-for="line in bundle.lines"\n                    :key="bundle.key + ':' + line.containerTypeId"\n                    class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3"\n                  >\n                    <div class="flex flex-wrap items-center justify-between gap-3">\n                      <div>\n                        <strong class="block text-sm">{{ line.quantity }} × {{ line.containerTypeName }}</strong>\n                        <span class="mt-0.5 block text-[11px] font-semibold text-[var(--dh-text-muted)]">\n                          Unitario: {{ formatMoney(line.unitCost, bundle.currency) }} / contenedor\n                        </span>\n                      </div>\n                      <strong class="text-sm text-[var(--dh-primary)]">{{ formatMoney(line.totalCost, bundle.currency) }}</strong>\n                    </div>\n                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">\n                      <span class="text-[10px] font-bold text-[var(--dh-text-muted)]">{{ formatDate(line.rate.validFrom) }} – {{ formatDate(line.rate.validTo) }}</span>\n                      <span\n                        class="inline-flex items-center gap-1 text-[11px] font-black text-[var(--dh-primary)] hover:underline"\n                        role="link"\n                        tabindex="0"\n                        @click.stop="openImportSource(line.rate)"\n                        @keyup.enter.stop="openImportSource(line.rate)"\n                      >\n                        <ExternalLink class="h-3.5 w-3.5" /> Ver fuente\n                      </span>\n                    </div>\n                  </div>\n                </div>\n\n                <div class="mt-4 flex flex-col gap-3 border-t border-[var(--dh-border)] pt-4 sm:flex-row sm:items-end sm:justify-between">\n                  <div>\n                    <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Vigencia común</span>\n                    <strong class="mt-1 block text-sm">{{ formatDate(bundle.validFrom) }} – {{ formatDate(bundle.validTo) }}</strong>\n                    <span class="mt-1 block text-[11px] font-semibold text-[var(--dh-text-muted)]">\n                      {{ bundle.freeDays > 0 ? bundle.freeDays + ' días libres mínimos entre los equipos' : 'Sin días libres comunes definidos' }} · {{ bundle.sourceCount }} fuente{{ bundle.sourceCount === 1 ? '' : 's' }}\n                    </span>\n                  </div>\n                  <div class="text-right">\n                    <span class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Flete total</span>\n                    <strong class="mt-1 block text-2xl">{{ formatMoney(bundle.totalCost, bundle.currency) }}</strong>\n                  </div>\n                </div>\n              </button>\n            </div>\n\n            <div class="flex justify-end">\n              <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>\n            </div>\n          </template>\n\n          <template v-else-if="shipmentModeForApi === 'Fcl' && fclRateRequirements.length">\n            <div class="crystal-empty p-7">\n              <div class="text-center">\n                <p class="text-lg font-black">No existe una combinación de tarifas que cubra todos los contenedores</p>\n                <p class="mt-2 text-sm text-[var(--dh-text-muted)]">Dhole consultó cada tipo de contenedor por separado, pero no encontró una misma combinación de naviera, agente y moneda para toda la solicitud.</p>\n              </div>\n              <div class="mx-auto mt-5 grid max-w-3xl gap-2 sm:grid-cols-2">\n                <div\n                  v-for="coverage in fclRateCoverage"\n                  :key="'coverage:' + coverage.containerTypeId"\n                  class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-3 py-3"\n                >\n                  <strong>{{ coverage.quantity }} × {{ coverage.containerTypeName }}</strong>\n                  <DhBadge :variant="coverage.availableCount > 0 ? 'success' : 'danger'">\n                    {{ coverage.availableCount > 0 ? coverage.availableCount + ' tarifa' + (coverage.availableCount === 1 ? '' : 's') : 'Sin tarifa' }}\n                  </DhBadge>\n                </div>\n              </div>\n              <div class="mt-5 flex flex-wrap justify-center gap-2">\n                <DhButton :disabled="saving" @click="saveOpenRequest">{{ saving ? 'Guardando…' : 'Guardar solicitud abierta' }}</DhButton>\n                <DhButton variant="secondary" @click="continueManual">Continuar de manera manual</DhButton>\n              </div>\n            </div>\n          </template>\n\n          <template v-else-if="availableRates.length">`
  code = replaceOne(code, ratesTemplateAnchor, fclTemplate, 'screen 5 FCL bundles')

  const mixedFreightNotesAnchor = `notes: [baseFreight.notes, 'Flete específico para ' + allocation.quantity + ' × ' + allocation.containerTypeName].filter(Boolean).join(' · '),`
  if (code.includes(mixedFreightNotesAnchor)) {
    code = code.replace(
      mixedFreightNotesAnchor,
      `notes: [baseFreight.notes, 'Flete específico para ' + allocation.quantity + ' × ' + allocation.containerTypeName, fclSelectedImportRateIds.value[allocation.containerTypeId] ? 'Tarifa importada: ' + fclSelectedImportRateIds.value[allocation.containerTypeId] : null].filter(Boolean).join(' · '),`,
    )
  }

  return code
}

export function pricingWizardFclRateBundles(): Plugin {
  return {
    name: 'dhole-pricing-wizard-fcl-rate-bundles',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
