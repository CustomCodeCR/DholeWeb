import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'

export const pricingQuotationEditDelta387Runtime = String.raw`
interface QuoteEditContext387 {
  modality: string; shipmentMode: string; originId: string; destinationId: string
  podId: string; agentId: string; carrierId: string; incotermId: string
  equipmentId: string; importRateId: string; services: string[]
  merchant: boolean; carrier: boolean; dangerous: boolean; overweight: boolean
  nonStackable: boolean; storageDays: number; cargoValue: number
}
const quoteEditOriginalContext387 = ref<QuoteEditContext387 | null>(null)
const quoteEditAutoRemovedIds387 = new Set<string>()
let quoteEditRequest387 = 0

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
    cargoValue: number(form.cargoValue),
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
    if (cost.costDetailType === 'Freight' || cost.isActive === false) return false
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
  const sequence = ++quoteEditRequest387
  const signature = JSON.stringify(quoteEditContext387())
  if (!quoteEditChangedKeys387().size) {
    quoteEditRemoveInvalidDetails387()
    return true
  }
  const loaded = await loadApplicableCosts()
  if (!loaded || sequence !== quoteEditRequest387
      || signature !== JSON.stringify(quoteEditContext387())) return false
  quoteEditRemoveInvalidDetails387()
  quoteEditRequestedCosts387().forEach(cost => {
    appendConfiguredCostToPersistedEdit(cost)
  })
  quoteEditEnsureRequestedServices387()
  return true
}
watch(
  () => [step.value, form.serviceIds.join('|'), form.incotermId,
    form.carrierId, form.agentId, form.originId, form.destinationId, form.podId,
    form.modality, form.shipmentMode, form.merchantHaulage, form.carrierHaulage,
    form.overweight, form.dangerousCargo, form.equipmentId] as const,
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
    'function syncHaulageOptionalLines() {\\n'
      + '  if (props.rateId && !quoteEditChangedKeys387().has("merchant")'
      + ' && !quoteEditChangedKeys387().has("carrier")) return',
    'preserve persisted haulage selections')

  s = replaceSingle(s,
    '    // An existing quote is a pricing snapshot; opening it must not overwrite its amounts.',
    '    quoteEditOriginalContext387.value = quoteEditContext387()\n'
      + '    quoteEditAutoRemovedIds387.clear()\n'
      + '    // An existing quote is a pricing snapshot; opening it must not overwrite its amounts.',
    'original context snapshot')

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

  const saveStart = s.indexOf('  if (editingRate.value && !props.viewOnly) {\n    await loadApplicableCosts()')
  const saveEnd = s.indexOf('  const details: CreateRateDetailRequest[]', saveStart)
  if (saveStart < 0 || saveEnd < 0) throw new Error('[pricingQuotationEditDelta387] Save reconciliation guard')
  s = s.slice(0, saveStart)
    + '  if (props.rateId && editingRate.value && !(await quoteEditApplyDelta387())) return\n\n'
    + s.slice(saveEnd)

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
