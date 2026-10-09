import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardOwnLclLinePersistence] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceOne(
    code,
    `function addManualCharge() {`,
    `function isOwnLclMatrixSourceActive() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  if (lclSelectedSource.value?.kind === 'Own') return true\n  return String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n}\n\nfunction isPersistedOwnLclMatrixSnapshot() {\n  if (shipmentModeForApi.value !== 'Lcl') return false\n  return rateLines.value.some((line) => {\n    if (line.costId) return false\n    const marker = String(line.notes ?? '')\n    return /LCL\\s*PROPIO|Fuente LCL:\\s*Propio|Consolidado(Id)?:/i.test(marker)\n  })\n}\n\nfunction isOwnLclMatrixContext() {\n  return isOwnLclMatrixSourceActive() || isPersistedOwnLclMatrixSnapshot()\n}\n\nfunction syncOwnLclFreightLineFromProvider() {\n  const source = lclSelectedSource.value\n  if (source?.kind !== 'Own') return\n\n  const cost = number(form.freightCost)\n  const sale = number(form.freightSale)\n  const sourceFreight = source.lines.find((line) => line.costDetailType === 'Freight')\n  if (sourceFreight) {\n    sourceFreight.costAmount = cost\n    sourceFreight.saleAmount = sale\n  }\n\n  const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = cost\n    freight.saleAmount = sale\n  }\n}\n\nfunction persistedOwnLclConsolidationId() {\n  const rate = editingRate.value\n  if (!rate || rate.shipmentMode !== 'Lcl') return ''\n\n  for (const detail of rate.rateDetails ?? []) {\n    const match = String(detail.notes ?? '').match(\n      /ConsolidadoId:\\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,\n    )\n    if (match?.[1]) return match[1]\n  }\n\n  return ''\n}\n\nfunction persistedOwnLclContextUnchanged() {\n  const rate = editingRate.value\n  if (!props.rateId || !rate || rate.shipmentMode !== 'Lcl') return false\n\n  const persistedConsolidationId = persistedOwnLclConsolidationId()\n  if (!persistedConsolidationId) return false\n\n  const selectedSourceId =\n    lclSelectedSource.value?.kind === 'Own'\n      ? String(lclSelectedSource.value.id ?? '')\n      : String(lclSelectedSourceKey.value ?? '').startsWith('Own:')\n        ? String(lclSelectedSourceKey.value).slice(4)\n        : ''\n\n  if (selectedSourceId && selectedSourceId !== persistedConsolidationId) return false\n\n  // For own LCL, the consolidation id is the authoritative pricing source.\n  // Agent/carrier fields may hydrate a few ticks later, so they must not make\n  // Pantalla 7 recalculate the quote as if it were a new consolidation.\n  return String(rate.polId ?? '') === String(form.originId ?? '')\n    && String(rate.poeId ?? '') === String(form.destinationId ?? '')\n    && String(rate.podId ?? '') === String(form.podId ?? '')\n    && String(rate.incotermId ?? '') === String(form.incotermId ?? '')\n}\n\nfunction persistedOwnLclRateLine(detail: RateDto['rateDetails'][number]): RateLine {\n  const normalizedName = normalizeCatalogValue(detail.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n  const detailType: CostDetailType = isPickup ? 'OriginCharge' : detail.costDetailType\n  const chargeBasis: ChargeBasis = normalizedName === 'cfs' ? 'PerCbm' : detail.chargeBasis\n\n  return {\n    key: \`existing:\${detail.id}\`,\n    detailId: detail.id,\n    section: isPickup ? 'pickup_origin' : sectionForDetail(detailType, detail.name),\n    name: detail.name,\n    costDetailType: detailType,\n    costType: detail.costType,\n    chargeBasis,\n    costId: null,\n    notes: detail.notes ?? null,\n    billToClient: detail.billToClient ?? null,\n    currencyId: detail.currencyId,\n    currencyName: detail.currencyName,\n    currencyCode: detail.currencyCode,\n    amountCurrencyCode: detail.currencyCode,\n    costAmount: Number(detail.costAmount || 0),\n    saleAmount: Number(detail.saleAmount || 0),\n    included: true,\n    optional: false,\n    // Persisted own-LCL matrix rows remain normal tariff lines. Only ad-hoc rows\n    // created from Pantalla 7 carry manual=true while the quote is being edited.\n    manual: false,\n    applyDestinationTax:\n      Boolean(detail.applyDestinationTax) || /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),\n    destinationTaxRate: Number(detail.destinationTaxRate || 0),\n  } as RateLine\n}\n\nfunction normalizeOwnLclSourceLine(line: RateLine) {\n  const normalizedName = normalizeCatalogValue(line.name)\n  const isPickup = /pick\\s*up|recole/.test(normalizedName)\n\n  return {\n    ...line,\n    section: isPickup ? 'pickup_origin' : line.section,\n    costDetailType: isPickup ? 'OriginCharge' : line.costDetailType,\n    chargeBasis: normalizedName === 'cfs' ? 'PerCbm' : line.chargeBasis,\n    costId: null,\n    included: true,\n    optional: false,\n    manual: false,\n  } as RateLine\n}\n\nfunction ownLclTransientSupplementalLines() {\n  return rateLines.value.filter((line) => line.manual || line.key === 'cargo-insurance:auto')\n}\n\nfunction mergeOwnLclSupplementalLines(baseLines: RateLine[], supplementalLines: RateLine[]) {\n  const merged = [...baseLines]\n  const keys = new Set(merged.map((line) => line.key))\n  supplementalLines.forEach((line) => {\n    if (keys.has(line.key)) return\n    merged.push(line)\n    keys.add(line.key)\n  })\n  return merged\n}\n\nfunction syncOwnLclCargoInsuranceLine() {\n  const insuranceServiceSelected = Boolean(\n    cargoInsuranceService.value && form.serviceIds.includes(cargoInsuranceService.value.id),\n  )\n  const insuranceRequested = insuranceServiceSelected || form.cargoValue > 0\n  const syntheticIndex = rateLines.value.findIndex((line) => line.key === 'cargo-insurance:auto')\n\n  if (!insuranceRequested || !visibleSections.value.includes('destination_charges')) {\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const matrixInsurance = rateLines.value.find((line) => {\n    if (line.key === 'cargo-insurance:auto') return false\n    if (line.costDetailType === 'Insurance') return true\n    const name = normalizeCatalogValue(line.name)\n    const notes = String(line.notes ?? '')\n    return (name.includes('seguro') || name.includes('insurance'))\n      && /LCL\\s*PROPIO|Consolidado(Id)?:|Plan Miami:/i.test(notes)\n  })\n  if (matrixInsurance) {\n    // Las versiones anteriores del selector tipaban \"Seguro\" de Miami como\n    // DestinationCharge. Normalizarlo aquí también corrige borradores ya abiertos\n    // o restaurados desde autosave sin obligar al usuario a seleccionar de nuevo.\n    matrixInsurance.costDetailType = 'Insurance'\n    matrixInsurance.section = 'destination_charges'\n    matrixInsurance.included = true\n    matrixInsurance.optional = false\n    matrixInsurance.manual = false\n    // Old Miami D quotations used USD 60. When editing, enforce the new USD 95\n    // minimum without lowering a negotiated higher price or changing view mode.\n    if (!props.viewOnly && String(matrixInsurance.notes ?? '').includes('Plan Miami: D')) {\n      matrixInsurance.saleAmount = Math.max(95, number(matrixInsurance.saleAmount))\n    }\n    if (syntheticIndex >= 0) rateLines.value.splice(syntheticIndex, 1)\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n  const insurance = form.cargoValue > 0\n    ? calculateCargoInsurance(form.cargoValue, form.freightCost)\n    : null\n  const contextLabel = form.cargoValue > 0\n    ? 'Calculado automáticamente sobre el valor declarado de la carga.'\n    : 'Ingrese el valor de la carga para calcular costo y venta del seguro.'\n\n  if (syntheticIndex >= 0) {\n    const line = rateLines.value[syntheticIndex]\n    line.section = 'destination_charges'\n    line.name = 'Seguro de carga'\n    line.costDetailType = 'Insurance'\n    line.costType = 'Optional'\n    line.chargeBasis = 'PerShipment'\n    line.contextLabel = contextLabel\n    line.currencyId = currency.id\n    line.currencyName = displayValue(currency)\n    line.currencyCode = currency.code\n    line.costAmount = insurance?.cost ?? 0\n    line.saleAmount = insurance?.sale ?? 0\n    line.included = true\n    line.optional = true\n    line.manual = false\n    return\n  }\n\n  rateLines.value.push({\n    key: 'cargo-insurance:auto',\n    section: 'destination_charges',\n    name: 'Seguro de carga',\n    costDetailType: 'Insurance',\n    costType: 'Optional',\n    chargeBasis: 'PerShipment',\n    contextLabel,\n    currencyId: currency.id,\n    currencyName: displayValue(currency),\n    currencyCode: currency.code,\n    costAmount: insurance?.cost ?? 0,\n    saleAmount: insurance?.sale ?? 0,\n    included: true,\n    optional: true,\n    manual: false,\n  })\n}\n\nfunction restoreOwnLclMatrixLines() {\n  // Own LCL keeps the consolidation matrix authoritative, while preserving\n  // supplemental Screen 7 lines such as manual rubrics and cargo insurance.\n  const supplementalLines = ownLclTransientSupplementalLines()\n\n  if (persistedOwnLclContextUnchanged() && editingRate.value) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      editingRate.value.rateDetails.map((detail) => {
        const persisted = persistedOwnLclRateLine(detail)
        if (props.viewOnly) return persisted
        // A plan/source watcher may run after the user edited a matrix line.
        // Preserve in-progress cost/sale edits instead of restoring the old DB price.
        const pendingEdit = rateLines.value.find((line) =>
          line.detailId === detail.id && !line.costId,
        )
        return pendingEdit
          ? {
              ...persisted,
              costAmount: number(pendingEdit.costAmount),
              saleAmount: number(pendingEdit.saleAmount),
            }
          : persisted
      }),\n      supplementalLines,\n    )\n    costs.value = []\n    syncOwnLclCargoInsuranceLine()\n    return\n  }\n\n  const source = lclSelectedSource.value\n  if (source?.kind === 'Own' && Array.isArray(source.lines) && source.lines.length) {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      source.lines.map((line) => normalizeOwnLclSourceLine(line as RateLine)),\n      supplementalLines,\n    )\n    syncOwnLclFreightLineFromProvider()\n  } else {\n    rateLines.value = mergeOwnLclSupplementalLines(\n      rateLines.value.filter((line) => !line.costId),\n      supplementalLines,\n    )\n  }\n  costs.value = []\n  syncOwnLclCargoInsuranceLine()\n}\nfunction hasPersistedLclDetailSnapshot() {\n  return shipmentModeForApi.value === 'Lcl'\n    && Boolean(props.rateId)\n    && rateLines.value.some((line) => Boolean(line.detailId))\n}\n\nfunction refreshRateLinesForCurrentSource() {\n  if (props.viewOnly && props.rateId && rateLines.value.some((line) => Boolean(line.detailId))) return\n\n  // Consolidado propio: la matriz es la fuente base; manuales y seguro son suplementos.\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  if (hasPersistedLclDetailSnapshot()) {\n    if (props.viewOnly) return\n    rateLines.value = rateLines.value.filter((line) => Boolean(line.detailId) || !line.costId)\n    mergeConfiguredOptionalCostsIntoRateLines(true)\n    return\n  }\n\n  rebuildRateLines()\n}\n\nfunction addManualCharge() {`,
    'own LCL line refresh helper',
  )

  // Never query the global Costs catalog for an own consolidation.
  code = replaceOne(
    code,
    `async function loadApplicableCosts() {\n  try {`,
    `async function loadApplicableCosts() {\n  if (isOwnLclMatrixContext()) {\n    costs.value = []\n    return\n  }\n\n  try {`,
    'own LCL applicable costs guard',
  )

  // Any watcher that tries to rebuild lines while Own is selected must restore
  // the consolidation calculation instead of rebuilding from Costs y recargos.
  code = replaceOne(
    code,
    `function rebuildRateLines() {\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    `function rebuildRateLines() {\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]`,
    'own LCL rebuild guard',
  )

  code = replaceOne(
    code,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
    `function mergeConfiguredOptionalCostsIntoRateLines(includeFixed = false) {\n  if (isOwnLclMatrixContext()) {\n    restoreOwnLclMatrixLines()\n    return\n  }\n\n  // Una tarifa persistida en modo vista es un snapshot autoritativo del response.`,
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

  code = replaceOne(
    code,
    `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) rebuildRateLines()\n})`,
    `watch(() => form.currencyId, () => {\n  if (hydratingExistingRate.value) return\n  if (step.value === 7) refreshRateLinesForCurrentSource()\n})`,
    'currency line refresh',
  )

  code = replaceOne(
    code,
    `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|')] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    rebuildRateLines()\n  },\n)`,
    `watch(\n  () => [form.cargoValue, form.freightCost, form.serviceIds.join('|')] as const,\n  () => {\n    if (hydratingExistingRate.value || step.value < 7) return\n    refreshRateLinesForCurrentSource()\n  },\n)`,
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
    `  const sourceDetails = isOwnLclMatrixContext()\n    ? ${detailsMapperAnchor}.filter((line) => !line.costId)\n    : ${detailsMapperAnchor}\n  const details: CreateRateDetailRequest[] = sourceDetails.map((line) => ({`,
    'own LCL persisted detail guard',
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
