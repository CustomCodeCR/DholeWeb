import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('operations reuses shared tables, prioritizes validation and retains quote and ACL guards', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  assert.match(detail, /<DhDataTable :columns="costColumns" :rows="costRows"/)
  assert.match(detail, /auth.hasScope\('operations.cost.read'\)/)
  assert.match(detail, /<OperationsApertureValidationPanel/)
  assert.match(detail, /missingCostProviders/)
  assert.doesNotMatch(detail, /Opción comercial aceptada: \{\{ quote.quoteOptionId/)
  assert.match(detail, /<DhTabs :model-value="selectedTab"/)
})
test('shared drawer uses opaque theme background and operations uses shared responsive table', () => {
  const drawer = read('src/shared/components/organisms/DhDrawer.vue')
  assert.match(drawer, /bg-\[var\(--dh-bg\)\]/)
  assert.match(drawer, /<slot name="footer"\s*\/>/)
  const dashboard = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  assert.match(dashboard, /<DhDataTable v-else :columns="recentColumns"/)
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(cases, /label="Procedencia"/)
  assert.match(cases, /openingText\('clientPoReference'\)/)
})

test('accepted commercial data uses actual quote number, scoped snapshot and readable labels', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  const helper = read('src/modules/operations/utils/commercialPresentation.ts')
  const audit = read('src/modules/operations/utils/operationsAudit.ts')
  assert.match(cases, /row\.quoteNumber/)
  assert.doesNotMatch(cases, />Ver QUO</)
  assert.match(detail, /snapshotCosts\.value\.length \? snapshotCosts\.value/)
  assert.match(detail, /auth\.hasScope\('operations\.finance\.manage'\)/)
  assert.match(api, /snapshotItems\?: OperationsSnapshotCost\[\]/)
  assert.match(helper, /rate\.revisionNumber !== quote\.snapshotVersion/)
  assert.match(helper, /normalizeIncotermCode/)
  assert.match(audit, /'quoteid', 'acceptedoptionid', 'sourceeventid'/)
})

test('automatic Aperturas pool displays every pending reviewer with authorized labels', () => {
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  assert.match(cases, /v-for="id in row.pendingValidatorIds"/)
  assert.match(cases, /result\.people/)
  assert.match(cases, /caseClientNames\[row.id\]/)
  assert.match(detail, /work\.people/)
  assert.match(api, /pendingValidatorIds\?: string\[\]/)
})

test('automatic opening requires only one approval and sends to Origin', () => {
  const panel = read('src/modules/operations/components/OperationsApertureValidationPanel.vue')
  const dashboard = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  assert.match(panel, /Tu aprobación enviará el expediente a Coordinación Origen/)
  assert.doesNotMatch(panel, /segunda aprobación|segundo operativo/)
  assert.match(dashboard, /Math\.min\(1, row\.approvedReviews\) \+ ' \/ 1'/)
})

test('commercial snapshot cost metadata and terms use shared controls and finance permission', () => {
  const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  assert.match(detail, /key: 'chargeBasis'/)
  assert.match(detail, /key: 'costDetailType'/)
  assert.match(detail, /auth\.hasScope\('operations\.finance\.manage'\) && commercialConditions/)
  assert.match(detail, /commercialConditions\.value = null/)
})
