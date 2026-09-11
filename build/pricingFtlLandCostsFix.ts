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
  // Pantalla 7 el contexto real debe ser el POE de la tarifa importada seleccionada.
  // Además enviamos importRateId para que Pricing vuelva a resolver el POE de forma
  // autoritativa y no dependa exclusivamente del estado local del frontend.
  code = replaceRegexOne(
    code,
    /function applicableCost\(cost: CostSelectDto\) \{[\s\S]*?\n\}\n\nfunction costSpecificity/,
    `function costContextImportRateId() {
  if (!isMultimodalViaPanama(selectedDestination.value)) return ''
  return String(form.selectedImportRateId ?? '').trim()
}

function costContextPoeId() {
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

function applicableCost(cost: CostSelectDto) {
  const backendContextMatched = costResolvedByBackendContext(cost)
  const contextPoeId = costContextPoeId()

  if (!backendContextMatched) {
    if (cost.services?.length && !cost.services.some((service) => form.serviceIds.includes(service.id))) return false
    if (cost.shipmentMode && cost.shipmentMode !== shipmentModeForApi.value) return false
    if (cost.incoterms?.length && !cost.incoterms.some((incoterm) => incoterm.id === form.incotermId)) return false
    if (cost.carrierId && cost.carrierId !== form.carrierId) return false
    if (cost.agentId && cost.agentId !== form.agentId) return false
    if (cost.polId && cost.polId !== form.originId) return false
    if (cost.poeId && cost.poeId !== contextPoeId) return false
    if (cost.podId && cost.podId !== form.podId) return false

    if (cost.portId) {
      const matchesLegacyPort = cost.portRole === 'Pol'
        ? cost.portId === form.originId
        : cost.portRole === 'Poe'
          ? cost.portId === contextPoeId
          : cost.portRole === 'Pod'
            ? cost.portId === form.podId
            : [form.originId, contextPoeId, form.podId].includes(cost.portId)
      if (!matchesLegacyPort) return false
    }
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

  code = replaceRegexOne(
    code,
    /async function loadApplicableCosts\(\) \{[\s\S]*?\n\}\n\nfunction rebuildRateLines/,
    `async function loadApplicableCosts() {
  try {
    const contextKey = currentCostContextKey()
    const importRateId = costContextImportRateId()
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

    costs.value = selectedCosts.map((cost) => ({
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
