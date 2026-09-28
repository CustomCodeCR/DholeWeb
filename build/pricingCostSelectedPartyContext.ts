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

  // Pricing expone todas las relaciones como listas. Para una cotización concreta
  // mostramos la relación que coincide con el contexto seleccionado, manteniendo
  // los campos legacy únicamente como fallback de compatibilidad.
  const relationName = (
    relations: Array<{ id: string; name: string }> | null | undefined,
    selectedId: string,
    legacyName?: string | null,
  ) => relations?.find((item) => item.id === selectedId)?.name
    ?? relations?.[0]?.name
    ?? legacyName
    ?? null

  const agentName = relationName(cost.agents, form.agentId, cost.agentName)
  const carrierName = relationName(cost.carriers, form.carrierId, cost.carrierName)
  const polName = relationName(cost.pols, form.originId, cost.polName)
  const poeName = relationName(cost.poes, costContextPoeId(), cost.poeName)
  const podName = relationName(cost.pods, form.podId, cost.podName)

  if (agentName) parts.push(`Agente: ${agentName}`)
  if (carrierName) parts.push(`Naviera: ${carrierName}`)
  if (polName) parts.push(`POL: ${polName}`)
  if (poeName) parts.push(`POE: ${poeName}`)
  if (podName) parts.push(`POD: ${podName}`)
  if (cost.portName && !parts.some((part) => part.includes(cost.portName!))) {
    const role = cost.portRole && cost.portRole !== 'Any' ? cost.portRole.toUpperCase() : 'Puerto'
    parts.push(`${role}: ${cost.portName}`)
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
