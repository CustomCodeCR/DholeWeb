import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8')

test('Maersk operations use the authenticated Agent API and explicit contracts', async () => {
  const [endpoint, service, types] = await Promise.all([
    source('../src/core/composables/endpoints.ts'),
    source('../src/core/services/agentService.ts'),
    source('../src/core/interfaces/agent.ts'),
  ])
  assert.match(endpoint, /\/api\/agents\/maersk\/operations/)
  assert.match(endpoint, /\/api\/agents\/maersk-circuit\/\{\{providerId\}\}\/reset/)
  assert.match(service, /maerskOperations/)
  assert.match(service, /verifiedWithProvider/)
  assert.match(types, /interface MaerskOperationsDto/)
  assert.equal(/\bfetch\s*\(/.test(service), false)
})

test('Maersk console requires both view permissions and verified operator reset', async () => {
  const [route, sidebar, permissions, view] = await Promise.all([
    source('../src/core/router/index.ts'),
    source('../src/core/composables/useSidebarItems.ts'),
    source('../src/modules/agent/composables/useAgentPermissions.ts'),
    source('../src/modules/agent/views/MaerskOperationsView.vue'),
  ])
  assert.match(route, /path: 'agents\/maersk'/)
  assert.match(route, /requiredAllScopes: \[VIEW_SCOPES\.agentExecutions, VIEW_SCOPES\.agentBrowserProfiles\]/)
  assert.match(sidebar, /requiredAllScopes: \['agent\.executions\.view', 'agent\.browser-profiles\.view'\]/)
  assert.match(permissions, /canResetMaerskCircuit/)
  assert.match(view, /verifiedWithProvider\.value && operatorReason\.value\.trim\(\)\.length >= 12/)
  assert.match(view, /canReset\.value \|\| !resetValid\.value/)
  assert.match(view, /document\.hidden/)
  assert.match(view, /onUnmounted/)
  assert.match(view, /clearInterval/)
  assert.equal(view.includes('v-html'), false)
  for (const secret of ['storagePath', 'inputJson', 'outputJson', 'password', 'cookies']) {
    assert.equal(view.includes(secret), false, `Do not expose ${secret} in operator console.`)
  }
})

test('Maersk console contains localized operational and safety labels', async () => {
  const [es, en] = await Promise.all([
    source('../src/core/i18n/es.json'), source('../src/core/i18n/en.json'),
  ])
  for (const language of [es, en]) {
    const translation = JSON.parse(language).maerskOperations
    for (const key of [
      'title', 'noAccess', 'disabledWarning', 'operatorRequired',
      'resetExplanation', 'verified', 'operatorReason', 'resetFailed',
    ]) {
      assert.ok(translation[key]?.length > 0, `Missing translation: ${key}`)
    }
  }
})


test('Phase 6 monitoring alerts remain separated from circuit reset and require operator scopes', async () => {
  const [view, endpoints, service, contracts] = await Promise.all([
    source('../src/modules/agent/views/MaerskOperationsView.vue'),
    source('../src/core/composables/endpoints.ts'),
    source('../src/core/services/agentService.ts'),
    source('../src/core/interfaces/agent.ts'),
  ])
  assert.match(contracts, /interface MaerskMonitoringDto/)
  assert.match(contracts, /interface MaerskHealthAlertDto/)
  assert.match(endpoints, /\/api\/agents\/maersk\/alerts\/\{\{alertId\}\}\/acknowledge/)
  assert.match(service, /acknowledgeAlert\(alertId: string\)/)
  assert.match(view, /permissions\.canResetMaerskCircuit\.value/)
  assert.match(view, /monitoringEnabled/)
  assert.match(view, /acknowledgedAtUtc/)
  assert.match(view, /acknowledgeAlert\(alert\.id\)/)
  assert.match(view, /activeHealthAlerts/)
  for (const secret of ['storagePath', 'inputJson', 'outputJson', 'password', 'cookies']) {
    assert.equal(view.includes(secret), false, `Monitoring console should never expose ${secret}`)
  }
})

test('Phase 6 has translated severity, alert keys and operator acknowledgement warning', async () => {
  const [es, en] = await Promise.all([
    source('../src/core/i18n/es.json'), source('../src/core/i18n/en.json'),
  ])
  for (const file of [es, en]) {
    const t = JSON.parse(file).maerskMonitoring
    assert.ok(t.title && t.disabledHelp && t.ackNote && t.ackFailed)
    assert.deepEqual(Object.keys(t.severity).sort(), ['Critical', 'Warning'])
    for (const code of [
      'provider-access', 'half-open-stalled', 'browser-profile-blocked',
      'queue-backlog', 'running-stalled', 'execution-failure-spike',
    ]) assert.ok(t.codes[code]?.length > 0, `Missing ${code} in translations`)
  }
})

test('Phase 2 displays Disabled neutrally rather than green Closed when protection is off', async () => {
  const [types, view] = await Promise.all([
    source('../src/core/interfaces/agent.ts'),
    source('../src/modules/agent/views/MaerskOperationsView.vue'),
  ])
  assert.match(types, /'Disabled' \| 'Closed'/)
  assert.match(types, /persistedState/)
  assert.match(view, /!circuit\?\.featureEnabled/)
  assert.match(view, /\? 'neutral' : badgeVariant/)
  assert.match(view, /ShieldCheck v-else-if="circuit\?\.featureEnabled/)
})

test('Phase 5 profile health and waiting queue are scope-protected and never expose secrets', async () => {
  const [endpoints, service, types, view] = await Promise.all([
    source('../src/core/composables/endpoints.ts'),
    source('../src/core/services/agentService.ts'),
    source('../src/core/interfaces/agent.ts'),
    source('../src/modules/agent/views/MaerskOperationsView.vue'),
  ])
  for (const path of [
    '/api/agents/maersk/profiles/{{profileId}}/health',
    '/api/agents/maersk/executions/waiting',
    '/api/agents/maersk/executions/{{executionId}}/resume',
  ]) assert.ok(endpoints.includes(path), `Missing backend path: ${path}`)
  assert.match(service, /profileHealth\(profileId: string\)/)
  assert.match(service, /waitingExecutions\(\)/)
  assert.match(service, /resumeExecution\(executionId: string, reason: string, verifiedWithProvider: boolean\)/)
  assert.match(types, /interface MaerskProfileHealthDto/)
  assert.match(types, /interface MaerskWaitingExecutionDto/)
  assert.match(view, /selectedHealth\.nextAction/)
  assert.match(view, /waitingExecutions\.value = waiting/)
  assert.match(view, /permissions\.canCreateExecutions\.value/)
  assert.match(view, /resumeVerified\.value/)
  assert.match(view, /resumeReason\.value\.trim\(\)\.length >= 12/)
  assert.equal(view.includes('v-html'), false)
  for (const secret of ['storagePath', 'inputJson', 'outputJson', 'password', 'cookies']) {
    assert.equal(view.includes(secret), false, `Sensitive data in console: ${secret}`)
  }
})

test('Phase 5 safe recovery actions are translated into both languages', async () => {
  const [es, en] = await Promise.all([
    source('../src/core/i18n/es.json'), source('../src/core/i18n/en.json'),
  ])
  for (const raw of [es, en]) {
    const t = JSON.parse(raw).maerskOperations
    for (const key of [
      'profileHealth', 'environment', 'nextSafeAction', 'lastSuccess',
      'manualVerificationNote', 'waitingQueue', 'resume', 'confirmResume',
      'resumeExplanation', 'resumeFailed', 'resumeSuccess',
    ]) assert.ok(t[key]?.length > 0, `Missing translation ${key}`)
    for (const action of [
      'CircuitNotEnabled', 'VerifyProviderManually', 'AuthenticateOriginalProfile',
      'ReviewTechnicalRepair', 'WaitForCircuit', 'ReviewWaitingExecution',
      'SessionRecordedAsAuthenticated', 'ReviewSession',
    ]) assert.ok(t.actions[action]?.length > 0, `Missing safe action ${action}`)
  }
})

test('Phase 5 rollout preserves existing Maersk console before new Agent API is available', async () => {
  const [view, es, en] = await Promise.all([
    source('../src/modules/agent/views/MaerskOperationsView.vue'),
    source('../src/core/i18n/es.json'),
    source('../src/core/i18n/en.json'),
  ])
  assert.match(view, /recoveryApiAvailable\.value = false/)
  assert.match(view, /recoveryApiAvailable\.value = true/)
  assert.match(view, /details\.value = await AgentService\.maerskOperations\.get\(\)/)
  assert.match(view, /v-if="recoveryApiAvailable"/)
  assert.match(view, /recoveryApiAvailable\.value &&/)
  assert.ok(JSON.parse(es).maerskOperations.apiUnavailable)
  assert.ok(JSON.parse(en).maerskOperations.apiUnavailable)
})
