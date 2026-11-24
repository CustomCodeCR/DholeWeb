import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('operations reuses shared tables, prioritizes validation and retains quote and ACL guards', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  assert.match(detail, /<DhDataTable :columns="costColumns" :rows="costRows"/)
  assert.match(detail, /auth.hasScope\('operations.cost.read'\)/)
  assert.match(detail, /<OperationsApertureValidationPanel/)
  assert.match(detail, /costTotals/)
  assert.doesNotMatch(detail, /Opción comercial aceptada: \{\{ quote.quoteOptionId/)
  assert.match(detail, /dh-responsive-tabs dh-scrollbar/)
})
test('shared drawer uses opaque theme background and operations uses shared responsive table', () => {
  const drawer = read('src/shared/components/organisms/DhDrawer.vue')
  assert.match(drawer, /bg-\[var\(--dh-bg\)\]/)
  assert.match(drawer, /<slot name="footer"\s*\/>/)
  const dashboard = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  assert.match(dashboard, /<DhDataTable v-else :columns="recentColumns"/)
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(cases, /label="Procedencia"/)
  assert.match(cases, /openingText\('weightValue'\)/)
})
