import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('rate export uses the category report format and includes the selected statuses', () => {
  const source = readFileSync(new URL('../src/modules/pricing/views/PricingRatesView.vue', import.meta.url), 'utf8')
  const body = source.slice(source.indexOf('async function exportCommercialExcel()'), source.indexOf('function applyFilters()'))
  assert.ok(body.includes("params.set('includeAllStatuses', 'true')"))
  assert.ok(body.includes("params.set('categoryReport', 'true')"))
  assert.ok(source.includes('authStore.hasScope(PRICING_SCOPES.rates.exportReport)'))
  assert.ok(source.includes('v-if="canExportCategoryReport"'))
  assert.ok(body.includes("params.set('status', selectedFilters.statuses.join(','))"))
  assert.ok(body.includes("params.set('dateType', 'created')"))
  assert.ok(body.includes('/api/pricing/rates/commercial-report.xlsx'))
  assert.ok(!body.includes('pageSize'))
  assert.ok(!body.includes('basic-report.xlsx'))
})
