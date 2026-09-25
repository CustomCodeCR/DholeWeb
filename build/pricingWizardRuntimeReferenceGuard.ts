import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-runtime-reference-guard-20260925'

function replaceOptional(source: string, anchor: string, replacement: string) {
  return source.includes(anchor) ? source.replace(anchor, replacement) : source
}

function hasRuntimeBinding(source: string, name: string) {
  if (new RegExp('\\b(?:async\\s+)?function\\s+' + name + '\\s*\\(').test(source)) return true
  if (new RegExp('\\b(?:const|let|var)\\s+' + name + '\\s*=').test(source)) return true

  const imports = source.match(/import[\\s\\S]*?from\\s+['"][^'"]+['"]/g) ?? []
  return imports.some((statement) => new RegExp('\\b' + name + '\\b').test(statement))
}

function ensureRuntimeFunction(
  source: string,
  name: string,
  definition: string,
  definitions: string[],
) {
  if (!source.includes(name + '(')) return
  if (hasRuntimeBinding(source, name)) return
  definitions.push(definition)
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
      "function enforceLineCurrency(_line: RateLine) {",
      "  // Runtime fallback only. The canonical currency metadata remains intact.",
      "}",
    ].join('\n'))
  }


  ensureRuntimeFunction(
    code,
    'sectionForCost',
    [
      "function sectionForCost(cost: CostSelectDto): RateSection {",
      "  if (cost.costDetailType !== 'Freight') {",
      "    const explicitSection = explicitSectionFromName(cost.name)",
      "    if (explicitSection) return explicitSection",
      "  }",
      "  const byPortRole = sectionFromPortRole(cost.portRole, cost.costDetailType)",
      "  if (byPortRole) return byPortRole",
      "  if (cost.polId && !cost.poeId && !cost.podId) {",
      "    return cost.costDetailType === 'InlandTransport' ? 'pickup_origin' : 'origin_charges'",
      "  }",
      "  if ((cost.poeId || cost.podId) && !cost.polId) {",
      "    return cost.costDetailType === 'InlandTransport' ? 'delivery_destination' : 'destination_charges'",
      "  }",
      "  return sectionForDetail(cost.costDetailType, cost.name)",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'sectionForManual',
    [
      "function sectionForManual(section: RateSection): CostDetailType {",
      "  if (section === 'international_freight') return 'Freight'",
      "  if (section === 'origin_charges') return 'OriginCharge'",
      "  if (section === 'destination_charges') return 'DestinationCharge'",
      "  if (section === 'pickup_origin' || section === 'delivery_destination') return 'InlandTransport'",
      "  return 'Other'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'defaultChargeBasis',
    [
      "function defaultChargeBasis(type: CostDetailType): ChargeBasis {",
      "  if (type === 'Documentation') return 'PerDocument'",
      "  if (type === 'Freight' || type === 'InlandTransport') {",
      "    if (shipmentModeForApi.value === 'Fcl') return 'PerContainer'",
      "    if (shipmentModeForApi.value === 'Ftl') return 'PerTruck'",
      "    if (shipmentModeForApi.value === 'Lcl' || shipmentModeForApi.value === 'Ltl') return 'PerChargeableCbm'",
      "  }",
      "  return 'PerShipment'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'detailTypeLabel',
    [
      "function detailTypeLabel(type: CostDetailType) {",
      "  return ({",
      "    Freight: 'Flete internacional',",
      "    AgentCharge: 'Costo de agente',",
      "    OriginCharge: 'Cargo en origen',",
      "    DestinationCharge: 'Cargo en destino',",
      "    PortCharge: 'Cargo portuario',",
      "    CustomsCharge: 'Aduana',",
      "    InlandTransport: 'Transporte interno',",
      "    Documentation: 'Documentación',",
      "    Insurance: 'Seguro',",
      "    Other: 'Otro',",
      "  } as Record<CostDetailType, string>)[type]",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'chargeBasisLabel',
    [
      "function chargeBasisLabel(basis: ChargeBasis) {",
      "  return ({",
      "    PerShipment: 'Por embarque',",
      "    PerService: 'Por Servicio',",
      "    PerContainer: 'Por contenedor',",
      "    PerTeu: 'Por TEU',",
      "    PerTruck: 'Por camión',",
      "    PerCbm: 'Por CBM',",
      "    PerChargeableCbm: 'Por CBM cobrable',",
      "    PerKg: 'Por kg',",
      "    Per100Kg: 'Por 100 kg',",
      "    PerTon: 'Por tonelada',",
      "    PerPallet: 'Por pallet',",
      "    PerPackage: 'Por bulto',",
      "    PerDocument: 'Por documento',",
      "  } as Record<ChargeBasis, string>)[basis]",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'costContextLabel',
    [
      "function costContextLabel(cost: CostSelectDto) {",
      "  const parts: string[] = []",
      "  if (cost.agentName) parts.push('Agente: ' + cost.agentName)",
      "  if (cost.carrierName) parts.push('Naviera: ' + cost.carrierName)",
      "  if (cost.polName) parts.push('POL: ' + cost.polName)",
      "  if (cost.poeName) parts.push('POE: ' + cost.poeName)",
      "  if (cost.podName) parts.push('POD: ' + cost.podName)",
      "  if (cost.portName && !parts.some((part) => part.includes(cost.portName!))) {",
      "    const role = cost.portRole && cost.portRole !== 'Any' ? cost.portRole.toUpperCase() : 'Puerto'",
      "    parts.push(role + ': ' + cost.portName)",
      "  }",
      "  return parts.join(' · ') || null",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'applicableConfiguredCosts',
    [
      "function applicableConfiguredCosts() {",
      "  return costs.value",
      "    .filter(applicableCost)",
      "    .sort((left, right) => costSpecificity(right) - costSpecificity(left))",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'isCargoConditionLine',
    [
      "function isCargoConditionLine(line: RateLine, kind: 'dangerous' | 'overweight') {",
      "  const value = normalizeCatalogValue(line.name)",
      "  return kind === 'dangerous'",
      "    ? value.includes('carga peligrosa') || value.includes('dangerous') || value.includes('hazmat')",
      "    : value.includes('sobrepeso') || value.includes('overweight') || value.includes('over weight')",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'canApplyDestinationTax',
    [
      "function canApplyDestinationTax(line: RateLine) {",
      "  return line.section === 'destination_charges' && line.costDetailType !== 'AgentCharge'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'lineDestinationTaxRate',
    [
      "function lineDestinationTaxRate(line: RateLine) {",
      "  const persistedRate = number(line.destinationTaxRate)",
      "  return persistedRate > 0 ? persistedRate : destinationTaxRate.value",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'lineTaxAmount',
    [
      "function lineTaxAmount(line: RateLine) {",
      "  const taxRate = lineDestinationTaxRate(line)",
      "  return line.applyDestinationTax && canApplyDestinationTax(line) && taxRate > 0",
      "    ? Math.round(number(line.saleAmount) * taxRate) / 100",
      "    : 0",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'lineTaxTotalAmount',
    [
      "function lineTaxTotalAmount(line: RateLine) {",
      "  return lineTaxAmount(line) * quantityForRateLine(line)",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'lineSaleWithTax',
    [
      "function lineSaleWithTax(line: RateLine) {",
      "  return number(line.saleAmount) + lineTaxAmount(line)",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'setLineDestinationTax',
    [
      "function setLineDestinationTax(line: RateLine, enabled: boolean) {",
      "  const active = Boolean(enabled) && canApplyDestinationTax(line) && destinationTaxRate.value > 0",
      "  line.applyDestinationTax = active",
      "  line.destinationTaxRate = active ? destinationTaxRate.value : 0",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'quantityForRateLine',
    [
      "function quantityForRateLine(line: RateLine) {",
      "  const explicitQuantity = number(line.quantityOverride)",
      "  if (explicitQuantity > 0) return explicitQuantity",
      "  return quantityForChargeBasis(line.chargeBasis)",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'rateEquipmentSummary',
    [
      "function rateEquipmentSummary(rate: RateDto) {",
      "  const mode = String(rate.shipmentMode).toLocaleLowerCase()",
      "  if (mode === 'lcl') return 'LCL · ' + Number(rate.chargeableQuantity || 0).toFixed(3) + ' CBM cobrable'",
      "  if (mode === 'ltl') return 'LTL · ' + Number(rate.chargeableQuantity || 0).toFixed(3) + ' CBM cobrable'",
      "  const allocations = (rate.containers ?? []).filter((container) => number(container.quantity) > 0)",
      "  if (allocations.length) {",
      "    return allocations",
      "      .map((container) => String(container.quantity) + ' × ' + (container.containerTypeName || container.containerTypeCode))",
      "      .join(' + ')",
      "  }",
      "  return String(rate.containerQuantity) + ' × ' + rate.containerTypeName",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'financialTone',
    [
      "function financialTone(value: number) {",
      "  if (value < 0) return 'danger'",
      "  if (value > 0) return 'success'",
      "  return 'neutral'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'validityTone',
    [
      "function validityTone(validTo: string) {",
      "  const days = remainingValidityDays(validTo)",
      "  if (days <= 3) return 'danger'",
      "  if (days <= 7) return 'warning'",
      "  return 'success'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'selectedSellerRequestExecutiveName',
    [
      "function selectedSellerRequestExecutiveName() {",
      "  const selected = sellerRequestOwnerOptions.value.find((option) => option.value === sellerRequestOwnerId.value)",
      "  return String(selected?.label || '').trim()",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'chooseLandLtlCommercialProfile',
    [
      "async function chooseLandLtlCommercialProfile(profile: LandCommercialProfile) {",
      "  if (profile === landLtlCommercialProfile.value && resolvedFtlTariff.value) return",
      "  landLtlCommercialProfile.value = profile",
      "  await searchApprovedRates()",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'appendPanamaProductionLandLine',
    [
      "function appendPanamaProductionLandLine(lines: RateLine[]) {",
      "  if (!panamaProductionNoSearchActive.value) return",
      "  const finalDestination = panamaProductionFinalDestination()",
      "  if (!isPanamaCostaRicaGamProductionRoute(finalDestination)) return",
      "  const usd = catalogs.currencies.find((currency) => {",
      "    const value = normalizeCatalogValue([currency.code, displayValue(currency), currency.label].filter(Boolean).join(' '))",
      "    return value === 'usd' || value.includes(' usd') || value.includes('dolar') || value.includes('dollar')",
      "  }) ?? null",
      "  if (!usd) return",
      "  lines.push({",
      "    key: 'panama-production:cfz-san-jose-2140',",
      "    section: 'international_freight',",
      "    name: 'Flete terrestre internacional CFZ / Zona Libre Colón, Panamá → ' + finalDestination,",
      "    costDetailType: 'InlandTransport',",
      "    costType: 'Variable',",
      "    chargeBasis: 'PerContainer',",
      "    contextLabel: 'CFZ / Zona Libre Colón, Panamá → ' + finalDestination + ' · Marítimo-terrestre',",
      "    notes: '[PANAMA_PRODUCTION_NO_SEARCH] Regla GCF multimodal: CFZ / Zona Libre Colón, Panamá → San José, Costa Rica · USD 2,140 por unidad. No realiza búsqueda adicional.',",
      "    currencyId: usd.id,",
      "    currencyName: displayValue(usd) || usd.label || 'USD',",
      "    currencyCode: String(usd.code || 'USD'),",
      "    amountCurrencyCode: String(usd.code || 'USD'),",
      "    costAmount: 2140,",
      "    saleAmount: 2140,",
      "    included: true,",
      "    optional: false,",
      "    manual: false,",
      "  })",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'calculateCargoInsurance',
    [
      "function calculateCargoInsurance(cargoValue: number, _freightAmount: number) {",
      "  const value = Math.max(0, Number(cargoValue) || 0)",
      "  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100",
      "  return {",
      "    insuredValue: roundMoney(value),",
      "    cost: Math.max(35, roundMoney(value * 0.002)),",
      "    sale: Math.max(95, roundMoney(value * 0.0065)),",
      "  }",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'cargoInsuranceNote',
    [
      "function cargoInsuranceNote(cargoValue: number, freightAmount: number) {",
      "  const calculated = calculateCargoInsurance(cargoValue, freightAmount)",
      "  return 'Seguro de carga · valor carga USD ' + calculated.insuredValue.toFixed(2) + ' · venta 0.65% · mínimo USD 95 · costo 0.20% · mínimo costo USD 35'",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

  ensureRuntimeFunction(
    code,
    'syncPersistedLinesWithChangedConfiguredCosts',
    [
      "function syncPersistedLinesWithChangedConfiguredCosts() {",
      "  if (!editingRate.value || props.viewOnly) return 0",
      "  const configuredCosts = applicableConfiguredCosts()",
      "  const persistedById = new Map(editingRate.value.rateDetails.map((detail) => [detail.id, detail] as const))",
      "  const resolveCurrentConfiguredCost = (line: RateLine) => {",
      "    const normalizedLineName = normalizeCatalogValue(line.name)",
      "    const sameLogicalCharge = configuredCosts.find((cost) =>",
      "      normalizeCatalogValue(cost.name) === normalizedLineName && cost.costDetailType === line.costDetailType,",
      "    )",
      "    if (sameLogicalCharge) return sameLogicalCharge",
      "    const sameName = configuredCosts.filter((cost) => normalizeCatalogValue(cost.name) === normalizedLineName)",
      "    if (sameName.length === 1) return sameName[0]",
      "    return line.costId ? configuredCosts.find((cost) => cost.id === line.costId) ?? null : null",
      "  }",
      "  let changedCount = 0",
      "  rateLines.value.forEach((line) => {",
      "    if (!line.costId || line.costDetailType === 'Freight') return",
      "    const configured = resolveCurrentConfiguredCost(line)",
      "    if (!configured) return",
      "    const persisted = line.detailId",
      "      ? persistedById.get(line.detailId)",
      "      : editingRate.value?.rateDetails.find((detail) => detail.costId === line.costId)",
      "    if (!persisted) return",
      "    const configuredChargeBasis = configured.chargeBasis ?? defaultChargeBasis(configured.costDetailType)",
      "    const catalogChanged =",
      "      persisted.name.trim() !== configured.name.trim()",
      "      || persisted.costDetailType !== configured.costDetailType",
      "      || persisted.costType !== configured.costType",
      "      || persisted.chargeBasis !== configuredChargeBasis",
      "      || persisted.currencyId !== configured.currencyId",
      "      || persisted.currencyCode.trim().toUpperCase() !== configured.currencyCode.trim().toUpperCase()",
      "      || number(persisted.costAmount) !== number(configured.costAmount)",
      "      || number(persisted.saleAmount) !== number(configured.saleAmount)",
      "      || String(persisted.notes ?? '').trim() !== String(configured.notes ?? '').trim()",
      "    if (!catalogChanged) return",
      "    line.section = sectionForCost(configured)",
      "    line.name = configured.name",
      "    line.costDetailType = configured.costDetailType",
      "    line.costType = configured.costType",
      "    line.chargeBasis = configuredChargeBasis",
      "    line.contextLabel = costContextLabel(configured)",
      "    line.notes = configured.notes?.trim() || null",
      "    line.serviceIds = configured.services?.map((service) => service.id) ?? []",
      "    line.currencyId = configured.currencyId",
      "    line.currencyName = configured.currencyName",
      "    line.currencyCode = configured.currencyCode",
      "    line.amountCurrencyCode = configured.currencyCode",
      "    line.costAmount = number(configured.costAmount)",
      "    line.saleAmount = number(configured.saleAmount)",
      "    line.optional = configured.costType === 'Optional'",
      "    line.manual = false",
      "    enforceLineCurrency(line)",
      "    changedCount += 1",
      "  })",
      "  return changedCount",
      "}",
    ].join('\n'),
    missingRuntimeDefinitions,
  )

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


  const guardedRuntimeFunctions = [
    'automaticOptionalCostId',
    'sectionForDetail',
    'screen4OptionalConditionSelection',
    'canonicalCurrencyCode',
    'convertUsdCrc',
    'enforceLineCurrency',
    'sectionForCost',
    'sectionForManual',
    'defaultChargeBasis',
    'detailTypeLabel',
    'chargeBasisLabel',
    'costContextLabel',
    'applicableConfiguredCosts',
    'isCargoConditionLine',
    'canApplyDestinationTax',
    'lineDestinationTaxRate',
    'lineTaxAmount',
    'lineTaxTotalAmount',
    'lineSaleWithTax',
    'setLineDestinationTax',
    'quantityForRateLine',
    'rateEquipmentSummary',
    'financialTone',
    'validityTone',
    'selectedSellerRequestExecutiveName',
    'chooseLandLtlCommercialProfile',
    'appendPanamaProductionLandLine',
    'calculateCargoInsurance',
    'cargoInsuranceNote',
    'syncPersistedLinesWithChangedConfiguredCosts',
  ]

  for (const name of guardedRuntimeFunctions) {
    if (code.includes(name + '(') && !hasRuntimeBinding(code, name)) {
      throw new Error('[pricingWizardRuntimeReferenceGuard] ' + name + ' remained undefined after final fallback injection.')
    }
  }

  if (
    code.includes('canonicalCurrencyCode(')
    && !code.includes('function canonicalCurrencyCode(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] canonicalCurrencyCode remained undefined after fallback injection.')
  }
  if (
    code.includes('convertUsdCrc(')
    && !code.includes('function convertUsdCrc(')
  ) {
    throw new Error('[pricingWizardRuntimeReferenceGuard] convertUsdCrc remained undefined after fallback injection.')
  }

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
