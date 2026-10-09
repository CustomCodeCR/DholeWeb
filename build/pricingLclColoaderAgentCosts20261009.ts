import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RUNTIME = "// dhole-lcl-coloader-agent-costs-20261009\nlet dholeLclColoaderCostRequest = 0\n\nfunction isLclColoaderAgentCostContext() {\n  return shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader'\n}\n\nfunction dholeLclColoaderAgentCostMatches(cost: CostSelectDto) {\n  if (!isLclColoaderAgentCostContext() || !form.agentId) return false\n  if (cost.isActive === false || cost.costDetailType === 'Freight') return false\n  if (cost.chargeBasis === 'PerContainer' || cost.chargeBasis === 'PerTruck') return false\n  // A coloader owns these charges. The old quote's Maersk must not qualify.\n  if (cost.carrierId || (Array.isArray(cost.carriers) && cost.carriers.length > 0)) return false\n  const assignedAgents = Array.isArray(cost.agents) ? cost.agents.map((item) => item.id) : []\n  if (assignedAgents.length > 0) {\n    if (!assignedAgents.includes(form.agentId)) return false\n  } else if (cost.agentId !== form.agentId) {\n    return false\n  }\n  const modes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length > 0\n    ? cost.shipmentModes\n    : (cost.shipmentMode ? [cost.shipmentMode] : [])\n  if (modes.length > 0 && !modes.some((mode) => mode === 'Lcl' || mode === 'Any')) return false\n  if (cost.polId && cost.polId !== form.originId) return false\n  if (cost.poeId && cost.poeId !== form.destinationId) return false\n  if (cost.podId && cost.podId !== form.podId) return false\n  if (Array.isArray(cost.pols) && cost.pols.length && !cost.pols.some((port) => port.id === form.originId)) return false\n  if (Array.isArray(cost.poes) && cost.poes.length && !cost.poes.some((port) => port.id === form.destinationId)) return false\n  if (Array.isArray(cost.pods) && cost.pods.length && !cost.pods.some((port) => port.id === form.podId)) return false\n  if (cost.portId) {\n    const expected = cost.portRole === 'Pol' ? form.originId\n      : cost.portRole === 'Poe' ? form.destinationId\n      : cost.portRole === 'Pod' ? form.podId : ''\n    if (expected ? cost.portId !== expected\n      : ![form.originId, form.destinationId, form.podId].includes(cost.portId)) return false\n  }\n  if (Array.isArray(cost.incoterms) && cost.incoterms.length\n    && !cost.incoterms.some((term) => term.id === form.incotermId)) return false\n  if (Array.isArray(cost.services) && cost.services.length\n    && !cost.services.some((service) => form.serviceIds.includes(service.id))) return false\n  if (!incotermResponsibilitySections.value.includes(sectionForCost(cost))) return false\n  return true\n}\n\nfunction rebuildLclColoaderAgentLines() {\n  if (!isLclColoaderAgentCostContext() || props.viewOnly) return\n  const source = lclSelectedSource.value\n  if (!source) return\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n\n  const previous = rateLines.value\n  const previousCostLines = new Map(previous.filter((line) => line.costId).map((line) => [line.costId, line]))\n  // An old Own source is never reused after switching to Coloader.\n  const sourceLines: RateLine[] = source.manual ? []\n    : (source.lines ?? []).map((line) => ({ ...line })) as RateLine[]\n  const userLines = previous.filter((line) =>\n    line.manual && !line.detailId && String(line.key).startsWith('manual:'))\n  const freight = sourceLines.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = number(form.freightCost)\n    freight.saleAmount = number(form.freightSale)\n    freight.included = true\n  } else {\n    const existingFreight = previous.find((line) =>\n      line.costDetailType === 'Freight' && !line.detailId\n      && !/LCL\\s*PROPIO|ConsolidadoId:/i.test(String(line.notes ?? '')))\n    sourceLines.unshift(existingFreight ? {\n      ...existingFreight,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n    } : {\n      key: 'lcl-coloader:freight',\n      section: 'international_freight',\n      name: 'Flete Internacional Marítimo LCL',\n      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: 'PerChargeableCbm',\n      currencyId: currency.id,\n      currencyName: displayValue(currency),\n      currencyCode: currency.code,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n      optional: false,\n      manual: false,\n      notes: 'Fuente LCL: Coloader',\n    })\n  }\n  const result = [...sourceLines]\n  const identities = new Set(result.map((line) =>\n    normalizeCatalogValue(line.name) + '|' + line.costDetailType))\n\n  costs.value.filter(dholeLclColoaderAgentCostMatches).forEach((cost) => {\n    const identity = normalizeCatalogValue(cost.name) + '|' + cost.costDetailType\n    if (result.some((line) => line.costId === cost.id) || identities.has(identity)) return\n    identities.add(identity)\n    const old = previousCostLines.get(cost.id)\n    const optional = cost.costType === 'Optional'\n    result.push({\n      key: 'cost:' + cost.id,\n      section: sectionForCost(cost),\n      name: cost.name,\n      costDetailType: cost.costDetailType,\n      costType: cost.costType,\n      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),\n      costId: cost.id,\n      contextLabel: costContextLabel(cost),\n      notes: ['Fuente LCL: Coloader', String(cost.notes ?? '').trim()].filter(Boolean).join(' · '),\n      serviceIds: cost.services?.map((service) => service.id) ?? [],\n      currencyId: cost.currencyId,\n      currencyName: cost.currencyName,\n      currencyCode: cost.currencyCode,\n      costAmount: old ? number(old.costAmount) : number(cost.costAmount),\n      saleAmount: old ? number(old.saleAmount) : number(cost.saleAmount),\n      included: old ? old.included : !optional,\n      optional,\n      manual: false,\n    })\n  })\n  for (const line of userLines) {\n    if (!result.some((candidate) => candidate.key === line.key)) result.push(line)\n  }\n  rateLines.value = result\n}\n"

const LCL_MARKER = '// dhole-lcl-coloader-agent-costs-20261009'

function lclReplaceOnce(code: string, anchor: string, replacement: string, label: string) {
  const count = code.split(anchor).length - 1
  if (count !== 1) throw new Error('[lclColoaderAgentCosts] Expected one ' + label + ', found ' + count)
  return code.replace(anchor, replacement)
}

function patchLclColoaderAgentCosts(source: string) {
  if (source.includes(LCL_MARKER)) return source
  let code = source
  code = lclReplaceOnce(code,
    'async function loadApplicableCosts() {',
    RUNTIME + '\nasync function loadApplicableCosts() {',
    'cost helpers')
  const blockedLoader = [
    "  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') {",
    '    costs.value = []',
    '    return',
    '  }',
  ].join('\n')
  const agentLoader = [
    '  if (isLclColoaderAgentCostContext()) {',
    '    // Only agent-based LCL charges, never the saved carrier from an Own quote.',
    "    form.carrierId = ''",
    '    const request = ++dholeLclColoaderCostRequest',
    '    const agentId = form.agentId',
    '    const sourceId = lclSelectedSource.value?.id',
    '    if (!agentId) { costs.value = []; return }',
    '    try {',
    '      const selected = await PricingService.selectCosts({',
    '        agentId,',
    '        polId: form.originId || undefined,',
    '        poeId: form.destinationId || undefined,',
    '        podId: form.podId || undefined,',
    '        incotermId: form.incotermId || undefined,',
    "        shipmentMode: 'Lcl',",
    '        isActive: true,',
    '        applicableToContext: true,',
    '        serviceIds: form.serviceIds.join(\',\') || undefined,',
    '      })',
    '      if (request !== dholeLclColoaderCostRequest || !isLclColoaderAgentCostContext()',
    '        || form.agentId !== agentId || lclSelectedSource.value?.id !== sourceId) return',
    '      costs.value = selected.filter(dholeLclColoaderAgentCostMatches)',
    '    } catch (error) {',
    '      if (request === dholeLclColoaderCostRequest) {',
    '        costs.value = []',
    "        toastStore.backendError(error, 'No se pudieron cargar los costos del agente LCL coloader.')",
    '      }',
    '    }',
    '    return',
    '  }',
  ].join('\n')
  code = lclReplaceOnce(code, blockedLoader, agentLoader, 'LCL cost-loading guard')
  code = lclReplaceOnce(code, 'function applicableConfiguredCosts() {',
    'function applicableConfiguredCosts() {\n  if (isLclColoaderAgentCostContext()) return costs.value.filter(dholeLclColoaderAgentCostMatches).sort((a, b) => costSpecificity(b) - costSpecificity(a))',
    'configured cost matcher')
  code = lclReplaceOnce(code, 'function rebuildRateLines() {',
    'function rebuildRateLines() {\n  if (isLclColoaderAgentCostContext()) {\n    rebuildLclColoaderAgentLines()\n    return\n  }',
    'LCL rate-line rebuild')
  const blockedOptionalMerge =
    "  if (shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader') return"
  const mergeIndex = code.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(')
  const mergeEnd = code.indexOf('\nfunction ', mergeIndex + 10)
  if (mergeIndex < 0 || mergeEnd < 0) throw new Error('[lclColoaderAgentCosts] Missing optional merge boundaries')
  const mergeBody = code.slice(mergeIndex, mergeEnd)
  if (!mergeBody.includes(blockedOptionalMerge)) throw new Error('[lclColoaderAgentCosts] Missing optional merge guard')
  code = code.slice(0, mergeIndex)
    + mergeBody.replace(blockedOptionalMerge,
      '  if (isLclColoaderAgentCostContext()) {\n    rebuildLclColoaderAgentLines()\n    return\n  }')
    + code.slice(mergeEnd)
  const restoreCarrier = 'if (!form.carrierId && editingRate.value.carrierId) form.carrierId = editingRate.value.carrierId'
  code = lclReplaceOnce(code, restoreCarrier,
    'if (!isLclColoaderAgentCostContext() && !form.carrierId && editingRate.value.carrierId) form.carrierId = editingRate.value.carrierId',
    'persisted Own carrier recovery')
  const refreshStart = code.indexOf('function refreshRateLinesForCurrentSource() {')
  const refreshEnd = code.indexOf('\nfunction ', refreshStart + 10)
  if (refreshStart < 0 || refreshEnd < 0) throw new Error('[lclColoaderAgentCosts] Missing line refresh function')
  const refreshBody = code.slice(refreshStart, refreshEnd)
  const refreshAnchor = '    return\n  }\n\n  // Consolidado propio:'
  if (!refreshBody.includes(refreshAnchor)) throw new Error('[lclColoaderAgentCosts] Missing coloader refresh guard')
  code = code.slice(0, refreshStart)
    + refreshBody.replace(refreshAnchor,
      '    rebuildLclColoaderAgentLines()\n    return\n  }\n\n  // Consolidado propio:')
    + code.slice(refreshEnd)

  // A changed Own-to-Coloader source invalidates historic rate-detail IDs.
  const relinkAnchor = 'function relinkExistingDetailIdsForEdit() {'
  code = lclReplaceOnce(code, relinkAnchor,
    relinkAnchor + '\n  if (isLclColoaderAgentCostContext() && editingRate.value?.rateDetails?.some((detail) => /LCL\\s*PROPIO|ConsolidadoId:/i.test(String(detail.notes ?? \'\')))) return',
    'historic Own detail ids')
  const preserveAnchor = 'function shouldPreservePersistedEditLines() {'
  code = lclReplaceOnce(code, preserveAnchor,
    preserveAnchor + '\n  if (isLclColoaderAgentCostContext() && editingRate.value?.rateDetails?.some((detail) => /LCL\\s*PROPIO|ConsolidadoId:/i.test(String(detail.notes ?? \'\')))) return false',
    'persisted Own snapshot guard')
  return code
}

export function pricingLclColoaderAgentCosts20261009(): Plugin {
  return {
    name: 'dhole-pricing-lcl-coloader-agent-costs-20261009',
    transform(source, id) {
      if (id.includes('?')) return null
      if (!id.replaceAll('\\', '/').endsWith(WIZARD_PATH)) return null
      return { code: patchLclColoaderAgentCosts(source), map: null }
    },
  }
}
