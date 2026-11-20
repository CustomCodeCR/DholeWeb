import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dashboard = readFileSync(new URL('../src/modules/dashboard/views/DashboardView.vue', import.meta.url), 'utf8')
const approval = readFileSync(new URL('../src/modules/pricing/components/PricingExpiredRateApprovalModal.vue', import.meta.url), 'utf8')
const pricingService = readFileSync(new URL('../src/modules/pricing/services/expiredRateApprovalService.ts', import.meta.url), 'utf8')

test('a seller approver has an inbox on their own dashboard without Pricing roles', () => {
  assert.match(dashboard, /jmesen@castrofallas\.com/)
  assert.match(dashboard, /rsibaja@castrofallas\.com/)
  assert.match(dashboard, /v-if="canApproveExpiredRates"/)
  assert.match(dashboard, /Revisar solicitudes/)
  assert.match(dashboard, /component: PricingExpiredRateApprovalModal/)
  assert.match(dashboard, /mode: 'review'/)
  // Approval eligibility is based on the signed-in email, not a Pricing scope.
  const approverDefinition = dashboard.split('const canApproveExpiredRates = computed')[1]?.split('const pendingExpiredApprovals')[0] ?? ''
  assert.doesNotMatch(approverDefinition, /hasScope|hasRole|PRICING_SCOPES/)
})

test('both seller and Pricing managers see count updates from realtime notifications', () => {
  assert.match(dashboard, /expiredRateApprovalService\.pending\(\)\)\.length/)
  assert.match(dashboard, /dhole:notification:received/)
  assert.match(dashboard, /startsWith\('pricing\.rate\.expired-update\.'\)/)
  assert.match(dashboard, /route\.query\.expiredApprovals/)
  assert.match(dashboard, /openExpiredApprovalInbox\(\)/)
})

test('approver sees the same secure approval modal regardless of role', () => {
  assert.match(approval, /expiredRateApprovalService\.decide\(item\.id, approve, comment\)/)
  assert.match(pricingService, /\/expired-rate-updates\/pending/)
})
