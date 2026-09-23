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

  const replacement = `function shouldPreservePersistedEditLines() {
  const rate = editingRate.value
  if (!rate || props.viewOnly) return false

  const sameFreightSource = rate.sourceImportFclRateId
    ? form.selectedImportRateId === rate.sourceImportFclRateId
    : form.manualRate && !form.selectedImportRateId
  if (!sameFreightSource) return false

  const persistedServiceIds = (rate.services ?? [])
    .map((service) => service.id)
    .filter(Boolean)
    .sort()
    .join("|")
  const selectedServiceIds = [...form.serviceIds].filter(Boolean).sort().join("|")

  return String(rate.shipmentMode ?? "").toUpperCase() === String(form.shipmentMode ?? "").toUpperCase()
    && String(rate.polId ?? "") === String(form.originId ?? "")
    && String(rate.poeId ?? "") === String(form.destinationId ?? "")
    && String(rate.podId ?? "") === String(form.podId ?? "")
    && String(rate.containerTypeId ?? "") === String(form.equipmentId ?? "")
    && String(rate.incotermId ?? "") === String(form.incotermId ?? "")
    && String(rate.agentId ?? "") === String(form.agentId ?? "")
    && String(rate.carrierId ?? "") === String(form.carrierId ?? "")
    && String(rate.currencyId ?? "") === String(form.currencyId ?? "")
    && persistedServiceIds === selectedServiceIds
}

function syncPersistedFreightLineForEdit() {
  const freight = rateLines.value.find((line) => line.costDetailType === "Freight")
  if (freight) {
    freight.costAmount = number(form.freightCost)
    freight.saleAmount = number(form.freightSale)
  }
  relinkExistingDetailIdsForEdit()
}

async function next() {
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
${savedManualStep}    // Editar con el mismo flete/origen de tarifa es una revisión del snapshot
    // persistido, no una cotización nueva. Mantener exactamente las líneas y valores
    // recibidos por getRate; solo reconstruir Costs cuando realmente cambió el contexto.
    if (shouldPreservePersistedEditLines()) {
      syncPersistedFreightLineForEdit()
    } else {
      await loadApplicableCosts()
      rebuildRateLines()
    }
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
