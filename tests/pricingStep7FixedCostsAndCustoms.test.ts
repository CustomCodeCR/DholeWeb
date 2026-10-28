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
  assert.match(result, /function selectedColoaderCrcCustomsCost/)
  assert.match(result, /function syncSelectedColoaderCrcCustomsLine/)
  assert.match(result, /name\.includes\('customs clearance'\)/)
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
