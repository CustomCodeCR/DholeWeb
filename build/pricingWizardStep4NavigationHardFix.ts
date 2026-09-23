import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOne(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error(`[pricingWizardStep4NavigationHardFix] Expected one ${label}, found ${count}.`)
  }
  return source.replace(anchor, replacement)
}

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

  const replacement = `const persistedEditAppliedIncotermId = ref('')

function persistedEditRouteMatches() {
  const rate = editingRate.value
  if (!props.rateId || !rate || props.viewOnly) return false

  return String(rate.polId ?? '') === String(form.originId ?? '')
    && String(rate.poeId ?? '') === String(form.destinationId ?? '')
    && String(rate.podId ?? '') === String(form.podId ?? '')
}

function shouldPreservePersistedEditLines() {
  const rate = editingRate.value
  if (!persistedEditRouteMatches() || !rate) return false

  // El snapshot depende SOLO de ruta + naviera + agente.
  // Equipo, Incoterm, moneda y sourceImportFclRateId NO lo invalidan.
  return String(rate.carrierId ?? '') === String(form.carrierId ?? '')
    && String(rate.agentId ?? '') === String(form.agentId ?? '')
}

function samePersistedRouteAndCarrierCandidate(candidate: ImportRateSelectDto) {
  const rate = editingRate.value
  if (!props.rateId || !rate || props.viewOnly) return false

  // El POD del import puede venir "Por asignar"; el POD final autoritativo es el
  // que ya está persistido en la cotización.
  return String(rate.polId ?? '') === String(candidate.polId ?? form.originId ?? '')
    && String(rate.poeId ?? '') === String(candidate.poeId ?? form.destinationId ?? '')
    && String(rate.podId ?? '') === String(form.podId ?? '')
    && String(rate.carrierId ?? '') === String(candidate.carrierId ?? form.carrierId ?? '')
}

function isOriginalPersistedFreightCandidate(candidate: ImportRateSelectDto) {
  const sourceId = editingRate.value?.sourceImportFclRateId
  return Boolean(sourceId && sourceId === candidate.id && samePersistedRouteAndCarrierCandidate(candidate))
}

function isUnassignedCandidateParty(value: unknown) {
  const normalized = normalizeCatalogValue(String(value ?? ''))
  return !normalized || normalized === 'pending' || normalized.includes('por asignar')
}

function persistedRateLineForEdit(detail: RateDto['rateDetails'][number]): RateLine {
  const configuredCost = detail.costId ? costs.value.find((cost) => cost.id === detail.costId) : null
  return {
    key: \`existing:\${detail.id}\`,
    detailId: detail.id,
    section: sectionForDetail(detail.costDetailType, detail.name),
    name: detail.name,
    costDetailType: detail.costDetailType,
    costType: detail.costType,
    chargeBasis: detail.chargeBasis,
    costId: detail.costId ?? null,
    notes: detail.notes ?? null,
    billToClient: detail.billToClient ?? null,
    serviceIds: configuredCost?.services?.map((service) => service.id) ?? [],
    currencyId: detail.currencyId,
    currencyName: detail.currencyName,
    currencyCode: detail.currencyCode,
    amountCurrencyCode: detail.currencyCode,
    costAmount: Number(detail.costAmount || 0),
    saleAmount: Number(detail.saleAmount || 0),
    included: true,
    optional: detail.costType === 'Optional',
    manual: !detail.costId,
    applyDestinationTax:
      Boolean(detail.applyDestinationTax) || /IVA\\s+\\d+/i.test(String(detail.notes ?? '')),
    destinationTaxRate: Number(detail.destinationTaxRate || 0),
  } as RateLine
}

function syncPersistedFreightLineForEdit() {
  const freight = rateLines.value.find((line) => line.costDetailType === 'Freight')
  if (freight) {
    // Si se escogió otro flete de la misma ruta/naviera/agente, solo cambia el
    // flete. chooseRate protege costo/venta cuando se reelige el source original.
    freight.costAmount = number(form.freightCost)
    freight.saleAmount = number(form.freightSale)
  }
  relinkExistingDetailIdsForEdit()
}

function appendConfiguredCostToPersistedEdit(cost: CostSelectDto) {
  const section = sectionForCost(cost)
  const duplicate = rateLines.value.some((line) =>
    (line.costId && line.costId === cost.id)
    || (
      line.costDetailType === cost.costDetailType
      && normalizeCatalogValue(line.name) === normalizeCatalogValue(cost.name)
    ),
  )
  if (duplicate || !visibleSections.value.includes(section) || cost.costDetailType === 'Freight') return

  rateLines.value.push({
    key: \`edit-incoterm-cost:\${cost.id}\`,
    section,
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    costId: cost.id,
    contextLabel: costContextLabel(cost),
    notes: cost.notes?.trim() || null,
    serviceIds: cost.services?.map((service) => service.id) ?? [],
    currencyId: cost.currencyId,
    currencyName: cost.currencyName,
    currencyCode: cost.currencyCode,
    amountCurrencyCode: cost.currencyCode,
    costAmount: number(cost.costAmount),
    saleAmount: number(cost.saleAmount),
    included:
      cost.costType !== 'Optional'
      || (form.dangerousCargo && isDangerousCargoCost(cost))
      || (form.overweight && isOverweightCost(cost))
      || (form.merchantHaulage && haulageAssociation(cost) === 'merchant')
      || (form.carrierHaulage && haulageAssociation(cost) === 'carrier'),
    optional: cost.costType === 'Optional',
    manual: false,
    applyDestinationTax: false,
    destinationTaxRate: 0,
  } as RateLine)
}

function addIncotermFallbackLine(section: RateSection) {
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency || !visibleSections.value.includes(section)) return

  if (section === 'pickup_origin') {
    const exists = rateLines.value.some(
      (line) => line.section === section && line.costDetailType === 'InlandTransport',
    )
    if (exists) return
    rateLines.value.push({
      key: 'edit-incoterm-fallback:pickup_origin',
      section,
      name: 'Recolecta',
      costDetailType: 'InlandTransport',
      costType: 'Variable',
      chargeBasis: defaultChargeBasis('InlandTransport'),
      contextLabel: 'Variable: complete costo y venta según la recolección aplicable.',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      amountCurrencyCode: currency.code,
      costAmount: 0,
      saleAmount: 0,
      included: true,
      optional: false,
      manual: false,
    })
    return
  }

  if (section === 'origin_charges') {
    const exists = rateLines.value.some(
      (line) => line.section === section && line.costDetailType === 'OriginCharge',
    )
    if (exists) return
    rateLines.value.push({
      key: 'edit-incoterm-fallback:origin_charges',
      section,
      name: 'Cargos en Origen',
      costDetailType: 'OriginCharge',
      costType: 'Variable',
      chargeBasis: defaultChargeBasis('OriginCharge'),
      contextLabel: 'Variable: complete costo y venta según los cargos de origen aplicables.',
      currencyId: currency.id,
      currencyName: displayValue(currency),
      currencyCode: currency.code,
      amountCurrencyCode: currency.code,
      costAmount: 0,
      saleAmount: 0,
      included: true,
      optional: false,
      manual: false,
    })
  }
}

function reconcilePersistedEditLinesForIncoterm() {
  const rate = editingRate.value
  if (!rate || !shouldPreservePersistedEditLines()) return

  const allowed = new Set(incotermResponsibilitySections.value)

  // Eliminar solamente el delta del Incoterm anterior y las secciones que ya no
  // corresponden. Todo RateDetail persistido permitido conserva exactamente su valor.
  rateLines.value = rateLines.value.filter((line) =>
    allowed.has(line.section)
    && !line.key.startsWith('edit-incoterm-cost:')
    && !line.key.startsWith('edit-incoterm-fallback:'),
  )

  // Si una sección persistida vuelve a habilitarse, restaurarla desde el response.
  rate.rateDetails.forEach((detail) => {
    const restored = persistedRateLineForEdit(detail)
    if (!allowed.has(restored.section)) return

    const exists = rateLines.value.some((line) =>
      line.detailId === restored.detailId
      || (
        line.costDetailType === restored.costDetailType
        && normalizeCatalogValue(line.name) === normalizeCatalogValue(restored.name)
      ),
    )
    if (!exists) rateLines.value.push(restored)
  })

  // Agregar los cargos/recargos del NUEVO Incoterm sin tocar líneas ya guardadas.
  applicableConfiguredCosts().forEach(appendConfiguredCostToPersistedEdit)

  // EXW/FCA pueden necesitar sus bloques de origen aunque no haya costo maestro.
  addIncotermFallbackLine('pickup_origin')
  addIncotermFallbackLine('origin_charges')

  syncPersistedFreightLineForEdit()
  rateLines.value.forEach((line) => {
    line.amountCurrencyCode ||= canonicalCurrencyCode(line)
    enforceLineCurrency(line)
  })
}

async function next() {
  // Solo la vista de solo lectura puede saltarse la lógica del wizard.
  if (props.rateId && props.viewOnly) {
    if (step.value < maxStep.value) step.value += 1
    return
  }

  // Pantalla 4 cambia primero a Pantalla 5 y consulta en segundo plano.
  if (step.value === 4) {
    step.value = 5
    void searchApprovedRates().catch((error) => {
      toastStore.backendError(error, 'No se pudieron cargar las tarifas disponibles.')
    })
    return
  }

  if (!canNext.value) return

  if (step.value === 6) {
\${savedManualStep}    if (shouldPreservePersistedEditLines()) {
      // Equipo e Incoterm NO regeneran el snapshot.
      // Si cambió el Incoterm, aplicar únicamente su delta.
      if (persistedEditAppliedIncotermId.value !== form.incotermId) {
        await loadApplicableCosts()
        reconcilePersistedEditLinesForIncoterm()
        persistedEditAppliedIncotermId.value = form.incotermId
      } else {
        syncPersistedFreightLineForEdit()
      }
    } else {
      // Ruta, naviera o agente sí cambió: aquí sí corresponde recalcular.
      await loadApplicableCosts()
      rebuildRateLines()
      persistedEditAppliedIncotermId.value = form.incotermId
    }
  }

  if (step.value < 8) step.value += 1
}

`

  code = code.slice(0, startIndex) + replacement + code.slice(endIndex)

  // Inicializar el Incoterm aplicado con el que vino persistido en la tarifa.
  const hydrateIncotermAnchor = `    form.incotermId = rate.incotermId ?? ''`
  if (code.includes(hydrateIncotermAnchor)) {
    code = code.replace(
      hydrateIncotermAnchor,
      `${hydrateIncotermAnchor}\n    persistedEditAppliedIncotermId.value = form.incotermId`,
    )
  }

  // Cualquier rebuild disparado por watchers debe respetar el snapshot cuando
  // ruta + naviera + agente siguen iguales.
  const rebuildAnchor = `function rebuildRateLines() {\n`
  if (!code.includes(`function rebuildRateLines() {\n  if (shouldPreservePersistedEditLines())`)) {
    code = replaceOne(
      code,
      rebuildAnchor,
      `function rebuildRateLines() {\n  if (shouldPreservePersistedEditLines()) {\n    syncPersistedFreightLineForEdit()\n    return\n  }\n`,
      'rebuildRateLines',
    )
  }

  // Al hidratar una edición existente, rateDetails es autoritativo. No agregar
  // opcionales del catálogo hasta que el usuario cambie explícitamente Incoterm.
  const optionalMergeGuard = `  if (props.viewOnly && props.rateId) return`
  if (code.includes(optionalMergeGuard)) {
    code = code.replace(
      optionalMergeGuard,
      `  if (props.rateId && (props.viewOnly || shouldPreservePersistedEditLines())) return`,
    )
  }

  // Proteger el POD final y los valores del mismo flete original. Un flete NUEVO
  // de la misma ruta/naviera puede cambiar solo la línea de flete.
  const chooseRateStart =
    code.indexOf('async function chooseRate(rate: ImportRateSelectDto) {') >= 0
      ? code.indexOf('async function chooseRate(rate: ImportRateSelectDto) {')
      : code.indexOf('function chooseRate(rate: ImportRateSelectDto) {')
  const chooseRateEnd = code.indexOf('function continueManual() {', chooseRateStart)
  if (chooseRateStart < 0 || chooseRateEnd < 0) {
    throw new Error('[pricingWizardStep4NavigationHardFix] chooseRate anchors not found.')
  }

  let chooseRateBlock = code.slice(chooseRateStart, chooseRateEnd)
  const chooseOpen = chooseRateBlock.indexOf('{') + 1
  chooseRateBlock =
    chooseRateBlock.slice(0, chooseOpen)
    + `\n  const sameEditRouteCarrier = samePersistedRouteAndCarrierCandidate(rate)\n  const originalEditFreight = isOriginalPersistedFreightCandidate(rate)`
    + chooseRateBlock.slice(chooseOpen)

  const chooseRateStepAnchor = `  step.value = 6`
  if (!chooseRateBlock.includes(chooseRateStepAnchor)) {
    throw new Error('[pricingWizardStep4NavigationHardFix] chooseRate step anchor not found.')
  }
  chooseRateBlock = chooseRateBlock.replace(
    chooseRateStepAnchor,
    `  if (sameEditRouteCarrier && editingRate.value?.podId) {\n    form.podId = editingRate.value.podId\n  }\n\n  if (originalEditFreight) {\n    const persistedEditFreight = editingRate.value?.rateDetails.find((detail) => detail.costDetailType === 'Freight')\n    if (persistedEditFreight) {\n      form.freightCost = number(persistedEditFreight.costAmount)\n      form.freightSale = number(persistedEditFreight.saleAmount)\n    }\n    if (editingRate.value?.carrierId) form.carrierId = editingRate.value.carrierId\n    if (editingRate.value?.currencyId) form.currencyId = editingRate.value.currencyId\n  }\n\n${chooseRateStepAnchor}`,
  )
  code = code.slice(0, chooseRateStart) + chooseRateBlock + code.slice(chooseRateEnd)

  // Los imports históricos pueden traer Agente "Por asignar". Si es el source
  // original (o el bundle no trae un agente real), conservar el agente persistido.
  const bundleStart = code.indexOf('function chooseFclRateBundle(bundle: FclRateBundle) {')
  if (bundleStart >= 0) {
    const bundleEnd = code.indexOf('\n}', bundleStart)
    if (bundleEnd < 0) {
      throw new Error('[pricingWizardStep4NavigationHardFix] chooseFclRateBundle end not found.')
    }

    let bundleBlock = code.slice(bundleStart, bundleEnd + 2)
    const chooseBundleAnchor = `  chooseRate(primary.rate)`
    if (bundleBlock.includes(chooseBundleAnchor)) {
      bundleBlock = bundleBlock.replace(
        chooseBundleAnchor,
        `  const preservePersistedEditAgent = samePersistedRouteAndCarrierCandidate(primary.rate)\n    && (isOriginalPersistedFreightCandidate(primary.rate) || isUnassignedCandidateParty(bundle.agent))\n\n${chooseBundleAnchor}`,
      )
    }

    const agentAnchor = `  if (agent) form.agentId = agent.id`
    if (bundleBlock.includes(agentAnchor)) {
      bundleBlock = bundleBlock.replace(
        agentAnchor,
        `${agentAnchor}\n  if (preservePersistedEditAgent && editingRate.value?.agentId) {\n    form.agentId = editingRate.value.agentId\n  }`,
      )
    }

    code = code.slice(0, bundleStart) + bundleBlock + code.slice(bundleEnd + 2)
  }

  // Compatibilidad con transforms FCL anteriores.
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

    const helper = `function fclRateApprovalRank(rate: ImportRateSelectDto) {\n  if (rate.status === 'Approved') return 0\n  if (rate.status === 'PreAuthorized') return 1\n  return 2\n}\n\n`
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
