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

function hasSatisfiedOverweightVariant(
  line: {
    id?: string | null
    costId?: string | null
    operationalConditions?: string[] | null
  },
  conditions: string[],
) {
  if (!form.overweight || conditions.includes('Overweight')) return false

  const lineId = automaticOptionalCostId(line)
  const base = [...conditions].sort()

  return costs.value.some((candidate) => {
    if (candidate.costType !== 'Optional') return false
    if (candidate.id === lineId) return false

    const candidateConditions = operationalConditionsFor(candidate)
    if (!candidateConditions.includes('Overweight')) return false

    const candidateBase = candidateConditions
      .filter((condition) => condition !== 'Overweight')
      .sort()

    // Variante mutuamente excluyente: misma regla base, pero especializada
    // para Sobrepeso. Ej.: [CarrierHaulage] vs [CarrierHaulage, Overweight].
    if (
      candidateBase.length !== base.length
      || candidateBase.some((condition, index) => condition !== base[index])
    ) {
      return false
    }

    return candidateConditions.every((condition) => operationalConditionSelected(condition))
  })
}

function shouldIncludeOptionalCost(line: {
  id?: string | null
  costId?: string | null
  operationalConditions?: string[] | null
}) {
  const automaticCostId = automaticOptionalCostId(line)
  if (automaticCostId && dismissedAutomaticOptionalCostIds.value.has(automaticCostId)) return false

  const conditions = operationalConditionsFor(line)

  // Sin condiciones explícitas el cargo sigue disponible en Pantalla 7,
  // pero nunca se marca automáticamente.
  if (conditions.length === 0) return false

  // AND estricto: cuando un cargo requiere Naviera + Sobrepeso, ambos botones
  // deben estar seleccionados. El nombre del cargo no participa en esta decisión.
  if (!conditions.every((condition) => operationalConditionSelected(condition))) return false

  // Si existe una variante específica de Sobrepeso para la misma regla base,
  // la variante normal es excluyente y no se selecciona al mismo tiempo.
  if (hasSatisfiedOverweightVariant(line, conditions)) return false

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
    if (!configured?.operationalConditions?.length) return

    line.included = shouldIncludeOptionalCost(configured)
    if (!line.included) line.applyDestinationTax = false
  })
}`,
    'operational condition synchronization',
  )

  // La selección manual tampoco puede dejar activa a la vez la variante normal
  // y la variante de Sobrepeso. Después de cualquier cambio del multiselect, reaplicar
  // las condiciones explícitas y su exclusividad.
  code = replaceRegexOne(
    code,
    /      line\.included = selectable && selected\.has\(line\.key\)\n    \}\)\n  \},\n\}\)/,
    `      line.included = selectable && selected.has(line.key)
    })
    syncHaulageOptionalLines()
  },
})`,
    'manual optional selection exclusivity',
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
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
