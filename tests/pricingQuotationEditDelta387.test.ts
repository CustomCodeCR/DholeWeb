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
  const operations = vm.runInContext(js + '\n({ snapshot: quoteEditContext387, original: quoteEditOriginalContext387, apply: quoteEditApplyDelta387, requested: quoteEditRequestedCosts387 })', ctx) as any
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
