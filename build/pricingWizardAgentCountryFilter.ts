import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const occurrences = source.split(anchor).length - 1
  if (occurrences !== 1) {
    throw new Error(`[pricingWizardAgentCountryFilter] Expected exactly one ${label} anchor, found ${occurrences}.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source

  const optionsAnchor = `const agentOptions = computed(() => catalogs.agents.map((item) => ({ value: item.id, label: displayValue(item) })))`
  const optionsReplacement = `function agentMatchesSelectedOrigin(agent: CatalogItemSelectDto) {
  const originTokens = countryTokens(selectedOrigin.value)
  if (!originTokens.size) return true

  const agentTokens = countryTokens(agent)
  if (!agentTokens.size) return false

  return [...originTokens].some((originToken) => {
    if (agentTokens.has(originToken)) return true
    if (originToken.length <= 3) return false

    return [...agentTokens].some((agentToken) =>
      agentToken.length > 3 &&
      (agentToken.includes(originToken) || originToken.includes(agentToken)),
    )
  })
}

const eligibleAgents = computed(() => catalogs.agents.filter(agentMatchesSelectedOrigin))
const agentOptions = computed(() => eligibleAgents.value.map((item) => ({ value: item.id, label: displayValue(item) })))`
  code = replaceOne(code, optionsAnchor, optionsReplacement, 'agent options')

  code = replaceOne(
    code,
    `  for (const agent of catalogs.agents) {`,
    `  for (const agent of eligibleAgents.value) {`,
    'agent origin resolver',
  )

  const assignAnchor = `function assignAgentForOrigin() {
  if (hydratingExistingRate.value || !form.originId) return
  const agent = resolveAgentForOrigin()
  if (agent && form.agentId !== agent.id) form.agentId = agent.id
}`
  const assignReplacement = `function assignAgentForOrigin() {
  if (hydratingExistingRate.value || !form.originId) return

  const agent = resolveAgentForOrigin()
  if (agent) {
    if (form.agentId !== agent.id) form.agentId = agent.id
    return
  }

  // Si el POL tiene país identificado pero no existe un agente asociado a ese país,
  // no conservar un agente de otro origen previamente seleccionado.
  if (countryTokens(selectedOrigin.value).size && form.agentId) form.agentId = ''
}`
  code = replaceOne(code, assignAnchor, assignReplacement, 'agent origin assignment')

  return code
}

export function pricingWizardAgentCountryFilter(): Plugin {
  return {
    name: 'dhole-pricing-wizard-agent-country-filter',
    enforce: 'pre',
    transform(source, id) {
      const normalizedId = id.replace(/\\/g, '/').split('?')[0]
      if (id.includes('?') || !normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
