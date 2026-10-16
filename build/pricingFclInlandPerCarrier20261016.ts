import type { Plugin } from 'vite'

// Keep every carrier's actual inland line. A multi-FCL quote must not price
// COSCO's 40HC using MSC's 20DV inland amount or multiply one line by both units.
const WIZARD = '/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue'
const MARK = '// dhole-fcl-inland-per-carrier-20261016'

const HELPERS = String.raw`
// dhole-fcl-inland-per-carrier-20261016
const fclInlandPerCarrier = computed(() =>
  shipmentModeForApi.value === 'Fcl' && fclCarriersByEquipment.value.length > 1,
)

function fclInlandIsCarrierCost(cost: CostSelectDto) {
  if (cost.isActive === false) return false
  const name = normalizeCatalogValue(cost.name)
  const inland = cost.costDetailType === 'InlandTransport'
    || name.includes('inland') || name.includes('transporte interno')
  if (!inland) return false
  if (dholeHaulageOptionalAssociation(cost) === 'carrier') return true
  return name.includes('naviera') && !name.includes('merchant')
}

const fclInlandCarrierRows = computed(() => {
  if (!fclInlandPerCarrier.value) return [] as Array<{
    typeId: string; carrierId: string; carrierName: string; quantity: number
    equipment: string; cost: CostSelectDto
  }>
  const catalog = new Map<string, CostSelectDto>()
  // Full catalogue is a fallback for historic /costs/select single-carrier
  // results, but still enforce the actual route, services, incoterm and carrier.
  ;[...allCosts.value, ...costs.value]
    .filter((cost) => fclInlandIsCarrierCost(cost)
      && maritimeFclCostMatchesCurrentContext(cost)
      && Boolean(resolvedConditionalCost(cost))
      && dholeHaulageOtherConditionsMatch(cost)
      && dholeHaulageMatchesSelectedTerminal(cost))
    .forEach((cost) => catalog.set(cost.id, cost))
  return fclCarriersByEquipment.value.flatMap((unit) => {
    if (!unit.id) return []
    const equipment = fclContainerAllocations.value
      .find((allocation) => allocation.containerTypeId === unit.containerTypeId)?.containerTypeName ?? ''
    const matches = [...catalog.values()].filter((cost) =>
      maritimeFclRelationMatches(cost.carriers, cost.carrierId, unit.id))
    const selected = matches.filter((cost) => {
      if (cost.carrierId || cost.carriers?.length) return true
      // Do not charge generic and carrier-specific equivalents twice.
      return !matches.some((specific) => specific.id !== cost.id
        && (specific.carrierId || specific.carriers?.length)
        && normalizeCatalogValue(specific.name) === normalizeCatalogValue(cost.name))
    })
    return selected.map((cost) => ({
      typeId: unit.containerTypeId,
      carrierId: unit.id,
      carrierName: unit.name,
      quantity: unit.quantity,
      equipment,
      cost,
    }))
  })
})

const fclInlandUnpricedCarriers = computed(() => fclInlandPerCarrier.value && form.carrierHaulage
  ? fclCarriersByEquipment.value.filter((unit) => unit.id
    && !fclInlandCarrierRows.value.some((row) => row.typeId === unit.containerTypeId))
  : [])

function fclInlandUnitQuantity(cost: CostSelectDto, quantity: number) {
  const basis = cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType)
  return basis === 'PerContainer' || basis === 'PerTruck'
    ? quantity
    : quantityForChargeBasis(basis, cost.operationalConditions)
}

function fclInlandMakeLine(
  row: typeof fclInlandCarrierRows.value[number],
  saved: RateLine | undefined,
): RateLine {
  const { cost } = row
  const resolved = resolvedConditionalCost(cost)
  const noteParts = String(saved?.notes ?? cost.notes ?? '').split(/\s+·\s+/)
    .filter((part) => !/^(?:Naviera|Equipo)\s*:/i.test(part.trim()))
  noteParts.push('Naviera: ' + row.carrierName)
  noteParts.push('Equipo: ' + row.quantity + ' × ' + row.equipment)
  const line: RateLine = {
    key: 'fcl-inland:' + row.typeId + ':' + cost.id,
    detailId: saved?.detailId ?? null,
    section: sectionForCost(cost),
    name: cost.name,
    costDetailType: cost.costDetailType,
    costType: cost.costType,
    chargeBasis: cost.chargeBasis ?? defaultChargeBasis(cost.costDetailType),
    costId: cost.id,
    contextLabel: costContextLabel(cost),
    notes: noteParts.filter(Boolean).join(' · '),
    serviceIds: cost.services?.map((service) => service.id) ?? [],
    currencyId: saved?.currencyId ?? cost.currencyId,
    currencyName: saved?.currencyName ?? cost.currencyName,
    currencyCode: saved?.currencyCode ?? cost.currencyCode,
    costAmount: saved ? number(saved.costAmount) : number(resolved?.costAmount ?? cost.costAmount),
    saleAmount: saved ? number(saved.saleAmount) : number(resolved?.saleAmount ?? cost.saleAmount),
    included: Boolean(form.carrierHaulage),
    optional: cost.costType === 'Optional',
    manual: false,
    quantityOverride: fclInlandUnitQuantity(cost, row.quantity),
    billToClient: saved?.billToClient ?? null,
    applyDestinationTax: saved?.applyDestinationTax ?? false,
    destinationTaxRate: saved?.destinationTaxRate ?? 0,
  }
  enforceLineCurrency(line)
  return line
}

function fclSyncInlandPerCarrier() {
  if (!fclInlandPerCarrier.value || props.viewOnly || props.sellerRequestMode) return
  if (!costs.value.length && !allCosts.value.length) return
  const catalog = new Map([...allCosts.value, ...costs.value].map((cost) => [cost.id, cost]))
  const isOldInland = (line: RateLine) =>
    String(line.key ?? '').startsWith('fcl-inland:')
    || Boolean(line.costId && catalog.has(line.costId)
      && fclInlandIsCarrierCost(catalog.get(line.costId)!))
  const existing = rateLines.value
  const removed = existing.filter(isOldInland)
  const rows = fclInlandCarrierRows.value
  if (!removed.length && !rows.length) return
  const index = existing.findIndex(isOldInland)
  const keep = existing.filter((line) => !isOldInland(line))
  const added = form.carrierHaulage ? rows.map((row) => {
    const key = 'fcl-inland:' + row.typeId + ':' + row.cost.id
    const sameId = removed.filter((line) => line.costId === row.cost.id)
    const previous = removed.find((line) => line.key === key)
      ?? sameId.find((line) =>
        String(line.notes ?? '').includes('Naviera: ' + row.carrierName))
      ?? (sameId.length === 1 && rows.filter((candidate) =>
        candidate.cost.id === row.cost.id).length === 1 ? sameId[0] : undefined)
    return fclInlandMakeLine(row, previous)
  }) : []
  const at = index < 0 ? keep.length : Math.min(index, keep.length)
  const next = [...keep.slice(0, at), ...added, ...keep.slice(at)]
  const signature = (values: RateLine[]) => JSON.stringify(values.map((line) =>
    [line.key, line.detailId, line.included, line.costAmount, line.saleAmount, line.notes, line.quantityOverride]))
  if (signature(next) !== signature(existing)) rateLines.value = next
}

watch(
  () => [step.value, form.carrierHaulage, form.merchantHaulage,
    fclCarriersByEquipment.value.map((unit) => unit.containerTypeId + ':' + unit.id + ':' + unit.quantity).join('|'),
    fclInlandCarrierRows.value.map((row) => row.typeId + ':' + row.cost.id).join('|'),
    rateLines.value.map((line) => line.key + ':' + (line.costId ?? '')).join('|')].join('~'),
  () => {
    if ([6, 7, 8].includes(step.value)) fclSyncInlandPerCarrier()
  },
  { immediate: true, flush: 'post' },
)
`

const UNIT_PANEL = String.raw`
              <div v-if="fclInlandPerCarrier && form.carrierHaulage" class="space-y-2">
                <p class="text-sm font-black">Inland por naviera y contenedor</p>
                <div v-for="row in fclInlandCarrierRows" :key="row.typeId + ':' + row.cost.id"
                  class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs">
                  <span><strong>{{ row.carrierName }} · {{ row.quantity }} × {{ row.equipment }}</strong> · {{ row.cost.name }}</span>
                  <span>Costo: <strong>{{ dholeHaulageMoney(dholeHaulageConverted(number(row.cost.costAmount) * fclInlandUnitQuantity(row.cost, row.quantity), canonicalCurrencyCode(row.cost))) }}</strong>
                    · Venta: <strong>{{ dholeHaulageMoney(dholeHaulageConverted(number(row.cost.saleAmount) * fclInlandUnitQuantity(row.cost, row.quantity), canonicalCurrencyCode(row.cost))) }}</strong></span>
                </div>
                <p v-for="unit in fclInlandUnpricedCarriers" :key="'missing-inland:' + unit.containerTypeId"
                  class="text-xs font-bold text-amber-600">
                  Falta configurar Inland para {{ unit.name }}. No se utilizará el precio de otra naviera.
                </p>
              </div>
`

function editFunction(source: string, signature: string, update: (text: string) => string): string {
  const start = source.indexOf(signature)
  const end = start < 0 ? -1 : source.indexOf('\n}\n', start)
  if (end < 0) throw new Error('[fclInland] Missing ' + signature)
  return source.slice(0, start) + update(source.slice(start, end + 2)) + source.slice(end + 2)
}
function change(source: string, from: string, to: string): string {
  if (!source.includes(from)) throw new Error('[fclInland] Missing ' + from.slice(0, 85))
  return source.replace(from, to)
}

export function patchFclInlandPerCarrier(source: string) {
  if (source.includes(MARK) || !source.includes('function fclCarrierForType(')) return source
  let code = source

  code = change(code, 'function quantityForRateLine(line: RateLine) {',
    String.raw`function quantityForRateLine(line: RateLine) {
  if (String(line.key ?? '').startsWith('fcl-inland:'))
    return Math.max(1, number(line.quantityOverride))`)

  code = change(code, 'function fclCarrierLabelForLine(line: RateLine): string {',
    String.raw`function fclCarrierLabelForLine(line: RateLine): string {
  if (String(line.key ?? '').startsWith('fcl-inland:')) {
    const carrier = String(line.notes ?? '').match(/Naviera:\s*([^·\r\n]+)/i)?.[1]?.trim()
    const equipment = String(line.notes ?? '').match(/Equipo:\s*([^·\r\n]+)/i)?.[1]?.trim()
    if (carrier) return 'Naviera: ' + carrier + (equipment ? ' · Equipo: ' + equipment : '')
  }`)

  code = editFunction(code, 'function fclScreen8LineCarrier(line: RateLine)', (part) =>
    change(part, "  const notes = String(line.notes ?? '')",
      String.raw`  const notes = String(line.notes ?? '')
  if (String(line.key ?? '').startsWith('fcl-inland:')) {
    const carrier = notes.match(/Naviera:\s*([^·\r\n]+)/i)?.[1]?.trim()
    const equipment = notes.match(/Equipo:\s*([^·\r\n]+)/i)?.[1]?.trim() ?? ''
    if (carrier) return { title: 'Naviera: ' + carrier, equipment, kind: 'carrier' }
  }`))

  // The global carrier-haulage comparator must account for each supplier's
  // real inland price, not double MSC's cost because the quote has two units.
  code = editFunction(code, 'function dholeHaulageOptionTotals(mode: DholeHaulageChoice)', (part) =>
    change(part,
      "  const rows = mode === 'merchant' ? dholeMerchantCosts.value : dholeCarrierCosts.value",
      String.raw`  if (mode === 'carrier' && fclInlandPerCarrier.value) {
    const inlandIds = new Set(fclInlandCarrierRows.value.map((row) => row.cost.id))
    const otherCosts = dholeCarrierCosts.value.filter((cost) =>
      !inlandIds.has(cost.id) && !fclInlandIsCarrierCost(cost))
    const total = (field: 'costAmount' | 'saleAmount') =>
      dholeHaulageSum(otherCosts, field)
        + fclInlandCarrierRows.value.reduce((sum, row) => sum +
          dholeHaulageConverted(number(row.cost[field]) * fclInlandUnitQuantity(row.cost, row.quantity),
            canonicalCurrencyCode(row.cost)), 0)
    return { cost: total('costAmount'), sale: total('saleAmount') }
  }
  const rows = mode === 'merchant' ? dholeMerchantCosts.value : dholeCarrierCosts.value`))

  // Every cost that carries an independent CostId remains a distinct rate line
  // and the master freight charges are left untouched.
  const rowPanel = '<div v-if="dholeSelectedHaulageCosts.length" class="space-y-2">'
  code = change(code, rowPanel,
    UNIT_PANEL + '              <div v-if="dholeSelectedHaulageCosts.length && (!fclInlandPerCarrier || !form.carrierHaulage)" class="space-y-2">')

  const screen8Warning = '<p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Líneas completas de la tarifa</p>'
  code = change(code, screen8Warning,
    screen8Warning + String.raw`
              <p v-if="fclInlandUnpricedCarriers.length" class="mt-2 text-xs font-bold text-amber-600">
                Faltan costos Inland para: {{ fclInlandUnpricedCarriers.map((unit) => unit.name).join(', ') }}. No se copiarán importes de otras navieras.
              </p>`)

  const end = code.lastIndexOf('</script>')
  if (end < 0) throw new Error('[fclInland] Missing wizard script')
  code = code.slice(0, end) + '\n' + HELPERS + code.slice(end)
  return code
}

export function pricingFclInlandPerCarrier20261016(): Plugin {
  return {
    name: 'dhole-fcl-inland-per-carrier-20261016',
    transform(source, id) {
      if (id.includes('?') || !id.replaceAll('\\', '/').endsWith(WIZARD)) return null
      return { code: patchFclInlandPerCarrier(source), map: null }
    },
  }
}
