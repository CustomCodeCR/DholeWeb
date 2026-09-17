import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function patchWizard(source: string) {
  let code = source
  const start = 'async function next() {'
  const end = 'function previous() {'
  const startIndex = code.indexOf(start)
  const endIndex = code.indexOf(end, startIndex + start.length)

  if (startIndex < 0 || endIndex < 0) {
    throw new Error('[pricingWizardStep4NavigationHardFix] Wizard navigation anchors not found.')
  }

  const hasSavedManualRateState = code.includes('const selectedSavedManualRate = computed(')
  const savedManualStep = hasSavedManualRateState
    ? `    if (selectedSavedManualRate.value) {\n      await loadApplicableCosts()\n      hydrateSavedManualRateLines(selectedSavedManualRate.value)\n      if (step.value < 8) step.value += 1\n      return\n    }\n`
    : ''

  const replacement = `async function next() {
  // Solo la vista de solo lectura puede saltarse la lógica del wizard. En edición
  // debemos ejecutar exactamente el mismo flujo que creación para volver a consultar
  // tarifas en Pantalla 5 y reconstruir costos/líneas antes de guardar.
  if (props.rateId && props.viewOnly) {
    if (step.value < maxStep.value) step.value += 1
    return
  }

  // Pantalla 4 nunca debe quedar bloqueada por la carga de tarifas. Cambiar a
  // Pantalla 5 primero y ejecutar la consulta en segundo plano.
  if (step.value === 4) {
    step.value = 5
    void searchApprovedRates().catch((error) => {
      toastStore.backendError(error, 'No se pudieron cargar las tarifas disponibles.')
    })
    return
  }

  if (!canNext.value) return

  if (step.value === 6) {
${savedManualStep}    await loadApplicableCosts()
    rebuildRateLines()
  }

  if (step.value < 8) step.value += 1
}

`

  code = code.slice(0, startIndex) + replacement + code.slice(endIndex)

  // Algunos transforms anteriores pueden conservar compareFclCandidateRates pero
  // eliminar accidentalmente su helper fclRateApprovalRank. Eso compila porque la
  // referencia se resuelve en runtime, pero rompe Pantalla 5 con un ReferenceError.
  // Como este plugin es el último transform del wizard antes de Vue, restauramos el
  // helper únicamente cuando realmente falta.
  const hasApprovalRankDefinition = code.includes('function fclRateApprovalRank(')
    || code.includes('const fclRateApprovalRank')
    || code.includes('let fclRateApprovalRank')
  const usesApprovalRank = code.includes('fclRateApprovalRank(')

  if (usesApprovalRank && !hasApprovalRankDefinition) {
    const comparatorAnchor = 'function compareFclCandidateRates('
    const comparatorIndex = code.indexOf(comparatorAnchor)
    if (comparatorIndex < 0) {
      throw new Error('[pricingWizardStep4NavigationHardFix] FCL comparator anchor not found.')
    }

    const helper = `function fclRateApprovalRank(rate: ImportRateSelectDto) {
  if (rate.status === 'Approved') return 0
  if (rate.status === 'PreAuthorized') return 1
  return 2
}

`
    code = code.slice(0, comparatorIndex) + helper + code.slice(comparatorIndex)
  }

  return code
}

export function pricingWizardStep4NavigationHardFix(): Plugin {
  return {
    name: 'dhole-pricing-wizard-step4-navigation-hard-fix',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
