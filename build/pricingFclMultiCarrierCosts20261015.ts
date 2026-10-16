import type { Plugin } from 'vite'

const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARK = '// dhole-fcl-multi-carrier-costs-20261015'
function swap(s: string, a: string, b: string): string {
  if (!s.includes(a)) throw new Error('[multiCarrierCosts] Missing anchor ' + a.slice(0, 80))
  return s.replace(a, b)
}
function editFn(s: string, signature: string, edit: (s: string) => string): string {
  const i = s.indexOf(signature)
  const j = i < 0 ? -1 : s.indexOf('\n}\n', i)
  if (j < 0) throw new Error('[multiCarrierCosts] Missing function ' + signature)
  return s.slice(0, i) + edit(s.slice(i, j + 2)) + s.slice(j + 2)
}

const STATE = String.raw`
// dhole-fcl-multi-carrier-costs-20261015
type CarrierForUnit = { id: string; name: string }
const fclCarrierOverrides = ref<Record<string, string>>({})
const fclSavedCarrierLookup = ref<Record<string, CarrierForUnit>>({})

function fclCarrierForType(typeId: string): CarrierForUnit {
  const id = fclSelectedImportRateIds.value[typeId]
  const source = (fclRatesByContainer.value[typeId] ?? []).find((rate) => rate.id === id)
  const container = fclContainerAllocations.value.find((row) => row.containerTypeId === typeId)
  const typeText = normalizeCatalogValue(container?.containerTypeName || '')
  const detail = editingRate.value?.rateDetails?.find((row) => row.costDetailType === 'Freight'
    && Boolean(typeText) && normalizeCatalogValue(String(row.name) + ' ' + String(row.notes)).includes(typeText))
  const notes = String(detail?.notes ?? '')
  const savedId = notes.match(/NavieraId:\s*([0-9a-f-]{36})/i)?.[1]
  const savedName = notes.match(/Naviera:\s*([^·\r\n]+)/i)?.[1]?.trim()
  const recovered = fclSavedCarrierLookup.value[typeId]
  const carrierId = fclCarrierOverrides.value[typeId] || source?.carrierId || savedId
    || recovered?.id || (typeId === form.equipmentId ? form.carrierId : '')
  const name = source?.carrier || savedName || recovered?.name || ''
  const catalog = catalogs.carriers.find((item) => item.id === carrierId)
    ?? catalogs.carriers.find((item) => name
      && normalizeCatalogValue(displayValue(item)) === normalizeCatalogValue(name))
  return { id: catalog?.id || carrierId || '', name: catalog ? displayValue(catalog) : name || 'Seleccione naviera' }
}

const fclCarriersByEquipment = computed(() => fclContainerAllocations.value.map((item) => ({
  containerTypeId: item.containerTypeId,
  quantity: Math.max(1, Math.trunc(number(item.quantity))),
  ...fclCarrierForType(item.containerTypeId),
})))
const fclAllCarrierIds = computed(() => shipmentModeForApi.value === 'Fcl'
  && fclContainerAllocations.value.length > 1
    ? [...new Set(fclCarriersByEquipment.value.map((row) => row.id).filter(Boolean))]
    : form.carrierId ? [form.carrierId] : [])

function fclMatchesCarrierSet(relations: Array<{ id: string }> | null | undefined,
  carrierId: string | null | undefined) {
  return fclAllCarrierIds.value.some((id) => maritimeFclRelationMatches(relations, carrierId, id))
    || (!fclAllCarrierIds.value.length && !carrierId && !relations?.length)
}

function fclCostCarrierQuantity(cost: CostSelectDto): number | null {
  if (!cost.carrierId && !cost.carriers?.length) return null
  const count = fclCarriersByEquipment.value.reduce((sum, item) =>
    sum + (maritimeFclRelationMatches(cost.carriers, cost.carrierId, item.id) ? item.quantity : 0), 0)
  return count > 0 ? count : null
}

function setFclEquipmentCarrier(typeId: string, id: string) {
  const prior = fclCarrierForType(typeId).id
  fclCarrierOverrides.value = { ...fclCarrierOverrides.value, [typeId]: id }
  if (prior !== id) fclSelectedImportRateIds.value = { ...fclSelectedImportRateIds.value, [typeId]: '' }
  if (typeId === form.equipmentId) form.carrierId = id
}

function setFclEquipmentFreight(typeId: string, field: 'cost' | 'sale', value: number) {
  const amount = Number.isFinite(value) ? Math.max(0, value) : 0
  if (typeId === form.equipmentId) {
    if (field === 'cost') form.freightCost = amount
    else form.freightSale = amount
  } else {
    const row = fclExtraContainers.value.find((item) => item.containerTypeId === typeId)
    if (!row) return
    if (field === 'cost') row.freightCostAmount = amount
    else row.freightSaleAmount = amount
    row.freightTouched = true
  }
}

// Recover the carrier for historical mixed-FCL quotes from each freight's import source.
watch(() => editingRate.value?.id || '', async (id) => {
  fclSavedCarrierLookup.value = {}
  const rate = editingRate.value
  if (!id || !rate || String(rate.shipmentMode).toLowerCase() !== 'fcl') return
  const results = await Promise.allSettled((rate.containers ?? []).map(async (container) => {
    const details = rate.rateDetails ?? []
    const detail = details.find((row) => row.costDetailType === 'Freight'
      && [container.containerTypeName, container.containerTypeCode].filter(Boolean)
        .some((text) => normalizeCatalogValue(String(row.name) + ' ' + String(row.notes))
          .includes(normalizeCatalogValue(text))))
    const sourceId = String(detail?.notes ?? '').match(/Tarifa importada:\s*([0-9a-f-]{36})/i)?.[1]
    if (!sourceId) return null
    const source = await PricingService.getImportRate(sourceId)
    return { typeId: container.containerTypeId, id: source.carrierId, name: source.carrier }
  }))
  if (editingRate.value?.id !== id) return
  const pairs: Array<[string, CarrierForUnit]> = []
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value?.id)
      pairs.push([result.value.typeId, { id: result.value.id, name: result.value.name }])
  })
  fclSavedCarrierLookup.value = Object.fromEntries(pairs)
}, { immediate: true })

watch(() => [step.value, fclCarriersByEquipment.value.map((r) => r.containerTypeId + r.id).join('|')] as const,
  async () => {
    if (step.value !== 6 || shipmentModeForApi.value !== 'Fcl'
      || fclContainerAllocations.value.length <= 1 || hydratingExistingRate.value) return
    await loadApplicableCosts()
  }, { flush: 'post' })

function fclCarrierLabelForLine(line: RateLine): string {
  if (shipmentModeForApi.value !== 'Fcl' || fclContainerAllocations.value.length < 2) return ''
  let matches: typeof fclCarriersByEquipment.value = []
  if (line.costDetailType === 'Freight') {
    matches = fclCarriersByEquipment.value.filter((unit) => {
      const allocation = fclContainerAllocations.value.find((row) => row.containerTypeId === unit.containerTypeId)
      return allocation && fclFreightLineMatchesAllocation(line, allocation)
    })
  } else if (line.costId) {
    const configured = costs.value.find((cost) => cost.id === line.costId)
    if (configured && (configured.carrierId || configured.carriers?.length)) {
      matches = fclCarriersByEquipment.value.filter((unit) =>
        Boolean(unit.id) && maritimeFclRelationMatches(configured.carriers, configured.carrierId, unit.id),
      )
    }
  }
  if (matches.length) {
    const carriers = [...new Set(matches.map((unit) => unit.name).filter((name) => name && name !== 'Seleccione naviera'))]
    if (!carriers.length) return ''
    const names = matches.map((unit) => {
      const allocation = fclContainerAllocations.value.find((row) => row.containerTypeId === unit.containerTypeId)
      return allocation ? String(unit.quantity) + ' × ' + allocation.containerTypeName : ''
    }).filter(Boolean)
    return 'Naviera: ' + carriers.join(' + ') + (names.length ? ' · Equipo: ' + names.join(' + ') : '')
  }
  // Existing persisted quotes may have saved carrier annotations but their
  // configured cost is no longer active. Do not silently drop that snapshot.
  const notes = String(line.notes ?? '')
  const carrier = notes.match(/(?:^|·)\s*Naviera:\s*([^·\r\n]+)/i)?.[1]?.trim()
  const equipment = notes.match(/(?:^|·)\s*Equipo:\s*([^·\r\n]+)/i)?.[1]?.trim()
  return carrier ? 'Naviera: ' + carrier + (equipment ? ' · Equipo: ' + equipment : '') : ''
}

function fclPersistCarrierNote(line: RateLine, notes: string | null | undefined): string | null {
  if (shipmentModeForApi.value !== 'Fcl' || fclContainerAllocations.value.length < 2)
    return notes || null
  // Replace the old displayed assignment, leaving the original commercial
  // comment and freight's technical rate-source identifier untouched.
  const original = String(notes ?? '').split(/\s+·\s+/).filter((part) =>
    !/^(?:Naviera|Equipo)\s*:/i.test(part.trim())).join(' · ').trim()
  const assignment = fclCarrierLabelForLine(line)
  return [original, assignment].filter(Boolean).join(' · ') || null
}

`

const FREIGHT = `
          <div v-if="shipmentModeForApi === 'Fcl' && fclContainerAllocations.length > 1" class="crystal-soft space-y-3 p-4 md:p-5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div><p class="font-black">Flete por contenedor</p><p class="mt-1 text-xs text-[var(--dh-text-muted)]">Cada equipo conserva su naviera, costo y venta.</p></div>
              <span class="rounded-full border border-[var(--dh-border)] px-2.5 py-1 text-xs font-semibold">{{ fclContainerTotal }} contenedores</span>
            </div>
            <div class="grid gap-3 lg:grid-cols-2">
              <div v-for="(allocation, index) in fclContainerAllocations" :key="'fcl-unit-price:' + allocation.containerTypeId" class="space-y-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3">
                <div class="flex flex-wrap items-center justify-between gap-2"><strong class="text-sm">{{ allocation.quantity }} × {{ allocation.containerTypeName }}</strong><span class="text-[10px] font-bold uppercase text-[var(--dh-text-muted)]">{{ index === 0 ? 'Principal' : 'Adicional ' + index }}</span></div>
                <DhSelect :model-value="fclCarrierForType(allocation.containerTypeId).id" label="Naviera" :options="carrierOptions" @update:model-value="(value) => setFclEquipmentCarrier(allocation.containerTypeId, String(value))" />
                <div class="grid gap-3 sm:grid-cols-2">
                  <DhInput :model-value="allocation.freightCostAmount" type="number" min="0" step="0.01" label="Costo unitario" @update:model-value="(value) => setFclEquipmentFreight(allocation.containerTypeId, 'cost', Number(value))" />
                  <DhInput :model-value="allocation.freightSaleAmount" type="number" min="0" step="0.01" label="Venta unitaria" @update:model-value="(value) => setFclEquipmentFreight(allocation.containerTypeId, 'sale', Number(value))" />
                </div>
                <p v-if="fclGroupOverweightUnits(allocation.containerTypeId, allocation.quantity)" class="text-xs font-semibold text-[var(--dh-primary)]">{{ fclGroupOverweightUnits(allocation.containerTypeId, allocation.quantity) }} con sobrepeso</p>
              </div>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-4 border-t border-[var(--dh-border)] pt-3 text-xs">
              <span>Costo total: <strong>{{ formatMoney(providerFreightCost, displayValue(selectedCurrency) || 'USD') }}</strong></span>
              <span>Venta total: <strong>{{ formatMoney(providerFreightSale, displayValue(selectedCurrency) || 'USD') }}</strong></span>
            </div>
          </div>
`

function replaceFreightPanel(s: string): string {
  const marker = s.indexOf('Flete internacional por equipo')
  const start = marker >= 0 ? s.lastIndexOf('<div v-if="shipmentModeForApi === \'Fcl\' && fclContainerAllocations.length > 1"', marker) : -1
  if (start < 0) throw new Error('[multiCarrierCosts] Missing original freight panel')
  const tags = /<\/?div\b[^>]*>/g
  tags.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(s))) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) return s.slice(0, start) + FREIGHT + s.slice(tags.lastIndex)
  }
  throw new Error('[multiCarrierCosts] Unclosed original freight panel')
}

export function patchFclMultiCarrierCosts(source: string): string {
  if (source.includes(MARK) || !source.includes('const fclContainerAllocations = computed(')) return source
  let code = source
  code = editFn(code, 'function maritimeFclCostMatchesCurrentContext(cost: CostSelectDto)', (s) =>
    swap(s, 'maritimeFclRelationMatches(cost.carriers, cost.carrierId, form.carrierId)',
      'fclMatchesCarrierSet(cost.carriers, cost.carrierId)'))
  code = editFn(code, 'async function loadApplicableCosts() {', (s) =>
    swap(s, 'PricingService.selectCosts(contextualQuery),',
      `Promise.allSettled(
        maritimeFcl && fclAllCarrierIds.value.length > 1
          ? fclAllCarrierIds.value.map((carrierId) =>
            PricingService.selectCosts({ ...contextualQuery, carrierId }))
          : [PricingService.selectCosts(contextualQuery)],
      ).then((results) => results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [])),`))
  if (code.includes('finalOptionalRelationMatches(cost.carriers, cost.carrierId, form.carrierId)'))
    code = swap(code, 'finalOptionalRelationMatches(cost.carriers, cost.carrierId, form.carrierId)',
      "(shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1 ? fclMatchesCarrierSet(cost.carriers, cost.carrierId) : finalOptionalRelationMatches(cost.carriers, cost.carrierId, form.carrierId))")
  code = swap(code, 'function quantityForRateLine(line: RateLine) {',
    `function quantityForRateLine(line: RateLine) {
  if (shipmentModeForApi.value === 'Fcl' && fclContainerAllocations.value.length > 1
    && line.costId && line.costDetailType !== 'Freight'
    && !/sobrepeso|overweight/.test(normalizeCatalogValue(line.name))
    && (line.chargeBasis === 'PerContainer' || line.chargeBasis === 'PerTruck')) {
    const configured = costs.value.find((item) => item.id === line.costId)
    if (configured) {
      const quantity = fclCostCarrierQuantity(configured)
      if (quantity !== null) return quantity
    }
  }`)
  code = editFn(code, 'function reconcileFclFreightLines() {', (s) => {
    let result = swap(s, '!/^Tarifa importada:/i.test(part)',
      '!/^Tarifa importada:/i.test(part) && !/^NavieraId:/i.test(part) && !/^Naviera:/i.test(part)')
    result = swap(result, "    if (importId) noteParts.push('Tarifa importada: ' + importId)",
      `    if (importId) noteParts.push('Tarifa importada: ' + importId)
    const carrier = fclCarrierForType(allocation.containerTypeId)
    if (carrier.id) noteParts.push('NavieraId: ' + carrier.id)
    if (carrier.id && carrier.name) noteParts.push('Naviera: ' + carrier.name)`)
    return result
  })
  code = swap(code, 'function chooseFclRateBundle(bundle: FclRateBundle) {',
    'function chooseFclRateBundle(bundle: FclRateBundle) {\n  fclCarrierOverrides.value = {}')
  code = swap(code, 'function resetWizard() {',
    'function resetWizard() {\n  fclCarrierOverrides.value = {}\n  fclSavedCarrierLookup.value = {}')
  // Reuse any v-if previously inserted by visual/pricing transforms.
  // Adding another v-if creates a Vue "Duplicate attribute" build error.
  const hideOriginalFieldForMixedFcl = (input: string, component: string, fieldName: string) => {
    const regex = new RegExp(
      '<' + component + '(?=[\\s>])(?=[^>]*v-model(?:\\.number)?="form\\.' + fieldName + '")[^>]*>',
    )
    const matched = input.match(regex)?.[0]
    if (!matched) return input
    const condition = "shipmentModeForApi !== 'Fcl' || fclContainerAllocations.length <= 1"
    const current = matched.match(/\bv-if="([^"]*)"/)
    const updated = current
      ? matched.replace(current[0], 'v-if="(' + current[1] + ') && (' + condition + ')"')
      : matched.replace('<' + component, '<' + component + ' v-if="' + condition + '"')
    return input.replace(matched, updated)
  }
  code = hideOriginalFieldForMixedFcl(code, 'DhSelect', 'carrierId')
  for (const field of ['freightCost', 'freightSale']) {
    code = hideOriginalFieldForMixedFcl(code, 'DhInput', field)
  }
  // Add a compact visual association to the editable lines and final preview,
  // without widening the cost table or changing the underlying CostId.
  const label = '<p v-if="fclCarrierLabelForLine(line)" class="mt-1 text-[11px] font-bold text-[var(--dh-text-muted)]">{{ fclCarrierLabelForLine(line) }}</p>'
  code = code.replaceAll('<p class="font-bold">{{ line.name }}</p>',
    '<p class="font-bold">{{ line.name }}</p>' + label)
  code = code.replaceAll('<strong>{{ line.name }}</strong>',
    '<strong>{{ line.name }}</strong>' + label)

  // The same association is saved per detail, not only in the single carrier
  // field of the quotation header, and is therefore available to the PDF.
  const detailsEnd = '  const includedNameKeys = new Set('
  if (!code.includes(detailsEnd)) throw new Error('[multiCarrierCosts] Missing rate detail serialization')
  code = code.replace(detailsEnd,
    '  details.forEach((detail, index) => {\\n'
    + '    const line = normalizedIncludedLines[index]\\n'
    + '    if (line) detail.notes = fclPersistCarrierNote(line, detail.notes)\\n'
    + '  })\\n\\n' + detailsEnd)
  code = replaceFreightPanel(code)
  const scriptEnd = code.lastIndexOf('</script>')
  if (scriptEnd < 0) throw new Error('[multiCarrierCosts] Missing script end')
  return code.slice(0, scriptEnd) + '\n' + STATE + code.slice(scriptEnd)
}

export function pricingFclMultiCarrierCosts20261015(): Plugin {
  return {
    name: 'dhole-fcl-multi-carrier-costs-20261015',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD)) return null
      return { code: patchFclMultiCarrierCosts(source), map: null }
    },
  }
}
