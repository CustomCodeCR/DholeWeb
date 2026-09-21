import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  AGENT_ACTION_TYPES,
  AGENT_BROWSER_PROFILE_STATUSES,
  AGENT_EXECUTION_STATUSES,
  AGENT_EXECUTION_STRATEGIES,
  AGENT_PROVIDER_TYPES,
  AGENT_SCHEDULE_TYPES,
} from '../src/core/interfaces/agent.ts'
import { AGENT_SCOPES, VIEW_SCOPES } from '../src/core/auth/scopes.ts'

async function source(path: string) {
  return readFile(new URL(path, import.meta.url), 'utf8')
}

test('Agent contracts expose the backend enum values without duplicated variants', () => {
  assert.deepEqual(AGENT_PROVIDER_TYPES, ['Maersk', 'Msc', 'Pil', 'CmaCgm', 'HapagLloyd', 'GenericWeb'])
  assert.deepEqual(AGENT_EXECUTION_STRATEGIES, ['Browser', 'BrowserNetworkCapture', 'Hermes', 'Hybrid'])
  assert.deepEqual(AGENT_ACTION_TYPES, ['SearchOceanRates', 'Authenticate', 'GenericExtraction'])
  assert.deepEqual(AGENT_SCHEDULE_TYPES, ['Once', 'Interval', 'Cron'])
  assert.deepEqual(AGENT_EXECUTION_STATUSES, [
    'Pending',
    'Queued',
    'Running',
    'WaitingForAuthentication',
    'Completed',
    'PartiallyCompleted',
    'Failed',
    'Cancelled',
  ])
  assert.deepEqual(AGENT_BROWSER_PROFILE_STATUSES, [
    'Unknown',
    'Ready',
    'LoginRequired',
    'Authenticating',
    'Authenticated',
    'Expired',
    'Blocked',
    'Error',
  ])
})

test('Agent scopes and route visibility use the granular backend permissions', async () => {
  assert.equal(AGENT_SCOPES.providers.view, 'agent.providers.view')
  assert.equal(AGENT_SCOPES.providers.manage, 'agent.providers.manage')
  assert.equal(AGENT_SCOPES.definitions.view, 'agent.definitions.view')
  assert.equal(AGENT_SCOPES.credentials.manage, 'agent.credentials.manage')
  assert.equal(AGENT_SCOPES.browserProfiles.authenticate, 'agent.browser-profiles.authenticate')
  assert.equal(AGENT_SCOPES.schedules.execute, 'agent.schedules.execute')
  assert.equal(AGENT_SCOPES.schedules.delete, 'agent.schedules.delete')
  assert.equal(AGENT_SCOPES.executions.cancel, 'agent.executions.cancel')
  assert.equal(VIEW_SCOPES.agentProviders, AGENT_SCOPES.providers.view)
  assert.equal(VIEW_SCOPES.agentExecutions, AGENT_SCOPES.executions.view)

  const permissions = await source('../src/modules/agent/composables/useAgentPermissions.ts')
  for (const fragment of [
    'AGENT_SCOPES.providers.manage',
    'AGENT_SCOPES.definitions.manage',
    'AGENT_SCOPES.credentials.manage',
    'AGENT_SCOPES.browserProfiles.authenticate',
    'AGENT_SCOPES.schedules.create',
    'AGENT_SCOPES.schedules.update',
    'AGENT_SCOPES.schedules.execute',
    'AGENT_SCOPES.executions.create',
    'AGENT_SCOPES.executions.cancel',
  ]) assert.ok(permissions.includes(fragment), `Missing permission guard: ${fragment}`)
})

test('Schedule form enforces Once, Interval, Cron and JSON validation rules', async () => {
  const view = await source('../src/modules/agent/views/AgentSchedulesView.vue')
  assert.match(view, /scheduleType === 'Once'/)
  assert.match(view, /executeAt/)
  assert.match(view, /scheduleType === 'Interval'/)
  assert.match(view, /intervalMinutes/)
  assert.match(view, /scheduleType === 'Cron'/)
  assert.match(view, /cronExpression/)
  assert.match(view, /JSON\.parse/)
  assert.match(view, /maxRetries/)
  assert.match(view, /timeoutSeconds/)
  assert.match(view, /America\/Costa_Rica/)
})

test('Execution status badge maps every operational state to the expected visual family', async () => {
  const badge = await source('../src/modules/agent/components/AgentExecutionStatusBadge.vue')
  assert.match(badge, /status === 'Completed'.*return 'success'/s)
  assert.match(badge, /status === 'Running'.*return 'primary'/s)
  assert.match(badge, /status === 'Failed'.*return 'danger'/s)
  assert.match(badge, /status === 'Cancelled'.*return 'warning'/s)
  assert.match(badge, /status === 'PartiallyCompleted'.*return 'warning'/s)
  assert.match(badge, /status === 'WaitingForAuthentication'.*return 'warning'/s)
  assert.match(badge, /return 'neutral'/)
})

test('Ocean Freight output renderer recognizes rate fields, legs and charges', async () => {
  const rate = await source('../src/modules/agent/components/AgentRateResult.vue')
  for (const field of ['etd', 'eta', 'transitdays', 'vessel', 'voyage', 'oceanfreight', 'allin', 'currency']) {
    assert.ok(rate.toLowerCase().includes(`'${field}'`) || rate.toLowerCase().includes(`"${field}"`), `Missing Ocean Freight field: ${field}`)
  }
  assert.match(rate, /transitTime/)
  assert.match(rate, /priceBreakdown/)
  assert.match(rate, /legs/)
  assert.match(rate, /charges/)
  assert.match(rate, /<AgentJsonViewer v-else/)
})

test('Invalid JSON is rendered safely instead of breaking the Agent view', async () => {
  const viewer = await source('../src/modules/agent/components/AgentJsonViewer.vue')
  const rate = await source('../src/modules/agent/components/AgentRateResult.vue')
  assert.match(viewer, /JSON\.parse\(props\.value\)/)
  assert.match(viewer, /catch[\s\S]*return props\.value/)
  assert.equal(viewer.includes('v-html'), false)
  assert.match(rate, /catch[\s\S]*return null/)
  assert.match(rate, /<AgentJsonViewer v-else/)
})

test('Provider-aware forms filter definitions and credentials by provider', async () => {
  const dashboard = await source('../src/modules/agent/views/AgentDashboardView.vue')
  const schedules = await source('../src/modules/agent/views/AgentSchedulesView.vue')
  for (const view of [dashboard, schedules]) {
    assert.match(view, /definition\.providerId === .*providerId/)
    assert.match(view, /credential\.providerId === .*providerId/)
  }
})

test('Execution polling stops on terminal states, page hiding and unmount', async () => {
  const polling = await source('../src/modules/agent/composables/useAgentPolling.ts')
  for (const state of ['Pending', 'Queued', 'Running', 'WaitingForAuthentication']) {
    assert.ok(polling.includes(`'${state}'`), `Missing polling state: ${state}`)
  }
  for (const state of ['Completed', 'PartiallyCompleted', 'Failed', 'Cancelled']) {
    assert.ok(polling.includes(`'${state}'`), `Missing terminal state: ${state}`)
  }
  assert.match(polling, /5_000|5000/)
  assert.match(polling, /document\.hidden/)
  assert.match(polling, /on(?:Before)?Unmount/)
  assert.match(polling, /visibilitychange/)
})

test('Agent service uses centralized endpoints and never performs direct fetch calls', async () => {
  const service = await source('../src/core/services/agentService.ts')
  const endpoints = await source('../src/core/composables/endpoints.ts')
  assert.equal(/\bfetch\s*\(/.test(service), false)
  assert.match(service, /callEndpoint/)
  assert.match(service, /AgentEndpoints/)

  for (const path of [
    '/api/agents/providers',
    '/api/agents/definitions',
    '/api/agents/credentials',
    '/api/agents/browser-profiles',
    '/api/agents/schedules',
    '/api/agents/executions',
  ]) assert.ok(endpoints.includes(path), `Missing Agent endpoint: ${path}`)

  for (const placeholder of ['{{providerId}}', '{{definitionId}}', '{{credentialId}}', '{{profileId}}', '{{scheduleId}}', '{{executionId}}']) {
    assert.ok(endpoints.includes(placeholder), `Missing endpoint placeholder: ${placeholder}`)
  }
})


test('Agent monitoring exposes both DholeAgentService and Hermes through gateway health', async () => {
  const monitoring = await source('../src/core/services/monitoringService.ts')
  assert.match(monitoring, /key: 'agent'/)
  assert.match(monitoring, /buildGatewayHealthUrl\('agent'\)/)
  assert.match(monitoring, /key: 'hermes'/)
  assert.match(monitoring, /buildGatewayHealthUrl\('hermes'\)/)
})

test('Agent navigation follows the guided setup workflow', async () => {
  const layout = await source('../src/shared/components/layouts/MainLayout.vue')
  const dashboard = await source('../src/modules/agent/views/AgentDashboardView.vue')

  const orderedRoutes = [
    '/agents/providers',
    '/agents/credentials',
    '/agents/browser-profiles',
    '/agents/definitions',
    '/agents/schedules',
    '/agents/executions',
  ]
  let previous = -1
  for (const route of orderedRoutes) {
    const index = layout.indexOf(route)
    assert.ok(index > previous, `Agent sidebar route out of order: ${route}`)
    previous = index
  }

  for (const key of [
    'agent.guide.providerTitle',
    'agent.guide.credentialTitle',
    'agent.guide.profileTitle',
    'agent.guide.definitionTitle',
    'agent.guide.testTitle',
    'agent.guide.scheduleTitle',
  ]) assert.ok(dashboard.includes(key), `Missing guided setup key: ${key}`)
})
