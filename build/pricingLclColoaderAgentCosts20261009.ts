import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const RUNTIME = "// dhole-lcl-coloader-agent-costs-20261009\nlet dholeLclColoaderCostRequest = 0\n\nfunction isLclColoaderAgentCostContext() {\n  return shipmentModeForApi.value === 'Lcl' && lclSelectedSource.value?.kind === 'Coloader'\n}\n\n// Multi-selections are authoritative. Legacy IDs keep only the first selected value.\nfunction dholeLclColoaderRelationMatches(\n  relations: Array<{ id: string }> | null | undefined,\n  legacyId: string | null | undefined,\n  selectedId: string | null | undefined,\n) {\n  const ids = Array.isArray(relations)\n    ? relations.map((item) => String(item.id ?? '')).filter(Boolean)\n    : []\n  if (ids.length > 0) return Boolean(selectedId) && ids.includes(String(selectedId))\n  return !legacyId || (Boolean(selectedId) && String(legacyId) === String(selectedId))\n}\n\nfunction dholeLclColoaderAgentCostMatches(cost: CostSelectDto) {\n  if (!isLclColoaderAgentCostContext() || !costContextAgentId()) return false\n  if (cost.isActive === false || cost.costDetailType === 'Freight') return false\n  if (cost.chargeBasis === 'PerContainer' || cost.chargeBasis === 'PerTruck') return false\n  // A coloader owns these charges. The old quote's Maersk must not qualify.\n  if (cost.carrierId || (Array.isArray(cost.carriers) && cost.carriers.length > 0)) return false\n  if (form.modality === 'Air') {\n    // Air costs may use AirConsol, Lcl or Any; respect current provider/route.\n    const assignedToAgent = Boolean(cost.agentId)\n      || (Array.isArray(cost.agents) && cost.agents.length > 0)\n    return assignedToAgent && airLclCostMatchesCurrentContext(cost)\n  }\n  const hasAssignedAgent = Boolean(cost.agentId)\n    || (Array.isArray(cost.agents) && cost.agents.length > 0)\n  if (!hasAssignedAgent) return false\n  if (!dholeLclColoaderRelationMatches(cost.agents, cost.agentId, costContextAgentId())) return false\n\n  const modes = Array.isArray(cost.shipmentModes) && cost.shipmentModes.length > 0\n    ? cost.shipmentModes\n    : (cost.shipmentMode ? [cost.shipmentMode] : [])\n  if (modes.length > 0 && !modes.some((mode) => mode === 'Lcl' || mode === 'Any')) return false\n  if (!dholeLclColoaderRelationMatches(cost.pols, cost.polId, form.originId)) return false\n  if (!dholeLclColoaderRelationMatches(cost.poes, cost.poeId, form.destinationId)) return false\n  if (!dholeLclColoaderRelationMatches(cost.pods, cost.podId, form.podId)) return false\n  if (cost.portId) {\n    const role = String(cost.portRole ?? '').toLowerCase()\n    const selectedForRole = role === 'pol' ? cost.pols\n      : role === 'poe' ? cost.poes : role === 'pod' ? cost.pods : null\n    // A legacy PortId must not negate a valid multi-port selection.\n    if (!Array.isArray(selectedForRole) || !selectedForRole.length) {\n      const expected = role === 'pol' ? form.originId\n        : role === 'poe' ? form.destinationId : role === 'pod' ? form.podId : ''\n      if (expected ? String(cost.portId) !== String(expected)\n        : ![form.originId, form.destinationId, form.podId].includes(cost.portId)) return false\n    }\n  }\n  if (Array.isArray(cost.incoterms) && cost.incoterms.length\n    && !cost.incoterms.some((term) => term.id === form.incotermId)) return false\n  if (Array.isArray(cost.services) && cost.services.length\n    && !cost.services.some((service) => form.serviceIds.includes(service.id))) return false\n  // /costs/select determines applicability using explicit cost restrictions.\n  // The Incoterm presentation sections are NOT a second cost eligibility gate:\n  // a returned Pier17 OriginCharge must remain visible even when FOB or an\n  // opaque catalog Incoterm hides origin in the generic section list.\n  // Explicit cost.incoterms above is still a hard restriction.\n  return true\n}\n\nfunction rebuildLclColoaderAgentLines() {\n  if (!isLclColoaderAgentCostContext() || props.viewOnly) return\n  const source = lclSelectedSource.value\n  if (!source) return\n  const currency = selectedCurrency.value ?? catalogs.currencies[0]\n  if (!currency) return\n\n  const previous = rateLines.value\n  const previousCostLines = new Map(previous.filter((line) => line.costId).map((line) => [line.costId, line]))\n  // An old Own source is never reused after switching to Coloader.\n  const sourceLines: RateLine[] = source.manual ? []\n    : (source.lines ?? []).map((line) => ({ ...line })) as RateLine[]\n  const userLines = previous.filter((line) =>\n    line.manual && !line.detailId && String(line.key).startsWith('manual:'))\n  const freight = sourceLines.find((line) => line.costDetailType === 'Freight')\n  if (freight) {\n    freight.costAmount = number(form.freightCost)\n    freight.saleAmount = number(form.freightSale)\n    freight.included = true\n  } else {\n    const existingFreight = previous.find((line) =>\n      line.costDetailType === 'Freight' && !line.detailId\n      && !/LCL\\s*PROPIO|ConsolidadoId:/i.test(String(line.notes ?? '')))\n    sourceLines.unshift(existingFreight ? {\n      ...existingFreight,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n    } : {\n      key: 'lcl-coloader:freight',\n      section: 'international_freight',\n      name: 'Flete Internacional Marítimo LCL',\n      costDetailType: 'Freight',\n      costType: 'Variable',\n      chargeBasis: 'PerChargeableCbm',\n      currencyId: currency.id,\n      currencyName: displayValue(currency),\n      currencyCode: currency.code,\n      costAmount: number(form.freightCost),\n      saleAmount: number(form.freightSale),\n      included: true,\n      optional: false,\n      manual: false,\n      notes: 'Fuente LCL: Coloader',\n    })\n  }\n  const result = [...sourceLines]\n  const identities = new Set(result.map((line) =>\n    normalizeCatalogValue(line.name) + '|' + line.costDetailType))\n\n  // Air coloaders also need Pricing's route-matching generic and fixed charges.\n  // A later agent refresh must not remove AWB, origin/destination surcharges, etc.\n  const candidateCosts = form.modality === 'Air'\n    ? [...new Map([...allCosts.value, ...costs.value].map((cost) => [cost.id, cost])).values()]\n      .filter((cost) => cost.costDetailType !== 'Freight' && airLclCostMatchesCurrentContext(cost))\n    : costs.value.filter(dholeLclColoaderAgentCostMatches)\n  candidateCosts.forEach((cost) => {\n    const identity = normalizeCatalogValue(cost.name) + '|' + cost.costDetailType\n    if (result.some((line) => line.costId === cost.id) || identities.has(identity)) return\n    identities.add(identity)\n    const old = previousCostLines.get(cost.id)\n    const optional = cost.costType === 'Optional'\n    result.push({\n      key: 'cost:' + cost.id,\n      section: sectionForCost(cost),\n      name: cost.name,\n      costDetailType: cost.costDetailType,\n      costType: cost.costType,\n      chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),\n      costId: cost.id,\n      contextLabel: costContextLabel(cost),\n      notes: ['Fuente LCL: Coloader', String(cost.notes ?? '').trim()].filter(Boolean).join(' · '),\n      serviceIds: cost.services?.map((service) => service.id) ?? [],\n      currencyId: cost.currencyId,\n      currencyName: cost.currencyName,\n      currencyCode: cost.currencyCode,\n      costAmount: old ? number(old.costAmount) : number(cost.costAmount),\n      saleAmount: old ? number(old.saleAmount) : number(cost.saleAmount),\n      included: old ? old.included : !optional,\n      optional,\n      manual: false,\n    })\n  })\n  for (const line of userLines) {\n    if (!result.some((candidate) => candidate.key === line.key)) result.push(line)\n  }\n  rateLines.value = result\n}\n"

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
    "  if (isLclColoaderAgentCostContext()) {",
    "    // A coloader owns its agent charges, never the previously selected ocean carrier.",
    "    form.carrierId = ''",
    "    const request = ++dholeLclColoaderCostRequest",
    "    const agentId = costContextAgentId()",
    "    const sourceId = lclSelectedSource.value?.id",
    "    const originId = form.originId",
    "    const poeId = form.destinationId",
    "    const podId = form.podId",
    "    const incotermId = form.incotermId",
    "    const serviceIds = form.serviceIds.join(',')",
    "    if (!agentId) { costs.value = []; return }",
    "    try {",
    "      // The contextual endpoint is not exhaustive for every legacy multi-port",
    "      // relation. Reconcile it against the active master catalog.",
    "      const [contextResult, catalogResult] = await Promise.allSettled([",
    "        PricingService.selectCosts({",
    "          agentId,",
    "          polId: originId || undefined,",
    "          poeId: poeId || undefined,",
    "          podId: podId || undefined,",
    "          incotermId: incotermId || undefined,",
    "          shipmentMode: form.modality === 'Air' ? 'AirConsol' : 'Lcl',",
    "          isActive: true,",
    "          applicableToContext: true,",
    "          serviceIds: serviceIds || undefined,",
    "        }),",
    "        PricingService.selectCosts({ isActive: true }),",
    "      ])",
    "      if (contextResult.status === 'rejected' && catalogResult.status === 'rejected') {",
    "        throw contextResult.reason",
    "      }",
    "      if (request !== dholeLclColoaderCostRequest || !isLclColoaderAgentCostContext()",
    "        || costContextAgentId() !== agentId || form.originId !== originId",
    "        || form.destinationId !== poeId || form.podId !== podId",
    "        || form.incotermId !== incotermId",
    "        || form.serviceIds.join(',') !== serviceIds",
    "        || lclSelectedSource.value?.id !== sourceId) return",
    "",
    "      const selected = new Map<string, CostSelectDto>()",
    "      if (catalogResult.status === 'fulfilled') {",
    "        catalogResult.value.forEach((cost) => selected.set(cost.id, cost))",
    "      }",
    "      if (contextResult.status === 'fulfilled') {",
    "        contextResult.value.forEach((cost) => selected.set(cost.id, cost))",
    "      }",
    "      costs.value = [...selected.values()].filter(dholeLclColoaderAgentCostMatches)",
    "    } catch (error) {",
    "      if (request === dholeLclColoaderCostRequest) {",
    "        costs.value = []",
    "        toastStore.backendError(error, 'No se pudieron cargar los costos del agente LCL coloader.')",
    "      }",
    "    }",
    "    return",
    "  }",
  ].join('\n')
  // Previous Vite transforms rewrite the original coloader guard; install an early
  // return before those guards instead of matching their old implementation.
  code = lclReplaceOnce(code, 'async function loadApplicableCosts() {',
    'async function loadApplicableCosts() {\n' + agentLoader,
    'LCL agent-only cost loading')
  code = lclReplaceOnce(code, 'function applicableConfiguredCosts() {',
    'function applicableConfiguredCosts() {\n  if (isLclColoaderAgentCostContext()) return costs.value.filter(dholeLclColoaderAgentCostMatches).sort((a, b) => costSpecificity(b) - costSpecificity(a))',
    'configured cost matcher')
  code = lclReplaceOnce(code, 'function rebuildRateLines() {',
    'function rebuildRateLines() {\n  if (isLclColoaderAgentCostContext()) {\n    rebuildLclColoaderAgentLines()\n    return\n  }',
    'LCL rate-line rebuild')
  // Previous transforms can rewrite the coloader exclusion in the optional merger.
  // Always intercept at the function entry, before legacy guards.
  const mergeStart = code.indexOf('function mergeConfiguredOptionalCostsIntoRateLines(')
  if (mergeStart < 0) throw new Error('[lclColoaderAgentCosts] Missing optional merge function')
  const mergeOpen = code.indexOf('{', mergeStart)
  if (mergeOpen < 0) throw new Error('[lclColoaderAgentCosts] Missing optional merge body')
  code = code.slice(0, mergeOpen + 1)
    + '\n  if (isLclColoaderAgentCostContext()) {\n    rebuildLclColoaderAgentLines()\n    return\n  }'
    + code.slice(mergeOpen + 1)
  // Hydration from an older Own quote must not restore its carrier.
  const restoreCarrier = 'if (!form.carrierId && editingRate.value.carrierId) form.carrierId = editingRate.value.carrierId'
  if (code.includes(restoreCarrier)) {
    code = code.replace(restoreCarrier,
      'if (!isLclColoaderAgentCostContext() && !form.carrierId && editingRate.value.carrierId) form.carrierId = editingRate.value.carrierId')
  }
  const refreshAnchor = 'function refreshRateLinesForCurrentSource() {'
  if (code.includes(refreshAnchor)) {
    code = lclReplaceOnce(code, refreshAnchor,
      refreshAnchor + '\n  if (isLclColoaderAgentCostContext()) {\n    rebuildLclColoaderAgentLines()\n    return\n  }',
      'LCL coloader refresh')
  }
  const ownSnapshot = "editingRate.value?.rateDetails?.some((detail) => /LCL\\s*PROPIO|ConsolidadoId:/i.test(String(detail.notes ?? '')))"
  const relinkAnchor = 'function relinkExistingDetailIdsForEdit() {'
  if (code.includes(relinkAnchor)) {
    code = lclReplaceOnce(code, relinkAnchor,
      relinkAnchor + '\n  if (isLclColoaderAgentCostContext() && ' + ownSnapshot + ') return',
      'Own detail relinking guard')
  }
  const preserveAnchor = 'function shouldPreservePersistedEditLines() {'
  if (code.includes(preserveAnchor)) {
    code = lclReplaceOnce(code, preserveAnchor,
      preserveAnchor + '\n  if (isLclColoaderAgentCostContext() && ' + ownSnapshot + ') return false',
      'Own snapshot preservation guard')
  }
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
