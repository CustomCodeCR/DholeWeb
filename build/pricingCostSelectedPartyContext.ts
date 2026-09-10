import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  const pattern = /function costContextLabel\(cost: CostSelectDto\) \{[\s\S]*?\n\}\n\nfunction applicableCost/
  const matches = source.match(new RegExp(pattern.source, 'g'))
  if ((matches?.length ?? 0) !== 1) {
    throw new Error(
      `[pricingCostSelectedPartyContext] Expected one costContextLabel block, found ${matches?.length ?? 0}.`,
    )
  }

  return source.replace(
    pattern,
    `function costContextLabel(cost: CostSelectDto) {
  const parts: string[] = []

  // CostSelectDto conserva carrierId/agentId legacy con la primera asociación guardada.
  // Cuando Pricing ya resolvió el costo contra el contexto actual, la etiqueta debe mostrar
  // la naviera/agente seleccionado en la tarifa, no ese primer snapshot legacy.
  const selectedAgentForCost = cost.agentId && form.agentId
    ? findById(catalogs.agents, form.agentId)
    : null
  const selectedCarrierForCost = cost.carrierId && form.carrierId
    ? findById(catalogs.carriers, form.carrierId)
    : null
  const agentName = selectedAgentForCost ? displayValue(selectedAgentForCost) : cost.agentName
  const carrierName = selectedCarrierForCost ? displayValue(selectedCarrierForCost) : cost.carrierName

  if (agentName) parts.push(\`Agente: \${agentName}\`)
  if (carrierName) parts.push(\`Naviera: \${carrierName}\`)
  if (cost.polName) parts.push(\`POL: \${cost.polName}\`)
  if (cost.poeName) parts.push(\`POE: \${cost.poeName}\`)
  if (cost.podName) parts.push(\`POD: \${cost.podName}\`)
  if (cost.portName && !parts.some((part) => part.includes(cost.portName!))) {
    const role = cost.portRole && cost.portRole !== 'Any' ? cost.portRole.toUpperCase() : 'Puerto'
    parts.push(\`\${role}: \${cost.portName}\`)
  }
  return parts.join(' · ') || null
}

function applicableCost`,
  )
}

export function pricingCostSelectedPartyContext(): Plugin {
  return {
    name: 'dhole-pricing-cost-selected-party-context',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
