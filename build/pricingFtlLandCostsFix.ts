import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRegexOne(source: string, pattern: RegExp, replacement: string, label: string) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matches = source.match(new RegExp(pattern.source, flags))
  if ((matches?.length ?? 0) !== 1) {
    throw new Error(`[pricingFtlLandCostsFix] Expected exactly one ${label}, found ${matches?.length ?? 0}.`)
  }
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchWizard(source: string) {
  let code = source

  // Terrestrial costs are already filtered by Pricing using the selected FTL/LTL context.
  // Do not hide a configured POL/POE charge only because the maritime Incoterm section map
  // does not contain that stage. Land charges can be origin, freight or destination charges.
  code = replaceRegexOne(
    code,
    /const visibleSections = computed<RateSection\[]>\(\(\) => \{[\s\S]*?\n\}\)\n\nconst includedLines = computed/,
    `const visibleSections = computed<RateSection[]>(() => {
  if (form.modality === 'Land' || shipmentModeForApi.value === 'Ftl' || shipmentModeForApi.value === 'Ltl') {
    return [...sectionOrder]
  }

  // Para marítimo/aéreo se conserva el límite comercial definido por Incoterm.
  const allowed = new Set<RateSection>(incotermResponsibilitySections.value)
  return sectionOrder.filter((section) => allowed.has(section))
})

const includedLines = computed`,
    'visible sections block',
  )

  // El POE "Multimodal Via Panamá" es solamente una opción visual del wizard. Para
  // tarifas importadas usamos el POE real de la tarifa. Cuando Pantalla 6 crea el flete
  // manualmente, el POE elegido allí pasa a ser el contexto autoritativo de cargos y
  // recargos, junto con la naviera seleccionada.
  code = replaceRegexOne(
    code,
    /function applicableCost\(cost: CostSelectDto\) \{[\s\S]*?\n\}\n\nfunction costSpecificity/,
    `function costContextImportRateId() {
  const selectedRateId = String(form.selectedImportRateId ?? '').trim()
  if (!selectedRateId) return String(manualOceanFreightSavedId.value ?? '').trim()
  if (!isMultimodalViaPanama(selectedDestination.value)) return ''
  return selectedRateId
}

function costContextPoeId() {
  const manualPoeId = String(manualOceanFreightPoeId.value ?? '').trim()
  if (!form.selectedImportRateId && manualPoeId) return manualPoeId
  if (!isMultimodalViaPanama(selectedDestination.value)) return form.destinationId
  return String(selectedImportRate.value?.poeId ?? '').trim() || form.destinationId
}

function currentCostContextKey() {
  return [
    shipmentModeForApi.value,
    form.originId,
    costContextPoeId(),
    form.podId,
    form.incotermId,
    form.carrierId,
    form.agentId,
    costContextImportRateId(),
    [...form.serviceIds].sort().join(','),
  ].join('|')
}

function costResolvedByBackendContext(cost: CostSelectDto) {
  return String(cost.__dholePricingContextKey ?? '') === currentCostContextKey()
}

function costMatchesHardRouteContext(cost: CostSelectDto) {
  const contextPoeId = costContextPoeId()
  const selectedPodId = String(form.podId ?? '').trim()

  // POL/POE/POD are hard route constraints even when Pricing says the cost matched the
  // requested context. In particular, a POD-specific cost must never leak into a quote
  // whose POD is empty.
  if (cost.polId && cost.polId !== form.originId) return false
  if (cost.poeId && cost.poeId !== contextPoeId) return false
  if (cost.podId && (!selectedPodId || cost.podId !== selectedPodId)) return false

  if (cost.portId) {
    const matchesLegacyPort = cost.portRole === 'Pol'
      ? cost.portId === form.originId
      : cost.portRole === 'Poe'
        ? cost.portId === contextPoeId
        : cost.portRole === 'Pod'
          ? Boolean(selectedPodId) && cost.portId === selectedPodId
          : [form.originId, contextPoeId, selectedPodId].filter(Boolean).includes(cost.portId)
    if (!matchesLegacyPort) return false
  }

  return true
}

function applicableCost(cost: CostSelectDto) {
  const backendContextMatched = costResolvedByBackendContext(cost)

  // /costs/select is authoritative when it resolved the complete pricing context.
  // A cost can be linked to several POD/POL/POE values; its legacy podId/polId/poeId only
  // keeps the first selected value for backwards compatibility. Re-checking that legacy
  // field here would incorrectly discard matches for the second and following selections.
  if (!backendContextMatched) {
    if (!costMatchesHardRouteContext(cost)) return false
    if (cost.services?.length && !cost.services.some((service) => form.serviceIds.includes(service.id))) return false
    if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
    if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
    if (cost.carrierId && cost.carrierId !== form.carrierId) return false
    if (cost.agentId && cost.agentId !== form.agentId) return false
  }

  // Pricing already evaluates each cost's own Incoterm restriction. The extra section
  // responsibility filter is only applicable to the maritime/air presentation model.
  const isTerrestrial = form.modality === 'Land'
    || shipmentModeForApi.value === 'Ftl'
    || shipmentModeForApi.value === 'Ltl'
  if (!isTerrestrial && !incotermResponsibilitySections.value.includes(sectionForCost(cost))) return false

  return true
}

function costSpecificity`,
    'applicable cost function',
  )

  // Cargos Optional que ya pasaron el filtro contextual del backend se incluyen de forma
  // automática. Se conservan las condiciones explícitas de carga peligrosa, sobrepeso,
  // muellaje y haulage. Si Pricing retira un cargo con la X, se recuerda mientras no cambie
  // el contexto de la cotización para que un rebuild no lo agregue nuevamente.
  code = replaceRegexOne(
    code,
    /function shouldIncludeOptionalCost\(line: \{ name: string; notes\?: string \| null \}\) \{[\s\S]*?\n\}/,
    `function automaticOptionalCostId(line: { id?: string | null; costId?: string | null }) {
  return String(line.costId ?? line.id ?? '').trim()
}

function shouldIncludeOptionalCost(line: { id?: string | null; costId?: string | null; name: string; notes?: string | null }) {
  const automaticCostId = automaticOptionalCostId(line)
  if (automaticCostId && dismissedAutomaticOptionalCostIds.value.has(automaticCostId)) return false

  const cargoSelected = cargoConditionSelection(line)
  if (cargoSelected === false) return false
  const portHandlingSelected = portHandlingConditionSelection(line)
  if (portHandlingSelected === false) return false
  const association = haulageAssociation(line)
  if (association === 'merchant' && !form.merchantHaulage) return false
  if (association === 'carrier' && !form.carrierHaulage) return false
  if (cargoSelected === true || portHandlingSelected === true) return true
  if (association === 'merchant') return form.merchantHaulage
  if (association === 'carrier') return form.carrierHaulage

  // Un Optional sin una condición especial adicional ya fue validado contra POE/POD,
  // naviera/agente, Incoterm, modalidad y servicios por DholePricing.
  return true
}`,
    'automatic optional inclusion',
  )

  code = replaceRegexOne(
    code,
    /async function loadApplicableCosts\(\) \{[\s\S]*?\n\}\n\nfunction rebuildRateLines/,
    `async function loadApplicableCosts() {
  try {
    const contextKey = currentCostContextKey()
    const importRateId = costContextImportRateId()

    if (automaticOptionalContextKey.value !== contextKey) {
      dismissedAutomaticOptionalCostIds.value.clear()
      automaticOptionalContextKey.value = contextKey
    }

    const selectedCosts = await PricingService.selectCosts({
      carrierId: form.carrierId || undefined,
      agentId: form.agentId || undefined,
      polId: form.originId || undefined,
      poeId: costContextPoeId() || undefined,
      podId: form.podId || undefined,
      incotermId: form.incotermId || undefined,
      shipmentMode: shipmentModeForApi.value,
      isActive: true,
      applicableToContext: true,
      serviceIds: form.serviceIds.join(',') || undefined,
      importRateId: importRateId || undefined,
    })

    // Pricing already evaluated the full multi-port selection table. Do not filter the
    // response again with the legacy single POD/POL/POE fields kept on CostSelectDto.
    costs.value = selectedCosts
      .map((cost) => ({
        ...cost,
        __dholePricingContextKey: contextKey,
      }))
  } catch (error) {
    costs.value = []
    toastStore.backendError(
      error,
      'No se pudieron cargar los costos que coinciden con modalidad, ruta, proveedor e Incoterm.',
    )
  }
}

function rebuildRateLines`,
    'contextual cost loader',
  )

  // Pantalla 7 no debe inventar una fila "Recolecta". Si existe Recolecta en Cargos y
  // recargos llegará desde /costs/select y se mostrará en su sección real; si no existe,
  // no se agrega una línea variable con costo/venta en cero.
  code = replaceRegexOne(
    code,
    /\naddVariableSectionFallback\(\n\s*'pickup_origin',\n\s*'Recolecta',\n\s*'InlandTransport',\n\s*'Variable: complete costo y venta según la recolección aplicable\.',\n\)\n/,
    '\n',
    'synthetic pickup fallback',
  )

  // Every Optional cost returned for the active Pricing context must be visible in the
  // selector. Haulage/cargo flags may still auto-select or clear their related lines, but
  // they must not make configured optionals disappear from Pantalla 7.
  code = replaceRegexOne(
    code,
    /const selectableOptionalLines = computed\(\(\) =>[\s\S]*?\n\)\nconst optionalChargeOptions = computed/,
    `const selectableOptionalLines = computed(() =>
  rateLines.value.filter((line) => line.optional),
)
const optionalChargeOptions = computed`,
    'optional cost selector',
  )

  // Solo el flujo operativo de Pricing puede quitar/reagregar cargos Optional. El flujo
  // de vendedor y la vista de solo lectura reciben los cargos aplicables ya seleccionados.
  code = replaceRegexOne(
    code,
    /\nconst selectedOptionalChargeKeys = computed<string\[]>\(\{/,
    `
const dismissedAutomaticOptionalCostIds = ref(new Set<string>())
const automaticOptionalContextKey = ref('')
const canManageAutomaticOptionalCosts = computed(() => !props.sellerRequestMode && !props.viewOnly)
const selectedOptionalChargeKeys = computed<string[]>({`,
    'automatic optional state and permission',
  )

  code = replaceRegexOne(
    code,
    /  set: \(keys\) => \{\n    const selected = new Set\(keys\)\n/,
    `  set: (keys) => {
    if (!canManageAutomaticOptionalCosts.value) return

    const selected = new Set(keys)
    selectableOptionalLines.value.forEach((line) => {
      const automaticCostId = automaticOptionalCostId(line)
      if (!automaticCostId) return
      if (selected.has(line.key)) dismissedAutomaticOptionalCostIds.value.delete(automaticCostId)
      else dismissedAutomaticOptionalCostIds.value.add(automaticCostId)
    })
`,
    'optional selector permission and dismissal tracking',
  )

  code = replaceRegexOne(
    code,
    /<PricingCrystalMultiSelect\n\s+v-model="selectedOptionalChargeKeys"/,
    `<PricingCrystalMultiSelect
                v-if="canManageAutomaticOptionalCosts"
                v-model="selectedOptionalChargeKeys"`,
    'pricing-only optional selector',
  )

  return code
}

export function pricingFtlLandCostsFix(): Plugin {
  return {
    name: 'dhole-pricing-ftl-land-costs-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
