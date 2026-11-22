import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

const OWN_LCL_AGENCY_COST_HELPERS = String.raw`
// Own LCL keeps its consolidation matrix, but selected Costa Rica customs is a
// separate service from Pricing Costs. Never replace or reprice the matrix.
function ownLclCustomsRelationMatches(
  relations: Array<{ id: string }> | null | undefined,
  legacyId: string | null | undefined,
  selectedId: string | null | undefined,
) {
  const ids = Array.isArray(relations)
    ? relations.map((item) => String(item.id ?? '')).filter(Boolean)
    : []
  if (ids.length) return Boolean(selectedId) && ids.includes(String(selectedId))
  return !legacyId || Boolean(selectedId) && String(legacyId) === String(selectedId)
}

function ownLclCustomsCostApplies(cost: CostSelectDto, serviceId: string) {
  if (cost.isActive === false || cost.costDetailType === 'Freight') return false
  if (!cost.services?.some((item) => item.id === serviceId)) return false
  const modes = cost.shipmentModes?.length ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []
  if (modes.length && !modes.some((mode) => ['lcl', 'any'].includes(String(mode).toLowerCase()))) return false
  if (cost.incoterms?.length && !cost.incoterms.some((item) => item.id === form.incotermId)) return false
  // LCL propio has no naviera: don't import shipping-line costs.
  if (cost.carrierId || cost.carriers?.length) return false

  const matches = ownLclCustomsRelationMatches
  if (!matches(cost.pols, cost.polId, form.originId)) return false
  if (!matches(cost.poes, cost.poeId, costContextPoeId())) return false
  if (!matches(cost.pods, cost.podId, form.podId)) return false

  const agentId = costContextAgentId()
  const ownGcfAgent = lclSelectedSource.value?.kind === 'Own'
    && normalizeCatalogValue([cost.agentName, cost.agentCode].filter(Boolean).join(' '))
      .match(/grupo castro fallas|\bgcf\b/)
  if ((cost.agentId || cost.agents?.length)
    && !matches(cost.agents, cost.agentId, agentId) && !ownGcfAgent) return false

  if (cost.portId) {
    const role = String(cost.portRole ?? '').toLowerCase()
    const relations = role === 'pol' ? cost.pols : role === 'poe' ? cost.poes : role === 'pod' ? cost.pods : null
    if (!relations?.length) {
      const expected = role === 'pol' ? form.originId
        : role === 'poe' ? costContextPoeId()
        : role === 'pod' ? form.podId : ''
      if (expected ? cost.portId !== expected
        : ![form.originId, costContextPoeId(), form.podId].includes(cost.portId)) return false
    }
  }
  return true
}

const ownLclCrcMasterCosts391: { value: CostSelectDto[] } = { value: [] }
let ownLclCrcMasterRequest391 = 0

async function loadOwnLclCrcMasterCosts391() {
  const service = selectedCrcCustomsService.value
  const request = ++ownLclCrcMasterRequest391
  // This matrix path normally zeroes costs.value; retrieve the service
  // independently without replacing ANY consolidation line or its prices.
  if (props.viewOnly || hydratingExistingRate.value || step.value !== 7
      || !isOwnLclMatrixContext() || shipmentModeForApi.value !== 'Lcl'
      || !service || !crcImportContext.value) {
    ownLclCrcMasterCosts391.value = []
    return
  }
  const snapshot = [
    form.originId, form.destinationId, form.podId, form.incotermId,
    costContextAgentId(), service.id, form.cargoWeightKg,
  ].join('|')
  try {
    const bundle = await PricingService.selectWizardCosts({
      carrierId: undefined,
      agentId: costContextAgentId() || undefined,
      polId: form.originId || undefined,
      poeId: costContextPoeId() || undefined,
      podId: form.podId || undefined,
      incotermId: form.incotermId || undefined,
      shipmentMode: 'Lcl',
      isActive: true,
      applicableToContext: true,
      serviceIds: form.serviceIds.join(',') || service.id,
      weightKg: number(form.cargoWeightKg) > 0 ? number(form.cargoWeightKg) : undefined,
      packages: number(form.cargoPackages) > 0 ? Math.trunc(number(form.cargoPackages)) : undefined,
      storageDays: number(form.storageDays) > 0 ? Math.trunc(number(form.storageDays)) : undefined,
    })
    if (request !== ownLclCrcMasterRequest391 || snapshot !== [
      form.originId, form.destinationId, form.podId, form.incotermId,
      costContextAgentId(), service.id, form.cargoWeightKg,
    ].join('|')) return
    // Backend-applicable is authoritative. For legacy own-LCL profiles whose
    // optional agent differs, only a globally unscoped exact service master
    // may be considered from the same bundle catalog.
    const extras = bundle.catalog.filter((cost) =>
      !cost.agentId && !cost.agents?.length && !cost.carrierId && !cost.carriers?.length
      && !cost.polId && !cost.pols?.length
      && !cost.poeId && !cost.poes?.length && !cost.podId && !cost.pods?.length
      && ownLclCustomsCostApplies(cost, service.id))
    ownLclCrcMasterCosts391.value = [...bundle.applicable, ...extras]
      .filter((cost, index, rows) => rows.findIndex((item) => item.id === cost.id) === index)
    syncOwnLclCrcAgencyLine()
  } catch (error) {
    if (request === ownLclCrcMasterRequest391)
      toastStore.backendError(error, 'No se pudo consultar el servicio aduanal LCL por tramo.')
  }
}
// Unit VMs execute the isolated helper without Vue; the actual wizard has watch.
if (typeof watch === 'function') watch(
  () => [step.value, hydratingExistingRate.value, form.serviceIds.join('|'),
    form.originId, form.destinationId, form.podId, form.incotermId,
    form.agentId, form.cargoWeightKg, form.cargoPackages, form.storageDays,
    lclSelectedSource.value?.kind] as const,
  () => { void loadOwnLclCrcMasterCosts391() },
  { flush: 'post', immediate: true },
)

function syncOwnLclCrcAgencyLine(forceReprice = false) {
  // Preserve the LCL consolidation matrix. The CRC customs service selected
  // by Sales is a separate, explicitly requested destination charge.
  if (props.viewOnly || shipmentModeForApi.value !== 'Lcl'
    || !isOwnLclMatrixContext() || !crcImportContext.value) return
  const service = selectedCrcCustomsService.value
  if (!service || !visibleSections.value.includes('destination_charges')) return

  // Pricing's full active catalog is loaded at wizard initialization. Service
  // association and complete route restrictions are authoritative; names are not.
  const configured = [...ownLclCrcMasterCosts391.value, ...costs.value]
    .filter((cost, index, rows) => rows.findIndex((row) => row.id === cost.id) === index)
    .filter((cost) => ownLclCustomsCostApplies(cost, service.id))
    .sort((a, b) => costSpecificity(b) - costSpecificity(a))[0]
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return
  if (!configured) {
    ensureCrcCustomsLine(rateLines.value, currency)
    return
  }

  const price = resolveCostPricing(configured, {
    weightKg: number(form.cargoWeightKg) > 0 ? number(form.cargoWeightKg) : null,
    packages: number(form.cargoPackages) > 0 ? Math.trunc(number(form.cargoPackages)) : null,
    storageDays: number(form.storageDays) > 0 ? Math.trunc(number(form.storageDays)) : null,
    containerTypeId: selectedEquipment.value?.id ?? null,
  })
  const selectedCurrencyForCost = findById(catalogs.currencies, configured.currencyId)
    ?? catalogs.currencies.find((item) =>
      String(item.code ?? '').toUpperCase() === String(configured.currencyCode ?? '').toUpperCase())
    ?? crcCurrency.value ?? currency
  const key = 'own-lcl-customs:' + configured.id
  const matchesAgencyLine = (line: RateLine) =>
    line.key === key || line.costId === configured.id
    || line.key === 'service:customs-cr'
    || isCrcCustomsLine(line, service.id)
    || (line.section === 'destination_charges'
      && normalizeCatalogValue(line.name) === normalizeCatalogValue(configured.name))
  const existingAgencyLines = rateLines.value.filter(matchesAgencyLine)
  const manual = existingAgencyLines.find((line) => line.manual && number(line.saleAmount) > 0)
  // An explicitly entered paid customs line is already the selected service.
  // Do not overwrite it or append a second master-cost row during normal edits.
  if (manual && !forceReprice) {
    rateLines.value = rateLines.value.filter((line) =>
      line === manual || !existingAgencyLines.includes(line) || Boolean(line.detailId))
    return
  }
  const existing = existingAgencyLines.find((line) => Boolean(line.detailId))
    ?? existingAgencyLines[0]
  const line: RateLine = {
    key,
    detailId: existing?.detailId ?? null,
    section: 'destination_charges',
    name: configured.name,
    // DestinationCharge is a valid master classification; on a quote this
    // service must be CustomsCharge for the save validator to recognize it.
    costDetailType: 'CustomsCharge',
    costType: 'Variable',
    chargeBasis: configured.chargeBasis ?? 'PerShipment',
    // Own-LCL uses matrix prices as its base. Supplemental CRC service
    // snapshots must not be removed by backend fixed CostId synchronization.
    costId: null,
    contextLabel: price
      ? costContextLabel(configured)
      : 'No se encontró un tramo de precio para el peso indicado. Revise los kg antes de guardar.',
    notes: [
      String(existing?.notes ?? configured.notes ?? '').split(/\s+·\s+/)
        .filter((part) => !part.startsWith('Costo maestro Pricing:')
          && part !== 'Servicio aduanal CRC seleccionado').join(' · ').trim(),
      'Costo maestro Pricing: ' + configured.id,
      'Servicio aduanal CRC seleccionado',
    ].filter((part, index, all) => part && all.indexOf(part) === index).join(' · '),
    serviceIds: configured.services?.map((item) => item.id) ?? [service.id],
    currencyId: existing?.detailId && !forceReprice ? existing.currencyId : selectedCurrencyForCost.id,
    currencyName: existing?.detailId && !forceReprice ? existing.currencyName : displayValue(selectedCurrencyForCost),
    currencyCode: existing?.detailId && !forceReprice ? existing.currencyCode : selectedCurrencyForCost.code,
    amountCurrencyCode: existing?.detailId && !forceReprice
      ? existing.amountCurrencyCode ?? existing.currencyCode
      : selectedCurrencyForCost.code,
    costAmount: existing?.detailId && !forceReprice ? number(existing.costAmount) : number(price?.costAmount),
    saleAmount: existing?.detailId && !forceReprice ? number(existing.saleAmount) : number(price?.saleAmount),
    included: true,
    optional: false,
    manual: false,
    billToClient: existing?.billToClient ?? null,
    applyDestinationTax: existing?.applyDestinationTax ?? false,
    destinationTaxRate: existing?.destinationTaxRate ?? 0,
  }
  if (existing) Object.assign(existing, line)
  else rateLines.value.push(line)
  // On explicit database refresh, replace stale generated placeholders.
  // Never delete a persisted detail automatically; its id must remain available.
  if (existing) {
    rateLines.value = rateLines.value.filter((item) =>
      item === existing || !existingAgencyLines.includes(item) || Boolean(item.detailId))
  }
}
`


function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardOwnLclLinePersistence] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  // The base Vue file declares this helper for vue-tsc. The plugin supplies
  // the source-aware implementation at addManualCharge(), so strip the fallback
  // from the transformed code before inserting the definitive implementation.
  const typeCheckOwnMatrixHelper = `function isOwnLclMatrixContext() {
  const currentNotes = includedLines.value.map((line) => String(line.notes ?? ''))
  // Prefer the actively selected source over the historical rate when switching coloader/own.
  if (currentNotes.some((note) => /Fuente LCL:\\s*Coloader|LCL\\s+COLOADER/i.test(note))) return false
  if (currentNotes.some((note) => /Fuente LCL:\\s*Propio|LCL\\s*PROPIO|ConsolidadoId:/i.test(note))) return true
  return Boolean(editingRate.value?.rateDetails.some((detail) =>
    /Fuente LCL:\\s*Propio|LCL\\s*PROPIO|ConsolidadoId:/i.test(String(detail.notes ?? '')),
  ))
}
`
  if (code.includes(typeCheckOwnMatrixHelper)) {
    code = code.replace(typeCheckOwnMatrixHelper, '')
  }


  code = replaceOne(
    code,
    `function addManualCharge() {`,
    `function isOwnLclMatrixSourceActive() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  if (lclSelectedSource.value?.kind === 'Own') return true\n  return String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  // Active coloader source supersedes historical own LCL matrix notes.\n  if (lclSelectedSource.value?.kind === 'Coloader') return false\n  if (String(lclSelectedSourceKey.value ?? '').startsWith('Coloader:')) return false\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction syncOwnLclFreightLineFromProvider() {\n  const source = lclSelectedSource.value\n  if (source?.kind !== 'Own') return\n\n  const cost = number(form.freightCost)\n  const sale = number(form.freightSale)\n  const sourceFreight = source.lines.find((line) => line.costDetailType === 'Freight')\n  if (sourceFreight) {\n    sourceFreight.costAmount = cost\n    sourceFreight.saleAmount = sale\n  }\n\n  const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = cost\n    freight.saleAmount = sale\n  }\n}\n\nfunction persistedOwnLclConsolidationId() {\n  const rate = editingRate.value\n  if (!rate || rate.shipmentMode !== 'Lcl') return ''\n\n  for (const detail of rate.rateDetails ?? []) {\n    const match = String(detail.notes ?? '').match(\n      /ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,\n    )\n    if (match?.[1]) return match[1]\n  }\n\n  return ''\n}\n\nfunction persistedOwnLclContextUnchanged() {\n  const rate = editingRate.value\n  if (!props.rateId || !rate || rate.shipmentMode !== 'Lcl') return false\n\n  const persistedConsolidationId = persistedOwnLclConsolidationId()\n  if (!persistedConsolidationId) return false\n\n  const selectedSourceId =\n    lclSelectedSource.value?.kind === 'Own'\n      ? String(lclSelectedSource.value.id ?? '')\n      : String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n        ? String(lclSelectedSourceKey.value).slice(4)\n        : ''\n\n  if (selectedSourceId && selectedSourceId !== persistedConsolidationId) return false\n\n  // For own LCL, the consolidation id is the authoritative pricing source.\n  // Agent/carrier fields may hydrate a few ticks later, so they must not make\n  // Pantalla 7 recalculate the quote as if it were a new consolidation.\n  return String(rate.polId ?? '') === String(form.originId ?? '')\n    && String(rate.poeId ?? '') === String(form.destinationId ?? '')\n    && String(rate.podId ?? '') === String(form.podId ?? '')\n    && String(rate.incotermId ?? '') === String(form.incotermId ?? '')\n}\n\nfunction persistedOwnLclRateLine(detail: RateDto['rateDetails'][number]): RateLine {\n  const normalizedName = normalizeCatalogValue(detail.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n  const detailType: CostDetailType = isPickup ? 'OriginCharge' : detail.costDetailType\n  const chargeBasis: ChargeBasis = normalizedName === 'cfs' ? 'PerChargeableCbm' : detail.chargeBasis\n\n  return {\n    key: \`existing:\${detail.id}\`,\n    detailId: detail.id,\n    section: isPickup ? 'pickup_origin' : sectionForDetail(detailType, detail.name),\n    name: detail.name,\n    costDetailType: detailType,\n    costType: detail.costType,\n    chargeBasis,\n    costId: null,\n    notes: detail.notes ?? null,\n    billToClient: detail.billToClient ?? null,\n    currencyId: detail.currencyId,\n    currencyName: detail.currencyName,\n    currencyCode: detail.currencyCode,\n    amountCurrencyCode: detail.currencyCode,\n    costAmount: Number(detail.costAmount || 0),\n    saleAmount: Number(detail.saleAmount || 0),\n    included: true,\n    optional: false,\n    // Persisted own-LCL matrix rows remain normal tariff lines. Only ad-hoc rows\n    // created from Pantalla 7 carry manual=true while the quote is being edited.\n    manual: false,\n    applyDestinationTax:\n      Boolean(detail.applyDestinationTax) || /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),\n    destinationTaxRate: Number(detail.destinationTaxRate || 0),\n  } as RateLine\n}\n\nfunction normalizeOwnLclSourceLine(line: RateLine) {\n  const normalizedName = normalizeCatalogValue(line.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n\n  return {\n    ...line,\n    section: isPickup ? 'pickup_origin' : line.section,\n    costDetailType: isPickup ? 'OriginCharge' : line.costDetailType,\n    chargeBasis: normalizedName === 'cfs' ? 'PerChargeableCbm' : line.chargeBasis,\n    costId: null,\n    included: true,\n    optional: false,\n    manual: false,\n  } as RateLine\n}\n\nfunction ownLclFromMatrix(notes: unknown) {\n  return /LCL\s*PROPIO|Fuente LCL:\s*Propio|Consolidado(Id)?:/i.test(String(notes ?? ''))\n}\n\ntype OwnLclQuotedLine = {\n  name?: string | null\n  section?: RateSection | null\n  costDetailType?: string | null\n  notes?: string | null\n  manual?: boolean | null\n  costId?: string | null\n  key?: string | null\n  detailId?: string | null\n  id?: string | null\n}\n// Keep explicit EXW pickup and operator-added charges independently of the own-LCL\n// consolidation matrix. Legacy catalog extras are still excluded unless the\n// route-matched EXW pickup loader explicitly selected that charge.\nfunction ownLclKeepQuotedLine(line: OwnLclQuotedLine, all: readonly OwnLclQuotedLine[]) {\n  if (ownLclFromMatrix(line.notes)) return true\n  // Keep the selected CRC customs supplement after autosave/detail hydration.\n  if (selectedCrcCustomsService.value && (\n    String(line.key ?? '').startsWith('own-lcl-customs:')\n    || line.key === 'service:customs-cr'\n    || /Servicio aduanal CRC seleccionado|Servicio de aduanas CRC/i.test(String(line.notes ?? ''))\n  )) return true\n  const name = normalizeCatalogValue(line.name ?? '')\n  if (line.costDetailType === 'Insurance' || name.includes('seguro') || name.includes('insurance')) return true\n  // The saved RateDetail DTO has no manual flag; wizard notes survive hydration.
  const operatorEntered = line.manual === true
    || /cargo manual agregado desde el wizard de pricing/i.test(String(line.notes ?? ''))
  if (operatorEntered && !line.costId) return true
  if (selectedIncotermCode.value === 'EXW' && line.key === 'variable-section:pickup_origin') return true
  const isPickup = line.section === 'pickup_origin'
    || /recole|pick.?up/.test(name)
    || (line.costDetailType === 'InlandTransport' && /(^| )origen( |$)/.test(name))
  if (selectedIncotermCode.value === 'EXW' && isPickup) {\n    if (String(line.key ?? '').startsWith('exw-fca-variable-cost:') && Boolean(line.costId)) return true\n    // A persisted EXW pickup keeps its master CostId but its runtime key is existing:<detailId>.\n    if (Boolean(line.detailId || line.id)) return true\n  }\n  if (!name.startsWith('manejos') || !(line.detailId || line.id)) return false\n  return !all.some((other) => ownLclFromMatrix(other.notes)\n    && normalizeCatalogValue(other.name ?? '').startsWith('manejos'))\n}\n\nfunction ownLclTransientSupplementalLines() {\n  const insuranceRequested = number(form.cargoValue) > 0\n    || Boolean(cargoInsuranceService.value && form.serviceIds.includes(cargoInsuranceService.value.id))\n  return rateLines.value.filter((line) =>\n    // DH-395: keep Miami plan supplements (especially VGM) even though their\n    // notes identify the own-consolidation matrix. Otherwise rebuilding P7\n    // discards the row immediately after DH-394 adds it.\n    line.included && (!ownLclFromMatrix(line.notes)\n      || String(line.key ?? '').startsWith('p7-394-miami:'))\n    && (Boolean(line.detailId) || line.manual || line.key === 'variable-section:pickup_origin'
      || String(line.key ?? '').startsWith('exw-fca-variable-cost:')\n      || String(line.key ?? '').startsWith('own-lcl-customs:')\n      || line.key === 'service:customs-cr'\n      || String(line.key ?? '').startsWith('p7-394-miami:')\n      || insuranceRequested && line.costDetailType === 'Insurance')\n    && ownLclKeepQuotedLine(line, rateLines.value),\n  )\n}\n\nfunction mergeOwnLclSupplementalLines(baseLines: RateLine[], supplementalLines: RateLine[]) {\n  const merged = [...baseLines]\n  const keys = new Set(merged.map((line) => line.key))\n  supplementalLines.forEach((line) => {\n    if (keys.has(line.key) || merged.some((item) =>\n      Boolean(line.detailId && item.detailId === line.detailId)\n      || (line.costDetailType === 'Insurance' && item.costDetailType === 'Insurance')\n      || (normalizeCatalogValue(line.name).startsWith('manejos')\n        && normalizeCatalogValue(item.name).startsWith('manejos')))) return\n    merged.push(line)\n    keys.add(line.key)\n  })\n  return merged\n}\n\nfunction syncOwnLclCargoInsuranceLine() {\n  // Honor explicitly selected insurance even when the LCL source is Own.\n  // Existing detail IDs, rates and manual adjustments remain authoritative.\n  const insuranceServiceSelected = Boolean(\n    cargoInsuranceService.value && form.serviceIds.includes(cargoInsuranceService.value.id),\n  )\n  const insuranceRequested = insuranceServiceSelected || form.cargoValue > 0\n  const syntheticIndex = rateLines.value.findIndex((line) => line.key === 'cargo-insurance:auto')\n  const existingMiamiDInsurance = rateLines.value.find((line) =>\n    !line.costId && (line.costDetailType === 'Insurance' || /seguro|insurance/i.test(String(line.name ?? '')))\n      && /Plan Miami:\\s*D\\b/i.test(String(line.notes ?? '')),\n  )\n  // A saved Miami quote may not hydrate cargoValue. The new minimum still\n  // applies to its existing insurance line without adding duplicate insurance.\n  if (existingMiamiDInsurance && !props.viewOnly) {\n    existingMiamiDInsurance.saleAmount = Math.max(95, number(existingMiamiDInsurance.saleAmount))\n  }\n\n  if (!insuranceRequested || !visibleSections.value.includes('destination_charges')) {\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const matrixInsurance = rateLines.value.find((line) => {\n    if (line.key === 'cargo-insurance:auto') return false\n    if (line.costDetailType === 'Insurance') return true\n    const name = normalizeCatalogValue(line.name)\n    // Legacy own-LCL insurance can be DestinationCharge without matrix notes.\n    // Match its name to preserve the same persisted detail instead of generating a duplicate.\n    return name.includes('seguro') || name.includes('insurance')\n  })\n  if (matrixInsurance) {\n    // Las versiones anteriores del selector tipaban \"Seguro\" de Miami como\n    // DestinationCharge. Normalizarlo aquí también corrige borradores ya abiertos\n    // o restaurados desde autosave sin obligar al usuario a seleccionar de nuevo.\n    matrixInsurance.costDetailType = 'Insurance'\n    matrixInsurance.section = 'destination_charges'\n    matrixInsurance.included = true\n    matrixInsurance.optional = false\n    matrixInsurance.manual = false\n    // Old Miami D quotations used USD 60. When editing, enforce the new USD 95\n    // minimum without lowering a negotiated higher price or changing view mode.\n    if (!props.viewOnly && String(matrixInsurance.notes ?? '').includes('Plan Miami: D')) {\n      matrixInsurance.saleAmount = Math.max(95, number(matrixInsurance.saleAmount))\n    }\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n  const insurance = form.cargoValue > 0\n    ? calculateCargoInsurance(form.cargoValue, form.freightCost)\n    : null\n  const contextLabel = form.cargoValue > 0\n    ? 'Calculado automáticamente sobre el valor declarado de la carga.'\n    : 'Ingrese el valor de la carga para calcular costo y venta del seguro.'\n\n  if (syntheticIndex >= 0) {\n    const line = rateLines.value[syntheticIndex]\n    line.section = 'destination_charges'\n    line.name = 'Seguro de carga'\n    line.costDetailType = 'Insurance'\n    line.costType = 'Optional'\n    line.chargeBasis = 'PerShipment'\n    line.contextLabel = contextLabel\n    line.currencyId = currency.id\n    line.currencyName = displayValue(currency)\n    line.currencyCode = currency.code\n    line.costAmount = insurance?.cost ?? 0\n    line.saleAmount = insurance?.sale ?? 0\n    line.included = true\n    line.optional = true\n    line.manual = false\n    return\n  }\n\n  rateLines.value.push({\n    key: 'cargo-insurance:auto',\n    section: 'destination_charges',\n    name: 'Seguro de carga',\n    costDetailType: 'Insurance',\n    costType: 'Optional',\n    chargeBasis: 'PerShipment',\n    contextLabel,\n    currencyId: currency.id,\n    currencyName: displayValue(currency),\n    currencyCode: currency.code,\n    costAmount: insurance?.cost ?? 0,\n    saleAmount: insurance?.sale ?? 0,\n    included: true,\n    optional: true,\n    manual: false,\n  })\n}\n\nfunction ensureOwnLclExwPickupLine() {
  // EXW requires an editable origin pickup even without a master Costs row.
  // Keep it separate from the consolidation matrix and avoid duplicate charges.
  if (props.viewOnly || selectedIncotermCode.value !== 'EXW') return
  if (!visibleSections.value.includes('pickup_origin')) return
  if (rateLines.value.some((line) => line.included && (line.section === 'pickup_origin' || isFlatPickupLine(line)))) return
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return
  rateLines.value.push({
    key: 'variable-section:pickup_origin',
    section: 'pickup_origin',
    name: 'Recolecta',
    costDetailType: 'InlandTransport',
    costType: 'Variable',
    chargeBasis: pickupLocations.value.length ? 'PerPickup' : 'PerShipment',
    contextLabel: 'EXW: complete costo y venta de la recolección en origen.',
    currencyId: currency.id,
    currencyName: displayValue(currency),
    currencyCode: currency.code,
    costAmount: 0,
    saleAmount: 0,
    included: true,
    optional: false,
    manual: false,
  })
}

function restoreOwnLclMatrixLines() {\n  // Own LCL keeps the consolidation matrix authoritative, while preserving\n  // supplemental Screen 7 lines such as manual rubrics and cargo insurance.\n  const supplementalLines = ownLclTransientSupplementalLines()\n\n  if (persistedOwnLclContextUnchanged() && editingRate.value) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      editingRate.value.rateDetails.filter((detail) =>\n        ownLclKeepQuotedLine(detail, editingRate.value!.rateDetails)).map((detail) => {
        const persisted = persistedOwnLclRateLine(detail)
        if (props.viewOnly) return persisted
        // A plan/source watcher may run after the user edited a matrix line.
        // Preserve in-progress cost/sale edits instead of restoring the old DB price.
        const pendingEdit = rateLines.value.find((line) =>
          line.detailId === detail.id && (!line.costId || String(line.key ?? '').startsWith('own-lcl-customs:')),
        )
        return pendingEdit
          ? {
              ...persisted,
              costAmount: number(pendingEdit.costAmount),
              saleAmount: number(pendingEdit.saleAmount),
            }
          : persisted
      }),\n      supplementalLines,\n    )\n    costs.value = []\n    ensureOwnLclExwPickupLine()
    syncOwnLclCargoInsuranceLine()\n    syncOwnLclCrcAgencyLine()\n    return\n  }\n\n  const source = lclSelectedSource.value\n  if (source?.kind === 'Own' && Array.isArray(source.lines) && source.lines.length) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      source.lines.filter((line) =>\n        ownLclKeepQuotedLine(line, source.lines)).map((line) => {\n        const normalized = normalizeOwnLclSourceLine(line as RateLine)\n        const edited = rateLines.value.find((candidate) => candidate.key === normalized.key && !candidate.costId)\n        return edited ? {\n          ...normalized,\n          costAmount: number(edited.costAmount),\n          saleAmount: number(edited.saleAmount),\n          detailId: edited.detailId ?? null,\n        } : normalized\n      }),\n      supplementalLines,\n    )\n    syncOwnLclFreightLineFromProvider()\n  } else {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      rateLines.value.filter((line) => !line.costId && ownLclKeepQuotedLine(line, rateLines.value)),\n      supplementalLines,\n    )\n  }\n  costs.value = []\n  ensureOwnLclExwPickupLine()
    syncOwnLclCargoInsuranceLine()\n  syncOwnLclCrcAgencyLine()\n}\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    // Coloader rate details stay authoritative on watchers and provider changes.\n    const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n    if (freight) {\n      freight.costAmount = number(form.freightCost)\n      freight.saleAmount = number(form.freightSale)\n    }\n    return\n  }\n\n  // Consolidado propio: la matriz es la fuente base; manuales y seguro son suplementos.\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // Avoid querying the global Costs catalog for LCL own consolidations.
  const fullyHydratedCostAnchor = "async function loadApplicableCosts(): Promise<boolean> {\n  const requestContext = activeCostContextKey()\n  const serial = ++applicableCostRequestSerial\n  try {"
  const modernCostAnchor = "async function loadApplicableCosts(): Promise<boolean> {\n  const requestContext = activeCostContextKey()\n  try {"
  const legacyCostAnchor = "async function loadApplicableCosts() {\n  try {"
  if (code.includes(fullyHydratedCostAnchor)) {
    code = replaceOne(
      code,
      fullyHydratedCostAnchor,
      fullyHydratedCostAnchor.replace(
        "\n  try {",
        "\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    costs.value = []\n    return true\n  }\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return true\n  }\n\n  try {",
      ),
      'own LCL applicable costs guard (full active catalogue)',
    )
  } else if (code.includes(modernCostAnchor)) {
    code = replaceOne(
      code,
      modernCostAnchor,
      modernCostAnchor.replace(
        "\n  try {",
        "\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    costs.value = []\n    return true\n  }\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return true\n  }\n\n  try {",
      ),
      'own LCL applicable costs guard (context-aware)',
    )
  } else {
    code = replaceOne(
      code,
      legacyCostAnchor,
      "async function loadApplicableCosts() {\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    costs.value = []\n    return\n  }\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return\n  }\n\n  try {",
      'own LCL applicable costs guard',
    )
  }

  const contextualRebuildAnchor = "function rebuildRateLines() {\n  const currentContext = activeCostContextKey()"
  const modernRebuildAnchor = "function rebuildRateLines() {\n  const previousOptionLines = multiCarrierSelectionMode.value && step.value >= 7"
  const legacyRebuildAnchor = "function rebuildRateLines() {\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]"
  const rebuildLclGuard = "  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') return\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n"
  if (code.includes(contextualRebuildAnchor)) {
    code = replaceOne(code, contextualRebuildAnchor,
      contextualRebuildAnchor.replace("\n  const currentContext", "\n" + rebuildLclGuard + "  const currentContext"),
      'own LCL rebuild guard (Incoterms context-aware)',
    )
  } else if (code.includes(modernRebuildAnchor)) {
    code = replaceOne(code, modernRebuildAnchor,
      modernRebuildAnchor.replace("\n  const previousOptionLines", "\n" + rebuildLclGuard + "  const previousOptionLines"),
      'own LCL rebuild guard (context-aware)',
    )
  } else {
    code = replaceOne(code, legacyRebuildAnchor,
      legacyRebuildAnchor.replace("\n  const currency", "\n" + rebuildLclGuard + "  const currency"),
      'own LCL rebuild guard',
    )
  }

  code = replaceOne(
    code,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') return\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
    'own LCL merge guard',
  )

  code = replaceOne(
    code,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n      mergeConfiguredOptionalCostsIntoRateLines(true)\n    } else {\n      rebuildRateLines()\n    }`,
    `    if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value) {\n      const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n      if (freight) {\n        freight.costAmount = number(form.freightCost)\n        freight.saleAmount = number(form.freightSale)\n      }\n\n      if (lclSelectedSource.value.kind === 'Own') {\n        restoreOwnLclMatrixLines()\n      } else {\n        mergeConfiguredOptionalCostsIntoRateLines(true)\n      }\n    } else {\n      rebuildRateLines()\n    }`,
    'provider-to-lines own LCL guard',
  )

  const modernAgentRefresh = "    if (loaded && step.value >= 7) {\n      rebuildRateLines()"
  if (code.includes(modernAgentRefresh)) {
    code = replaceOne(
      code,
      modernAgentRefresh,
      modernAgentRefresh.replace("rebuildRateLines()", "refreshRateLinesForCurrentSource()"),
      'agent/carrier line refresh with context-aware costs',
    )
  } else {
    code = replaceOne(
      code,
      `    await loadApplicableCosts()\n    if (step.value >= 7) rebuildRateLines()`,
      `    await loadApplicableCosts()\n    if (step.value >= 7) refreshRateLinesForCurrentSource()`,
      'agent/carrier line refresh',
    )
  }

  // Earlier versions of the wizard have no edit guard. Newer versions must
  // keep that guard so changing header currency does not reset saved sales.
  const legacyCurrencyWatcher = `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`
  const preservedCurrencyWatcher = `watch(() => form.currencyId, () => {\n  // A saved quotation already has individually priced currencies and sales.\n  // Rebuilding its lines from the tariff catalog discards edit IDs/overrides.\n  if (hydratingExistingRate.value || editingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`
  const multiPoeCurrencyWatcher = preservedCurrencyWatcher.replace(
    'if (hydratingExistingRate.value || editingRate.value) return',
    'if (hydratingExistingRate.value || switchingPoeRoute.value || editingRate.value) return',
  )
  const freightSyncedCurrencyWatcher = multiPoeCurrencyWatcher.replace(
    'if (step.value === 7) rebuildRateLines()',
    'if (step.value === 7) {\\n    rebuildRateLines()\\n    ensureProviderFreightOnScreenSeven()\\n  }'.replaceAll('\\n', '\n'),
  )
  const currencyWatcher = code.includes(freightSyncedCurrencyWatcher)
    ? freightSyncedCurrencyWatcher
    : code.includes(multiPoeCurrencyWatcher)
      ? multiPoeCurrencyWatcher
      : code.includes(preservedCurrencyWatcher) ? preservedCurrencyWatcher : legacyCurrencyWatcher
  const currencyReplacement = currencyWatcher === freightSyncedCurrencyWatcher
    ? currencyWatcher.replace(
      '    rebuildRateLines()\\n    ensureProviderFreightOnScreenSeven()'.replaceAll('\\n', '\n'),
      '    refreshRateLinesForCurrentSource()\\n    ensureProviderFreightOnScreenSeven()'.replaceAll('\\n', '\n'),
    )
    : currencyWatcher.replace('if (step.value === 7) rebuildRateLines()', 'if (step.value === 7) refreshRateLinesForCurrentSource()')
  code = replaceOne(
    code,
    currencyWatcher,
    currencyReplacement,
    'currency line refresh',
  )

  const legacyCargoWatcher = `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|'), form.cargoWeightKg, form.cargoPallets, form.cargoPackages, form.storageDays, form.equipmentId] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    rebuildRateLines()\n  },\n)`
  const preservedCargoWatcher = `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|'), form.cargoWeightKg, form.cargoPallets, form.cargoPackages, form.storageDays, form.equipmentId] as const,\n  () => {\n    // Editing Screen 3/4 cargo parameters must not replace the Screen 7\n    // persisted details with new catalog rows (which lose edited sales).\n    if (hydratingExistingRate.value || step.value < 7 || editingRate.value) return\n    rebuildRateLines()\n  },\n)`
  const cargoWatcher = code.includes(preservedCargoWatcher) ? preservedCargoWatcher : legacyCargoWatcher
  code = replaceOne(
    code,
    cargoWatcher,
    cargoWatcher.replace('    rebuildRateLines()\n  },\n)', '    refreshRateLinesForCurrentSource()\n  },\n)'),
    'cargo/service line refresh',
  )

  code = replaceOne(
    code,
    `          <div class="crystal-bottom-charges space-y-4 p-4">`,
    `          <div class="crystal-bottom-charges space-y-4 p-4">`,
    'keep manual charge editor available for own LCL',
  )

  // Own LCL persists matrix rows plus explicit supplemental lines; global Cost rows stay excluded.
  const detailsMapperAnchor = code.includes(
    'const details: CreateRateDetailRequest[] = normalizedIncludedLines.map((line) => ({',
  )
    ? 'normalizedIncludedLines'
    : 'includedLines.value'

  code = replaceOne(
    code,
    `  const details: CreateRateDetailRequest[] = ${detailsMapperAnchor}.map((line) => ({`,
    `  const sourceDetails = !editingRate.value && isOwnLclMatrixContext()\n    ? ${detailsMapperAnchor}.filter((line) => (!line.costId || (selectedIncotermCode.value === 'EXW' && line.section === 'pickup_origin'\n        && String(line.key ?? '').startsWith('exw-fca-variable-cost:')))\n      && ownLclKeepQuotedLine(line, ${detailsMapperAnchor}))\n    : ${detailsMapperAnchor}\n  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({`,
    'own LCL persisted detail guard',
  )

  code = replaceOne(code, 'function addManualCharge() {',
    OWN_LCL_AGENCY_COST_HELPERS + '\nfunction addManualCharge() {',
    'independent own LCL CRC agency cost')

  // The fixed-cost edit transform executes before this plugin and replaces the
  // old index-based "extraDetails" mapping with buildRateUpdateExtraDetails().
  // Its identity candidates must be drawn from the SAME filtered sourceDetails
  // that generated createPayload.details. Otherwise skipped own-LCL matrix
  // rows shift the indexes and attach an unrelated persisted RateDetail ID.
  const reconciledDetailIdAnchor =
    'includedLines.value.map((line) => ({ detailId: persistedDetailIdForLine(line) }))'
  const legacyDetailIdAnchor = 'id: includedLines.value[index]?.detailId ?? null,'
  if (code.includes(reconciledDetailIdAnchor)) {
    code = replaceOne(
      code,
      reconciledDetailIdAnchor,
      'sourceDetails.map((line) => ({ detailId: persistedDetailIdForLine(line) }))',
      'own LCL reconciled detail ID alignment',
    )
  } else {
    code = replaceOne(
      code,
      legacyDetailIdAnchor,
      'id: sourceDetails[index]?.detailId ?? null,',
      'own LCL legacy detail ID alignment',
    )
  }


  // An edit must retain the persisted own-LCL snapshot. Historical generic
  // lines are never removed because current catalog filtering excludes them.
  // The user must explicitly remove their RateDetail IDs after reviewing
  // financial impact; the backend fails closed on incomplete snapshots.

  // The ordinary fallback already checks the selected service and destination.
  // Do not suppress its editable zero-price row for own LCL when no Pricing
  // master cost matches the requested Costa Rica customs service.
  code = replaceOne(
    code,
    'function syncDeclaredCargoInsuranceOnEdit() {',
    'function syncDeclaredCargoInsuranceOnEdit() {\n  if (isOwnLclMatrixContext()) return',
    'own LCL excludes auto insurance outside configured matrix',
  )

  return code
}

export function pricingWizardOwnLclLinePersistence(): Plugin {
  return {
    name: 'dhole-pricing-wizard-own-lcl-line-persistence',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?')) return null
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
