import type { Plugin } from 'vite'

const WIZARD_PATH = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARKER = '// dhole-ftl-edit-preservation-final-20261028'

function replaceOne(source: string, before: string, after: string, label: string): string {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error('[pricingFtlEditPreservationFinal] ' + label + ': expected 1 anchor, got ' + count)
  return source.replace(before, after)
}

export function patchPricingFtlEditPreservationFinal(source: string): string {
  if (source.includes(MARKER)) return source
  let code = source

  // Agents are filtered by country. Keep the saved agent selectable on an edit
  // even when legacy metadata is incomplete or the user changed POE.
  const agentAnchor = 'const eligibleAgents = computed(() => catalogs.agents.filter(agentMatchesSelectedPol))'
  code = replaceOne(code, agentAnchor, String.raw`
const persistedFtlAgentForEdit = computed(() => {
  const rate = editingRate.value
  if (!props.rateId || !rate || props.viewOnly || shipmentModeForApi.value !== 'Ftl') return null
  const id = String(rate.agentId ?? '')
  const byId = catalogs.agents.find((agent) => agent.id === id)
  if (byId) return byId
  const savedCode = normalizeCatalogValue(rate.agentCode ?? '')
  const byCode = savedCode ? catalogs.agents.find((agent) =>
    normalizeCatalogValue(agent.code) === savedCode) : null
  if (byCode) return byCode
  const name = normalizeCatalogValue(rate.agentName ?? '')
  return name ? (catalogs.agents.find((agent) =>
    normalizeCatalogValue(displayValue(agent)) === name) ?? null) : null
})
const eligibleAgents = computed(() => catalogs.agents.filter((agent) =>
  agentMatchesSelectedPol(agent) || (
    Boolean(props.rateId) && !props.viewOnly && shipmentModeForApi.value === 'Ftl'
    && agent.id === persistedFtlAgentForEdit.value?.id
  ),
))
watch(step, (currentStep) => {
  if (currentStep !== 6 || !persistedFtlAgentForEdit.value || form.agentId) return
  form.agentId = persistedFtlAgentForEdit.value.id
}, { flush: 'sync' })
`.trim(), 'persisted FTL agent options')

  // The catalog code can be CUR-2026-001; display Config.Value (USD/CRC).
  const oldCurrencyLabel = "persistedFtlFreightForEdit.currencyCode || selectedCurrency?.code || 'USD'"
  const newCurrencyLabel = "displayValue(findById(catalogs.currencies, persistedFtlFreightForEdit.currencyId)) || displayValue(selectedCurrency) || persistedFtlFreightForEdit.currencyName || 'USD'"
  if (code.split(oldCurrencyLabel).length - 1 !== 2) {
    throw new Error('[pricingFtlEditPreservationFinal] FTL historical currency labels changed.')
  }
  code = code.split(oldCurrencyLabel).join(newCurrencyLabel)

  // Step 6 -> 7 must never call the generic rate-line rebuild for a saved FTL.
  // The existing RateDetails (and their stable DetailId) remain authoritative.
  // Other pricing plugins replace next() in full, including the modification
  // request shortcut. Locate the actual step-6 branch instead of a brittle
  // unrelated modificationRequestId string.
  const nextStart = code.indexOf('async function next() {')
  const nextEnd = code.indexOf('function previous() {', nextStart)
  if (nextStart < 0 || nextEnd <= nextStart) {
    throw new Error('[pricingFtlEditPreservationFinal] navigation bounds not found.')
  }
  const originalNext = code.slice(nextStart, nextEnd)
  const existingStepSixBranch = '  if (step.value === 6) {'
  if (!originalNext.includes(existingStepSixBranch)) {
    throw new Error('[pricingFtlEditPreservationFinal] step 6 branch not found after navigation transforms.')
  }
  const preserveStepSix = String.raw`  if (step.value === 6 && props.rateId && editingRate.value
      && !props.viewOnly && shipmentModeForApi.value === 'Ftl') {
    if (!canNext.value) {
      toastStore.warning('Flete incompleto', 'Revise los datos del flete FTL antes de continuar.')
      return
    }
    // Keep every persisted RateDetail and any edits made to existing lines.
    syncPersistedFreightLineForEdit()
    step.value = 7
    return
  }

`
  code = code.slice(0, nextStart)
    + originalNext.replace(existingStepSixBranch, preserveStepSix + existingStepSixBranch)
    + code.slice(nextEnd)

  // Earlier compatibility plugins could eagerly append catalog rows and
  // overwrite RateDetails while hydrating a saved quote. For FTL, opening Edit
  // must reproduce the persisted snapshot exactly until an explicit add-only refresh.
  const eagerHydrate = '    if (!props.viewOnly) {\n      // RateDetails persistidos siguen siendo autoritativos para montos. A la vez,'
  code = replaceOne(
    code,
    eagerHydrate,
    '    if (!props.viewOnly && shipmentModeForApi.value !== \'Ftl\') {\n      // RateDetails persistidos siguen siendo autoritativos para montos. A la vez,',
    'do not mutate FTL details while hydrating',
  )
  const eagerCrc = "    if (!props.viewOnly) {\n      const serviceCurrency = selectedCurrency.value ?? catalogs.currencies[0]"
  if (code.includes(eagerCrc)) {
    code = code.replace(
      eagerCrc,
      "    if (!props.viewOnly && shipmentModeForApi.value !== 'Ftl') {\n      const serviceCurrency = selectedCurrency.value ?? catalogs.currencies[0]",
    )
  }

  // The update payload must use the line collection currently displayed.
  // Re-running loadApplicableCosts/rebuildRateLines here would overwrite edits
  // even when the user explicitly chose to keep existing values.
  const saveAnchor = '  if (editingRate.value && !props.viewOnly) {\n    await loadApplicableCosts()'
  code = replaceOne(
    code,
    saveAnchor,
    "  if (editingRate.value && !props.viewOnly && shipmentModeForApi.value !== 'Ftl') {\n    await loadApplicableCosts()",
    'prevent pre-save FTL rebuild',
  )
  const detailsAnchor = '  const details: CreateRateDetailRequest[] = '
  const start = code.indexOf('async function saveRate() {')
  const detailsIndex = code.indexOf(detailsAnchor, start)
  if (start < 0 || detailsIndex < start) throw new Error('[pricingFtlEditPreservationFinal] saveRate details anchor missing.')
  code = code.slice(0, detailsIndex)
    + "  if (editingRate.value && !props.viewOnly && shipmentModeForApi.value === 'Ftl') {\n    relinkExistingDetailIdsForEdit()\n  }\n\n"
    + code.slice(detailsIndex)

  // The refresh action means ADD missing charges only for a saved FTL. Never
  // replace, drop, or reset any persisted/manual line, amount or association.
  const refreshAnchor = 'async function applyScreen7DatabaseCosts() {'
  code = replaceOne(code, refreshAnchor, refreshAnchor + String.raw`
  if (props.rateId && editingRate.value && shipmentModeForApi.value === 'Ftl') {
    if (screen7RefreshBusy.value || props.viewOnly) return
    const previous = rateLines.value.map((line) => ({ ...line }))
    const previousCosts = costs.value
    const context = pricingDraftLineContextKey()
    screen7RefreshBusy.value = true
    try {
      await loadApplicableCosts()
      const optional = await loadAllApplicableOptionalCosts()
      if (context !== pricingDraftLineContextKey()) {
        throw new Error('La ruta, el agente o el equipo cambió durante la actualización.')
      }
      const merged = new Map(costs.value.map((cost) => [cost.id, cost]))
      const contextKey = currentCostContextKey()
      optional.forEach((cost) => merged.set(cost.id, {
        ...cost, __dholePricingContextKey: contextKey,
      }))
      const existingCostIds = new Set(previous.map((line) => line.costId).filter(Boolean))
      // Do not silently restore rows that were deliberately removed in this edit.
      const originalCostIds = new Set(
        (editingRate.value.rateDetails ?? []).map((line) => line.costId).filter(Boolean),
      )
      const additions: RateLine[] = []
      for (const cost of merged.values()) {
        if (cost.isActive === false || cost.costDetailType === 'Freight') continue
        if (!screen7CostMatchesSelectedProviders(cost) || !applicableCost(cost)) continue
        if (!visibleSections.value.includes(sectionForCost(cost))) continue
        if (existingCostIds.has(cost.id) || originalCostIds.has(cost.id)) continue
        if (previous.some((line) =>
          !line.costId
          && normalizeCatalogValue(line.name) === normalizeCatalogValue(cost.name)
          && line.costDetailType === cost.costDetailType
          && line.section === sectionForCost(cost))) continue
        const line = screen7CatalogRateLine(cost)
        if (!line) continue
        additions.push(line)
        existingCostIds.add(cost.id)
      }
      rateLines.value = [...previous, ...additions]
      pricingDraftLastLineContext = context
      screen7RefreshPromptOpen.value = false
      if (additions.length) {
        toastStore.success('Cargos faltantes agregados',
          'Se agregaron ' + additions.length + ' rubros nuevos. Las ' + previous.length
          + ' líneas existentes conservaron costo, venta, moneda y cliente.')
      } else {
        toastStore.info('Sin cargos nuevos',
          'No hay rubros faltantes para el contexto seleccionado. Todas las líneas anteriores se conservaron.')
      }
    } catch (error) {
      rateLines.value = previous
      costs.value = previousCosts
      toastStore.backendError(error, 'No se añadieron cargos. Se conservaron todas las líneas y valores existentes.')
    } finally {
      screen7RefreshBusy.value = false
    }
    return
  }
`, 'add-only FTL database refresh')

  // Clarify the meaning of the existing confirmation button for saved FTLs.
  code = code.replace(
    'Actualizar desde la base de datos</DhButton>',
    "{{ shipmentModeForApi === 'Ftl' && props.rateId ? 'Agregar solo cargos faltantes' : 'Actualizar desde la base de datos' }}</DhButton>",
  )
  const refreshDescription = 'Actualizar consulta los costos y cargos opcionales vigentes para la ruta y el proveedor,'
  code = code.replace(
    refreshDescription,
    "{{ shipmentModeForApi === 'Ftl' && props.rateId ? 'Agregar consulta los costos vigentes y agrega únicamente rubros que no estén en la cotización.' : 'Actualizar consulta los costos y cargos opcionales vigentes para la ruta y el proveedor,' }}",
  )
  code = code.replace(
    'reemplaza sus importes y puede añadir o quitar líneas automáticas. Los rubros manuales',
    "{{ shipmentModeForApi === 'Ftl' && props.rateId ? 'No reemplaza costos, ventas, monedas, clientes ni elimina líneas existentes.' : 'reemplaza sus importes y puede añadir o quitar líneas automáticas. Los rubros manuales' }}",
  )
  code = code.replace(
    'se conservan. No guarda la tarifa hasta que usted lo confirme.',
    "{{ shipmentModeForApi === 'Ftl' && props.rateId ? 'Los valores anteriores permanecen intactos. La tarifa solo se guarda al confirmar.' : 'se conservan. No guarda la tarifa hasta que usted lo confirme.' }}",
  )

  return code.replace('</script>', MARKER + '\n</script>')
}

export function pricingFtlEditPreservationFinal(): Plugin {
  return {
    name: 'dhole-pricing-ftl-edit-preservation-final',
    enforce: 'pre',
    transform(source, id) {
      if (id.includes('?')) return null
      const normalized = id.replaceAll('\\', '/').split('?')[0]
      if (!normalized.endsWith(WIZARD_PATH)) return null
      return { code: patchPricingFtlEditPreservationFinal(source), map: null }
    },
  }
}
