import assert from 'node:assert/strict'
import test from 'node:test'
import { patchPricingStep7FixedCostsAndCustoms } from '../build/pricingStep7FixedCostsAndCustoms.ts'

const fixture = [
  '<script setup lang="ts">',
  "function isCrcCustomsService(service: CatalogItemSelectDto) {",
  "  const name = normalizeCatalogValue(displayValue(service))",
  "  return name.includes('agencia aduanas crc')",
  "    || name.includes('agencia aduanal crc')",
  "    || name.includes('servicio aduanas crc')",
  "    || name.includes('aduanas costa rica')",
  "}",
  "function rebuildLclColoaderAgentLines() {",
  "  const result: RateLine[] = []",
  "  rateLines.value = result",
  "}",
  '</script>',
  '<template>',
  '<DhInput v-model.number="line.costAmount" type="number" step="0.01" min="0" label="Costo" :disabled="props.viewOnly || (!(line.optional && !props.viewOnly) && (line.costDetailType === \'AgentCharge\' || line.costType !== \'Variable\'))" />',
  '<DhInput v-model.number="line.saleAmount" type="number" step="0.01" min="0" label="Venta" :disabled="line.costDetailType === \'AgentCharge\'" />',
  '</template>',
].join('\n')

test('fixed costs are enabled without lifting read-only or non-fixed restrictions', () => {
  const result = patchPricingStep7FixedCostsAndCustoms(fixture)
  assert.match(result, /line\.costType !== 'Fixed' && \(props\.viewOnly/)
  assert.match(result, /:disabled="props\.viewOnly \|\| \(line\.costType !== 'Fixed'/)
  assert.match(result, /min="0" label="Costo"/)
  assert.match(result, /v-model\.number="line\.saleAmount"/)
})

test('selected customs is independent from the maritime coloader', () => {
  const result = patchPricingStep7FixedCostsAndCustoms(fixture)
  assert.match(result, /syncSelectedColoaderCrcCustomsLine\(\)/)
  assert.match(result, /previous\.filter\(\(line\) => line\.costDetailType === 'Insurance'\)/)
  assert.match(result, /result\.some\(\(line\) => line\.costDetailType === 'Insurance'\)/)
  assert.match(result, /rateLines\.value = result\n  syncSelectedColoaderCrcCustomsLine\(\)\n  syncDeclaredCargoInsuranceOnEdit\(\)/)
  assert.match(result, /function selectedColoaderCrcCustomsCost/)
  assert.match(result, /function syncSelectedColoaderCrcCustomsLine/)
  assert.match(result, /customsCode === 'CUSTOMS_FOREIGN'/)
  assert.match(result, /if \(!configured\)/)
  assert.match(result, /ensureCrcCustomsLine\(rateLines\.value, currency\)/)
  assert.match(result, /costId: null/)
  assert.match(result, /form\.serviceIds\.join\('\|'\)/)
})

test('the patch fails on incompatible markup and is idempotent', () => {
  assert.equal(patchPricingStep7FixedCostsAndCustoms(patchPricingStep7FixedCostsAndCustoms(fixture)), patchPricingStep7FixedCostsAndCustoms(fixture))
  assert.throws(
    () => patchPricingStep7FixedCostsAndCustoms(fixture.replace('  rateLines.value = result', '  return result')),
    /Missing coloader assignment/,
  )
})


test('only Costa Rica customs activates the destination pricing requirement', () => {
  const result = patchPricingStep7FixedCostsAndCustoms(fixture)
  const fn = result.slice(result.indexOf('function isCrcCustomsService'), result.indexOf('function rebuildLclColoaderAgentLines'))
    .replace('service: CatalogItemSelectDto', 'service')
  const classify = new Function('normalizeCatalogValue', 'displayValue', fn + '\nreturn isCrcCustomsService')(
    (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bde\b/g, ' ').replace(/\s+/g, ' ').trim(),
    (service: { value: string }) => service.value,
  )
  const cases = [
    ['CUSTOMS_FOREIGN', 'Agencia de Aduanas Exterior', false],
    ['CUSTOMS_FOREIGN', 'Agencia de Aduanas Costa Rica', false],
    ['CUSTOMS_CR', 'Agencia de Aduanas CRC', true],
    ['CUSTOMS_CR', 'Servicio de Aduanas', true],
    ['LEGACY', 'Agencia de Aduanas Costa Rica', true],
    ['LEGACY', 'Customs clearance Costa Rica', true],
    ['LEGACY', 'Agencia de Aduanas Exterior', false],
    ['LEGACY', 'Trámite de exportación aduanas', false],
    ['LEGACY', 'Customs clearance', false],
    ['LEGACY', 'Servicio de aduanas', false],
    ['INT_TRANSPORT', 'Transporte Internacional', false],
  ] as const
  for (const [code, value, expected] of cases) assert.equal(classify({ code, value }), expected, value)
  const selected = [
    { code: 'CUSTOMS_FOREIGN', value: 'Agencia de Aduanas Exterior' },
    { code: 'INT_TRANSPORT', value: 'Transporte Internacional' },
    { code: 'PICKUP', value: 'Transporte recolección' },
  ]
  assert.equal(selected.find(classify), undefined)
  assert.equal([...selected, {code: 'CUSTOMS_CR', value: 'Agencia de Aduanas CRC'}].find(classify)?.code, 'CUSTOMS_CR')
})
