import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export const pricingQuotationEditDelta387Runtime = String.raw`
interface QuoteEditContext387 {
  modality: string; shipmentMode: string; originId: string; destinationId: string
  podId: string; agentId: string; carrierId: string; incotermId: string
  equipmentId: string; importRateId: string; services: string[]
  merchant: boolean; carrier: boolean; dangerous: boolean; overweight: boolean
  nonStackable: boolean; storageDays: number; cargoValue: number; portHandlingMode: string; cargoWeightKg: number
}
const quoteEditOriginalContext387 = ref<QuoteEditContext387 | null>(null)
const quoteEditAutoRemovedIds387 = new Set<string>()
let quoteEditRequest387 = 0
let quoteEditPending387: { signature: string; promise: Promise<boolean> } | null = null

function quoteEditContext387(): QuoteEditContext387 {
  return {
    modality: String(form.modality), shipmentMode: String(shipmentModeForApi.value),
    originId: form.originId, destinationId: form.destinationId,
    podId: form.podId, agentId: form.agentId, carrierId: form.carrierId,
    incotermId: form.incotermId, equipmentId: form.equipmentId,
    importRateId: form.selectedImportRateId,
    services: [...new Set(form.serviceIds)].sort(),
    merchant: Boolean(form.merchantHaulage), carrier: Boolean(form.carrierHaulage),
    dangerous: Boolean(form.dangerousCargo), overweight: Boolean(form.overweight),
    nonStackable: Boolean(form.nonStackable), storageDays: number(form.storageDays),
    cargoValue: number(form.cargoValue), portHandlingMode: String(form.portHandlingMode ?? ''),
    cargoWeightKg: number(form.cargoWeightKg),
  }
}
function quoteEditAddedServices387() {
  const original = new Set(quoteEditOriginalContext387.value?.services ?? [])
  return new Set(form.serviceIds.filter(id => !original.has(id)))
}
function quoteEditChangedKeys387() {
  const original = quoteEditOriginalContext387.value
  if (!original) return new Set<string>()
  const current = quoteEditContext387()
  const changed = new Set<string>()
  for (const key of Object.keys(current) as Array<keyof QuoteEditContext387>) {
    if (JSON.stringify(original[key]) !== JSON.stringify(current[key])) changed.add(key)
  }
  return changed
}
function quoteEditTransportChanged387() {
  const changed = quoteEditChangedKeys387()
  return ['modality', 'shipmentMode', 'originId', 'destinationId', 'podId',
    'agentId', 'carrierId', 'equipmentId', 'importRateId'].some(key => changed.has(key))
}
// Saved manual Inland rows are real RateDetails, not optional catalog entries.
function quoteEditPersistedInlandMode(line: { name: string }) {
  const name = normalizeCatalogValue(line.name)
  if (name.includes('merchant haulage') || (name.includes('inland') && name.includes('merchant'))) return 'merchant'
  if (name.includes('carrier haulage') || (name.includes('inland') && (name.includes('naviera') || name.includes('carrier')))) return 'carrier'
  return null
}
function quoteEditKeepPersistedInland(line: { name: string; detailId?: string | null }) {
  if (!props.rateId || !line.detailId || !quoteEditOriginalContext387.value
      || quoteEditTransportChanged387()
      || explicitlyRemovedPersistedDetailIds.value.has(line.detailId)) return false
  const mode = quoteEditPersistedInlandMode(line)
  return mode === 'merchant' ? Boolean(form.merchantHaulage)
    : mode === 'carrier' ? Boolean(form.carrierHaulage) : false
}
function quoteEditRestorePersistedInland() {
  const rate = editingRate.value
  if (!rate) return
  for (const detail of rate.rateDetails) {
    if (!quoteEditKeepPersistedInland({ name: detail.name, detailId: detail.id })) continue
    const existing = rateLines.value.find(line => line.detailId === detail.id)
    if (existing) {
      if (!existing.included) existing.included = true
    } else {
      rateLines.value.push(persistedRateLineForEdit(detail))
    }
  }
}

// Unchanged revisions must not lose required historical rows when a watcher
// rebuilds them. Only relink a unique, exact, generated equivalent; never
// guess between homonyms, distinct suppliers, equipment or manual charges.
function quoteEditRestoreUnchangedRequiredDetails() {
  const rate = editingRate.value
  if (!rate || quoteEditChangedKeys387().size) return
  const removed = explicitlyRemovedPersistedDetailIds.value
  for (const detail of rate.rateDetails) {
    if (!detail.id || removed.has(detail.id) || detail.costType === 'Optional') continue
    const name = normalizeCatalogValue(detail.name)
    // Panama road and excess have their own route/provenance-aware reconciliation.
    if ((typeof isPanamaHistoricalRoad === 'function' && isPanamaHistoricalRoad(detail))
        || /sobrepeso|overweight|excedente/.test(name)) continue
    const existing = rateLines.value.find(line => line.detailId === detail.id)
    if (existing) {
      if (!existing.included && !existing.optional) existing.included = true
      continue
    }
    const sameIdentity = (line: { name: string; costId?: string | null; costDetailType?: string | null; chargeBasis?: string | null }) =>
      (line.costId ?? null) === (detail.costId ?? null)
      && (Boolean(detail.costId) || normalizeCatalogValue(line.name) === name)
      && line.costDetailType === detail.costDetailType
      && line.chargeBasis === detail.chargeBasis
    const aliases = rateLines.value.filter(line => !line.detailId && sameIdentity(line))
    const originals = rate.rateDetails.filter(sameIdentity)
    if (aliases.length || originals.length > 1) {
      if (aliases.length !== 1 || originals.length !== 1 || aliases[0]!.manual) continue
      const alias = aliases[0]!
      // Restore the original authoritative identity and negotiated amounts;
      // a generated alias is not a persisted operator edit.
      rateLines.value = rateLines.value.map(line =>
        line === alias ? persistedRateLineForEdit(detail) : line)
    } else {
      // Avoid inventing a second charge when a different catalog or manual
      // row with the same label could already represent this detail.
      const independentRoad = /^(flete (?:terrestre internacional|internacional terrestre)|land freight)(?: |$)/.test(name)
      if (rateLines.value.some(line => !line.detailId && (normalizeCatalogValue(line.name) === name
          || Boolean(detail.costId && line.costId === detail.costId)
          || (independentRoad && /^(flete (?:terrestre internacional|internacional terrestre)|land freight)(?: |$)/.test(normalizeCatalogValue(line.name)))))) continue
      rateLines.value.push(persistedRateLineForEdit(detail))
    }
  }
}

function quoteEditRequestedCosts387(): CostSelectDto[] {
  if (!editingRate.value || props.viewOnly || !quoteEditOriginalContext387.value) return []
  const changed = quoteEditChangedKeys387()
  if (!changed.size) return []
  const added = quoteEditAddedServices387()
  const original = quoteEditOriginalContext387.value
  const relatedToChangedContext = (cost: CostSelectDto) =>
    (changed.has('carrierId') && (Boolean(cost.carrierId) || Boolean(cost.carriers?.length)))
    || (changed.has('agentId') && (Boolean(cost.agentId) || Boolean(cost.agents?.length)))
    || (changed.has('originId') && (Boolean(cost.polId) || Boolean(cost.pols?.length)))
    || (changed.has('destinationId') && (Boolean(cost.poeId) || Boolean(cost.poes?.length)))
    || (changed.has('podId') && (Boolean(cost.podId) || Boolean(cost.pods?.length)))
    || (changed.has('incotermId') && Boolean(cost.incoterms?.length))
    || (changed.has('shipmentMode') && Boolean(cost.shipmentMode))
    || (changed.has('equipmentId') && cost.chargeBasis === 'PerContainer')
    || (changed.has('modality') && Boolean(cost.shipmentMode))
    || ((changed.has('merchant') || changed.has('carrier')) &&
      /inland|haulage|muellaje|redestino|anticipado/i.test(cost.name))
    || ((changed.has('overweight') || changed.has('dangerous')) &&
      /sobrepeso|overweight|imo|peligros/i.test(cost.name))
  return applicableConfiguredCosts().filter(cost => {
    if (cost.isActive === false) return false
    const name = normalizeCatalogValue(cost.name)
    const contextChanged = quoteEditTransportChanged387()
      || changed.has('merchant') || changed.has('carrier')
    // Land Freight is an independent CostId. Do not touch ocean/equipment Freight.
    if (cost.costDetailType === 'Freight') {
      return contextChanged && /terrestre|land freight/.test(name)
    }
    // Optional inland is a user-driven Merchant/Carrier selection, not a
    // general permission to append every optional charge on the route.
    const selectedHaulage = form.merchantHaulage ? 'merchant'
      : form.carrierHaulage ? 'carrier' : null
    const newlySelectedPortHandling = changed.has('portHandlingMode')
      && Boolean(form.portHandlingMode)
      && name.includes(normalizeCatalogValue(form.portHandlingMode))
      && !(name.includes('redestino') && name.includes('anticipado'))
    if (newlySelectedPortHandling) return true
    // A user ticking Sobrepeso on an EXISTING quote is an explicit request.
    // Do not automatically insert unrelated optional inland/IMO charges.
    const newOverweight = changed.has('overweight') && form.overweight
      && (/^(sobrepeso|overweight)/.test(name))
      && (dholeHaulageOptionalAssociation(cost) !== 'merchant' || form.merchantHaulage)
      && (dholeHaulageOptionalAssociation(cost) !== 'carrier' || form.carrierHaulage)
    if (newOverweight) return true
    const newlySelectedInland = contextChanged && selectedHaulage
      && (cost.costDetailType === 'InlandTransport' || /inland|haulage/.test(name))
      && dholeHaulageOptionalAssociation(cost) === selectedHaulage
    if (newlySelectedInland) return true
    const associatedNewService = cost.services?.some(service => added.has(service.id)) ?? false
    const newlyRequestedInsurance = cost.costDetailType === 'Insurance'
      && [...added].some(id => catalogs.services.some(service => service.id === id
        && /seguro.*carga|carga.*seguro/.test(normalizeCatalogValue(displayValue(service)))))
    if (associatedNewService || newlyRequestedInsurance) return true
    // A context change does not authorize unrelated optional or global charges.
    if (cost.costType === 'Optional' || !relatedToChangedContext(cost)) return false
    // New context-specific costs are eligible; unchanged quote costs remain untouched.
    return JSON.stringify(original) !== JSON.stringify(quoteEditContext387())
  })
}
function quoteEditRemoveInvalidDetails387() {
  const rate = editingRate.value
  const original = quoteEditOriginalContext387.value
  if (!rate || !original) return
  const selected = new Set(form.serviceIds)
  const removed = new Set(original.services.filter(id => !selected.has(id)))
  const changed = quoteEditChangedKeys387()
  const applicable = new Set(costs.value.map(cost => cost.id))
  // Only metadata with a relationship to an explicitly modified dimension may
  // authorize removal. Unknown old CostIds, manual prices and unrelated rows stay.
  const outdated = (line: RateLine) => {
    if (!line.costId || line.manual) return false
    // A changed muellaje mode explicitly removes the opposite persisted line.
    // All unrelated saved charges and their negotiated prices remain intact.
    if (form.portHandlingMode) {
      const label = normalizeCatalogValue(line.name)
      const oldChoice = (label.includes('anticipado') && form.portHandlingMode !== 'Anticipado')
        || (label.includes('redestino') && form.portHandlingMode !== 'Redestino')
      if (oldChoice) return true
    }
    // Only the explicit removal of Sobrepeso may delete its former paid line.
    // Never delete independent inland, maritime freight or other negotiated lines.
    if (changed.has('overweight') && !form.overweight
        && (/^(sobrepeso|overweight)/.test(normalizeCatalogValue(line.name)))) return true
    const master = allCosts.value.find(cost => cost.id === line.costId)
    const services = line.serviceIds?.length ? line.serviceIds
      : master?.services?.map(service => service.id) ?? []
    if (removed.size && services.some(id => removed.has(id))
      && !services.some(id => selected.has(id))) return true
    if (!master || applicable.has(line.costId)) return false
    return (changed.has('carrierId') && (Boolean(master.carrierId) || Boolean(master.carriers?.length)))
      || (changed.has('agentId') && (Boolean(master.agentId) || Boolean(master.agents?.length)))
      || (changed.has('originId') && (Boolean(master.polId) || Boolean(master.pols?.length)))
      || (changed.has('destinationId') && (Boolean(master.poeId) || Boolean(master.poes?.length)))
      || (changed.has('podId') && (Boolean(master.podId) || Boolean(master.pods?.length)))
      || (changed.has('incotermId') && Boolean(master.incoterms?.length))
  }
  rateLines.value = rateLines.value.filter(line => {
    if (line.key.startsWith('edit-incoterm-cost:') || line.key === 'quote-edit:insurance') {
      // Unsaved additions have no RateDetailId. Removing an opposite
      // muellaje choice must precede the legacy keep-if-no-service shortcut.
      if (form.portHandlingMode && /anticipado|redestino/.test(normalizeCatalogValue(line.name))
          && outdated(line)) return false
      if (!line.serviceIds?.length) return true
      return line.serviceIds.some(id => selected.has(id))
    }
    if (!outdated(line)) return true
    if (line.detailId) {
      quoteEditAutoRemovedIds387.add(line.detailId)
      explicitlyRemovedPersistedDetailIds.value.add(line.detailId)
    }
    return false
  })
  // Restoring a selection must restore its original detailId and negotiated prices.
  for (const id of [...quoteEditAutoRemovedIds387]) {
    const detail = rate.rateDetails.find(item => item.id === id)
    if (!detail) continue
    const restored = persistedRateLineForEdit(detail)
    if (outdated(restored)) continue
    if (!rateLines.value.some(line => line.detailId === id)) rateLines.value.push(restored)
    explicitlyRemovedPersistedDetailIds.value.delete(id)
    quoteEditAutoRemovedIds387.delete(id)
  }
}
function quoteEditEnsureRequestedServices387() {
  const added = quoteEditAddedServices387()
  if (!added.size) return
  const newInsurance = [...added].some(id => catalogs.services.some(service =>
    service.id === id && /seguro.*carga|carga.*seguro/.test(
      normalizeCatalogValue(displayValue(service)))))
  if (newInsurance && !rateLines.value.some(line => line.costDetailType === 'Insurance')) {
    const currency = selectedCurrency.value ?? catalogs.currencies[0]
    if (currency) {
      const calculated = form.cargoValue > 0
        ? calculateCargoInsurance(number(form.cargoValue), number(form.freightCost)) : null
      rateLines.value.push({
        key: 'quote-edit:insurance', section: 'destination_charges', name: 'Seguro de carga',
        costDetailType: 'Insurance', costType: 'Optional', chargeBasis: 'PerShipment',
        serviceIds: [...added].filter(id => catalogs.services.some(service =>
          service.id === id && /seguro.*carga|carga.*seguro/.test(
            normalizeCatalogValue(displayValue(service))))),
        currencyId: currency.id, currencyName: displayValue(currency), currencyCode: currency.code,
        costAmount: calculated?.cost ?? 0, saleAmount: calculated?.sale ?? 0,
        included: true, optional: true, manual: false,
        contextLabel: calculated ? 'Seguro solicitado en la modificación'
          : 'Ingrese el valor de la carga o el precio del seguro solicitado',
      } as RateLine)
    }
  }
  const customs = selectedCrcCustomsService.value
  if (customs && added.has(customs.id)
      && !rateLines.value.some(line => isCrcCustomsLine(line, customs.id))) {
    const currency = selectedCurrency.value ?? catalogs.currencies[0]
    if (currency) ensureCrcCustomsLine(rateLines.value, currency)
  }
}
async function quoteEditApplyDelta387(): Promise<boolean> {
  if (!props.rateId || props.viewOnly || !editingRate.value || hydratingExistingRate.value) return true
  if (!quoteEditOriginalContext387.value) return false
  const signature = JSON.stringify(quoteEditContext387())
  if (quoteEditPending387?.signature === signature) return quoteEditPending387.promise
  const sequence = ++quoteEditRequest387
  if (!quoteEditChangedKeys387().size) {
    quoteEditRemoveInvalidDetails387()
    quoteEditRestorePersistedInland()
    quoteEditRestoreUnchangedRequiredDetails()
    return true
  }
  const promise = (async () => {
    const loaded = await loadApplicableCosts(true)
    if (!loaded || sequence !== quoteEditRequest387
        || signature !== JSON.stringify(quoteEditContext387())) return false
    quoteEditRemoveInvalidDetails387()
    quoteEditRestorePersistedInland()
    quoteEditRequestedCosts387().forEach(cost => {
      appendConfiguredCostToPersistedEdit(cost)
    })
    quoteEditEnsureRequestedServices387()
    return true
  })()
  quoteEditPending387 = { signature, promise }
  try {
    return await promise
  } finally {
    if (quoteEditPending387?.promise === promise) quoteEditPending387 = null
  }
}
watch(
  () => [step.value, form.serviceIds.join('|'), form.incotermId,
    form.carrierId, form.agentId, form.originId, form.destinationId, form.podId,
    form.modality, form.shipmentMode, form.merchantHaulage, form.carrierHaulage,
    form.overweight, form.dangerousCargo, form.equipmentId, form.portHandlingMode,
    form.cargoWeightKg] as const,
  () => {
    if (step.value !== 7 || !props.rateId || props.viewOnly || hydratingExistingRate.value) return
    void quoteEditApplyDelta387()
  },
  { flush: 'post' },
)
`

function replaceSingle(source: string, oldText: string, newText: string, label: string) {
  const n = source.split(oldText).length - 1
  if (n !== 1) throw new Error('[pricingQuotationEditDelta387] ' + label + ': expected 1, got ' + n)
  return source.replace(oldText, newText)
}

export function patchPricingQuotationEditDelta387(source: string): string {
  let s = source
  if (!s.includes('function appendConfiguredCostToPersistedEdit(cost: CostSelectDto) {')) {
    // The DH-386 endpoint-contract unit fixture has no saved-rate workflow.
    // Real wizard code MUST include the edit reconciliation anchor.
    if (!s.includes('async function hydrateExistingRate()')) return s
    throw new Error('[pricingQuotationEditDelta387] Edit reconciliation was not installed')
  }
  if (!s.includes('const explicitlyRemovedPersistedDetailIds = ref(')) {
    throw new Error('[pricingQuotationEditDelta387] Explicit deletion safeguard missing')
  }

  // No silent catalog imports into a persisted quote during hydration/navigation/save.
  const legacy = 'applicableConfiguredCosts().forEach(appendConfiguredCostToPersistedEdit)'
  const oldCount = s.split(legacy).length - 1
  if (oldCount < 3) throw new Error('[pricingQuotationEditDelta387] Expected legacy calls, got ' + oldCount)
  s = s.replaceAll(legacy, 'quoteEditRequestedCosts387().forEach(appendConfiguredCostToPersistedEdit)')

  const appendStart = s.indexOf('function appendConfiguredCostToPersistedEdit(cost: CostSelectDto) {')
  const appendEnd = s.indexOf('\nfunction addIncotermFallbackLine(', appendStart)
  if (appendStart < 0 || appendEnd < 0) throw new Error('[pricingQuotationEditDelta387] Append function boundaries')
  let append = s.slice(appendStart, appendEnd)
  append = replaceSingle(append,
    '    if (!equivalent.costId) {',
    '    if (!equivalent.costId && !props.rateId) {',
    'do not relink persisted details')
  append = replaceSingle(append,
    '    costAmount: number(cost.costAmount),\n    saleAmount: number(cost.saleAmount),',
    '    costAmount: number(resolvedConditionalCost(cost)?.costAmount ?? cost.costAmount),\n    saleAmount: number(resolvedConditionalCost(cost)?.saleAmount ?? cost.saleAmount),',
    'tier pricing')
  append = replaceSingle(append,
    '      || shouldIncludeOptionalCost(cost),',
    '      || shouldIncludeOptionalCost(cost)\n      || Boolean(cost.services?.some(service => quoteEditAddedServices387().has(service.id)))\n      || (cost.costDetailType === "Insurance" && cargoInsuranceSelected.value),',
    'newly requested service inclusion')
  s = s.slice(0, appendStart) + append + s.slice(appendEnd)

  // Existing-rate hydration calls the filtered list, which is empty until the
  // operator changes a field. Prevent implicit haulage inclusion changes as well.
  s = replaceSingle(s,
    'function syncHaulageOptionalLines() {',
    'function syncHaulageOptionalLines() {\n'
      + '  if (props.rateId && !quoteEditChangedKeys387().has("merchant")'
      + ' && !quoteEditChangedKeys387().has("carrier")'
      + ' && !quoteEditChangedKeys387().has("portHandlingMode")) return',
    'preserve persisted haulage selections')

  s = replaceSingle(s,
    '    persistedRateLineBaselines.clear()',
    '    quoteEditOriginalContext387.value = quoteEditContext387()\n'
      + '    quoteEditAutoRemovedIds387.clear()\n'
      + '    persistedRateLineBaselines.clear()',
    'original context snapshot')

  // Capture the LCL baseline AFTER source hydration and its normalized provider,
  // not before the late coloader/own-source compatibility transforms run.
  const hydrateStart = s.indexOf('async function hydrateExistingRate() {')
  if (hydrateStart >= 0) {
    const finish = '    hydratingExistingRate.value = false'
    const finishIndex = s.indexOf(finish, hydrateStart)
    if (finishIndex < 0) throw new Error('[DH-LCL-EDIT] Hydration completion anchor missing')
    s = s.slice(0, finishIndex)
      + '    if (shipmentModeForApi.value === "Lcl" && quoteEditOriginalContext387.value && editingRate.value) {\n'
      + '      quoteEditOriginalContext387.value = quoteEditContext387()\n'
      + '      quoteEditRequest387++\n'
      + '      quoteEditPending387 = null\n'
      + '    }\n'
      + s.slice(finishIndex)
  }

  const nextStart = s.indexOf('async function next() {')
  const nextEnd = s.indexOf('\nfunction previous() {', nextStart)
  if (nextStart < 0 || nextEnd < 0) throw new Error('[pricingQuotationEditDelta387] Navigation block')
  let next = s.slice(nextStart, nextEnd)
  const before = '  if (step.value === 6) {\n    try {'
  next = replaceSingle(next, before,
    '  if (step.value === 6 && props.rateId && editingRate.value) {\n'
      + '    if (!(await quoteEditApplyDelta387())) return\n'
      + '    step.value = 7\n    return\n  }\n'
      + before, 'edit navigation')
  s = s.slice(0, nextStart) + next + s.slice(nextEnd)

  // Reconcile BEFORE reading orderedCompleteRateLines. The old await after
  // normalizedIncludedLines captured stale values and misaligned RateDetail IDs.
  const snapshotAnchor = '  const normalizedIncludedLines = orderedCompleteRateLines.value.map((line) => {'
  s = replaceSingle(s, snapshotAnchor,
    '  if (props.rateId && editingRate.value && !(await quoteEditApplyDelta387())) {\n'
      + '    toastStore.warning("Costos pendientes", "No se pudieron verificar los cambios de contexto. Intente guardar nuevamente.")\n'
      + '    return\n  }\n'
      + (s.includes('function syncPanamaOverweightLines() {') ? '  syncPanamaOverweightLines()\n' : '')
      + '\n' + snapshotAnchor,
    'save-side request delta before immutable snapshot')

  const detailIdsAnchor = 'const currentDetailIds = new Set(includedLines.value.map((line) => line.detailId).filter((id): id is string => Boolean(id)))'
  // The final save must compare the exact serialized row identities, not a
  // second live computed list that watchers may have changed after snapshot.
  if (s.includes(detailIdsAnchor)) {
    s = replaceSingle(s, detailIdsAnchor,
      'const currentDetailIds = new Set(normalizedIncludedLines.map((line) => line.detailId).filter((id): id is string => Boolean(id)))',
      'validate immutable persisted detail snapshot')
  }

  const freight = 'function syncPersistedFreightLineForEdit() {'
  s = replaceSingle(s, freight,
    freight + '\n  if (props.rateId && !quoteEditTransportChanged387()) return',
    'unchanged freight preservation')

  s = replaceSingle(s, '\n</script>', '\n' + pricingQuotationEditDelta387Runtime + '\n</script>', 'inject delta runtime')
  return s
}

export function pricingQuotationEditDelta387(): Plugin {
  return {
    name: 'dhole-pricing-quotation-edit-delta-387',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll(String.fromCharCode(92), '/').endsWith(WIZARD)) return null
      return { code: patchPricingQuotationEditDelta387(source), map: null }
    },
  }
}
