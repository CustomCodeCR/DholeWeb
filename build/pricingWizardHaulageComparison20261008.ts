import type { Plugin } from 'vite'

// Merchant/Naviera belongs to pricing-provider decisions, not cargo conditions.
const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-haulage-choice-screen6-20261008'

const HELPERS = `// dhole-haulage-choice-screen6-20261008
type DholeHaulageChoice = 'merchant' | 'carrier'

const dholeHaulageVisible = computed(() =>
  ['Maritime', 'Multimodal'].includes(String(form.modality))
  && shipmentModeForApi.value === 'Fcl'
  && !props.sellerRequestMode,
)
const dholeHaulagePending = ref(false)
const dholeHaulageLoadedContext = ref('')
let dholeHaulageRequestVersion = 0

// Only read prices returned for the exact current context, not stale entries
// retained while changing naviera, route or agent.
const dholeHaulageContextCosts = computed(() =>
  applicableConfiguredCosts().filter((cost) =>
    cost.isActive !== false && costResolvedByBackendContext(cost),
  ),
)

// The imported Maersk/MSC/etc. rate determines the REAL Panama POE.
 // An inland named for Rodman/Manzanillo cannot be selected for Balboa.
function dholeHaulageMatchesSelectedTerminal(cost: { name: string }) {
  const label = normalizeCatalogValue(String(cost.name ?? ''))
  const terminals = ['balboa', 'manzanillo', 'rodman', 'cristobal']
    .map((value) => ({ value, index: label.indexOf(value) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)
  if (!terminals.length) return true

  const poe = findById(catalogs.poe, costContextPoeId())
  const routeLabel = normalizeCatalogValue([
    poe?.code,
    poe ? displayValue(poe) : '',
    selectedImportRate.value?.poe,
  ].filter(Boolean).join(' '))

  // A generic "Multimodal vía Panamá" has no precise inland origin yet.
  return Boolean(routeLabel && routeLabel.includes(terminals[0].value))
}

function dholeHaulageOtherConditionsMatch(cost: CostSelectDto) {
  return (cost.operationalConditions ?? [])
    .filter((condition) => condition !== 'MerchantHaulage' && condition !== 'CarrierHaulage')
    .every((condition) => operationalConditionSelected(condition))
}

function dholeHaulageCostsFor(mode: DholeHaulageChoice) {
  const rows = dholeHaulageContextCosts.value.filter((cost) =>
    haulageAssociation(cost) === mode
    && dholeHaulageOtherConditionsMatch(cost)
    && dholeHaulageMatchesSelectedTerminal(cost),
  )
  // Do not offer a Panama haulage alternative that has only a Gate/other
  // surcharge but no configured transport to/from the selected terminal.
  if (isMultimodalViaPanama(selectedDestination.value) && !rows.some((cost) => {
    const label = normalizeCatalogValue(cost.name)
    return cost.costDetailType === 'InlandTransport'
      || label.includes('inland')
      || label.includes('flete terrestre')
      || label.includes('transporte interno')
  })) return []
  return rows
}

const dholeMerchantCosts = computed(() => dholeHaulageCostsFor('merchant'))
const dholeCarrierCosts = computed(() => dholeHaulageCostsFor('carrier'))
const dholeMerchantAvailable = computed(() => dholeMerchantCosts.value.length > 0)
const dholeCarrierAvailable = computed(() => dholeCarrierCosts.value.length > 0)
const dholeCurrentChoice = computed<DholeHaulageChoice | null>(() =>
  form.merchantHaulage && dholeMerchantAvailable.value ? 'merchant'
  : form.carrierHaulage && dholeCarrierAvailable.value ? 'carrier'
  : null,
)
const dholeHaulageCurrency = computed<'USD' | 'CRC'>(() =>
  String(selectedCurrency.value?.code ?? '').trim().toUpperCase() === 'CRC' ? 'CRC' : 'USD',
)

function dholeHaulageConverted(value: number, currencyCode: string) {
  const source = String(currencyCode || '').trim().toUpperCase()
  if (source !== 'USD' && source !== 'CRC') return Number.NaN
  if (source !== dholeHaulageCurrency.value && number(exchangeRateSale.value) <= 0) {
    return Number.NaN
  }
  return convertUsdCrc(value, source, dholeHaulageCurrency.value)
}

function dholeHaulageCostAmount(cost: CostSelectDto, field: 'costAmount' | 'saleAmount') {
  const quantity = quantityForChargeBasis(
    cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    cost.operationalConditions,
  )
  return dholeHaulageConverted(number(cost[field]) * quantity, canonicalCurrencyCode(cost))
}

function dholeHaulageSum(rows: CostSelectDto[], field: 'costAmount' | 'saleAmount') {
  return rows.reduce((total, cost) => total + dholeHaulageCostAmount(cost, field), 0)
}

function dholeHaulageOptionTotals(mode: DholeHaulageChoice) {
  const rows = mode === 'merchant' ? dholeMerchantCosts.value : dholeCarrierCosts.value
  return { cost: dholeHaulageSum(rows, 'costAmount'), sale: dholeHaulageSum(rows, 'saleAmount') }
}

const dholeBaseCosts = computed(() =>
  dholeHaulageContextCosts.value.filter((cost) =>
    cost.costDetailType !== 'Freight'
    && haulageAssociation(cost) === null
    && (cost.costType !== 'Optional' || shouldIncludeOptionalCost(cost)),
  ),
)

function dholeHaulageEstimate(mode: DholeHaulageChoice) {
  const freightCurrency = dholeHaulageCurrency.value
  const freightQuantity = Math.max(1, number(form.equipmentQuantity))
  const freightCost = dholeHaulageConverted(number(form.freightCost) * freightQuantity, freightCurrency)
  const freightSale = dholeHaulageConverted(number(form.freightSale) * freightQuantity, freightCurrency)
  const option = dholeHaulageOptionTotals(mode)
  const cost = freightCost + dholeHaulageSum(dholeBaseCosts.value, 'costAmount') + option.cost
  const sale = freightSale + dholeHaulageSum(dholeBaseCosts.value, 'saleAmount') + option.sale
  return { cost, sale, utility: sale - cost, margin: sale > 0 ? ((sale - cost) / sale) * 100 : 0 }
}

const dholeMerchantEstimate = computed(() => dholeHaulageEstimate('merchant'))
const dholeCarrierEstimate = computed(() => dholeHaulageEstimate('carrier'))
const dholeSelectedEstimate = computed(() =>
  dholeCurrentChoice.value ? dholeHaulageEstimate(dholeCurrentChoice.value) : null,
)
const dholeSelectedHaulageCosts = computed(() =>
  dholeCurrentChoice.value === 'merchant' ? dholeMerchantCosts.value
  : dholeCurrentChoice.value === 'carrier' ? dholeCarrierCosts.value
  : [],
)
const dholeHaulageRecommended = computed<DholeHaulageChoice | null>(() => {
  if (!dholeMerchantAvailable.value) return dholeCarrierAvailable.value ? 'carrier' : null
  if (!dholeCarrierAvailable.value) return 'merchant'
  const merchant = dholeMerchantEstimate.value
  const carrier = dholeCarrierEstimate.value
  if (!Number.isFinite(merchant.margin) || !Number.isFinite(carrier.margin)) return null
  if (merchant.margin !== carrier.margin) return merchant.margin > carrier.margin ? 'merchant' : 'carrier'
  if (merchant.cost !== carrier.cost) return merchant.cost < carrier.cost ? 'merchant' : 'carrier'
  return 'carrier'
})

function dholeHaulageMoney(value: number) {
  return Number.isFinite(value)
    ? formatMoney(value, dholeHaulageCurrency.value)
    : 'Tipo de cambio pendiente'
}

function dholeChooseHaulage(mode: DholeHaulageChoice) {
  if (dholeHaulagePending.value || !dholeHaulageVisible.value) return
  if (mode === 'merchant' && !dholeMerchantAvailable.value) return
  if (mode === 'carrier' && !dholeCarrierAvailable.value) return

  form.merchantHaulage = mode === 'merchant'
  form.carrierHaulage = mode === 'carrier'
  syncHaulageOptionalLines()
}

// Re-read Costos y recargos whenever the selected route, naviera or agent changes.
// The same context revisited keeps the user's manual preference if still valid.
watch(
  () => [step.value, currentCostContextKey()].join('~'),
  async () => {
    const requestVersion = ++dholeHaulageRequestVersion
    if (step.value !== 6 || !dholeHaulageVisible.value || props.viewOnly) {
      dholeHaulagePending.value = false
      return
    }

    const requestedContext = currentCostContextKey()
    const changedContext = requestedContext !== dholeHaulageLoadedContext.value
    dholeHaulagePending.value = true
    if (changedContext) {
      form.merchantHaulage = false
      form.carrierHaulage = false
    }

    try {
      await loadApplicableCosts()
      if (
        requestVersion !== dholeHaulageRequestVersion
        || step.value !== 6
        || currentCostContextKey() !== requestedContext
      ) return

      dholeHaulageLoadedContext.value = requestedContext
      const merchant = dholeMerchantAvailable.value
      const carrier = dholeCarrierAvailable.value
      const validCurrent = (form.merchantHaulage && merchant) || (form.carrierHaulage && carrier)

      if (!validCurrent) {
        // If only one transport modality exists, select it automatically.
        // When both are available default to the higher estimated margin.
        const mode = merchant && carrier
          ? dholeHaulageRecommended.value
          : merchant ? 'merchant' : carrier ? 'carrier' : null
        form.merchantHaulage = mode === 'merchant'
        form.carrierHaulage = mode === 'carrier'
      }
      syncHaulageOptionalLines()
    } finally {
      if (requestVersion === dholeHaulageRequestVersion) {
        dholeHaulagePending.value = false
      }
    }
  },
  { immediate: true, flush: 'post' },
)

`

const SCREEN6 = `          <div v-if="dholeHaulageVisible && !props.viewOnly" class="crystal-soft space-y-4 p-4 md:p-5">
            <div>
              <p class="text-base font-black">Transporte en destino · Naviera o Merchant</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Opciones reales de Costos y recargos para la naviera, agente, ruta e Incoterm seleccionados. Los importes se calculan por su base de cobro.</p>
            </div>
            <p v-if="dholeHaulagePending" class="text-sm font-semibold text-[var(--dh-text-muted)]">Consultando costos y alternativas disponibles…</p>
            <template v-else>
              <div class="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  class="rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  :class="form.carrierHaulage ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
                  :disabled="!dholeCarrierAvailable"
                  :aria-pressed="form.carrierHaulage"
                  @click="dholeChooseHaulage('carrier')"
                >
                  <span class="flex items-center justify-between gap-2 font-black"><span>Naviera (Carrier Haulage)</span><Check v-if="form.carrierHaulage" class="h-4 w-4" /></span>
                  <span v-if="dholeCarrierAvailable" class="mt-2 block space-y-1 text-xs">
                    <span class="block">Cargos: {{ dholeCarrierCosts.length }}</span>
                    <span class="block">Costo: <strong>{{ dholeHaulageMoney(dholeHaulageOptionTotals('carrier').cost) }}</strong></span>
                    <span class="block">Venta: <strong>{{ dholeHaulageMoney(dholeHaulageOptionTotals('carrier').sale) }}</strong></span>
                    <span class="block">Margen total estimado: <strong>{{ dholeCarrierEstimate.margin.toFixed(2) }}%</strong></span>
                    <span v-if="dholeHaulageRecommended === 'carrier' && dholeMerchantAvailable" class="block font-black text-[var(--dh-primary)]">Mejor margen estimado</span>
                  </span>
                  <span v-else class="mt-2 block text-xs">Sin cargos de Naviera configurados para esta selección.</span>
                </button>
                <button
                  type="button"
                  class="rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                  :class="form.merchantHaulage ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.08)]' : 'border-[var(--dh-border)] bg-[var(--dh-card)]'"
                  :disabled="!dholeMerchantAvailable"
                  :aria-pressed="form.merchantHaulage"
                  @click="dholeChooseHaulage('merchant')"
                >
                  <span class="flex items-center justify-between gap-2 font-black"><span>Merchant Haulage</span><Check v-if="form.merchantHaulage" class="h-4 w-4" /></span>
                  <span v-if="dholeMerchantAvailable" class="mt-2 block space-y-1 text-xs">
                    <span class="block">Cargos: {{ dholeMerchantCosts.length }}</span>
                    <span class="block">Costo: <strong>{{ dholeHaulageMoney(dholeHaulageOptionTotals('merchant').cost) }}</strong></span>
                    <span class="block">Venta: <strong>{{ dholeHaulageMoney(dholeHaulageOptionTotals('merchant').sale) }}</strong></span>
                    <span class="block">Margen total estimado: <strong>{{ dholeMerchantEstimate.margin.toFixed(2) }}%</strong></span>
                    <span v-if="dholeHaulageRecommended === 'merchant' && dholeCarrierAvailable" class="block font-black text-[var(--dh-primary)]">Mejor margen estimado</span>
                  </span>
                  <span v-else class="mt-2 block text-xs">Merchant no está disponible para esta naviera y ruta.</span>
                </button>
              </div>
              <p v-if="!dholeCarrierAvailable && !dholeMerchantAvailable" class="text-sm font-semibold text-amber-600">No hay cargos de Naviera ni de Merchant aplicables en Costos y recargos. No se agregará transporte interno automáticamente.</p>
              <p v-else-if="dholeCarrierAvailable !== dholeMerchantAvailable" class="text-xs font-semibold text-[var(--dh-text-muted)]">Se seleccionó automáticamente la única alternativa disponible.</p>
              <div v-if="dholeSelectedHaulageCosts.length" class="space-y-2">
                <p class="text-sm font-black">Cargos incluidos en la opción seleccionada</p>
                <div v-for="charge in dholeSelectedHaulageCosts" :key="charge.id" class="grid gap-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-4">
                  <span class="font-semibold">{{ charge.name }} · {{ chargeBasisLabel(charge.chargeBasis ?? defaultChargeBasis(charge.costDetailType)) }} × {{ quantityForChargeBasis(charge.chargeBasis ?? defaultChargeBasis(charge.costDetailType), charge.operationalConditions) }}</span>
                  <span>Costo: <strong>{{ dholeHaulageMoney(dholeHaulageCostAmount(charge, 'costAmount')) }}</strong></span>
                  <span>Venta: <strong>{{ dholeHaulageMoney(dholeHaulageCostAmount(charge, 'saleAmount')) }}</strong></span>
                </div>
              </div>
              <div v-if="dholeSelectedEstimate" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="crystal-metric crystal-metric--cost"><span class="block text-[10px] font-black uppercase tracking-widest">Costo total estimado</span><strong class="mt-1 block text-sm">{{ dholeHaulageMoney(dholeSelectedEstimate.cost) }}</strong></div>
                <div class="crystal-metric crystal-metric--sale"><span class="block text-[10px] font-black uppercase tracking-widest">Venta total estimada</span><strong class="mt-1 block text-sm">{{ dholeHaulageMoney(dholeSelectedEstimate.sale) }}</strong></div>
                <div class="crystal-metric" :class="'crystal-metric--' + financialTone(dholeSelectedEstimate.utility)"><span class="block text-[10px] font-black uppercase tracking-widest">Utilidad estimada</span><strong class="mt-1 block text-sm">{{ dholeHaulageMoney(dholeSelectedEstimate.utility) }}</strong></div>
                <div class="crystal-metric" :class="'crystal-metric--' + financialTone(dholeSelectedEstimate.margin)"><span class="block text-[10px] font-black uppercase tracking-widest">Margen estimado</span><strong class="mt-1 block text-sm">{{ Number.isFinite(dholeSelectedEstimate.margin) ? dholeSelectedEstimate.margin.toFixed(2) + '%' : 'Pendiente' }}</strong></div>
              </div>
              <p class="text-xs text-[var(--dh-text-muted)]">Totales orientativos sin IVA: flete y cargos aplicables de Costos y recargos. Las líneas finales se revisan en Pantalla 7.</p>
            </template>
          </div>

`

function patchWizard(source: string) {
  if (source.includes(MARKER)) return source
  let code = source

  const step4Start = code.indexOf('<div v-else-if="step === 4"')
  const step7Start = code.indexOf('<div v-else-if="step === 7"', step4Start)
  if (step4Start < 0 || step7Start < 0) throw new Error('[haulage screen6] Missing steps 4/7.')
  let step4 = code.slice(step4Start, step7Start)
  for (const handler of ['toggleMerchantHaulage', 'toggleCarrierHaulage']) {
    const pattern = new RegExp('^[ \\t]*<button\\b[^>]*@click="' + handler + '"[^>]*>[\\s\\S]*?<\\/button>[ \\t]*\\n?', 'gm')
    const matches = step4.match(pattern)
    if (matches?.length !== 1) {
      throw new Error('[haulage screen6] Expected one ' + handler + ' button, found ' + (matches?.length ?? 0))
    }
    step4 = step4.replace(pattern, '')
  }
  code = code.slice(0, step4Start) + step4 + code.slice(step7Start)

  const step6Start = code.indexOf('<div v-else-if="step === 6"')
  const step6End = code.indexOf('<div v-else-if="step === 4"', step6Start)
  if (step6Start < 0 || step6End < 0) throw new Error('[haulage screen6] Missing step 6.')
  const step6 = code.slice(step6Start, step6End)
  const summaryAnchor = '<div class="crystal-route-summary grid gap-3 md:grid-cols-4">'
  if (step6.split(summaryAnchor).length !== 2) throw new Error('[haulage screen6] Missing provider summary.')
  const newStep6 = step6.replace(summaryAnchor, SCREEN6 + '          ' + summaryAnchor)
  code = code.slice(0, step6Start) + newStep6 + code.slice(step6End)

  // Include only the selected inland alternative even for non-Optional cost rows.
  const syncStart = code.indexOf('function syncHaulageOptionalLines() {')
  const syncEnd = code.indexOf('\n}\n\nfunction toggleMerchantHaulage', syncStart)
  if (syncStart < 0 || syncEnd < 0) throw new Error('[haulage screen6] Missing optional sync helper.')
  const syncBlock = `function syncHaulageOptionalLines() {
  if (props.viewOnly && props.rateId) return

  rateLines.value.forEach((line) => {
    const configured = line.costId ? costs.value.find((cost) => cost.id === line.costId) : null
    const association = haulageAssociation(configured ?? line)
    if (association) {
      const enabled = association === 'merchant' ? form.merchantHaulage : form.carrierHaulage
      line.included = enabled
        && dholeHaulageMatchesSelectedTerminal(configured ?? line)
        && (!configured || dholeHaulageOtherConditionsMatch(configured))
      if (!line.included) line.applyDestinationTax = false
      return
    }
    if (!line.optional || !configured) return
    line.included = shouldIncludeOptionalCost({ ...configured, costId: line.costId })
    if (!line.included) line.applyDestinationTax = false
  })
}`
  code = code.slice(0, syncStart) + syncBlock + code.slice(syncEnd + 2)

  // A currency/freight/service change on Pantalla 7 rebuilds every line.
  // Reapply the selected Panama terminal + Merchant/Naviera choice afterwards.
  const rateLinesRebuildStart = code.indexOf('function rebuildRateLines() {')
  const rateLinesRebuildEnd = code.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(', rateLinesRebuildStart)
  if (rateLinesRebuildStart < 0 || rateLinesRebuildEnd < 0) {
    throw new Error('[haulage screen6] Missing rate-line rebuild boundaries.')
  }
  const rateLinesRebuild = code.slice(rateLinesRebuildStart, rateLinesRebuildEnd)
  const rateLinesAssignment = '  rateLines.value = lines\\n}'
  if (rateLinesRebuild.split(rateLinesAssignment).length !== 2) {
    throw new Error('[haulage screen6] Missing unique rate-line assignment.')
  }
  const syncedRebuild = rateLinesRebuild.replace(
    rateLinesAssignment,
    '  rateLines.value = lines\\n  if (dholeHaulageVisible.value) syncHaulageOptionalLines()\\n}',
  )
  code = code.slice(0, rateLinesRebuildStart) + syncedRebuild + code.slice(rateLinesRebuildEnd)

  const optionalStart = code.indexOf('function shouldIncludeOptionalCost(')
  const optionalEnd = code.indexOf('\n}\n', optionalStart)
  if (optionalStart < 0 || optionalEnd < 0) throw new Error('[haulage screen6] Missing optional inclusion matcher.')
  const optionalBlock = code.slice(optionalStart, optionalEnd + 2)
  const includeAnchor = '  return operationalConditionsSatisfied(line)'
  if (!optionalBlock.includes(includeAnchor)) throw new Error('[haulage screen6] Missing operational condition evaluation.')
  const updatedOptional = optionalBlock.replace(
    includeAnchor,
    `  const association = haulageAssociation(line as CostSelectDto)
  if (association && !dholeHaulageMatchesSelectedTerminal(line as CostSelectDto)) return false
  if (association === 'merchant' && !form.merchantHaulage) return false
  if (association === 'carrier' && !form.carrierHaulage) return false
  return operationalConditionsSatisfied(line)`,
  )
  code = code.slice(0, optionalStart) + updatedOptional + code.slice(optionalEnd + 2)

  const helperAnchor = 'function addManualCharge() {'
  if (!code.includes(helperAnchor)) throw new Error('[haulage screen6] Missing insertion anchor.')
  code = code.replace(helperAnchor, HELPERS + helperAnchor)

  // A slow prior request must never overwrite the naviera currently being priced.
  const afterFetch = '    const contextualCosts = contextResult.status ==='
  if (!code.includes(afterFetch)) throw new Error('[haulage screen6] Missing contextual fetch.')
  code = code.replace(afterFetch,
    '    if (contextKey !== currentCostContextKey()) return\n\n' + afterFetch)

  const nextAnchor = 'const canNext = computed(() => {'
  if (code.split(nextAnchor).length !== 2) throw new Error('[haulage screen6] Missing wizard canNext.')
  code = code.replace(nextAnchor, nextAnchor + '\n'
    + "  if (step.value === 6 && dholeHaulageVisible.value && (dholeHaulagePending.value || ((dholeMerchantAvailable.value || dholeCarrierAvailable.value) && !dholeCurrentChoice.value))) return false\n")


  return code
}

export function pricingWizardHaulageComparison20261008(): Plugin {
  return {
    name: 'dhole-pricing-haulage-screen6-comparison-20261008',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
