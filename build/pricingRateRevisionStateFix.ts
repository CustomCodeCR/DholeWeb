import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  const marker = '// dholeRevisionStateHydrationFix'
  if (source.includes(marker)) return source

  const hydrationPattern =
    /function hydrateEditSelectionsFromRate\(rate: RateDto\) \{[\s\S]*?\n\}\n\nfunction relinkExistingDetailIdsForEdit\(\) \{/

  if (!hydrationPattern.test(source)) {
    throw new Error('[pricingRateRevisionStateFix] Missing edit-selection hydration function.')
  }

  const replacement = `function hydrateEditSelectionsFromRate(rate: RateDto) {
  // dholeRevisionStateHydrationFix
  // Una revisión debe abrir exactamente con las selecciones persistidas de la tarifa.
  // Services es autoritativo para condiciones de carga; RateDetails lo es para
  // Merchant/Naviera y muellaje, porque son las líneas efectivamente guardadas.
  const subjectLines = persistedEditTermLines(rate.subjectTo)
  const includeLines = persistedEditTermLines(rate.includes)
  const details = rate.rateDetails ?? []
  const services = rate.services ?? []

  const detailLines = details
    .map((detail) => normalizeCatalogValue(\`\${detail.name} \${detail.notes ?? ''}\`))
    .filter(Boolean)
  const serviceLines = services
    .map((service) => normalizeCatalogValue(\`\${service.code ?? ''} \${service.name ?? ''}\`))
    .filter(Boolean)

  const hasDetail = (...terms: string[]) => persistedEditTermContains(detailLines, ...terms)
  const hasService = (...terms: string[]) => persistedEditTermContains(serviceLines, ...terms)

  // No inferir Carga peligrosa/Sobrepeso desde Subject To cuando la tarifa ya tiene
  // Services persistidos: un término comercial genérico no debe activar un flag.
  if (services.length > 0) {
    form.dangerousCargo = hasService('DANGEROUS_CARGO', 'carga peligrosa', 'dangerous cargo', 'hazmat')
    form.overweight = hasService('OVERWEIGHT', 'sobrepeso', 'sobre peso', 'overweight', 'over weight')
  } else {
    form.dangerousCargo =
      hasDetail('carga peligrosa', 'dangerous cargo', 'hazmat')
      || persistedEditTermContains(subjectLines, 'carga peligrosa', 'dangerous cargo', 'hazmat')
    form.overweight =
      hasDetail('sobrepeso', 'sobre peso', 'overweight', 'over weight')
      || persistedEditTermContains(subjectLines, 'sobrepeso', 'sobre peso', 'overweight', 'over weight')
  }

  form.nonStackable =
    hasService('NON_STACKABLE', 'carga no estibable', 'non stackable', 'nonstackable')
    || hasDetail('carga no estibable', 'non stackable', 'nonstackable')
    || persistedEditTermContains(subjectLines, 'carga no estibable', 'non stackable', 'nonstackable')

  const merchantFromDetails = hasDetail(
    'merchant haulage',
    'inland gam merchant',
    'gate + inland gam merchant',
  )
  const carrierFromDetails = hasDetail('carrier haulage', 'inland gam naviera')
  const merchantFromIncludes = persistedEditTermContains(
    includeLines,
    'merchant haulage',
    'inland gam merchant',
    'gate + inland gam merchant',
  )
  const carrierFromIncludes = persistedEditTermContains(
    includeLines,
    'carrier haulage',
    'inland gam naviera',
  )

  // Los detalles tienen prioridad. Así una tarifa histórica que realmente tenía
  // Merchant no lo pierde porque Includes esté incompleto o haya sido regenerado.
  if (merchantFromDetails !== carrierFromDetails) {
    form.merchantHaulage = merchantFromDetails
    form.carrierHaulage = carrierFromDetails
  } else if (merchantFromIncludes !== carrierFromIncludes) {
    form.merchantHaulage = merchantFromIncludes
    form.carrierHaulage = carrierFromIncludes
  } else {
    form.merchantHaulage = false
    form.carrierHaulage = false
  }

  const anticipadoFromDetails = hasDetail('anticipado')
  const redestinoFromDetails = hasDetail('redestino')
  const anticipadoFromIncludes = persistedEditTermContains(includeLines, 'anticipado')
  const redestinoFromIncludes = persistedEditTermContains(includeLines, 'redestino')

  if (anticipadoFromDetails !== redestinoFromDetails) {
    form.portHandlingMode = anticipadoFromDetails ? 'Anticipado' : 'Redestino'
  } else if (anticipadoFromIncludes !== redestinoFromIncludes) {
    form.portHandlingMode = anticipadoFromIncludes ? 'Anticipado' : 'Redestino'
  } else {
    form.portHandlingMode = ''
  }
}

function relinkExistingDetailIdsForEdit() {`

  return source.replace(hydrationPattern, replacement)
}

export function pricingRateRevisionStateFix(): Plugin {
  return {
    name: 'dhole-pricing-rate-revision-state-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
