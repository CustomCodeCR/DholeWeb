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
