import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRegexOne(source: string, pattern: RegExp, replacement: string, label: string) {
  const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  const matches = source.match(new RegExp(pattern.source, flags))
  if ((matches?.length ?? 0) !== 1) {
    throw new Error(
      `[pricingCostOperationalConditions] Expected one ${label}, found ${matches?.length ?? 0}.`,
    )
  }
  pattern.lastIndex = 0
  return source.replace(pattern, replacement)
}

function patchWizard(source: string) {
  let code = source

  code = replaceRegexOne(
    code,
    /function shouldIncludeOptionalCost\([\s\S]*?\n\}(?=\n\n(?:const selectableOptionalLines = computed|async function loadApplicableCosts))/,
    `function operationalConditionSelected(condition: string) {
  switch (condition) {
    case 'DangerousCargo':
      return !ltlCargoMode.value && form.dangerousCargo
    case 'Overweight':
      return !ltlCargoMode.value && form.overweight
    case 'MerchantHaulage':
      return form.merchantHaulage
    case 'CarrierHaulage':
      return form.carrierHaulage
    case 'EmptyReturn':
      return form.emptyReturn
    case 'ElectronicSeal':
      return form.electronicSeal
    case 'Anticipado':
      return form.portHandlingMode === 'Anticipado'
    case 'Redestino':
      return form.portHandlingMode === 'Redestino'
    default:
      return false
  }
}

function operationalConditionsFor(line: {
  operationalConditions?: string[] | null
}) {
  return Array.isArray(line.operationalConditions)
    ? line.operationalConditions.filter(Boolean)
    : []
}

function shouldIncludeOptionalCost(line: {
  id?: string | null
  costId?: string | null
  operationalConditions?: string[] | null
}) {
  const automaticCostId = automaticOptionalCostId(line)
  if (automaticCostId && dismissedAutomaticOptionalCostIds.value.has(automaticCostId)) return false
  // Pricing pidió que TODOS los cargos Optional aplicables al contexto entren marcados
  // por defecto. Las condiciones operativas siguen sirviendo para identificar el botón
  // relacionado, pero no desmarcan automáticamente la línea. El usuario puede quitarla
  // manualmente en Pantalla 7 y esa decisión se conserva mediante dismissed...Ids.
  return true
}`,
    'explicit operational condition matcher',
  )

  code = replaceRegexOne(
    code,
    /function syncHaulageOptionalLines\(\) \{[\s\S]*?\n\}(?=\n\nfunction toggleMerchantHaulage)/,
    `function syncHaulageOptionalLines() {
  if (props.viewOnly && props.rateId) return

  rateLines.value.forEach((line) => {
    if (!line.optional || !line.costId) return
    const configured = costs.value.find((cost) => cost.id === line.costId)
    if (!configured) return

    line.included = shouldIncludeOptionalCost({
      ...configured,
      costId: line.costId,
    })
    if (!line.included) line.applyDestinationTax = false
  })
}`,
    'operational condition synchronization',
  )

  code = replaceRegexOne(
    code,
    /const selectableOptionalLines = computed\(\(\) =>[\s\S]*?\n\)\nconst optionalChargeOptions = computed/,
    `const selectableOptionalLines = computed(() =>
  rateLines.value.filter((line) => line.optional),
)
const optionalChargeOptions = computed`,
    'multimodal optional selector exclusion',
  )

  // No inventar cargos Inland por el botón. Los botones solo activan cargos
  // configurados en Costos y recargos que ya pasaron ruta/naviera/agente/etc.
  code = replaceRegexOne(
    code,
    /\n\s*const addHaulageOption = \(key: string, name: string\) => \{[\s\S]*?\n\s*if \(form\.carrierHaulage\) addHaulageOption\('haulage:carrier', 'Inland GAM Naviera'\)\n/,
    '\n',
    'synthetic haulage fallback',
  )

  return code
}

export function pricingCostOperationalConditions(): Plugin {
  return {
    name: 'dhole-pricing-cost-operational-conditions',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
