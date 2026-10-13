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
  ].join('\n')
  return source.replace(anchor, runtime + '\n\n' + anchor)
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
