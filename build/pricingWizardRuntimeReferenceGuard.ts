import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-runtime-reference-guard-20260925'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function patchWizard(source: string) {
  let code = source
  if (code.includes(MARKER)) return code

  code = replaceOptional(
    code,
    '    const contextKey = currentCostContextKey()',
    '    const contextKey = dholeRuntimeCostContextKey()',
  )
  code = replaceOptional(
    code,
    '    const importRateId = costContextImportRateId()',
    '    const importRateId = dholeRuntimeCostContextImportRateId()',
  )
  code = replaceOptional(
    code,
    '      poeId: costContextPoeId() || undefined,',
    '      poeId: dholeRuntimeCostContextPoeId() || undefined,',
  )
  code = replaceOptional(
    code,
    '  const backendContextMatched = costResolvedByBackendContext(cost)',
    '  const backendContextMatched = dholeRuntimeCostResolvedByBackendContext(cost)',
  )
  code = replaceOptional(
    code,
    '    if (!costMatchesHardRouteContext(cost)) return false',
    '    if (!dholeRuntimeCostMatchesHardRouteContext(cost)) return false',
  )
  code = replaceOptional(
    code,
    '    const restoredMixedFclFreight = restorePersistedFclDistribution(rate)',
    '    const restoredMixedFclFreight = dholeRuntimeRestorePersistedFclDistribution(rate)',
  )

  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] script end not found.')
  }

  const missingRuntimeDefinitions: string[] = []

  if (
    code.includes('canonicalCurrencyCode(')
    && !code.includes('function canonicalCurrencyCode(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] canonicalCurrencyCode remained undefined.')
  }
  if (
    code.includes('convertUsdCrc(')
    && !code.includes('function convertUsdCrc(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] convertUsdCrc remained undefined.')
  }

  if (
    code.includes('automaticOptionalContextKey.value')
    && !code.includes('const automaticOptionalContextKey = ref(')
  ) {
    missingRuntimeDefinitions.push("const automaticOptionalContextKey = ref('')")
  }

  if (
    code.includes('dismissedAutomaticOptionalCostIds.value')
    && !code.includes('const dismissedAutomaticOptionalCostIds = ref(')
  ) {
    missingRuntimeDefinitions.push("const dismissedAutomaticOptionalCostIds = ref(new Set<string>())")
  }

  if (
    code.includes('canManageAutomaticOptionalCosts')
    && !code.includes('const canManageAutomaticOptionalCosts = computed(')
  ) {
    missingRuntimeDefinitions.push(
      "const canManageAutomaticOptionalCosts = computed(() => !props.sellerRequestMode && !props.viewOnly)",
    )
  }

  if (
    code.includes('automaticOptionalCostId(')
    && !code.includes('function automaticOptionalCostId(')
  ) {
    missingRuntimeDefinitions.push([
      "function automaticOptionalCostId(line: { id?: string | null; costId?: string | null }) {",
      "  return String(line.costId ?? line.id ?? '').trim()",
      "}",
    ].join('\n'))
  }

  if (
    code.includes('sectionForDetail(')
    && !code.includes('function sectionForDetail(')
  ) {
    missingRuntimeDefinitions.push([
      "function sectionForDetail(type: CostDetailType, name = ''): RateSection {",
      "  const normalized = normalizeCatalogValue(name)",
      "  const mentionsOrigin = /(^| )(origen|origin)( |$)/.test(normalized)",
      "  const mentionsDestination = /(^| )(destino|destination)( |$)/.test(normalized)",
      "  const mentionsPickup = /recole|pick\\s*up/.test(normalized)",
      "  const mentionsDelivery = /entrega|delivery/.test(normalized)",
      "",
      "  if (type !== 'Freight') {",
      "    if (mentionsPickup) return 'pickup_origin'",
      "    if (mentionsDelivery) return 'delivery_destination'",
      "    if (mentionsOrigin && !mentionsDestination) return 'origin_charges'",
      "    if (mentionsDestination && !mentionsOrigin) return 'destination_charges'",
      "  }",
      "",
      "  if (type === 'Freight') return 'international_freight'",
      "  if (type === 'OriginCharge') return 'origin_charges'",
      "  if (type === 'DestinationCharge' || type === 'Insurance') return 'destination_charges'",
      "  if (type === 'PortCharge') return mentionsOrigin ? 'origin_charges' : 'destination_charges'",
      "  if (type === 'InlandTransport') return mentionsPickup || mentionsOrigin ? 'pickup_origin' : 'delivery_destination'",
      "  if (type === 'CustomsCharge') return mentionsOrigin || normalized.includes('exterior') || normalized.includes('export') ? 'origin_charges' : 'destination_charges'",
      "  if (type === 'AgentCharge') {",
      "    return normalizeCatalogValue(direction.value).includes('exportacion') ? 'origin_charges' : 'destination_charges'",
      "  }",
      "  if (type === 'Documentation') return 'international_freight'",
      "  return 'destination_charges'",
      "}",
    ].join('\n'))
  }

  if (
    code.includes('screen4OptionalConditionSelection(')
    && !code.includes('function screen4OptionalConditionSelection(')
  ) {
    missingRuntimeDefinitions.push([
      "function screen4OptionalConditionSelection(line: { name: string; notes?: string | null }) {",
      "  if (form.modality !== 'Maritime' || shipmentModeForApi.value !== 'Fcl') return null",
      "  const value = normalizeCatalogValue(String(line.name ?? '') + ' ' + String(line.notes ?? ''))",
      "  const emptyReturn = value.includes('retiro vacio') || value.includes('retiro de vacio') || value.includes('empty return') || value.includes('empty container return') || value.includes('return empty')",
      "  if (emptyReturn) return Boolean(form.emptyReturn)",
      "  const electronicSeal = value.includes('marchamo electronico') || value.includes('electronic seal') || value.includes('electronic security seal') || value.includes('e seal')",
      "  if (electronicSeal) return Boolean(form.electronicSeal)",
      "  return null",
      "}",
    ].join('\n'))
  }

  if (
    code.includes('canonicalCurrencyCode(')
    && !code.includes('function canonicalCurrencyCode(')
  ) {
    missingRuntimeDefinitions.push([
      "function canonicalCurrencyCode(line: Pick<RateLine, 'currencyId' | 'currencyCode' | 'currencyName'>) {",
      "  const catalogCurrency = findById(catalogs.currencies, line.currencyId)",
      "  const candidates = [",
      "    line.currencyCode,",
      "    line.currencyName,",
      "    catalogCurrency?.code,",
      "    catalogCurrency?.slug,",
      "    catalogCurrency?.label,",
      "    displayValue(catalogCurrency),",
      "  ]",
      "",
      "  for (const candidate of candidates) {",
      "    const raw = String(candidate ?? '').trim()",
      "    const normalized = normalizeCatalogValue(raw)",
      "    const upper = raw.toUpperCase()",
      "    if (upper === 'USD' || normalized === 'usd' || normalized.includes('dolar') || normalized.includes('dollar')) {",
      "      return 'USD' as const",
      "    }",
      "    if (",
      "      upper === 'CRC'",
      "      || normalized === 'crc'",
      "      || normalized.includes('colon costarricense')",
      "      || normalized.includes('colones')",
      "      || normalized === 'colon'",
      "    ) {",
      "      return 'CRC' as const",
      "    }",
      "  }",
      "",
      "  return String(line.currencyCode ?? '').trim().toUpperCase()",
      "}",
    ].join('\n'))
  }

  if (
    code.includes('convertUsdCrc(')
    && !code.includes('function convertUsdCrc(')
  ) {
    missingRuntimeDefinitions.push([
      "function convertUsdCrc(amount: number, sourceCode: string, targetCode: 'USD' | 'CRC') {",
      "  const source = String(sourceCode || 'USD').trim().toUpperCase()",
      "  if (source === targetCode) return number(amount)",
      "  const rate = number(exchangeRateSale.value)",
      "  if (rate <= 0) return 0",
      "  if (source === 'USD' && targetCode === 'CRC') return number(amount) * rate",
      "  if (source === 'CRC' && targetCode === 'USD') return number(amount) / rate",
      "  return 0",
      "}",
    ].join('\n'))
  }

  if (
    code.includes('enforceLineCurrency(')
    && !code.includes('function enforceLineCurrency(')
  ) {
    missingRuntimeDefinitions.push([
      "function enforceLineCurrency(line: RateLine) {",
      "  if (typeof isLineCrcForced === 'function' && isLineCrcForced(line) && crcCurrency.value) {",
      "    if (typeof setLineCurrency === 'function') setLineCurrency(line, crcCurrency.value.id)",
      "  }",
      "}",
    ].join('\n'))
  }

  const helpers = `// dhole-runtime-reference-guard-20260925
${missingRuntimeDefinitions.join('\n\n')}
${missingRuntimeDefinitions.length ? '\n\n' : ''}function dholeRuntimeCostContextImportRateId() {
  const selectedRateId = String(form.selectedImportRateId ?? '').trim()
  if (!selectedRateId) return String(manualOceanFreightSavedId.value ?? '').trim()
  if (!isMultimodalViaPanama(selectedDestination.value)) return ''
  return selectedRateId
}

function dholeRuntimeCostContextPoeId() {
  const manualPoeId = String(manualOceanFreightPoeId.value ?? '').trim()
  if (!form.selectedImportRateId && manualPoeId) return manualPoeId
  if (!isMultimodalViaPanama(selectedDestination.value)) return form.destinationId
  return String(selectedImportRate.value?.poeId ?? '').trim() || form.destinationId
}

function dholeRuntimeCostContextKey() {
  return [
    shipmentModeForApi.value,
    form.originId,
    dholeRuntimeCostContextPoeId(),
    form.podId,
    form.incotermId,
    form.carrierId,
    form.agentId,
    dholeRuntimeCostContextImportRateId(),
    [...form.serviceIds].sort().join(','),
  ].join('|')
}

function dholeRuntimeCostResolvedByBackendContext(cost: CostSelectDto) {
  return String(cost.__dholePricingContextKey ?? '') === dholeRuntimeCostContextKey()
}

function dholeRuntimeCostMatchesHardRouteContext(cost: CostSelectDto) {
  const contextPoeId = dholeRuntimeCostContextPoeId()
  const selectedPodId = String(form.podId ?? '').trim()

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

function dholeRuntimePersistedFclFreightForContainer(
  rate: RateDto,
  container: { containerTypeName?: string | null; containerTypeCode?: string | null },
  fallbackIndex: number,
) {
  const freight = (rate.rateDetails ?? []).filter((detail) => detail.costDetailType === 'Freight')
  const candidates = [container.containerTypeName, container.containerTypeCode]
    .map((value) => normalizeCatalogValue(String(value ?? '')))
    .filter(Boolean)
  const matched = freight.find((detail) => {
    const source = normalizeCatalogValue(String(detail.name ?? '') + ' ' + String(detail.notes ?? ''))
    return candidates.some((candidate) => source.includes(candidate))
  })
  return matched ?? freight[fallbackIndex] ?? null
}

function dholeRuntimeRestorePersistedFclDistribution(rate: RateDto) {
  if (String(rate.shipmentMode).toLocaleLowerCase() !== 'fcl') return false

  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)
  if (allocations.length <= 1) {
    fclExtraContainers.value = []
    return false
  }

  const primary =
    allocations.find((container) => container.containerTypeId === rate.containerTypeId)
    ?? allocations[0]

  form.equipmentId = primary.containerTypeId
  form.equipmentQuantity = Math.max(1, Math.trunc(number(primary.quantity)))

  const primaryIndex = allocations.findIndex(
    (container) => container.containerTypeId === primary.containerTypeId,
  )
  const primaryFreight = dholeRuntimePersistedFclFreightForContainer(
    rate,
    primary,
    Math.max(0, primaryIndex),
  )
  form.freightCost = number(primaryFreight?.costAmount)
  form.freightSale = number(primaryFreight?.saleAmount)

  fclExtraContainers.value = allocations
    .filter((container) => container.containerTypeId !== primary.containerTypeId)
    .map((container) => {
      const allocationIndex = allocations.findIndex(
        (candidate) => candidate.containerTypeId === container.containerTypeId,
      )
      const freight = dholeRuntimePersistedFclFreightForContainer(
        rate,
        container,
        Math.max(0, allocationIndex),
      )
      return {
        key: crypto.randomUUID(),
        containerTypeId: container.containerTypeId,
        quantity: Math.max(1, Math.trunc(number(container.quantity))),
        freightCostAmount: number(freight?.costAmount),
        freightSaleAmount: number(freight?.saleAmount),
        freightTouched: true,
      }
    })

  return true
}

`

  code = code.slice(0, scriptEnd) + helpers + code.slice(scriptEnd)

  if (
    code.includes('automaticOptionalContextKey.value')
    && !code.includes('const automaticOptionalContextKey = ref(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] automaticOptionalContextKey remained undefined.')
  }
  if (
    code.includes('sectionForDetail(')
    && !code.includes('function sectionForDetail(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] sectionForDetail remained undefined.')
  }
  if (
    code.includes('dismissedAutomaticOptionalCostIds.value')
    && !code.includes('const dismissedAutomaticOptionalCostIds = ref(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] dismissedAutomaticOptionalCostIds remained undefined.')
  }

  if (code.includes('const contextKey = currentCostContextKey()')) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] currentCostContextKey call remained unresolved.')
  }
  if (code.includes('const restoredMixedFclFreight = restorePersistedFclDistribution(rate)')) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] restorePersistedFclDistribution call remained unresolved.')
  }

  return code
}

export function pricingWizardRuntimeReferenceGuard(): Plugin {
  return {
    name: 'dhole-pricing-wizard-runtime-reference-guard',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
