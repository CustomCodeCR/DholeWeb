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
