import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sellerDashboardRatesPath } from '../src/modules/dashboard/utils/sellerDashboardRatesPath.ts'
import { commercialPerformancePercent } from '../src/modules/dashboard/utils/commercialDashboardMetrics.ts'

const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('solo la supervisión autorizada recibe sellerUserId para usar la cartera personal del vendedor', () => {
  const seller = '30571c8c-80bc-46a3-85bb-932e4152ffcb'
  assert.equal(sellerDashboardRatesPath(false, seller), '/api/pricing/seller-rates')
  assert.equal(sellerDashboardRatesPath(true, ''), '/api/pricing/seller-rates/dashboard')
  assert.equal(sellerDashboardRatesPath(true, seller), '/api/pricing/seller-rates/dashboard?sellerUserId=' + seller)
})

test('supervisión no recorta tarifas sin RateRequest ni reutiliza el vendedor anterior', () => {
  const dashboard = source('src/modules/dashboard/components/SellerRoleDashboard.vue')
  assert.match(dashboard, /sellerDashboardRatesPath\(props.adminPreview, props.filterSeller\)/)
  assert.match(dashboard, /sellerDashboardRatesPath\(props.adminPreview, requestedSellerId\)/)
  assert.doesNotMatch(dashboard, /allowedRateIds/)
  assert.match(dashboard, /watch\(\(\) => props.filterSeller/)
  assert.match(dashboard, /if \(token !== sellerLoadToken\) return/)
  assert.match(dashboard, /request.sellerUserId !== props.filterSeller/)
})

test('el score permanece consistente con la misma base, incluidas rechazadas y vencidas', () => {
  // Las dos vistas deben mostrar la misma cifra para los mismos estados y período.
  const statuses = { accepted: 29, sent: 15, rejected: 13, expired: 13, open: 2 }
  const total = Object.values(statuses).reduce((a, b) => a + b, 0)
  const expected = (29 - 13) / (total - statuses.open) * 100
  assert.equal(commercialPerformancePercent(total, statuses.open, statuses.accepted, statuses.expired), expected)
  assert.equal(commercialPerformancePercent(31, 0, 3, 5), (3 - 5) / 31 * 100)
})
