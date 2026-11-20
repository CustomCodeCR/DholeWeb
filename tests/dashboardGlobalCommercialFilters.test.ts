import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { commercialPerformancePercent, isInDashboardDateRange } from '../src/modules/dashboard/utils/commercialDashboardMetrics.ts'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('las fechas son inclusivas y sin desplazamiento UTC en entradas date-only', () => {
  assert.equal(isInDashboardDateRange('2026-11-19', '2026-11-19', '2026-11-19'), true)
  assert.equal(isInDashboardDateRange('2026-11-18', '2026-11-19', '2026-11-19'), false)
  assert.equal(isInDashboardDateRange('2026-11-20', '2026-11-19', '2026-11-19'), false)
})
test('vencidas penalizan y el desempeño puede quedar negativo', () => {
  assert.equal(commercialPerformancePercent(10, 2, 3, 1), 40)
  assert.equal(commercialPerformancePercent(10, 1, 1, 5), -30)
  assert.equal(commercialPerformancePercent(0, 0, 0, 0), 0)
})
test('dashboard comercial comparte filtros entre métricas y reportería', () => {
  const view = read('src/modules/dashboard/views/DashboardView.vue')
  const seller = read('src/modules/dashboard/components/SellerRoleDashboard.vue')
  const report = read('src/modules/dashboard/components/RateOperationalReportsPanel.vue')
  assert.match(view, /Filtros generales del dashboard/)
  assert.match(view, /:filter-seller="globalFilters.seller"/)
  assert.match(view, /:filter-mode="globalFilters.mode"/)
  assert.match(seller, /props.filterMode/)
  assert.match(seller, /props.filterFrom/)
  assert.match(report, /selectedSeller.value/)
  assert.match(report, /isInDashboardDateRange\(row.createdAtUtc/)
  assert.match(seller, /status === 'Sent' \|\| status === 'Expired'/)
  assert.match(seller, /totals.quoted = totals.accepted \+ totals.inClientReview \+ totals.inPreparation \+ totals.rejected/)
})
