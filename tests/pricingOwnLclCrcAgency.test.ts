import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
import { readFileSync } from 'node:fs'

const pluginSource = readFileSync(
  new URL('../build/pricingWizardOwnLclLinePersistence.ts', import.meta.url), 'utf8',
)
const startTag = 'const OWN_LCL_AGENCY_COST_HELPERS = String.raw' + String.fromCharCode(96) + '\n'
const start = pluginSource.indexOf(startTag)
assert.ok(start >= 0, 'the own LCL custom service bridge must be present')
const end = pluginSource.indexOf('\n' + String.fromCharCode(96), start + startTag.length)
assert.ok(end > start, 'own LCL custom service bridge must be complete')
const code = pluginSource.slice(start + startTag.length, end)
const compiled = ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

const crc = { id: 'CRC', code: 'CRC', value: 'CRC' }
const usd = { id: 'USD', code: 'USD', value: 'USD' }
const target = {
  id: 'agency-cost',
  name: 'Servicio de agencia',
  costType: 'Fixed',
  costDetailType: 'DestinationCharge',
  shipmentMode: 'Lcl',
  shipmentModes: ['Lcl'],
  isActive: true,
  agentId: null,
  carrierId: null,
  polId: null, poeId: null, podId: null, portId: null,
  pols: [], poes: [], pods: [], agents: [], carriers: [], incoterms: [],
  services: [{ id: 'AGENCIA-CRC' }],
  currencyId: 'CRC', currencyName: 'CRC', currencyCode: 'CRC',
  chargeBasis: 'PerShipment',
  pricingRulesJson: JSON.stringify([
    { dimension: 'WeightKg', minValue: 1, maxValue: 500,
      calculationMode: 'Flat', costAmount: 40000, saleAmount: 40000 },
    { dimension: 'WeightKg', minValue: 501, maxValue: null,
      calculationMode: 'Flat', costAmount: 60000, saleAmount: 60000 },
  ]),
}
function fixture() {
  const freight = { key: 'own-matrix-freight', section: 'international_freight',
    costDetailType: 'Freight', costAmount: 100, saleAmount: 120, name: 'Flete internacional' }
  const originCustoms = { key: 'own-matrix-customs', section: 'origin_charges',
    costDetailType: 'CustomsCharge', name: 'CUSTOMS', costAmount: 25, saleAmount: 25 }
  const env: Record<string, any> = {
    props: { viewOnly: false },
    shipmentModeForApi: { value: 'Lcl' },
    isOwnLclMatrixContext: () => true,
    crcImportContext: { value: true },
    selectedCrcCustomsService: { value: { id: 'AGENCIA-CRC' } },
    visibleSections: { value: ['international_freight', 'origin_charges', 'destination_charges'] },
    lclSelectedSource: { value: { kind: 'Own' } },
    allCosts: { value: [target] }, costs: { value: [] },
    costContextPoeId: () => 'BALBOA',
    costContextAgentId: () => '',
    costSpecificity: () => 0,
    selectedCurrency: { value: usd },
    selectedEquipment: { value: null },
    catalogs: { currencies: [usd, crc] },
    crcCurrency: { value: crc },
    findById: (items: any[], id: string) => items.find((x) => x.id === id),
    displayValue: (item: { value: string }) => item?.value,
    normalizeCatalogValue: (v: string) => String(v ?? '').toLowerCase(),
    costContextLabel: () => 'Agencia aduanal Costa Rica',
    isCrcCustomsLine: (line: { section: string; costDetailType: string; name: string; serviceIds?: string[] },
      serviceId: string) => line.section === 'destination_charges'
      && (line.serviceIds?.includes(serviceId) ||
        /aduan|agencia/i.test(line.name)),
    form: {
      cargoWeightKg: 500, cargoPackages: 1, storageDays: 0,
      incotermId: 'FCA', originId: 'SHANGHAI', destinationId: 'BALBOA', podId: 'SAN_JOSE',
    },
    rateLines: { value: [freight, originCustoms] },
    resolveCostPricing: (cost: typeof target, cargo: { weightKg: number | null }) => {
      const weight = cargo.weightKg
      if (!weight) return null
      const rules = JSON.parse(cost.pricingRulesJson)
      return rules.find((rule: any) => weight >= rule.minValue
        && (rule.maxValue == null || weight <= rule.maxValue)) ?? null
    },
    ensureCrcCustomsLine: () => { throw Error('configured Cost should not use fallback') },
    number: (v: unknown) => Number(v) || 0,
  }
  const methods = vm.runInNewContext(compiled + '\n({ sync: syncOwnLclCrcAgencyLine })', env) as { sync: (force?: boolean) => void }
  return { env, ...methods }
}

test('LCL propio agrega la agencia aduanal CRC solicitada sin alterar la matriz', () => {
  const { env, sync } = fixture()
  sync()
  assert.deepEqual(env.rateLines.value.map((line: { name: string }) => line.name),
    ['Flete internacional', 'CUSTOMS', 'Servicio de agencia'])
  const agency = env.rateLines.value[2]
  assert.equal(agency.key, 'own-lcl-customs:agency-cost')
  assert.equal(agency.costDetailType, 'CustomsCharge')
  assert.equal(agency.costId, null)
  assert.equal(agency.currencyCode, 'CRC')
  assert.equal(agency.costAmount, 40000)
  assert.equal(agency.saleAmount, 40000)
  assert.deepEqual(Array.from(agency.serviceIds), ['AGENCIA-CRC'])
  assert.equal(env.rateLines.value[0].saleAmount, 120)
  assert.equal(env.rateLines.value[1].saleAmount, 25)
})

test('LCL propio no duplica la agencia al sincronizar o recalcular', () => {
  const { env, sync } = fixture()
  sync()
  sync()
  sync(true)
  assert.equal(env.rateLines.value.length, 3)
  assert.equal(env.rateLines.value.filter((line: { key: string }) =>
    line.key === 'own-lcl-customs:agency-cost').length, 1)
})

test('LCL propio preserva Manejos y los importes guardados', () => {
  const { env, sync } = fixture()
  env.rateLines.value.push({
    key: 'existing:SAVED', detailId: 'SAVED', costId: null,
    name: 'Manejos', section: 'destination_charges',
    costDetailType: 'DestinationCharge', currencyId: 'USD',
    currencyName: 'USD', currencyCode: 'USD',
    costAmount: 35, saleAmount: 65, included: true,
  })
  sync()
  sync(true)
  assert.equal(env.rateLines.value.length, 4)
  const saved = env.rateLines.value.find((line: { detailId?: string }) =>
    line.detailId === 'SAVED')
  assert.equal(saved?.costAmount, 35)
  assert.equal(saved?.saleAmount, 65)
})

test('LCL propio aplica el tramo Pricing por peso', () => {
  const { env, sync } = fixture()
  env.form.cargoWeightKg = 501
  sync()
  assert.equal(env.rateLines.value[2].saleAmount, 60000)
  env.form.cargoWeightKg = 500
  sync()
  assert.equal(env.rateLines.value[2].saleAmount, 40000)
  assert.equal(env.rateLines.value.length, 3)
})

test('no aparece agencia si no fue solicitada', () => {
  const { env, sync } = fixture()
  env.selectedCrcCustomsService.value = null
  sync()
  assert.equal(env.rateLines.value.length, 2)
})

test('agencia solicitada sin costo aplicable usa una línea editable sin precio inventado', () => {
  const { env, sync } = fixture()
  env.allCosts.value = []
  env.ensureCrcCustomsLine = (lines: Record<string, any>[]) => {
    if (lines.some((line) => line.key === 'service:customs-cr')) return
    lines.push({
      key: 'service:customs-cr', name: 'Servicio de aduanas (Costa Rica)',
      section: 'destination_charges', costDetailType: 'CustomsCharge',
      costId: null, costAmount: 0, saleAmount: 0, included: true,
      serviceIds: ['AGENCIA-CRC'],
    })
  }
  sync()
  sync()
  assert.equal(env.rateLines.value.length, 3)
  assert.equal(env.rateLines.value[2].key, 'service:customs-cr')
  assert.equal(env.rateLines.value[2].saleAmount, 0)
})

test('los filtros del plugin conservan la agencia para guardar y reabrir', () => {
  assert.ok(pluginSource.includes("selectedCrcCustomsService.value && (\\n"))
  assert.ok(pluginSource.includes("line.key === 'service:customs-cr'"))
  assert.ok(pluginSource.includes("startsWith('own-lcl-customs:')"))
  assert.ok(!pluginSource.includes("'function ensureCrcCustomsLine(lines: RateLine[], currency: CatalogItemSelectDto) {\\\\n  if (isOwnLclMatrixContext()) return'"))
})
