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
  if (!props.rateId || !rate || props.viewOnly) return false

  // En edición, la identidad comercial del flete es la fuente marítima seleccionada
  // y la naviera de la tarifa. El import puede venir con Agent/POD "Por asignar";
  // esos placeholders NO invalidan el snapshot ya cotizado.
  const sameCarrier = String(rate.carrierId ?? "") === String(form.carrierId ?? "")
  const sameShipmentMode =
    String(rate.shipmentMode ?? "").toUpperCase() === String(form.shipmentMode ?? "").toUpperCase()
  if (!sameCarrier || !sameShipmentMode) return false

  return rate.sourceImportFclRateId
    ? form.selectedImportRateId === rate.sourceImportFclRateId
    : form.manualRate && !form.selectedImportRateId
}

function syncPersistedFreightLineForEdit() {
  // Los valores persistidos de RateDetails son autoritativos. Esta función solo
  // conserva/revincula sus IDs; nunca vuelve a escribir costo/venta desde el import.
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

  // El response de getRate es el snapshot autoritativo de Pantalla 7 mientras
  // el usuario mantenga el mismo flete importado y la misma naviera.
  const rebuildAnchor = `function rebuildRateLines() {\n`
  if (!code.includes(`function rebuildRateLines() {\n  if (shouldPreservePersistedEditLines())`)) {
    if (!code.includes(rebuildAnchor)) {
      throw new Error('[pricingWizardStep4NavigationHardFix] rebuildRateLines anchor not found.')
    }
    code = code.replace(
      rebuildAnchor,
      `function rebuildRateLines() {\n  if (shouldPreservePersistedEditLines()) {\n    syncPersistedFreightLineForEdit()\n    return\n  }\n`,
    )
  }

  // No agregar opcionales del catálogo al hidratar una tarifa existente. Ese merge
  // era el responsable de que aparecieran Marchamo/Retiro Vacío y otros rubros que
  // nunca estuvieron guardados en rateDetails.
  const optionalMergeGuard = `  if (props.viewOnly && props.rateId) return`
  if (code.includes(optionalMergeGuard)) {
    code = code.replace(
      optionalMergeGuard,
      `  if (props.rateId && (props.viewOnly || shouldPreservePersistedEditLines())) return`,
    )
  }

  // Al seleccionar otra vez el MISMO flete original en Pantalla 5, el import solo
  // identifica la fuente. No debe pisar la venta cotizada, POD, agente, moneda ni
  // demás datos que ya quedaron persistidos en el RateHeader/RateDetails.
  const chooseRateStart =
    code.indexOf('async function chooseRate(rate: ImportRateSelectDto) {') >= 0
      ? code.indexOf('async function chooseRate(rate: ImportRateSelectDto) {')
      : code.indexOf('function chooseRate(rate: ImportRateSelectDto) {')
  const chooseRateEnd = code.indexOf('function continueManual() {', chooseRateStart)
  if (chooseRateStart < 0 || chooseRateEnd < 0) {
    throw new Error('[pricingWizardStep4NavigationHardFix] chooseRate anchors not found.')
  }

  let chooseRateBlock = code.slice(chooseRateStart, chooseRateEnd)
  const chooseRateStepAnchor = `  step.value = 6`
  if (!chooseRateBlock.includes('const persistedEditFreight = editingRate.value?.rateDetails.find')) {
    if (!chooseRateBlock.includes(chooseRateStepAnchor)) {
      throw new Error('[pricingWizardStep4NavigationHardFix] chooseRate step anchor not found.')
    }
    chooseRateBlock = chooseRateBlock.replace(
      chooseRateStepAnchor,
      `  if (shouldPreservePersistedEditLines()) {\n    const persistedEditFreight = editingRate.value?.rateDetails.find((detail) => detail.costDetailType === 'Freight')\n    if (persistedEditFreight) {\n      form.freightCost = number(persistedEditFreight.costAmount)\n      form.freightSale = number(persistedEditFreight.saleAmount)\n    }\n    if (editingRate.value?.podId) form.podId = editingRate.value.podId\n    if (editingRate.value?.carrierId) form.carrierId = editingRate.value.carrierId\n    if (editingRate.value?.currencyId) form.currencyId = editingRate.value.currencyId\n  }\n\n${chooseRateStepAnchor}`,
    )
  }
  code = code.slice(0, chooseRateStart) + chooseRateBlock + code.slice(chooseRateEnd)

  const bundleStart = code.indexOf('function chooseFclRateBundle(bundle: FclRateBundle) {')
  if (bundleStart >= 0) {
    const bundleEnd = code.indexOf('\n}', bundleStart)
    if (bundleEnd < 0) {
      throw new Error('[pricingWizardStep4NavigationHardFix] chooseFclRateBundle end not found.')
    }
    let bundleBlock = code.slice(bundleStart, bundleEnd + 2)
    const agentAnchor = `  if (agent) form.agentId = agent.id`
    if (bundleBlock.includes(agentAnchor) && !bundleBlock.includes('editingRate.value?.agentId')) {
      bundleBlock = bundleBlock.replace(
        agentAnchor,
        `${agentAnchor}\n  if (shouldPreservePersistedEditLines() && editingRate.value?.agentId) {\n    form.agentId = editingRate.value.agentId\n  }`,
      )
      code = code.slice(0, bundleStart) + bundleBlock + code.slice(bundleEnd + 2)
    }
  }

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
