import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

function replaceOnce(source: string, anchor: string, replacement: string, label: string) {
  const count = source.split(anchor).length - 1
  if (count !== 1) {
    throw new Error('[pricingWizardScreen7CostChoice] ' + label + ': expected 1 anchor, got ' + count)
  }
  return source.replace(anchor, replacement)
}

function patchWizard(source: string) {
  let code = source
  const stateAnchor = 'const rateLines = ref<RateLine[]>([])'
  code = replaceOnce(code, stateAnchor, stateAnchor + String.raw`
const screen7RefreshPromptOpen = ref(false)
const screen7RefreshBusy = ref(false)
const screen7RefreshAllowed = ref(false)
const screen7OwnLclRefreshContext = ref('')
// The confirmation is for an existing persisted quote only.
// Newly created quotations always use current catalog costs automatically.
const screen7RequiresConfirmation = computed(() => Boolean(props.rateId) && !props.viewOnly)
`, 'line state')

  // Do not silently replace edited/persisted rows when an upstream watcher
  // asks for catalog costs again. First-time generation still runs normally.
  const rebuildAnchor = 'function rebuildRateLines() {\n  if (pricingDraftRestoring.value) return'
  code = replaceOnce(code, rebuildAnchor, rebuildAnchor + String.raw`
  if (screen7RequiresConfirmation.value && rateLines.value.length > 0 && !screen7RefreshAllowed.value) {
    screen7RefreshPromptOpen.value = true
    return
  }
`, 'rebuild guard')

  // A persisted rate is the authoritative source until the user elects to
  // reapply live catalog data; preserve both amounts and line membership.
  const eagerSync = '    if (!props.viewOnly) syncPersistedLinesWithChangedConfiguredCosts()'
  if (code.includes(eagerSync)) code = code.replace(eagerSync, '    // Keep the persisted price snapshot until Pricing authorizes a catalog refresh.')
  const eagerAdd = '    rateLines.value = uniqueReleaseLines\n    mergeConfiguredOptionalCostsIntoRateLines()'
  if (code.includes(eagerAdd)) code = code.replace(eagerAdd, '    rateLines.value = uniqueReleaseLines')

  const scriptEnd = '\n</script>'
  const script = String.raw`
function screen7CostLineKey(line: RateLine) {
  // A persisted detail can have a different Vue key to an unsaved catalog row.
  return line.costId
    ? 'cost:' + line.costId
    : 'line:' + normalizeCatalogValue(line.name) + '|' + line.costDetailType + '|' + line.section
}

function keepScreen7CurrentLines() {
  screen7RefreshPromptOpen.value = false
  pricingDraftLastLineContext = pricingDraftLineContextKey()
  savePricingDraftNow()
}

function screen7CatalogRateLine(cost: CostSelectDto, previous?: RateLine): RateLine | null {
  const amount = resolvedConditionalCost(cost)
  if (!amount) return null

  // Reconcile persisted details by their stable CostId. Generated wizard rows
  // can be empty for no-freight Incoterms, edited LCL, or legacy routes even
  // when Pricing returned matching costs.
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) return null
  const optional = cost.costType === 'Optional'
  const line: RateLine = {
    key: previous?.key ?? 'cost:' + cost.id,
    detailId: previous?.detailId,
    section: sectionForCost(cost),
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    costId: previous?.costId ?? cost.id,
    contextLabel: costContextLabel(cost),
    notes: cost.notes?.trim() || null,
    serviceIds: cost.services?.map((service) => service.id) ?? [],
    billToClient: previous?.billToClient,
    currencyId: cost.currencyId || currency.id,
    currencyName: cost.currencyName || displayValue(currency),
    currencyCode: cost.currencyCode || currency.code,
    amountCurrencyCode: cost.currencyCode || currency.code,
    costAmount: number(amount.costAmount),
    saleAmount: number(amount.saleAmount),
    included: previous?.included ?? !optional,
    optional,
    manual: false,
    applyDestinationTax: previous?.applyDestinationTax,
    destinationTaxRate: previous?.destinationTaxRate,
  }
  enforceLineCurrency(line)
  return line
}


function screen7OwnLclDestinationCode() {
  const label = normalizeCatalogValue(displayValue(resolvePodForDestination() ?? selectedDestination.value))
  if (/costa rica|san jose|gam|caldera|limon|moin/.test(label)) return 'CR'
  if (/panama|colon|cfz|czf/.test(label)) return 'PA'
  if (/nicaragua|managua/.test(label)) return 'NI'
  if (/honduras|san pedro sula/.test(label)) return 'HN'
  if (/guatemala/.test(label)) return 'GT'
  if (/salvador|san salvador/.test(label)) return 'SV'
  return ''
}

function screen7OwnLclPolCode() {
  const origin = normalizeCatalogValue(
    [displayValue(selectedOrigin.value), selectedOrigin.value?.code].filter(Boolean).join(' '),
  )
  const aliases: Record<string, string> = {
    ningbo: 'NINGBO', cnngb: 'NINGBO',
    qingdao: 'QINGDAO', cntao: 'QINGDAO',
    xiamen: 'XIAMEN', cnxmn: 'XIAMEN',
    shantou: 'SHANTOU', cnswa: 'SHANTOU',
    dalian: 'DALIAN', cndlc: 'DALIAN',
    chongqing: 'CHONGQING', cnckg: 'CHONGQING',
    fuzhou: 'FUZHOU', cnfoc: 'FUZHOU',
    shenzhen: 'SHENZHEN', cnszx: 'SHENZHEN',
    xingang: 'XINGANG', tianjin: 'XINGANG',
    shekou: 'SHEKOU', guangzhou: 'GUANGZHOU',
    miami: 'MIAMI', usmia: 'MIAMI',
    shanghai: 'SHANGHAI', cnsha: 'SHANGHAI',
  }
  for (const [alias, code] of Object.entries(aliases)) {
    if (origin.includes(alias)) return code
  }
  // Internal Config item codes are not UN/LOCODEs; the consolidation's
  // physical POL is a safer fallback than passing POL-2026-NNN to Pricing.
  const persisted = normalizeCatalogValue(
    String(editingRate.value?.polName ?? '')
      + ' ' + String(editingRate.value?.polCode ?? ''),
  )
  for (const [alias, code] of Object.entries(aliases)) {
    if (persisted.includes(alias)) return code
  }
  // Never send Config's opaque POL-YYYY-NNN keys to the calculation API.
  // Requiring a recognizable commercial POL is safer than a wrong quote.
  throw new Error('No se pudo identificar el puerto comercial (POL) de LCL propio. Revise la ruta antes de recalcular.')
}

function screen7OwnLclQuoteLineType(name: string): CostDetailType {
  const value = normalizeCatalogValue(name)
  if (/flete internacional|flete miami|miami costa rica|ocean/.test(value)) return 'Freight'
  if (/recolecta|pickup|pick up/.test(value)) return 'OriginCharge'
  if (value.includes('custom')) return 'CustomsCharge'
  if (/seguro|insurance/.test(value)) return 'Insurance'
  if (/doc|manifest|vgm/.test(value)) return 'Documentation'
  if (value.includes('flete terrestre')) return 'InlandTransport'
  if (/cfs|whse|warehouse/.test(value)) return 'OriginCharge'
  return 'DestinationCharge'
}

function screen7OwnLclQuoteLineBasis(basis: string): ChargeBasis {
  const value = normalizeCatalogValue(basis)
  if (value.includes('cft')) return 'PerChargeableCft'
  if (value.includes('cbm')) return 'PerChargeableCbm'
  if (value.includes('document')) return 'PerDocument'
  return 'PerShipment'
}

function screen7OwnLclMatrixMarker(line: RateLine) {
  return /LCL\s*PROPIO|Fuente LCL:\s*Propio|Consolidado(Id)?:/i.test(String(line.notes ?? ''))
}

function screen7OwnLclMatrixIdentity(line: RateLine) {
  return [
    normalizeCatalogValue(line.name),
    line.section,
    line.chargeBasis,
  ].join('|')
}

async function screen7RefreshOwnLclMatrix(previous: RateLine[]) {
  const source = lclSelectedSource.value
  const selectedId = source?.kind === 'Own' ? String(source.id ?? '') : ''
  const keyId = String(lclSelectedSourceKey.value ?? '').startsWith('Own:')
    ? String(lclSelectedSourceKey.value).slice(4) : ''
  const persistedId = persistedOwnLclConsolidationId()
  const consolidationId = selectedId || keyId || persistedId
  if (!consolidationId) {
    throw new Error('La tarifa no contiene un identificador de consolidado propio. No se modificaron sus líneas.')
  }
  const destinationCode = screen7OwnLclDestinationCode()
  if (!destinationCode) {
    throw new Error('No se pudo determinar el país de destino de la matriz LCL. Se conservaron los importes.')
  }
  // The selector itself calculates directly by consolidation ID. Do not
  // prefetch the consolidation detail here: historic consolidated quotes can
  // still be priced even if the detail endpoint refuses inactive/old records.
  // Use the exact quote cargo when available; older persisted rates can be
  // missing editable dimensions, so preserve their original billable CBM.
  const storedCbm = Math.max(1, number(editingRate.value?.chargeableQuantity)
    || number(source?.requestedCbm) || number(lclRequestedCbm.value))
  // Editing older own-LCL quotes can hydrate with default 1-CBM dimensions,
  // despite a persisted 29-CBM (or larger) billable quantity. A pricing-only
  // refresh must not silently reprice them using that placeholder.
  const currentCbm = number(lclChargeableCbm.value)
  const useCurrentCargo = lclCargoLines.value.length > 0
    && (!editingRate.value || Math.abs(currentCbm - storedCbm) < 0.05)
  const cargoLines = useCurrentCargo
    ? lclCargoLines.value
    : [{
        description: 'Cotización LCL',
        units: 1,
        totalWeightKg: 0,
        lengthCm: 100,
        widthCm: 100,
        heightCm: storedCbm * 100,
      }]
  const calculation = await OwnLclConsolidationService.calculate(consolidationId, {
    destinationCode,
    incoterm: selectedIncotermCode.value || 'FOB',
    cargoLines,
    polCode: screen7OwnLclPolCode(),
    salePerCbm: null,
    sets: 1,
    hbl: 1,
    pickupCost: 0,
    pickupSale: 0,
    discount: 0,
    commercialPlan: form.miamiCommercialPlan || null,
    cargoValue: Math.max(0, number(form.cargoValue)),
    whsQty: Math.max(1, Math.trunc(number(form.miamiWhsQty))),
    includeSed: Boolean(form.miamiIncludeSed),
    sedQty: Math.max(1, Math.trunc(number(form.miamiSedQty))),
    isDangerousCargo: Boolean(form.dangerousCargo),
    isBonded: Boolean(form.miamiBonded),
  })
  if (!calculation.lines?.length) {
    throw new Error('La matriz del consolidado no devolvió cargos vigentes. Los valores anteriores se conservaron.')
  }
  const commercialMarker = form.miamiCommercialPlan
    ? ' · Plan Miami: ' + form.miamiCommercialPlan
      + ' · WHS: ' + Math.max(1, Math.trunc(number(form.miamiWhsQty)))
      + ' · SED: ' + (form.miamiIncludeSed ? Math.max(1, Math.trunc(number(form.miamiSedQty))) : 0)
      + ' · Bonded: ' + (form.miamiBonded ? 'Sí' : 'No')
    : ''
  const marker = 'LCL PROPIO · ConsolidadoId: ' + calculation.consolidationId
    + ' · Consolidado: #' + calculation.consolidationNumber + commercialMarker
  const currency = selectedCurrency.value ?? catalogs.currencies[0]
  if (!currency) throw new Error('No está disponible la divisa de la cotización LCL.')
  const existingMatrix = previous.filter(screen7OwnLclMatrixMarker)
  const used = new Set<number>()
  const fresh: RateLine[] = calculation.lines.map((item, index) => {
    const type = screen7OwnLclQuoteLineType(item.name)
    const normalized = normalizeCatalogValue(item.name)
    const isPickup = /recolecta|pickup|pick up/.test(normalized)
    const sourceBasis = normalizeCatalogValue(item.chargeBasis)
    const volumeBased = sourceBasis.includes('cbm') || sourceBasis.includes('cft')
    const quantity = Math.max(0, number(item.quantity))
    const collapseFixed = !volumeBased && quantity > 1
    const basis = normalized === 'cfs' ? 'PerCbm' : screen7OwnLclQuoteLineBasis(item.chargeBasis)
    const section: RateSection = isPickup ? 'pickup_origin'
      : sectionForDetail(type, item.name)
    const line: RateLine = {
      key: 'own-lcl:' + consolidationId + ':' + index,
      section,
      name: item.name,
      costDetailType: type,
      costType: isPickup ? 'Variable' : 'Fixed',
      chargeBasis: basis,
      costId: null,
      contextLabel: 'Consolidado ' + calculation.consolidationNumber
        + ' · ' + calculation.matrixVersion,
      notes: volumeBased ? marker
        : marker + ' · Base: ' + item.chargeBasis
          + '; cantidad aplicada: ' + (quantity || 1) + '.',
      currencyId: source?.currencyId || currency.id,
      currencyName: source?.currencyName || displayValue(currency),
      currencyCode: source?.currencyCode || currency.code,
      amountCurrencyCode: source?.currencyCode || currency.code,
      costAmount: collapseFixed ? number(item.costTotal) : number(item.costUnit),
      saleAmount: collapseFixed ? number(item.saleTotal) : number(item.saleUnit),
      included: true,
      optional: false,
      manual: false,
      applyDestinationTax: false,
      destinationTaxRate: 0,
    }
    const identity = screen7OwnLclMatrixIdentity(line)
    const oldIndex = existingMatrix.findIndex((candidate, candidateIndex) =>
      !used.has(candidateIndex) && screen7OwnLclMatrixIdentity(candidate) === identity)
    if (oldIndex >= 0) {
      used.add(oldIndex)
      const old = existingMatrix[oldIndex]
      line.detailId = old.detailId
      line.billToClient = old.billToClient
      line.applyDestinationTax = old.applyDestinationTax
      line.destinationTaxRate = old.destinationTaxRate
      line.included = old.included
    }
    return line
  })
  // Matrix items are replaced in full. Preserve ad-hoc/historical details
  // without a consolidation marker and prevent duplicate generated insurance.
  const supplemental = previous.filter((line) => {
    if (screen7OwnLclMatrixMarker(line)) return false
    if (line.key === 'cargo-insurance:auto') {
      return !fresh.some((item) => item.costDetailType === 'Insurance')
    }
    return true
  })
  return { fresh, next: [...fresh, ...supplemental], calculation }
}

async function applyScreen7DatabaseCosts() {
  if (screen7RefreshBusy.value || props.viewOnly) return
  const previous = rateLines.value.map((line) => ({ ...line }))
  const previousCosts = costs.value
  const previousLineContext = pricingDraftLastLineContext
  const previousOwnLclRefreshContext = screen7OwnLclRefreshContext.value
  const previousSource = lclSelectedSource.value
  const previousFreightCost = form.freightCost
  const previousFreightSale = form.freightSale
  const requestedContext = pricingDraftLineContextKey()
  screen7RefreshBusy.value = true
  screen7RefreshAllowed.value = true
  try {
    if (!selectedCurrency.value && catalogs.currencies.length === 0) {
      throw new Error('No se cargó la moneda de la cotización. Recargue los catálogos antes de actualizar.')
    }

    if (isOwnLclMatrixContext()) {
      // LCL propio uses its consolidated route matrix, never the generic
      // Pricing Costs catalog or the historical persisted detail snapshot.
      const { fresh, next, calculation } = await screen7RefreshOwnLclMatrix(previous)
      if (requestedContext !== pricingDraftLineContextKey()) {
        throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
      }
      screen7OwnLclRefreshContext.value = requestedContext
      rateLines.value = next
      costs.value = []
      if (lclSelectedSource.value?.kind === 'Own') {
        lclSelectedSource.value = {
          ...lclSelectedSource.value,
          lines: fresh,
          totalCost: calculation.totalCost,
          totalSale: calculation.finalSale,
          profitAmount: calculation.profitAmount,
          profitPerCbm: calculation.profitPerCbm,
          profitPercentage: calculation.profitPercentage,
          meetsMinimumMargin: calculation.meetsMinimumMargin,
          matrixVersion: calculation.matrixVersion,
        }
      }
      const freight = fresh.find((line) => line.costDetailType === 'Freight')
      if (freight) {
        form.freightCost = freight.costAmount
        form.freightSale = freight.saleAmount
      }
      pricingDraftLastLineContext = requestedContext
      screen7RefreshPromptOpen.value = false
      savePricingDraftNow()
      toastStore.success(
        'Matriz LCL propia actualizada',
        'Se cargaron los ' + fresh.length + ' rubros vigentes del consolidado; '
          + (next.length - fresh.length) + ' líneas independientes se conservaron. Revise antes de guardar.',
      )
      return
    }
    await loadApplicableCosts()
    if (requestedContext !== pricingDraftLineContextKey()) {
      throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
    }

    const isColoader = isLclColoaderAgentCostContext()
    if (!isColoader) {
      const optionalCosts = await loadAllApplicableOptionalCosts()
      const merged = new Map(costs.value.map((cost) => [cost.id, cost]))
      const contextKey = currentCostContextKey()
      optionalCosts.forEach((cost) => {
        merged.set(cost.id, { ...cost, __dholePricingContextKey: contextKey })
      })
      costs.value = [...merged.values()]
    }
    if (requestedContext !== pricingDraftLineContextKey()) {
      throw new Error('La ruta o el proveedor cambió durante la consulta. Intente actualizar nuevamente.')
    }

    // A saved quote may reference a CostId not returned by the contextual
    // endpoint due to historical first-port or agent associations. Read the
    // active catalog for those exact IDs, never a cross-route name guess.
    const catalogById = new Map(costs.value.map((cost) => [cost.id, cost]))
    const missingCostIds = new Set(
      previous.map((line) => line.costId).filter((id): id is string =>
        Boolean(id) && !catalogById.has(id!)),
    )
    if (missingCostIds.size) {
      const activeCatalog = await PricingService.selectCosts({ isActive: true })
      activeCatalog.forEach((cost) => {
        if (missingCostIds.has(cost.id) && cost.isActive !== false) {
          catalogById.set(cost.id, cost)
        }
      })
    }
    // An all-manual or historical quotation can legitimately have no matching
    // active master costs. The safe result is to keep it intact and tell the
    // user no amounts could be refreshed, never make the quote uneditable.

    // Do NOT empty rateLines before rebuilding. LCL coloaders, manual freights
    // and saved quote snapshots depend on the previous source rows. Instead
    // disable the normal draft-price-preservation wrapper for this one
    // explicitly confirmed refresh.
    pricingDraftLastLineContext = '__explicit_catalog_refresh__'
    rebuildRateLines()
    const generated = rateLines.value.map((line) => ({ ...line }))
    const previousByKey = new Map(previous.map((line) => [screen7CostLineKey(line), line]))
    const next: RateLine[] = []
    const seenKeys = new Set<string>()
    let refreshed = 0
    let retained = 0

    const insert = (line: RateLine) => {
      const key = screen7CostLineKey(line)
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      next.push(line)
    }

    // The rebuild may contain provider-specific lines, manual charges and
    // catalog costs. Update every CostId from the latest DB snapshot even if
    // a source-specific rebuilder kept the old amounts.
    for (const line of generated) {
      if (line.costDetailType === 'Freight' && !hasInternationalTransportService.value) continue
      const original = previousByKey.get(screen7CostLineKey(line))
      const configured = line.costId ? catalogById.get(line.costId) : undefined
      const refreshedLine = configured ? screen7CatalogRateLine(configured, original ?? line) : null
      if (refreshedLine) {
        insert(refreshedLine)
        refreshed += 1
      } else {
        if (original?.detailId && !line.detailId) line.detailId = original.detailId
        insert(line)
      }
    }

    // Reconcile all original persisted details. A no-freight quote can have
    // zero rebuilt lines but still has legitimate destination/customs charges.
    // Do not mistake an empty builder output for permission to delete them.
    for (const original of previous) {
      if (original.costDetailType === 'Freight' && !hasInternationalTransportService.value) continue
      const key = screen7CostLineKey(original)
      if (seenKeys.has(key)) continue
      const configured = original.costId ? catalogById.get(original.costId) : undefined
      const refreshedLine = configured ? screen7CatalogRateLine(configured, original) : null
      if (refreshedLine) {
        insert(refreshedLine)
        refreshed += 1
      } else {
        // Manual items and historical unmatched CostIds retain their exact
        // detail IDs and amounts until a human explicitly edits/removes them.
        insert({ ...original })
        retained += 1
      }
    }

    // The contextual Pricing response is authoritative for ADDING newly
    // applicable charges. Some legacy wizard rebuild branches produce none,
    // so materialize those items directly without an unrelated freight row.
    for (const cost of costs.value) {
      if (cost.isActive === false || cost.costDetailType === 'Freight') continue
      if (!visibleSections.value.includes(sectionForCost(cost))
          && !previous.some((line) => line.costId === cost.id)) continue
      if (seenKeys.has('cost:' + cost.id)) continue
      const existingLogical = next.some((line) =>
        normalizeCatalogValue(line.name) === normalizeCatalogValue(cost.name)
        && line.costDetailType === cost.costDetailType
        && line.section === sectionForCost(cost))
      if (existingLogical) continue
      const newLine = screen7CatalogRateLine(cost)
      if (newLine) {
        insert(newLine)
        refreshed += 1
      }
    }

    if (!next.length && previous.length) {
      throw new Error('No se recibieron líneas ni costos para esta cotización. Se conservaron los valores anteriores.')
    }
    rateLines.value = next
    pricingDraftLastLineContext = pricingDraftLineContextKey()
    screen7RefreshPromptOpen.value = false
    savePricingDraftNow()
    if (refreshed === 0) {
      toastStore.warning(
        'No hay nuevos costos aplicables',
        'Pricing no devolvió importes actualizables para esta ruta. Las ' + retained + ' líneas anteriores se conservaron sin cambios.',
      )
    } else {
      toastStore.success(
        'Líneas actualizadas',
        'Se aplicaron ' + refreshed + ' costos vigentes; ' + retained + ' líneas sin equivalencia en el catálogo se conservaron. Revise los importes antes de guardar.',
      )
    }
  } catch (error) {
    rateLines.value = previous
    costs.value = previousCosts
    pricingDraftLastLineContext = previousLineContext
    screen7OwnLclRefreshContext.value = previousOwnLclRefreshContext
    lclSelectedSource.value = previousSource
    form.freightCost = previousFreightCost
    form.freightSale = previousFreightSale
    screen7RefreshPromptOpen.value = true
    if (isOwnLclMatrixContext()) {
      // Surface an actionable route-matrix error instead of the backend's
      // ambiguous "An unexpected error occurred" toast. The HTTP status,
      // public error code and trace are safe to report and make it possible
      // to diagnose Pricing without losing persisted tariff details.
      const failure = error as {
        status?: number
        code?: string
        endpoint?: string
        message?: string
        data?: { code?: string; detail?: string; message?: string; traceId?: string; correlationId?: string }
      }
      const status = failure?.status ? 'HTTP ' + failure.status : 'Error de cálculo'
      const code = failure?.code || failure?.data?.code
      const trace = failure?.data?.traceId || failure?.data?.correlationId
      const detail = String(failure?.data?.detail || failure?.data?.message || failure?.message || '').trim()
      const generic = /^(an unexpected error occurred\.?|internal server error\.?|error interno del servidor\.?)$/i.test(detail)
      const reason = detail && !generic ? detail : 'Pricing no pudo calcular la matriz del consolidado.'
      const message = status + (code ? ' · ' + code : '')
        + ': ' + reason
        + (trace ? ' · Seguimiento: ' + trace : '')
        + ' Se conservaron todas las líneas e importes anteriores.'
      console.error('[Pricing][LCL propio][Pantalla 7] Falló la actualización de matriz', {
        status: failure?.status,
        code,
        endpoint: failure?.endpoint,
        traceId: trace,
      }, error)
      toastStore.error('No se pudieron actualizar los cargos LCL propios', message)
    } else {
      toastStore.backendError(error, 'No se actualizaron las líneas. Todos los valores anteriores se conservaron.')
    }
  } finally {
    screen7RefreshAllowed.value = false
    screen7RefreshBusy.value = false
  }
}

// Only prompt while editing/reloading a saved quotation. New quotations
// load their applicable database costs without interrupting the wizard.
watch(
  () => [step.value, pricingDraftReady.value] as const,
  ([currentStep, ready]) => {
    if (currentStep !== 7) {
      screen7RefreshPromptOpen.value = false
      return
    }
    if (screen7RequiresConfirmation.value && ready && rateLines.value.length) {
      screen7RefreshPromptOpen.value = true
    }
  },
  { immediate: true, flush: 'post' },
)
`
  // After an explicit recalculation, unrelated source watchers must not
  // restore the saved matrix snapshot and discard the newly fetched rows.
  if (code.includes('function restoreOwnLclMatrixLines() {')) {
    code = replaceOnce(
      code,
      'function restoreOwnLclMatrixLines() {',
      'function restoreOwnLclMatrixLines() {\n  if (screen7OwnLclRefreshContext.value === pricingDraftLineContextKey()) return',
      'explicit own LCL refresh persistence',
    )
  }

  code = replaceOnce(code, scriptEnd, '\n' + script + scriptEnd, 'script insertion')

  // The benchmark panel may refresh its own data. It must never rehydrate the
  // entire rate and overwrite unsaved price edits as a side effect.
  code = code.replace('@refreshed="hydrateExistingRate"', '@refreshed="screen7RefreshPromptOpen = screen7RequiresConfirmation"')

  const stageAnchor = '<div v-else-if="step === 7" class="crystal-lines-stage space-y-6">'
  const prompt = String.raw`
          <div v-if="screen7RequiresConfirmation && screen7RefreshPromptOpen && rateLines.length"
            role="group" aria-label="Confirmar actualización de líneas"
            class="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 md:p-5">
            <h3 class="text-sm font-black text-[var(--dh-text)]">¿Desea mantener los valores actuales o actualizar la tarifa?</h3>
            <p class="mt-2 text-xs font-semibold text-[var(--dh-text-muted)]">
              Mantener conserva los montos y las líneas que ya tiene, incluidas las modificaciones manuales.
              Actualizar consulta los costos y cargos opcionales vigentes para la ruta y el proveedor,
              reemplaza sus importes y puede añadir o quitar líneas automáticas. Los rubros manuales
              se conservan. No guarda la tarifa hasta que usted lo confirme.
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <DhButton type="button" variant="secondary" size="sm" :disabled="screen7RefreshBusy"
                @click="keepScreen7CurrentLines">Mantener valores actuales</DhButton>
              <DhButton type="button" size="sm" :loading="screen7RefreshBusy" :disabled="screen7RefreshBusy"
                @click="applyScreen7DatabaseCosts">Actualizar desde la base de datos</DhButton>
            </div>
          </div>
`
  code = replaceOnce(code, stageAnchor, stageAnchor + '\n' + prompt, 'screen 7 confirmation')
  return code
}

export function pricingWizardScreen7CostChoice(): Plugin {
  return {
    name: 'dhole-pricing-screen7-cost-choice',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalizedId = id.replaceAll('\\', '/').split('?')[0]
      if (!normalizedId.endsWith(WIZARD_PATH)) return null
      return { code: patchWizard(source), map: null }
    },
  }
}
