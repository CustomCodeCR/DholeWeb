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

function costShipmentModeForApi(): ShipmentMode {
  // La UI aérea reutiliza el flujo consolidado LCL para medidas/CFT, pero los costos
  // maestros deben resolverse con su modalidad propia para no mezclar LCL marítimo.
  if (form.modality === 'Air' && shipmentModeForApi.value === 'Lcl') return 'AirConsol'
  return shipmentModeForApi.value
}

function costContextAgentId() {
  if (
    (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'AirConsol')
    && lclSelectedSource.value
  ) {
    const directId = String(lclSelectedSource.value.providerId ?? '').trim()
    if (directId && catalogs.agents.some((item) => item.id === directId)) return directId

    const providerText = normalizeCatalogValue(
      [lclSelectedSource.value.providerCode, lclSelectedSource.value.providerName]
        .filter(Boolean)
        .join(' '),
    )
    const matched = catalogs.agents.find((item) => {
      const candidate = normalizeCatalogValue(
        [item.code, displayValue(item), item.label, item.value].filter(Boolean).join(' '),
      )
      if (lclSelectedSource.value?.kind === 'Own') {
        return candidate.includes('gcf') || candidate.includes('grupo castro fallas')
      }
      return Boolean(
        providerText
        && (candidate.includes(providerText) || providerText.includes(candidate)),
      )
    })
    if (matched) return matched.id
    if (directId) return directId
  }

  return String(form.agentId ?? '').trim()
}

function currentCostContextKey() {
  return [
    costShipmentModeForApi(),
    form.originId,
    costContextPoeId(),
    form.podId,
    form.incotermId,
    form.carrierId,
    costContextAgentId(),
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
    const configuredModes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
      ? cost.shipmentModes
      : cost.shipmentMode
        ? [cost.shipmentMode]
        : []
    if (configuredModes.length && !configuredModes.includes(costShipmentModeForApi())) return false
    if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
    if (cost.carrierId && cost.carrierId !== form.carrierId) return false
    if (cost.agentId && cost.agentId !== costContextAgentId()) return false
  }

  // /costs/select ya evaluó las restricciones reales del costo: ruta, naviera/agente,
  // Incoterm explícito, modalidad y servicios. CostDetailType/section es presentación,
  // no una segunda regla de aplicabilidad. Un OriginCharge configurado para FOB, por
  // ejemplo, debe seguir apareciendo si Pricing lo devolvió para ese contexto.
  return true
}

function costSpecificity`,
    'applicable cost function',
  )

  // El wizard principal todavía recibe el helper de selección automática desde
  // pricingCargoHaulageKeywordFix. La vista estable de edición ya trae los opcionales
  // normalizados en el source y no siempre contiene ese helper; crear una versión
  // compatible para que los plugins posteriores puedan endurecer la regla.
  if (code.includes('function shouldIncludeOptionalCost(')) {
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
  return false
}`,
      'automatic optional inclusion',
    )
  } else {
    const optionalSelectorAnchor = 'const selectableOptionalLines = computed'
    if (!code.includes(optionalSelectorAnchor)) {
      throw new Error('[pricingFtlLandCostsFix] Optional selector anchor not found.')
    }
    code = code.replace(
      optionalSelectorAnchor,
      `function automaticOptionalCostId(line: { id?: string | null; costId?: string | null }) {
  return String(line.costId ?? line.id ?? '').trim()
}

function shouldIncludeOptionalCost(line: { id?: string | null; costId?: string | null }) {
  const automaticCostId = automaticOptionalCostId(line)
  if (automaticCostId && dismissedAutomaticOptionalCostIds.value.has(automaticCostId)) return false
  return true
}

${optionalSelectorAnchor}`,
    )
  }

  code = replaceRegexOne(
    code,
    /async function loadApplicableCosts\(\) \{[\s\S]*?\n\}\n\nfunction rebuildRateLines/,
    `function maritimeFclRelationMatches(
  relations: Array<{ id: string }> | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string | null | undefined,
) {
  const selected = String(selectedId ?? '').trim()
  const ids = Array.isArray(relations)
    ? relations.map((item) => String(item.id ?? '').trim()).filter(Boolean)
    : []
  if (ids.length > 0) return Boolean(selected) && ids.includes(selected)
  return !legacyId || (Boolean(selected) && String(legacyId) === selected)
}

function maritimeFclCostMatchesCurrentContext(cost: CostSelectDto) {
  if (cost.isActive === false) return false

  const modes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length
    ? cost.shipmentModes
    : cost.shipmentMode ? [cost.shipmentMode] : []
  if (modes.length > 0 && !modes.some((mode) => String(mode).toLowerCase() === 'fcl')) return false

  if (cost.incoterms?.length && !cost.incoterms.some((item) => item.id === form.incotermId)) return false
  if (cost.services?.length && !cost.services.some((item) => form.serviceIds.includes(item.id))) return false

  const poeId = costContextPoeId()
  if (!maritimeFclRelationMatches(cost.pols, cost.polId, form.originId)) return false
  if (!maritimeFclRelationMatches(cost.poes, cost.poeId, poeId)) return false
  if (!maritimeFclRelationMatches(cost.pods, cost.podId, form.podId)) return false
  if (!maritimeFclRelationMatches(cost.carriers, cost.carrierId, form.carrierId)) return false
  if (!maritimeFclRelationMatches(cost.agents, cost.agentId, costContextAgentId())) return false

  // PortId reflects only the first legacy selection. Match the full
  // relationship first when several POE/POD/POL values were configured.
  if (cost.portId) {
    const role = String(cost.portRole ?? '').toLowerCase()
    const relation = role === 'pol' ? cost.pols : role === 'poe' ? cost.poes : role === 'pod' ? cost.pods : null
    if (!Array.isArray(relation) || relation.length === 0) {
      const expected = role === 'pol' ? form.originId : role === 'poe' ? poeId : role === 'pod' ? form.podId : null
      const candidates = expected ? [expected] : [form.originId, poeId, form.podId].filter(Boolean)
      if (!candidates.includes(String(cost.portId))) return false
    }
  }

  return true
}

async function loadApplicableCosts() {
  try {
    const contextKey = currentCostContextKey()
    const importRateId = costContextImportRateId()

    if (automaticOptionalContextKey.value !== contextKey) {
      dismissedAutomaticOptionalCostIds.value.clear()
      automaticOptionalContextKey.value = contextKey
    }

    const contextualQuery = {
      carrierId: form.carrierId || undefined,
      agentId: costContextAgentId() || undefined,
      polId: form.originId || undefined,
      poeId: costContextPoeId() || undefined,
      podId: form.podId || undefined,
      incotermId: form.incotermId || undefined,
      shipmentMode: costShipmentModeForApi(),
      isActive: true,
      applicableToContext: true,
      serviceIds: form.serviceIds.join(',') || undefined,
      importRateId: importRateId || undefined,
    }

    const maritimeFcl = form.modality === 'Maritime' && costShipmentModeForApi() === 'Fcl'
    const [contextResult, fullCatalogResult] = await Promise.allSettled([
      PricingService.selectCosts(contextualQuery),
      maritimeFcl
        ? PricingService.selectCosts({ isActive: true })
        : Promise.resolve([] as CostSelectDto[]),
    ])

    if (contextResult.status === 'rejected' && (!maritimeFcl || fullCatalogResult.status === 'rejected')) {
      throw contextResult.reason
    }

    const contextualCosts = contextResult.status === 'fulfilled' ? contextResult.value : []
    const fullCatalog = fullCatalogResult.status === 'fulfilled' ? fullCatalogResult.value : []
    const mergedCosts = new Map<string, CostSelectDto>()

    // The contextual API may reject a valid multi-port entry because PortId/
    // PoeId/PodId represent only the first historical selection. Reconcile with
    // the active catalog using explicit relation arrays as the source of truth.
    if (maritimeFcl) {
      fullCatalog
        .filter(maritimeFclCostMatchesCurrentContext)
        .forEach((cost) => mergedCosts.set(cost.id, cost))
      contextualCosts
        .filter(maritimeFclCostMatchesCurrentContext)
        .forEach((cost) => mergedCosts.set(cost.id, cost))
    } else {
      contextualCosts.forEach((cost) => mergedCosts.set(cost.id, cost))
    }

    costs.value = [...mergedCosts.values()].map((cost) => ({
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

  // Los costos que devolvió Pricing para el contexto completo son autoritativos.
  // No descartarlos otra vez por visibleSections, ya que esa lista modela presentación
  // por Incoterm y puede contradecir una asociación explícita del costo maestro.
  code = replaceRegexOne(
    code,
    /const configuredCosts = applicableConfiguredCosts\(\)\n  configuredCosts\.forEach\(\(cost\) => \{\n    const section = sectionForCost\(cost\)\n    if \(!visible\.has\(section\)\) return/,
    `const configuredCosts = applicableConfiguredCosts()
  configuredCosts.forEach((cost) => {
    const section = sectionForCost(cost)`,
    'configured cost visual-section filter',
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

    const previousSelected = new Set(
      selectableOptionalLines.value.filter((line) => line.included).map((line) => line.key),
    )
    const selected = new Set(keys)
    selectableOptionalLines.value.forEach((line) => {
      const automaticCostId = automaticOptionalCostId(line)
      if (!automaticCostId) return

      const wasSelected = previousSelected.has(line.key)
      const isSelected = selected.has(line.key)
      if (wasSelected && !isSelected) dismissedAutomaticOptionalCostIds.value.add(automaticCostId)
      if (!wasSelected && isSelected) dismissedAutomaticOptionalCostIds.value.delete(automaticCostId)
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
