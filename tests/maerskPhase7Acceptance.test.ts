import assert from 'node:assert/strict'
import test from 'node:test'
import {
  visibleMaerskAlerts,
  canAcknowledgeMaerskAlert,
  canResetMaerskCircuit,
} from '../src/modules/agent/utils/maerskAlertPolicy.ts'

const baseAlert = {
  id: '4ad01a64-a255-488f-8776-5661fa1de0cf',
  key: 'provider-access',
  code: 'maersk_provider_verification_required',
  severity: 'Critical' as const,
  state: 'Active' as const,
  firstSeenAtUtc: '2026-10-09T00:00:00Z',
  lastSeenAtUtc: '2026-10-09T00:01:00Z',
  resolvedAtUtc: null,
  acknowledgedAtUtc: null,
}

const monitoring = {
  monitoringEnabled: true,
  observedAtUtc: '2026-10-09T00:02:00Z',
  failedInWindow: 0,
  queuedOverThreshold: 0,
  runningOverThreshold: 0,
  oldestQueuedAtUtc: null,
  lastCompletedAtUtc: null,
  alerts: [baseAlert],
}

test('phase 7: acknowledgement is visible only for an unacknowledged active incident and authorized operator', () => {
  assert.equal(canAcknowledgeMaerskAlert(true, monitoring, baseAlert), true)
  assert.equal(canAcknowledgeMaerskAlert(false, monitoring, baseAlert), false)
  assert.equal(canAcknowledgeMaerskAlert(true, null, baseAlert), false)
  assert.equal(canAcknowledgeMaerskAlert(true, { ...monitoring, monitoringEnabled: false }, baseAlert), false)
  assert.equal(canAcknowledgeMaerskAlert(true, monitoring, { ...baseAlert, state: 'Resolved' }), false)
  assert.equal(canAcknowledgeMaerskAlert(true, monitoring, { ...baseAlert, acknowledgedAtUtc: '2026-10-09T00:10:00Z' }), false)
  assert.equal(canAcknowledgeMaerskAlert(true, monitoring, undefined), false)
})

test('phase 7: disabled monitoring hides stale persisted alerts instead of implying availability', () => {
  assert.equal(visibleMaerskAlerts(monitoring).length, 1)
  assert.deepEqual(visibleMaerskAlerts({
    ...monitoring,
    alerts: [baseAlert, { ...baseAlert, id: 'other', state: 'Resolved' }],
  }).map((a) => a.id), [baseAlert.id])
  assert.deepEqual(visibleMaerskAlerts({ ...monitoring, monitoringEnabled: false }), [])
  assert.deepEqual(visibleMaerskAlerts(null), [])
})

test('phase 7: circuit reset stays disabled if feature off, no operator scope or Closed', () => {
  assert.equal(canResetMaerskCircuit(true, true, 'Open'), true)
  assert.equal(canResetMaerskCircuit(true, true, 'HalfOpen'), true)
  assert.equal(canResetMaerskCircuit(false, true, 'Open'), false)
  assert.equal(canResetMaerskCircuit(true, false, 'Open'), false)
  assert.equal(canResetMaerskCircuit(true, true, 'Closed'), false)
  assert.equal(canResetMaerskCircuit(true, undefined, 'Open'), false)
})

test('phase 7: API and UI keep operator acknowledgment separate from circuit reset', async () => {
  const { readFile } = await import('node:fs/promises')
  const view = await readFile(new URL('../src/modules/agent/views/MaerskOperationsView.vue', import.meta.url), 'utf8')
  const service = await readFile(new URL('../src/core/services/agentService.ts', import.meta.url), 'utf8')
  const scopes = await readFile(new URL('../src/modules/agent/composables/useAgentPermissions.ts', import.meta.url), 'utf8')
  const endpoints = await readFile(new URL('../src/core/composables/endpoints.ts', import.meta.url), 'utf8')
  assert.match(view, /canAcknowledgeMaerskAlert\(/)
  assert.match(view, /canResetMaerskCircuit\(/)
  assert.match(view, /!resetValid\.value/)
  assert.match(view, /verifiedWithProvider\.value/)
  assert.match(service, /acknowledgeAlert\(alertId: string\)/)
  assert.match(service, /resetCircuit\(providerId: string, reason: string, verifiedWithProvider: boolean\)/)
  assert.match(scopes, /AGENT_SCOPES\.browserProfiles\.authenticate/)
  assert.match(endpoints, /\/maersk\/alerts\/\{\{alertId\}\}\/acknowledge/)
  assert.equal(view.includes('v-html'), false)
})
