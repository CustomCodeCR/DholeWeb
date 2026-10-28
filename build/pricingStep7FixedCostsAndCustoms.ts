import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-step7-fixed-costs-and-crc-customs-20261028'

function replaceOnce(source: string, anchor: string, replacement: string, label: string): string {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingStep7FixedCostsAndCustoms] ' + label + ': expected 1, got ' + count)
  }
  return source.replace(anchor, replacement)
}

export function patchPricingStep7FixedCostsAndCustoms(source: string): string {
  if (source.includes(MARKER)) return source
  let code = source

  // Enable the COST of Fixed charge rows, without loosening other guards
  // (read-only, AgentCharge and optional/variable rules).
  let editableFixedInputs = 0
  code = code.replace(
    /<DhInput\b[^>]*v-model\.number="line\.costAmount"[^>]*\/>/g,
    (input) => {
      const guard = input.match(/:disabled="([^"]+)"/)
      if (!guard) throw new Error('[pricingStep7FixedCostsAndCustoms] Cost field has no read-only guard')
      editableFixedInputs++
      return input.replace(guard[0],
        ':disabled="props.viewOnly || (line.costType !== \'Fixed\' && (' + guard[1] + '))"')
    },
  )
  if (!editableFixedInputs) throw new Error('[pricingStep7FixedCostsAndCustoms] Missing screen 7 cost inputs')

  // The Config label is not always the legacy '... CRC' one.
  const oldCustomsName = [
    "  return name.includes('agencia aduanas crc')",
    "    || name.includes('agencia aduanal crc')",
    "    || name.includes('servicio aduanas crc')",
    "    || name.includes('aduanas costa rica')",
  ].join('\n')
  code = replaceOnce(code, oldCustomsName, [
    oldCustomsName,
    "    || /(?:servicio|agencia|tramite|despacho).*aduan|aduan.*(?:servicio|agencia|tramite|crc|costa rica)/.test(name)",
    "    || name.includes('customs clearance')",
  ].join('\n'), 'CRC customs service aliases')

  const coloaderStart = code.indexOf('function rebuildLclColoaderAgentLines() {')
  const builderEnd = coloaderStart < 0 ? -1 : code.indexOf('\n}\n', coloaderStart)
  if (coloaderStart < 0 || builderEnd < 0) {
    throw new Error('[pricingStep7FixedCostsAndCustoms] Missing LCL coloader line builder')
  }
  const builder = code.slice(coloaderStart, builderEnd)
  if (!builder.includes('  rateLines.value = result')) {
    throw new Error('[pricingStep7FixedCostsAndCustoms] Missing coloader assignment')
  }
  code = code.slice(0, coloaderStart)
    + builder.replace('  rateLines.value = result',
      '  rateLines.value = result\n  syncSelectedColoaderCrcCustomsLine()')
    + code.slice(builderEnd)

  const runtime = "\n// A customs charge selected for Costa Rica belongs to this quote, not to\n// the maritime coloader. The master remains unchanged.\nfunction selectedColoaderCrcCustomsCost(serviceId: string): CostSelectDto | null {\n  if (!serviceId) return null\n  const matches = (\n    relations: Array<{ id: string }> | null | undefined,\n    legacyId: string | null | undefined,\n    selectedId: string | null | undefined,\n  ) => {\n    const ids = (relations ?? []).map((entry) => String(entry.id ?? '')).filter(Boolean)\n    if (ids.length) return Boolean(selectedId) && ids.includes(String(selectedId))\n    return !legacyId || (Boolean(selectedId) && String(legacyId) === String(selectedId))\n  }\n  const candidates = [...new Map(\n    [...allCosts.value, ...costs.value].map((cost) => [cost.id, cost]),\n  ).values()].filter((cost) => {\n    if (cost.isActive === false || cost.costDetailType === 'Freight') return false\n    if (!cost.services?.some((service) => service.id === serviceId)) return false\n    const modes = cost.shipmentModes?.length\n      ? cost.shipmentModes : cost.shipmentMode ? [cost.shipmentMode] : []\n    if (modes.length && !modes.some((mode) =>\n      ['lcl', 'any'].includes(String(mode).toLowerCase()))) return false\n    if (cost.incoterms?.length && !cost.incoterms.some((term) => term.id === form.incotermId)) return false\n    if (cost.carrierId || cost.carriers?.length) return false\n    if (cost.chargeBasis === 'PerContainer' || cost.chargeBasis === 'PerTruck') return false\n    if (!matches(cost.pols, cost.polId, form.originId)) return false\n    if (!matches(cost.poes, cost.poeId, costContextPoeId())) return false\n    if (!matches(cost.pods, cost.podId, form.podId)) return false\n    if (cost.portId) {\n      const role = String(cost.portRole ?? '').toLowerCase()\n      const expected = role === 'pol' ? form.originId\n        : role === 'poe' ? costContextPoeId()\n        : role === 'pod' ? form.podId : ''\n      if (expected && String(cost.portId) !== String(expected)) return false\n      if (!expected && ![form.originId, costContextPoeId(), form.podId].includes(cost.portId)) return false\n    }\n    // A selected customs service may have a customs agent different from\n    // the maritime provider: never require the coloader's agent ID here.\n    return true\n  })\n  return candidates.sort((left, right) => costSpecificity(right) - costSpecificity(left))[0] ?? null\n}\n\nfunction syncSelectedColoaderCrcCustomsLine() {\n  if (props.viewOnly || !isLclColoaderAgentCostContext() || hydratingExistingRate.value) return\n  const service = selectedCrcCustomsService.value\n  if (!service) {\n    rateLines.value = rateLines.value.filter((line) =>\n      line.key !== 'service:customs-cr' || Boolean(line.detailId))\n    return\n  }\n  if (!crcImportContext.value || !visibleSections.value.includes('destination_charges')) return\n  const existing = rateLines.value.find((line) => isCrcCustomsLine(line, service.id))\n  if (existing) {\n    existing.included = true\n    return\n  }\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n  const configured = selectedColoaderCrcCustomsCost(service.id)\n  if (!configured) {\n    // No invented prices. Save validation requires a positive sale.\n    ensureCrcCustomsLine(rateLines.value, currency)\n    return\n  }\n  const price = resolveCostPricing(configured, {\n    weightKg: number(form.cargoWeightKg) > 0 ? number(form.cargoWeightKg) : null,\n    packages: number(form.cargoPackages) > 0 ? Math.trunc(number(form.cargoPackages)) : null,\n    storageDays: number(form.storageDays) > 0 ? Math.trunc(number(form.storageDays)) : null,\n    containerTypeId: selectedEquipment.value?.id ?? null,\n  })\n  const chargeCurrency = findById(catalogs.currencies, configured.currencyId)\n    ?? crcCurrency.value ?? currency\n  rateLines.value.push({\n    key: 'service:customs-cr',\n    section: 'destination_charges',\n    name: configured.name,\n    costDetailType: 'CustomsCharge',\n    // Supplement values are quote-specific; never rewrite Fixed Cost masters.\n    costType: 'Variable',\n    costId: null,\n    chargeBasis: configured.chargeBasis ?? 'PerService',\n    contextLabel: price ? costContextLabel(configured)\n      : 'Sin tramo de costo aplicable: revise peso y bultos.',\n    notes: [String(configured.notes ?? '').trim(), 'Servicio de aduanas CRC'].filter(Boolean).join(' · '),\n    serviceIds: [service.id],\n    currencyId: chargeCurrency.id,\n    currencyName: displayValue(chargeCurrency),\n    currencyCode: chargeCurrency.code,\n    amountCurrencyCode: chargeCurrency.code,\n    costAmount: price ? number(price.costAmount) : 0,\n    saleAmount: price ? number(price.saleAmount) : 0,\n    included: true,\n    optional: false,\n    manual: false,\n  })\n}\n\nwatch(\n  () => [\n    step.value,\n    form.serviceIds.join('|'),\n    lclSelectedSource.value?.kind,\n    lclSelectedSource.value?.id,\n    allCosts.value.length,\n    costs.value.length,\n    form.podId,\n    form.destinationId,\n  ] as const,\n  () => {\n    if (step.value !== 7 || props.viewOnly || hydratingExistingRate.value) return\n    if (isLclColoaderAgentCostContext()) syncSelectedColoaderCrcCustomsLine()\n    else if (isOwnLclMatrixContext()) syncOwnLclCrcAgencyLine()\n  },\n  { flush: 'post' },\n)\n"
  code = replaceOnce(code, '\n</script>', '\n' + runtime + '\n' + MARKER + '\n</script>', 'runtime injection')
  return code
}

export function pricingStep7FixedCostsAndCustoms(): Plugin {
  return {
    name: 'dhole-pricing-step7-fixed-costs-and-customs',
    // Run in normal phase immediately before Vue, after legacy transforms.
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchPricingStep7FixedCostsAndCustoms(source), map: null }
    },
  }
}
