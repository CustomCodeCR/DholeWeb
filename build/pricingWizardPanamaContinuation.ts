import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceRequired(source: string, anchor: string, replacement: string, label: string) {
  if (!source.includes(anchor)) {
    throw new Error(`[pricingWizardPanamaContinuation] ${label} anchor not found.`)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  if (code.includes('// dhole-panama-production-no-search')) return code

  const canNextAnchor = `const canNext = computed(() => {`
  const helpers = `// dhole-panama-production-no-search
const panamaProductionNoSearchActive = computed(() =>
  ['Maritime', 'Multimodal'].includes(String(form.modality))
  && shipmentModeForApi.value === 'Fcl'
  && isMultimodalViaPanama(selectedDestination.value),
)

function panamaProductionFinalDestination() {
  const selected = selectedPod.value ? displayValue(selectedPod.value) : ''
  return selected || String(editingRate.value?.podName ?? '').trim()
}

function panamaProductionFinalDestinationCode() {
  return String(selectedPod.value?.code ?? editingRate.value?.podCode ?? '').trim() || null
}

function isPanamaCostaRicaGamProductionRoute(finalDestination: string) {
  const normalized = normalizeCatalogValue(finalDestination)
  return normalized.includes('san jose') || normalized === 'costa rica'
}

function appendPanamaProductionLandLine(lines: RateLine[]) {
  if (!panamaProductionNoSearchActive.value) return

  const finalDestination = panamaProductionFinalDestination()
  if (!isPanamaCostaRicaGamProductionRoute(finalDestination)) return

  const usd = catalogs.currencies.find((currency) => {
    const value = normalizeCatalogValue([
      currency.code,
      displayValue(currency),
      currency.label,
    ].filter(Boolean).join(' '))
    return value === 'usd'
      || value.includes(' usd')
      || value.includes('dolar')
      || value.includes('dollar')
  }) ?? null

  if (!usd) return

  lines.push({
    key: 'panama-production:cfz-san-jose-2140',
    section: 'international_freight',
    name: 'Flete terrestre internacional CFZ / Zona Libre Colón, Panamá → ' + finalDestination,
    costDetailType: 'InlandTransport',
    costType: 'Variable',
    chargeBasis: 'PerContainer',
    contextLabel: 'CFZ / Zona Libre Colón, Panamá → ' + finalDestination + ' · Marítimo-terrestre',
    notes: '[PANAMA_PRODUCTION_NO_SEARCH] Regla GCF multimodal: CFZ / Zona Libre Colón, Panamá → San José, Costa Rica · USD 2,140 por unidad. No realiza búsqueda adicional.',
    currencyId: usd.id,
    currencyName: displayValue(usd) || usd.label || 'USD',
    currencyCode: String(usd.code || 'USD'),
    amountCurrencyCode: String(usd.code || 'USD'),
    costAmount: 2140,
    saleAmount: 2140,
    included: true,
    optional: false,
    manual: false,
  })
}

${canNextAnchor}`
  code = replaceRequired(code, canNextAnchor, helpers, 'production Panama helpers')

  // Mantener el POD final que escogió el usuario. La tarifa marítima primaria no debe reemplazarlo.
  const chooseRateStart = code.indexOf(`function chooseRate(rate: ImportRateSelectDto) {`)
  const chooseRateEnd = code.indexOf(`function continueManual() {`, chooseRateStart)
  if (chooseRateStart < 0 || chooseRateEnd < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Imported rate selection anchors not found.')
  }

  let chooseRateBlock = code.slice(chooseRateStart, chooseRateEnd)
  chooseRateBlock = chooseRateBlock.replace(
    `  if (ratePod) form.podId = ratePod.id`,
    `  if (ratePod && !panamaProductionNoSearchActive.value) form.podId = ratePod.id`,
  )
  code = code.slice(0, chooseRateStart) + chooseRateBlock + code.slice(chooseRateEnd)

  // En producción no hay selector ni segunda búsqueda. Solo exigimos el POD final.
  const canNextIndex = code.indexOf(canNextAnchor)
  const stepThreeIndex = code.indexOf(`  if (step.value === 3) {`, canNextIndex)
  const stepThreeReturnIndex = code.indexOf(`\n    return Boolean(`, stepThreeIndex)
  if (stepThreeIndex < 0 || stepThreeReturnIndex < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Screen 3 validation anchor not found.')
  }
  code = code.slice(0, stepThreeReturnIndex)
    + `\n    if (panamaProductionNoSearchActive.value && !form.podId && !editingRate.value?.podName) return false`
    + code.slice(stepThreeReturnIndex)

  // Pantalla 7: aplicar directamente la regla GCF CFZ -> San José por USD 2,140.
  // No consulta PanamaContinuationService ni ejecuta un segundo lookup.
  const rateLinesAssignment = `  rateLines.value = lines`
  const rateLinesIndex = code.indexOf(rateLinesAssignment, code.indexOf(`function rebuildRateLines() {`))
  if (rateLinesIndex < 0) {
    throw new Error('[pricingWizardPanamaContinuation] Rate line rebuild anchor not found.')
  }
  code = code.slice(0, rateLinesIndex)
    + `  appendPanamaProductionLandLine(lines)\n`
    + code.slice(rateLinesIndex)

  return code
}

export function pricingWizardPanamaContinuation(): Plugin {
  return {
    name: 'dhole-pricing-wizard-panama-production-no-search',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
