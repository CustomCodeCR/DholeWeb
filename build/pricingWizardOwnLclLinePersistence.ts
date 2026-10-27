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
  if (cost.isActive === false) return false
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

function syncOwnLclCrcAgencyLine(forceReprice = false) {
  if (props.viewOnly || shipmentModeForApi.value !== 'Lcl'
    || !isOwnLclMatrixContext() || !crcImportContext.value) return
  const service = selectedCrcCustomsService.value
  if (!service || !visibleSections.value.includes('destination_charges')) return

  // Pricing's full active catalog is loaded at wizard initialization. Service
  // association and complete route restrictions are authoritative; names are not.
  const configured = [...allCosts.value, ...costs.value]
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
    costDetailType: configured.costDetailType,
    costType: configured.costType,
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
    `function isOwnLclMatrixSourceActive() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  if (lclSelectedSource.value?.kind === 'Own') return true\n  return String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  // Active coloader source supersedes historical own LCL matrix notes.\n  if (lclSelectedSource.value?.kind === 'Coloader') return false\n  if (String(lclSelectedSourceKey.value ?? '').startsWith('Coloader:')) return false\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction syncOwnLclFreightLineFromProvider() {\n  const source = lclSelectedSource.value\n  if (source?.kind !== 'Own') return\n\n  const cost = number(form.freightCost)\n  const sale = number(form.freightSale)\n  const sourceFreight = source.lines.find((line) => line.costDetailType === 'Freight')\n  if (sourceFreight) {\n    sourceFreight.costAmount = cost\n    sourceFreight.saleAmount = sale\n  }\n\n  const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = cost\n    freight.saleAmount = sale\n  }\n}\n\nfunction persistedOwnLclConsolidationId() {\n  const rate = editingRate.value\n  if (!rate || rate.shipmentMode !== 'Lcl') return ''\n\n  for (const detail of rate.rateDetails ?? []) {\n    const match = String(detail.notes ?? '').match(\n      /ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,\n    )\n    if (match?.[1]) return match[1]\n  }\n\n  return ''\n}\n\nfunction persistedOwnLclContextUnchanged() {\n  const rate = editingRate.value\n  if (!props.rateId || !rate || rate.shipmentMode !== 'Lcl') return false\n\n  const persistedConsolidationId = persistedOwnLclConsolidationId()\n  if (!persistedConsolidationId) return false\n\n  const selectedSourceId =\n    lclSelectedSource.value?.kind === 'Own'\n      ? String(lclSelectedSource.value.id ?? '')\n      : String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n        ? String(lclSelectedSourceKey.value).slice(4)\n        : ''\n\n  if (selectedSourceId && selectedSourceId !== persistedConsolidationId) return false\n\n  // For own LCL, the consolidation id is the authoritative pricing source.\n  // Agent/carrier fields may hydrate a few ticks later, so they must not make\n  // Pantalla 7 recalculate the quote as if it were a new consolidation.\n  return String(rate.polId ?? '') === String(form.originId ?? '')\n    && String(rate.poeId ?? '') === String(form.destinationId ?? '')\n    && String(rate.podId ?? '') === String(form.podId ?? '')\n    && String(rate.incotermId ?? '') === String(form.incotermId ?? '')\n}\n\nfunction persistedOwnLclRateLine(detail: RateDto['rateDetails'][number]): RateLine {\n  const normalizedName = normalizeCatalogValue(detail.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n  const detailType: CostDetailType = isPickup ? 'OriginCharge' : detail.costDetailType\n  const chargeBasis: ChargeBasis = normalizedName === 'cfs' ? 'PerCbm' : detail.chargeBasis\n\n  return {\n    key: \`existing:\${detail.id}\`,\n    detailId: detail.id,\n    section: isPickup ? 'pickup_origin' : sectionForDetail(detailType, detail.name),\n    name: detail.name,\n    costDetailType: detailType,\n    costType: detail.costType,\n    chargeBasis,\n    costId: null,\n    notes: detail.notes ?? null,\n    billToClient: detail.billToClient ?? null,\n    currencyId: detail.currencyId,\n    currencyName: detail.currencyName,\n    currencyCode: detail.currencyCode,\n    amountCurrencyCode: detail.currencyCode,\n    costAmount: Number(detail.costAmount || 0),\n    saleAmount: Number(detail.saleAmount || 0),\n    included: true,\n    optional: false,\n    // Persisted own-LCL matrix rows remain normal tariff lines. Only ad-hoc rows\n    // created from Pantalla 7 carry manual=true while the quote is being edited.\n    manual: false,\n    applyDestinationTax:\n      Boolean(detail.applyDestinationTax) || /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),\n    destinationTaxRate: Number(detail.destinationTaxRate || 0),\n  } as RateLine\n}\n\nfunction normalizeOwnLclSourceLine(line: RateLine) {\n  const normalizedName = normalizeCatalogValue(line.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n\n  return {\n    ...line,\n    section: isPickup ? 'pickup_origin' : line.section,\n    costDetailType: isPickup ? 'OriginCharge' : line.costDetailType,\n    chargeBasis: normalizedName === 'cfs' ? 'PerCbm' : line.chargeBasis,\n    costId: null,\n    included: true,\n    optional: false,\n    manual: false,\n  } as RateLine\n}\n\nfunction ownLclTransientSupplementalLines() {\n  return rateLines.value.filter((line) => line.manual || line.key === 'cargo-insurance:auto'\n    || (Boolean(selectedCrcCustomsService.value) && !line.detailId\n      && (String(line.key ?? '').startsWith('own-lcl-customs:') || line.key === 'service:customs-cr')))\n}\n\nfunction mergeOwnLclSupplementalLines(baseLines: RateLine[], supplementalLines: RateLine[]) {\n  const merged = [...baseLines]\n  const keys = new Set(merged.map((line) => line.key))\n  supplementalLines.forEach((line) => {\n    if (keys.has(line.key)) return\n    merged.push(line)\n    keys.add(line.key)\n  })\n  return merged\n}\n\nfunction syncOwnLclCargoInsuranceLine() {\n  const insuranceServiceSelected = Boolean(\n    cargoInsuranceService.value && form.serviceIds.includes(cargoInsuranceService.value.id),\n  )\n  const insuranceRequested = insuranceServiceSelected || form.cargoValue > 0\n  const syntheticIndex = rateLines.value.findIndex((line) => line.key === 'cargo-insurance:auto')\n\n  if (!insuranceRequested || !visibleSections.value.includes('destination_charges')) {\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const matrixInsurance = rateLines.value.find((line) => {\n    if (line.key === 'cargo-insurance:auto') return false\n    if (line.costDetailType === 'Insurance') return true\n    const name = normalizeCatalogValue(line.name)\n    const notes = String(line.notes ?? '')\n    return (name.includes('seguro') || name.includes('insurance'))\n      && /LCL\\s*PROPIO|Consolidado(Id)?:|Plan Miami:/i.test(notes)\n  })\n  if (matrixInsurance) {\n    // Las versiones anteriores del selector tipaban \"Seguro\" de Miami como\n    // DestinationCharge. Normalizarlo aquí también corrige borradores ya abiertos\n    // o restaurados desde autosave sin obligar al usuario a seleccionar de nuevo.\n    matrixInsurance.costDetailType = 'Insurance'\n    matrixInsurance.section = 'destination_charges'\n    matrixInsurance.included = true\n    matrixInsurance.optional = false\n    matrixInsurance.manual = false\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n  const insurance = form.cargoValue > 0\n    ? calculateCargoInsurance(form.cargoValue, form.freightCost)\n    : null\n  const contextLabel = form.cargoValue > 0\n    ? 'Calculado automáticamente sobre el valor declarado de la carga.'\n    : 'Ingrese el valor de la carga para calcular costo y venta del seguro.'\n\n  if (syntheticIndex >= 0) {\n    const line = rateLines.value[syntheticIndex]\n    line.section = 'destination_charges'\n    line.name = 'Seguro de carga'\n    line.costDetailType = 'Insurance'\n    line.costType = 'Optional'\n    line.chargeBasis = 'PerShipment'\n    line.contextLabel = contextLabel\n    line.currencyId = currency.id\n    line.currencyName = displayValue(currency)\n    line.currencyCode = currency.code\n    line.costAmount = insurance?.cost ?? 0\n    line.saleAmount = insurance?.sale ?? 0\n    line.included = true\n    line.optional = true\n    line.manual = false\n    return\n  }\n\n  rateLines.value.push({\n    key: 'cargo-insurance:auto',\n    section: 'destination_charges',\n    name: 'Seguro de carga',\n    costDetailType: 'Insurance',\n    costType: 'Optional',\n    chargeBasis: 'PerShipment',\n    contextLabel,\n    currencyId: currency.id,\n    currencyName: displayValue(currency),\n    currencyCode: currency.code,\n    costAmount: insurance?.cost ?? 0,\n    saleAmount: insurance?.sale ?? 0,\n    included: true,\n    optional: true,\n    manual: false,\n  })\n}\n\nfunction restoreOwnLclMatrixLines() {\n  // Own LCL keeps the consolidation matrix authoritative, while preserving\n  // supplemental Screen 7 lines such as manual rubrics and cargo insurance.\n  const supplementalLines = ownLclTransientSupplementalLines()\n\n  if (persistedOwnLclContextUnchanged() && editingRate.value) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      editingRate.value.rateDetails.map((detail) => {
        const persisted = persistedOwnLclRateLine(detail)
        if (props.viewOnly) return persisted
        const edited = rateLines.value.find((line) =>
          line.detailId === detail.id && String(line.key ?? '').startsWith('own-lcl-customs:'))
        return edited ? {
          ...persisted,
          costAmount: number(edited.costAmount),
          saleAmount: number(edited.saleAmount),
        } : persisted
      }),\n      supplementalLines,\n    )\n    costs.value = []\n    syncOwnLclCargoInsuranceLine()\n    syncOwnLclCrcAgencyLine()\n    return\n  }\n\n  const source = lclSelectedSource.value\n  if (source?.kind === 'Own' && Array.isArray(source.lines) && source.lines.length) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      source.lines.map((line) => normalizeOwnLclSourceLine(line as RateLine)),\n      supplementalLines,\n    )\n    syncOwnLclFreightLineFromProvider()\n  } else {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      rateLines.value.filter((line) => !line.costId),\n      supplementalLines,\n    )\n  }\n  costs.value = []\n  syncOwnLclCargoInsuranceLine()\n  syncOwnLclCrcAgencyLine()\n}\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    // Coloader rate details stay authoritative on watchers and provider changes.\n    const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n    if (freight) {\n      freight.costAmount = number(form.freightCost)\n      freight.saleAmount = number(form.freightSale)\n    }\n    return\n  }\n\n  // Consolidado propio: la matriz es la fuente base; manuales y seguro son suplementos.\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // Never query the global Costs catalog for an own consolidation.
  code = replaceOne(
    code,
    `async function loadApplicableCosts() {\n  try {`,
    `async function loadApplicableCosts() {\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {\n    costs.value = []\n    return\n  }\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return\n  }\n\n  try {`,
    'own LCL applicable costs guard',
  )

  // Any watcher that tries to rebuild lines while Own is selected must restore
  // the consolidation calculation instead of rebuilding from Costs y recargos.
  code = replaceOne(
    code,
    `function rebuildRateLines() {\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    `function rebuildRateLines() {\n  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') return\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    'own LCL rebuild guard',
  )

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

  code = replaceOne(
    code,
    `    await loadApplicableCosts()\n    if (step.value >= 7) rebuildRateLines()`,
    `    await loadApplicableCosts()\n    if (step.value >= 7) refreshRateLinesForCurrentSource()`,
    'agent/carrier line refresh',
  )

  // Earlier versions of the wizard have no edit guard. Newer versions must
  // keep that guard so changing header currency does not reset saved sales.
  const legacyCurrencyWatcher = `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`
  const preservedCurrencyWatcher = `watch(() => form.currencyId, () => {\n  // A saved quotation already has individually priced currencies and sales.\n  // Rebuilding its lines from the tariff catalog discards edit IDs/overrides.\n  if (hydratingExistingRate.value || editingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`
  const currencyWatcher = code.includes(preservedCurrencyWatcher) ? preservedCurrencyWatcher : legacyCurrencyWatcher
  code = replaceOne(
    code,
    currencyWatcher,
    currencyWatcher.replace('if (step.value === 7) rebuildRateLines()', 'if (step.value === 7) refreshRateLinesForCurrentSource()'),
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
    `  const sourceDetails = isOwnLclMatrixContext()\n    ? ${detailsMapperAnchor}.filter((line) => !line.costId || String(line.key ?? '').startsWith('own-lcl-customs:'))\n    : ${detailsMapperAnchor}\n  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({`,
    'own LCL persisted detail guard',
  )

  code = replaceOne(code, 'function addManualCharge() {',
    OWN_LCL_AGENCY_COST_HELPERS + '\nfunction addManualCharge() {',
    'independent own LCL CRC agency cost')

  // The update detail IDs must follow the same filtered list used to make details.
  code = replaceOne(
    code,
    "id: includedLines.value[index]?.detailId ?? null,",
    "id: (isOwnLclMatrixContext() ? sourceDetails : normalizedIncludedLines)[index]?.detailId ?? null,",
    'own LCL detail ID alignment',
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
