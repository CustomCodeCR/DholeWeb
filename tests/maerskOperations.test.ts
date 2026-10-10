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
