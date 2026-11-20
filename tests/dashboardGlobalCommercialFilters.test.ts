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
test('desempeño comercial usa todas las cotizadas salvo abiertas, con rechazadas y vencidas en la base', () => {
  // 3 aceptadas, 2 abiertas (aún no entregadas), 1 vencida y 4 más
  assert.equal(commercialPerformancePercent(10, 2, 3, 1), 25)
  // 1 aceptada, 1 abierta y 5 vencidas: desempeño negativo
  assert.ok(Math.abs(commercialPerformancePercent(10, 1, 1, 5) - (-400 / 9)) < 0.000001)
  // 2 aceptadas, 2 abiertas, 1 vencida y 2 rechazadas: las rechazadas permanecen en el denominador
  assert.equal(commercialPerformancePercent(7, 2, 2, 1), 20)
  // Ninguna tarifa recibida por el vendedor; evitar división entre cero
  assert.equal(commercialPerformancePercent(5, 5, 0, 0), 0)
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
