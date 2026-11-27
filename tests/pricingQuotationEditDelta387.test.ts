import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { pricingQuotationEditDelta387Runtime } from '../build/pricingQuotationEditDelta387.ts'

function fixture() {
  const freight = { key: 'existing:F', detailId: 'F', costDetailType: 'Freight', costId: null, name: 'Flete internacional',
    costAmount: 5300, saleAmount: 5800, included: true, serviceIds: [] }
  const destination = { key: 'existing:D', id: 'D', detailId: 'D', costDetailType: 'DestinationCharge', costId: 'OLD',
    name: 'Redestino', costAmount: 225, saleAmount: 290, included: true, serviceIds: ['TRANSPORT'] }
  const customs = { id: 'AD', name: 'Servicio de Aduanas', costDetailType: 'CustomsCharge',
    costType: 'Fixed', isActive: true, costAmount: 50, saleAmount: 70,
    services: [{ id: 'ADUANAS' }] }
  const insurance = { id: 'INS', name: 'Seguro de carga', costDetailType: 'Insurance',
    costType: 'Optional', isActive: true, costAmount: 100, saleAmount: 125,
    services: [{ id: 'SEGURO' }] }
  const root: any = {
    props: { rateId: 'QUO-1', viewOnly: false },
    eligibleAgents: { value: [] as { id: string }[] },
    hydratingExistingRate: { value: false },
    editingRate: { value: {
      rateDetails: [freight, destination],
      services: [{ id: 'TRANSPORT' }],
    } },
    form: { modality: 'Multimodal', shipmentMode: 'FCL', originId: 'SHANGHAI',
      destinationId: 'BALBOA', podId: 'SANJOSE', agentId: 'WWL', carrierId: 'MAERSK',
      incotermId: 'FOB', equipmentId: '40HC', selectedImportRateId: 'A',
      serviceIds: ['TRANSPORT'], merchantHaulage: false, carrierHaulage: true,
      dangerousCargo: false, overweight: false, nonStackable: false,
      storageDays: 0, cargoValue: 0, freightCost: 5300, portHandlingMode: 'Redestino' },
    costs: { value: [] as any[] }, allCosts: { value: [customs, insurance] },
    rateLines: { value: [freight, destination].map(x => ({ ...x })) as any[] },
    explicitlyRemovedPersistedDetailIds: { value: new Set<string>() },
    catalogs: { services: [
      { id: 'TRANSPORT', value: 'Transporte internacional' },
      { id: 'ADUANAS', value: 'Servicio de Aduanas' },
      { id: 'SEGURO', value: 'Seguro de carga' },
    ], currencies: [{ id: 'USD', code: 'USD', value: 'USD' }] },
    selectedCurrency: { value: { id: 'USD', code: 'USD', value: 'USD' } },
    selectedCrcCustomsService: { value: { id: 'ADUANAS' } },
    cargoInsuranceSelected: { value: false },
    selectedIncotermCode: { value: 'FOB' },
    crcImportContext: { value: true },
    watch: () => {},
    nextTickForPoe: async () => {},
    ref: (v: any) => ({ value: v }),
    number: (v: unknown) => Number(v) || 0,
    normalizeCatalogValue: (v: unknown) => String(v ?? '').toLowerCase(),
    displayValue: (v: any) => v?.value ?? v?.name ?? '',
    shipmentModeForApi: { value: 'Fcl' },
    applicableConfiguredCosts: () => root.costs.value,
    loadApplicableCosts: async () => { root.costs.value = [customs, insurance]; return true },
    appendConfiguredCostToPersistedEdit: (cost: any) => {
      if (root.rateLines.value.some((line: any) => line.costId === cost.id)) return
      root.rateLines.value.push({
        key: 'edit-incoterm-cost:' + cost.id, costId: cost.id, costDetailType: cost.costDetailType,
        name: cost.name, included: true, costAmount: cost.costAmount, saleAmount: cost.saleAmount,
        serviceIds: cost.services.map((s: any) => s.id),
      })
    },
    ensureCrcCustomsLine: () => {},
    isCrcCustomsLine: (line: any, serviceId: string) =>
      (line.serviceIds ?? []).includes(serviceId),
    calculateCargoInsurance: () => ({ cost: 30, sale: 45 }),
    persistedRateLineForEdit: (detail: any) => ({ ...detail, key: 'existing:' + detail.detailId }),
  }
  const js = ts.transpileModule(pricingQuotationEditDelta387Runtime, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const ctx = vm.createContext(root)
  const operations = vm.runInContext(js + '\n({ snapshot: quoteEditContext387, original: quoteEditOriginalContext387, apply: quoteEditApplyDelta387, verify: quoteEditVerifyBeforeSave387, requested: quoteEditRequestedCosts387 })', ctx) as any
  operations.original.value = operations.snapshot()
  return { root, ...operations }
}

test('DH-387: unchanged quote does not fetch or reprice any saved line', async () => {
  const q = fixture()
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return true }
  await q.apply()
  assert.equal(queries, 0)
  assert.deepEqual(q.root.rateLines.value.map((l: any) => [l.detailId, l.costAmount, l.saleAmount]),
    [['F', 5300, 5800], ['D', 225, 290]])
})

test('DH-387: requested customs and insurance append only two lines; old prices unchanged', async () => {
  const q = fixture()
  q.root.form.serviceIds.push('ADUANAS', 'SEGURO')
  q.root.cargoInsuranceSelected.value = true
  assert.equal(await q.apply(), true)
  assert.equal(q.root.rateLines.value.length, 4)
  assert.deepEqual(q.root.rateLines.value.slice(0, 2).map((l: any) => [l.detailId, l.costAmount, l.saleAmount]),
    [['F', 5300, 5800], ['D', 225, 290]])
  assert.deepEqual(q.root.rateLines.value.slice(2).map((l: any) => [l.name, l.costAmount, l.saleAmount]),
    [['Servicio de Aduanas', 50, 70], ['Seguro de carga', 100, 125]])
  await q.apply()
  assert.equal(q.root.rateLines.value.length, 4, 'navigating back/forward cannot duplicate added charges')
  q.root.form.serviceIds = ['TRANSPORT']
  await q.apply()
  assert.equal(q.root.rateLines.value.length, 2, 'undoing services removes only newly added rows')
  assert.deepEqual(q.root.rateLines.value.map((l: any) => l.detailId), ['F', 'D'])
})

test('DH-387: a different provider may add associated fixed costs, but not global optionals', async () => {
  const q = fixture()
  q.root.form.carrierId = 'MSC'
  q.root.costs.value = [
    { id: 'NEW', name: 'Release MSC', costType: 'Fixed', costDetailType: 'DestinationCharge',
      carrierId: 'MSC', costAmount: 35, saleAmount: 50, services: [] },
    { id: 'UNWANTED', name: 'Despacho a bordo', costType: 'Optional', costDetailType: 'DestinationCharge',
      carrierId: 'MSC', costAmount: 55, saleAmount: 100, services: [] },
  ]
  assert.deepEqual(Array.from(q.requested(), (c: any) => c.id), ['NEW'])
  assert.deepEqual(q.root.rateLines.value.map((l: any) => l.saleAmount), [5800, 290])
})


test('DH-390: switching Redestino to Anticipado removes only the original detail and is reversible', async () => {
  const q = fixture()
  const anticipated = {
    id: 'ANT', name: 'Muellaje Anticipado', costDetailType: 'DestinationCharge',
    costType: 'Optional', isActive: true, costAmount: 75, saleAmount: 95, services: [],
  }
  q.root.loadApplicableCosts = async () => {
    q.root.costs.value = [anticipated]
    return true
  }
  q.root.form.portHandlingMode = 'Anticipado'
  assert.equal(await q.apply(), true)
  assert.deepEqual(q.root.rateLines.value.map((line: any) => line.name),
    ['Flete internacional', 'Muellaje Anticipado'])
  assert.equal(q.root.explicitlyRemovedPersistedDetailIds.value.has('D'), true)
  assert.equal(q.root.rateLines.value.find((line: any) => line.costId === 'ANT').saleAmount, 95)
  assert.equal(q.root.rateLines.value.find((line: any) => line.detailId === 'F').saleAmount, 5800)

  // Undo the change: restore the negotiated historical detail, not a new
  // catalog price; remove the just-created Anticipado without duplicating.
  q.root.form.portHandlingMode = 'Redestino'
  assert.equal(await q.apply(), true)
  assert.deepEqual(q.root.rateLines.value.map((line: any) => line.name),
    ['Flete internacional', 'Redestino'])
  assert.equal(q.root.explicitlyRemovedPersistedDetailIds.value.has('D'), false)
  assert.equal(q.root.rateLines.value.find((line: any) => line.detailId === 'D').saleAmount, 290)
})

test('saved variable Merchant Inland with null CostId survives edit and repeated P6/P7 navigation', async () => {
  const q = fixture()
  const inland = { id: 'INLAND', detailId: 'INLAND', key: 'existing:INLAND',
    name: 'INLAND DE BALBOA A COLON FREE ZONE (MERCHANT)',
    costDetailType: 'DestinationCharge', costType: 'Variable', costId: null,
    chargeBasis: 'PerContainer', manual: true, included: true, costAmount: 400, saleAmount: 430 }
  const road = { id: 'ROAD', detailId: 'ROAD', key: 'existing:ROAD',
    name: 'Flete terrestre internacional CFZ / Zona Libre Colón, Panamá → San Jose, Costa Rica',
    costDetailType: 'DestinationCharge', costId: null, manual: true,
    included: true, costAmount: 2140, saleAmount: 2140 }
  q.root.editingRate.value.rateDetails.push(inland, road)
  q.root.rateLines.value.push({ ...inland, included: false }, { ...road })
  q.root.form.merchantHaulage = true
  q.root.form.carrierHaulage = false
  q.original.value = q.snapshot()
  assert.equal(await q.apply(), true)
  assert.equal(q.root.rateLines.value.find((l: any) => l.detailId === 'INLAND').included, true)
  q.root.rateLines.value = q.root.rateLines.value.filter((l: any) => l.detailId !== 'INLAND')
  await q.apply()
  await q.apply()
  const rows = q.root.rateLines.value.filter((l: any) => l.detailId === 'INLAND')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].costAmount, 400)
  assert.equal(rows[0].saleAmount, 430)
  assert.equal(q.root.rateLines.value.find((l: any) => l.detailId === 'ROAD').saleAmount, 2140)
  rows[0].saleAmount = 450
  await q.apply()
  assert.equal(rows[0].saleAmount, 450)
  q.root.explicitlyRemovedPersistedDetailIds.value.add('INLAND')
  q.root.rateLines.value = q.root.rateLines.value.filter((l: any) => l.detailId !== 'INLAND')
  await q.apply()
  assert.equal(q.root.rateLines.value.some((l: any) => l.detailId === 'INLAND'), false)
})

test('unchanged revision restores required historical IDs without duplicating exact generated charges', async () => {
  const q = fixture()
  const saved = { id: 'FIXED', detailId: 'FIXED', key: 'existing:FIXED',
    name: 'Cargo destino contratado', costId: 'COST-1', costType: 'Fixed',
    costDetailType: 'DestinationCharge', chargeBasis: 'PerShipment',
    included: true, manual: false, costAmount: 80, saleAmount: 120 }
  const optional = { ...saved, id: 'OPT', detailId: 'OPT', key: 'existing:OPT',
    name: 'Cargo opcional', costId: 'OPT-1', costType: 'Optional' }
  q.root.editingRate.value.rateDetails.push(saved, optional)
  q.root.rateLines.value.push({ ...saved, detailId: null, key: 'cost:COST-1', saleAmount: 90 },
    { ...optional, included: false })
  assert.equal(await q.apply(), true)
  const matching = q.root.rateLines.value.filter((l: any) => l.costId === 'COST-1')
  assert.equal(matching.length, 1)
  assert.equal(matching[0].detailId, 'FIXED')
  assert.equal(matching[0].saleAmount, 120)
  assert.equal(q.root.rateLines.value.find((l: any) => l.detailId === 'OPT').included, false)
  matching[0].saleAmount = 135
  await q.apply()
  assert.equal(matching[0].saleAmount, 135)
  q.root.rateLines.value = q.root.rateLines.value.filter((l: any) => l.detailId !== 'FIXED')
  await q.apply()
  assert.equal(q.root.rateLines.value.find((l: any) => l.detailId === 'FIXED').saleAmount, 120)
  q.root.explicitlyRemovedPersistedDetailIds.value.add('FIXED')
  q.root.rateLines.value = q.root.rateLines.value.filter((l: any) => l.detailId !== 'FIXED')
  await q.apply()
  assert.equal(q.root.rateLines.value.some((l: any) => l.detailId === 'FIXED'), false)
})

test('catalog-backed historical road on any route retains its exact ID when a generated label changes', async () => {
  const q = fixture()
  const saved = { id: 'ROAD-OTHER', detailId: 'ROAD-OTHER', key: 'existing:ROAD-OTHER',
    name: 'Flete terrestre internacional Guatemala a Costa Rica', costId: 'ROAD-COST',
    costType: 'Fixed', costDetailType: 'Freight', chargeBasis: 'PerContainer',
    included: true, manual: false, costAmount: 1200, saleAmount: 1450 }
  q.root.editingRate.value.rateDetails.push(saved)
  q.root.rateLines.value.push({ ...saved, detailId: null, key: 'cost:ROAD-COST',
    name: 'Flete Internacional Terrestre', saleAmount: 1300 })
  assert.equal(await q.apply(), true)
  const rows = q.root.rateLines.value.filter((l: any) => l.costId === 'ROAD-COST')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].detailId, 'ROAD-OTHER')
  assert.equal(rows[0].saleAmount, 1450)
})

test('LCL price-only change preserves edited freight and needs no catalog lookup', async () => {
  const q = fixture()
  q.root.shipmentModeForApi.value = 'Lcl'
  q.root.form.shipmentMode = 'LCL'
  q.root.form.carrierId = ''
  q.original.value = q.snapshot()
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  q.root.form.freightCost = 4.4533376924
  q.root.form.freightSale = 3.15
  q.root.rateLines.value[0].costAmount = 4.4533376924
  q.root.rateLines.value[0].saleAmount = 3.15
  assert.equal(await q.apply(), true)
  assert.equal(queries, 0)
  assert.equal(q.root.rateLines.value[0].detailId, 'F')
  assert.equal(q.root.rateLines.value[0].costAmount, 4.4533376924)
  assert.equal(q.root.rateLines.value[0].saleAmount, 3.15)
})

test('identical concurrent cost reconciliation shares request and neither caller fails', async () => {
  const q = fixture()
  q.root.form.agentId = 'NEW-AGENT'
  let queries = 0
  let finish!: (value: boolean) => void
  q.root.loadApplicableCosts = () => {
    queries++
    return new Promise<boolean>(resolve => { finish = resolve })
  }
  const first = q.apply()
  const second = q.apply()
  assert.equal(queries, 1)
  finish(true)
  assert.equal(await first, true)
  assert.equal(await second, true)
})


test('Air price-only edit retains negotiated charges without a live catalog lookup', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.form.shipmentMode = 'AIR'
  q.root.shipmentModeForApi.value = 'Air'
  q.original.value = q.snapshot()
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  q.root.rateLines.value[0].saleAmount = 5900
  assert.equal(await q.apply(), true)
  assert.equal(queries, 0)
  assert.equal(q.root.rateLines.value[0].saleAmount, 5900)
})

test('Context reconciliation retries one transient failure without bypassing persistent errors', async () => {
  const q = fixture()
  q.root.form.agentId = 'NEW-AGENT'
  let queries = 0
  q.root.loadApplicableCosts = async () => ++queries === 2
  assert.equal(await q.apply(), true)
  assert.equal(queries, 2)
  q.root.form.agentId = 'ANOTHER-AGENT'
  queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  const previous = JSON.stringify(q.root.rateLines.value)
  assert.equal(await q.apply(), false)
  assert.equal(queries, 2)
  assert.equal(JSON.stringify(q.root.rateLines.value), previous)
})


test('P7 verified context is reused at P8 after CRM reselect, without querying costs again', async () => {
  const q = fixture()
  q.root.form.agentId = 'NEW'
  let queries = 0
  q.root.loadApplicableCosts = async () => ++queries === 1
  assert.equal(await q.apply(), true)
  q.root.form.clientId = 'CRM-RECOVERED'
  q.root.form.crmClientKind = 'account'
  assert.equal(await q.verify(), true)
  assert.equal(queries, 1)
  q.root.form.agentId = 'DIFFERENT'
  assert.equal(await q.verify(), false)
  assert.equal(queries, 3)
})
test('save follows a superseded physical context and refuses a stable failing context', async () => {
  const q = fixture()
  q.root.form.agentId = 'NEW'
  let queries = 0
  q.root.loadApplicableCosts = async () => {
    queries++
    if (queries === 1) { q.root.form.agentId = 'FINAL'; return false }
    return true
  }
  assert.equal(await q.verify(), true)
  assert.equal(queries, 2)
  q.root.form.agentId = 'FAIL'
  q.root.loadApplicableCosts = async () => false
  assert.equal(await q.verify(), false)
})


test('verified context does not hide a changed package count or equipment quantity', async () => {
  const q = fixture()
  q.root.form.agentId = 'NEW'
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return true }
  assert.equal(await q.verify(), true)
  q.root.form.cargoPackages = 3
  assert.equal(await q.verify(), true)
  q.root.form.equipmentQuantity = 2
  assert.equal(await q.verify(), true)
  assert.equal(queries, 3)
})


test('Air duplicate ignores residual maritime source and blank optional ID representations', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'AirConsol'
  q.root.form.selectedImportRateId = 'LEGACY-FCL'
  q.root.form.carrierId = null
  q.original.value = q.snapshot()
  q.root.form.selectedImportRateId = ''
  q.root.form.carrierId = ''
  q.root.rateLines.value[0].saleAmount = 5999
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.verify(), true)
  assert.equal(queries, 0)
  assert.equal(q.root.rateLines.value[0].saleAmount, 5999)
  q.root.form.agentId = 'NEW-AGENT'
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
})

test('Maritime FCL source changes still require verified costs', async () => {
  const q = fixture()
  q.root.form.selectedImportRateId = 'NEW-FCL'
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
})

test('Equivalent GUID casing and service ordering do not initiate a catalog lookup', async () => {
  const q = fixture()
  q.root.form.agentId = 'AABBCCDD-1234-5678-ABCD-0123456789AB'
  q.root.form.serviceIds = ['TRANSPORT', 'ADUANAS']
  q.original.value = q.snapshot()
  q.root.form.agentId = 'aabbccdd-1234-5678-abcd-0123456789ab'
  q.root.form.serviceIds = ['ADUANAS', 'TRANSPORT', 'TRANSPORT']
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.verify(), true)
  assert.equal(queries, 0)
})


test('existing Air agent-only edit reaches save without catalog and preserves reviewed details', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'AirConsol'
  q.original.value = q.snapshot()
  q.root.eligibleAgents.value = [{ id: 'NEW-AIR-AGENT' }]
  q.root.form.agentId = 'NEW-AIR-AGENT'
  q.root.rateLines.value[0].costAmount = 555
  q.root.rateLines.value[0].saleAmount = 777
  q.root.rateLines.value.push({ key: 'manual:extra', manual: true, included: true, costAmount: 20, saleAmount: 30 })
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  const before = JSON.stringify(q.root.rateLines.value)
  assert.equal(await q.verify(), true)
  assert.equal(await q.verify(), true)
  assert.equal(queries, 0)
  assert.equal(JSON.stringify(q.root.rateLines.value), before)
  assert.deepEqual(Array.from(q.requested()), [])
  q.root.form.destinationId = 'NEW-POE'
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
})

test('invalid Air agent never bypasses cost verification', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'Air'
  q.original.value = q.snapshot()
  q.root.form.agentId = 'NOT-ELIGIBLE'
  q.root.eligibleAgents.value = [{ id: 'OTHER' }]
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
})


test('air revision with agent AND weight changes persists reviewed unit prices without catalog', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'AirConsol'
  q.root.form.cargoWeightKg = 100
  q.root.form.cargoPackages = 2
  q.original.value = q.snapshot()
  q.root.eligibleAgents.value = [{ id: 'AIR-AGENT' }]
  q.root.form.agentId = 'AIR-AGENT'
  q.root.form.cargoWeightKg = 240
  q.root.form.cargoPackages = 4
  q.root.rateLines.value[0].chargeBasis = 'PerKg'
  q.root.rateLines.value[0].costAmount = 4
  q.root.rateLines.value[0].saleAmount = 6
  q.root.explicitlyRemovedPersistedDetailIds.value.add('D')
  q.root.rateLines.value = q.root.rateLines.value.filter((line: any) => line.detailId !== 'D')
  q.root.rateLines.value.push({ key: 'manual:extra', manual: true, included: true, costAmount: 20, saleAmount: 30 })
  const before = JSON.stringify(q.root.rateLines.value)
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.apply(), true)
  assert.equal(await q.verify(), true)
  assert.equal(queries, 0)
  assert.equal(JSON.stringify(q.root.rateLines.value), before)
  assert.equal(q.root.form.cargoWeightKg, 240)
  assert.deepEqual(Array.from(q.requested()), [])
  q.root.form.serviceIds.push('ADUANAS')
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
})

test('air weight-only edit does not require master catalog; route and invalid agent still do', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'Air'
  q.root.form.cargoWeightKg = 100
  q.original.value = q.snapshot()
  q.root.form.cargoWeightKg = 180
  let queries = 0
  q.root.loadApplicableCosts = async () => { queries++; return false }
  assert.equal(await q.verify(), true)
  assert.equal(queries, 0)
  q.root.form.agentId = 'NOT-ELIGIBLE'
  assert.equal(await q.verify(), false)
  assert.equal(queries, 2)
  q.root.form.agentId = 'WWL'
  q.root.form.originId = 'OTHER-POL'
  assert.equal(await q.verify(), false)
  assert.equal(queries, 4)
})

test('air invalid negative weight does not use the reviewed-price preservation path', async () => {
  const q = fixture()
  q.root.form.modality = 'Air'
  q.root.shipmentModeForApi.value = 'Air'
  q.root.form.cargoWeightKg = 100
  q.original.value = q.snapshot()
  q.root.form.cargoWeightKg = -1
  q.root.loadApplicableCosts = async () => false
  assert.equal(await q.verify(), false)
})


test('FTL agent-only edit preserves priced foreign customs, manual DUCA and freight', async () => {
  const q = fixture()
  Object.assign(q.root.form, { modality: 'Land', shipmentMode: 'FTL', originId: 'HN',
    destinationId: 'CR', podId: '', carrierId: 'TIGSA', agentId: 'GCF', portHandlingMode: '',
    serviceIds: ['FOREIGN', 'TRANSPORT', 'PICKUP'] })
  q.root.shipmentModeForApi.value = 'Ftl'
  q.root.eligibleAgents.value = [{id:'GCF'}, {id:'NEW'}]
  const rows = [
    {id:'F', detailId:'F', name:'Flete internacional terrestre', costDetailType:'Freight', costId:null, costAmount:1600, saleAmount:1695},
    {id:'AD', detailId:'AD', name:'Agencia de Aduanas Exterior', costDetailType:'DestinationCharge', costId:'FOREIGN-COST', costAmount:95, saleAmount:145},
    {id:'DUCA', detailId:'DUCA', name:'DUCA - F', costDetailType:'OriginCharge', costId:null, manual:true, costAmount:70, saleAmount:85},
    {id:'T', detailId:'T', name:'DUCA-T', costDetailType:'OriginCharge', costId:'DUCAT', costAmount:30, saleAmount:85},
  ].map(line => ({...line, key:'existing:'+line.id, costType:'Variable', chargeBasis:'PerShipment', included:true}))
  q.root.editingRate.value.rateDetails = rows
  q.root.rateLines.value = rows.map(line => ({...line}))
  q.root.allCosts.value = [{id:'FOREIGN-COST', agentId:'GCF', services:[{id:'FOREIGN'}]}]
  q.original.value = q.snapshot()
  q.root.form.carrierId = ''
  q.root.form.agentId = 'NEW'
  let calls = 0
  q.root.loadApplicableCosts = async () => { calls++; return false }
  assert.equal(await q.apply(), true)
  assert.equal(await q.verify(), true)
  assert.equal(calls, 0)
  assert.deepEqual(q.root.rateLines.value.map((line:any) => [line.detailId,line.costAmount,line.saleAmount]),
    rows.map(line=>[line.detailId,line.costAmount,line.saleAmount]))
  q.root.form.agentId = 'INVALID'
  assert.equal(await q.verify(), false)
  q.root.form.agentId = 'NEW'
  q.root.form.originId = 'PA'
  assert.equal(await q.verify(), false)
})


test('seller amendment: declared value creates a missing insurance charge even when service was already selected', async () => {
  const q = fixture()
  q.root.form.shipmentMode = 'LCL'
  q.root.shipmentModeForApi.value = 'Lcl'
  q.root.form.serviceIds.push('SEGURO')
  q.root.cargoInsuranceSelected.value = true
  q.original.value = q.snapshot()
  q.root.form.cargoValue = 4020.2
  q.root.loadApplicableCosts = async () => { q.root.costs.value = []; return true }
  assert.equal(await q.apply(), true)
  const lines = q.root.rateLines.value.filter((line: any) => line.costDetailType === 'Insurance')
  assert.equal(lines.length, 1)
  assert.equal(lines[0].included, true)
  assert.equal(lines[0].costAmount, 30)
  assert.equal(lines[0].saleAmount, 45)
  assert.equal(lines[0].serviceIds[0], 'SEGURO')
  assert.deepEqual(q.root.rateLines.value.slice(0, 2).map((line: any) => [line.detailId, line.costAmount, line.saleAmount]),
    [['F', 5300, 5800], ['D', 225, 290]])
  lines[0].saleAmount = 55
  assert.equal(await q.apply(), true)
  assert.equal(q.root.rateLines.value.filter((line: any) => line.costDetailType === 'Insurance').length, 1)
  assert.equal(lines[0].saleAmount, 55)
})

test('seller LCL insurance-only amendment with unavailable cost catalog can proceed without repricing original charges', async () => {
  const q = fixture()
  q.root.props.modificationRequestId = 'seller-request'
  q.root.form.modality = 'Maritime'
  q.root.shipmentModeForApi.value = 'Lcl'
  q.root.form.carrierId = ''
  q.root.form.agentId = 'Pier17'
  q.root.form.cargoValue = 0
  q.original.value = q.snapshot()
  q.root.form.cargoValue = 4020.2
  q.root.form.serviceIds.push('SEGURO')
  let calls = 0
  q.root.loadApplicableCosts = async () => { calls++; return false }
  q.root.syncSellerModificationInsurance = () => {
    if (!q.root.rateLines.value.some((line: any) => line.costDetailType === 'Insurance'))
      q.root.rateLines.value.push({ key: 'quote-edit:insurance', costDetailType: 'Insurance', included: true, costAmount: 35, saleAmount: 95 })
  }
  assert.equal(await q.apply(), true)
  assert.equal(await q.verify(), true)
  assert.equal(calls, 0)
  assert.equal(q.root.rateLines.value.length, 3)
  assert.equal(q.root.rateLines.value[0].saleAmount, 5800)
  q.root.form.agentId = 'OTHER'
  assert.equal(await q.apply(), false)
  assert.ok(calls > 0)
})
