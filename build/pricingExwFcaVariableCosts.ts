import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  const anchor = 'function addManualCharge() {'
  if (source.split(anchor).length !== 2) {
    throw new Error('[pricingExwFcaVariableCosts] Wizard anchor not found exactly once')
  }
  const marker = '// dhole-exw-fca-variable-costs-20261013'
  if (source.includes(marker)) return source
  const runtime = [
    marker,
    'const dholeExwFcaVariableCosts = ref<CostSelectDto[]>([])',
    'let dholeExwFcaRequest = 0',
    '',
    'function dholeExwFcaMatch(cost: CostSelectDto) {',
    "  if (cost.costType !== 'Variable' || !['EXW', 'FCA'].includes(selectedIncotermCode.value)) return false",
    "  if (cost.costDetailType === 'Freight') return false",
    '  if (!resolvedConditionalCost(cost)) return false',
    '  if (!incotermResponsibilitySections.value.includes(sectionForCost(cost))) return false',
    '  if (cost.incoterms?.length && !cost.incoterms.some((item) => item.id === form.incotermId)) return false',
    '  if (cost.services?.length && !cost.services.some((item) => form.serviceIds.includes(item.id))) return false',
    '  if (!operationalConditionsSatisfied(cost)) return false',
    "",
    "  const mode = String(shipmentModeForApi.value).toLowerCase()",
    "  const configuredModes = cost.shipmentModes?.length",
    "    ? cost.shipmentModes.map((item) => String(item).toLowerCase())",
    "    : cost.shipmentMode ? [String(cost.shipmentMode).toLowerCase()] : []",
    "  const airLcl = form.modality === 'Air' && mode === 'lcl'",
    "  if (configuredModes.length && !configuredModes.some((item) =>",
    "    item === mode || item === 'any' || (airLcl && (item === 'airconsol' || item === 'air')))) return false",
    "  if (['Lcl', 'Ltl'].includes(shipmentModeForApi.value)",
    "      && (cost.chargeBasis === 'PerContainer' || cost.chargeBasis === 'PerTruck')) return false",
    "  const relation = (",
    "    rows: Array<{ id: string }> | null | undefined,",
    "    oldId: string | null | undefined, selected: string | null | undefined,",
    "  ) => {",
    "    const ids = rows?.length ? rows.map((item) => item.id) : oldId ? [oldId] : []",
    "    return !ids.length || (Boolean(selected) && ids.includes(String(selected)))",
    "  }",
    "  if (!relation(cost.pols, cost.polId, form.originId)) return false",
    "  if (!relation(cost.poes, cost.poeId, form.destinationId)) return false",
    "  if (!relation(cost.pods, cost.podId, form.podId)) return false",
    "  if (!relation(cost.agents, cost.agentId, form.agentId)) return false",
    "  if (!relation(cost.carriers, cost.carrierId, form.carrierId)) return false",
    "  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader'",
    "      && (cost.carrierId || cost.carriers?.length)) return false",
    "  if (cost.portId) {",
    "    const role = String(cost.portRole || '').toLowerCase()",
    "    const multi = role === 'pol' ? cost.pols",
    "      : role === 'poe' ? cost.poes : role === 'pod' ? cost.pods : null",
    "    const target = role === 'pol' ? form.originId",
    "      : role === 'poe' ? form.destinationId : role === 'pod' ? form.podId : ''",
    "    if (!multi?.length && !(target",
    "      ? cost.portId === target",
    "      : [form.originId, form.destinationId, form.podId].includes(cost.portId))) return false",
    "  }",
    '  return true',
    '}',
    "function dholeExwFcaApply() {",
    "  if (props.viewOnly || step.value !== 7) return",
    "  const applicable = dholeExwFcaVariableCosts.value.filter(dholeExwFcaMatch)",
    "  const activeIds = new Set(applicable.map((cost) => cost.id))",
    "  if (rateLines.value.some((line) => line.key.startsWith('exw-fca-variable-cost:') && !activeIds.has(String(line.costId))))",
    "    rateLines.value = rateLines.value.filter((line) => !line.key.startsWith('exw-fca-variable-cost:') || activeIds.has(String(line.costId)))",
    "  if (!applicable.length) return",
    "  const known = new Set(costs.value.map((row) => row.id))",
    "  const newCosts = applicable.filter((row) => !known.has(row.id))",
    "  if (newCosts.length) costs.value = [...costs.value, ...newCosts]",
    "",
    "  applicable.forEach((cost) => {",
    '    const resolvedAmount = resolvedConditionalCost(cost)',
    '    if (!resolvedAmount) return',
    "    const existing = rateLines.value.find((line) => line.costId === cost.id)",
    "    if (existing) {",
    "      existing.included = true",
    "      existing.optional = false",
    "      return",
    "    }",
    "    const section = sectionForCost(cost)",
    "    const placeholders = rateLines.value.filter((line) =>",
    "      (line.key.startsWith('variable-section:') || line.key.startsWith('edit-incoterm-fallback:'))",
    "      && line.section === section && line.costDetailType === cost.costDetailType && !line.costId)",
    "    if (placeholders.length) {",
    "      const keys = new Set(placeholders.map((line) => line.key))",
    "      rateLines.value = rateLines.value.filter((line) => !keys.has(line.key))",
    "    }",
    "    rateLines.value.push({",
    "      key: 'exw-fca-variable-cost:' + cost.id,",
    "      section,",
    "      name: cost.name,",
    "      costDetailType: cost.costDetailType,",
    "      costType: 'Variable',",
    "      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),",
    "      costId: cost.id,",
    "      contextLabel: costContextLabel(cost),",
    "      notes: cost.notes?.trim() || null,",
    "      serviceIds: cost.services?.map((service) => service.id) ?? [],",
    "      currencyId: cost.currencyId,",
    "      currencyName: cost.currencyName,",
    "      currencyCode: cost.currencyCode,",
    "      amountCurrencyCode: cost.currencyCode,",
    "      costAmount: resolvedAmount.costAmount,",
    "      saleAmount: resolvedAmount.saleAmount,",
    "      included: true,",
    "      optional: false,",
    "      manual: false,",
    "      applyDestinationTax: false,",
    "      destinationTaxRate: 0,",
    "    })",
    "  })",
    "}",
    "",
    "function dholeExwFcaContextKey() {",
    "  return [step.value, shipmentModeForApi.value, form.modality,",
    "    form.originId, form.destinationId, form.podId, form.agentId, form.carrierId,",
    "    form.incotermId, form.serviceIds.join(','),",
    "    lclSelectedSource.value?.kind ?? '',",
    "    pickupLocations.value.map((pickup) => pickup.cargoCondition ?? '').join(','),",
    "  ].join('|')",
    "}",
    "",
    "async function dholeExwFcaLoad() {",
    "  const key = dholeExwFcaContextKey()",
    "  const request = ++dholeExwFcaRequest",
    "  dholeExwFcaVariableCosts.value = []",
    "  if (step.value !== 7 || props.viewOnly || !['EXW', 'FCA'].includes(selectedIncotermCode.value)) return",
    "  try {",
    "    const active = await PricingService.selectCosts({ isActive: true, costType: 'Variable' })",
    "    if (request !== dholeExwFcaRequest || key !== dholeExwFcaContextKey()) return",
    "    dholeExwFcaVariableCosts.value = active.filter(dholeExwFcaMatch)",
    "    dholeExwFcaApply()",
    "  } catch (error) {",
    "    if (request === dholeExwFcaRequest)",
    "      toastStore.backendError(error, 'No se pudieron cargar los cargos variables EXW/FCA.')",
    "  }",
    "}",
    "",
    "watch(dholeExwFcaContextKey, () => { void dholeExwFcaLoad() }, { flush: 'post', immediate: true })",
    "watch(() => rateLines.value.map((line) => line.key).join('|'), () => dholeExwFcaApply(), { flush: 'post' })",
  ].join('\n')
  let code = source.replace(anchor, runtime + '\n\n' + anchor)
  const supplement = "return rateLines.value.filter((line) => line.manual || line.key === 'cargo-insurance:auto')"
  if (code.includes(supplement))
    code = code.replace(supplement,
      "return rateLines.value.filter((line) => line.manual || line.key === 'cargo-insurance:auto' || String(line.key).startsWith('exw-fca-variable-cost:'))")

  const ownStart = code.indexOf('  const sourceDetails = isOwnLclMatrixContext()')
  if (ownStart >= 0) {
    const ownEnd = code.indexOf('  const details: CreateRateDetailRequest[]', ownStart)
    if (ownEnd < 0) throw new Error('[pricingExwFcaVariableCosts] Own LCL mapper missing')
    const ownBlock = code.slice(ownStart, ownEnd)
    const oldFilter = '.filter((line) => !line.costId)'
    const customsFilter = ".filter((line) => !line.costId || String(line.key ?? '').startsWith('own-lcl-customs:'))"
    const extraFilter = "String(line.key ?? '').startsWith('exw-fca-variable-cost:')"
    let patchedBlock = ownBlock
    if (!ownBlock.includes(extraFilter)) {
      if (ownBlock.includes(customsFilter)) {
        // The own-LCL persistence plugin now adds a customs exception first.
        // Preserve that exception while including EXW/FCA variable charges.
        patchedBlock = ownBlock.replace(customsFilter, customsFilter.slice(0, -1) + ' || ' + extraFilter + ')')
      } else if (ownBlock.includes(oldFilter)) {
        patchedBlock = ownBlock.replace(oldFilter, ".filter((line) => !line.costId || " + extraFilter + ")")
      } else {
        throw new Error('[pricingExwFcaVariableCosts] Own LCL filter missing')
      }
    }
    code = code.slice(0, ownStart) + patchedBlock + code.slice(ownEnd)
  }
  return code
}

export function pricingExwFcaVariableCosts(): Plugin {
  return {
    name: 'dhole-pricing-exw-fca-variable-costs',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
