import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  AGENT_ACTION_TYPES,
  AGENT_BROWSER_PROFILE_STATUSES,
  AGENT_ENDPOINT_MATCH_TYPES,
  AGENT_EXECUTION_STATUSES,
  AGENT_EXECUTION_STRATEGIES,
  AGENT_EXTRACTION_DATA_TYPES,
  AGENT_EXTRACTION_SOURCE_TYPES,
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
  assert.deepEqual(AGENT_ENDPOINT_MATCH_TYPES, ['Contains', 'Exact', 'Regex'])
  assert.deepEqual(AGENT_EXTRACTION_DATA_TYPES, ['String', 'Number', 'Decimal', 'Date', 'DateTime', 'Boolean', 'Object', 'Array'])
  assert.deepEqual(AGENT_EXTRACTION_SOURCE_TYPES, ['Auto', 'ProviderParser', 'JsonPath', 'Hermes'])
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


test('Extraction profile contracts mirror the contracts currently exposed by AgentService', async () => {
  const contracts = await source('../src/core/interfaces/agent.ts')

  for (const name of [
    'AgentExtractionRouteDto',
    'SaveAgentExtractionRouteRequest',
    'AgentExtractionEquipmentDto',
    'SaveAgentExtractionEquipmentRequest',
    'AgentEndpointCaptureDto',
    'SaveAgentEndpointCaptureRequest',
    'TestAgentEndpointCaptureRequest',
    'TestAgentEndpointCaptureResponse',
    'AgentExtractionFieldDto',
    'SaveAgentExtractionFieldRequest',
    'AgentPromptPreviewRequest',
    'AgentPromptPreviewDto',
    'AgentExecutionPromptSnapshotDto',
    'AgentResultDto',
  ]) {
    assert.ok(contracts.includes(`interface ${name}`), `Missing backend contract: ${name}`)
  }

  assert.match(contracts, /usernameMasked: string/)
  assert.match(contracts, /hasPassword: boolean/)
  assert.match(contracts, /username: string/)
  assert.match(contracts, /password: string \| null/)
  assert.equal(contracts.includes('usernameSecretKey'), false)
  assert.equal(contracts.includes('passwordSecretKey'), false)

  // The backend still does not publish these contracts; frontend must not invent them.
  assert.equal(contracts.includes('interface AgentExtractionProfileDto'), false)
  assert.equal(contracts.includes('interface AgentExecutionTaskDto'), false)
  assert.equal(contracts.includes('interface AgentExecutionStepDto'), false)
  assert.equal(contracts.includes('interface AgentNetworkCaptureDto'), false)
  assert.equal(contracts.includes('interface AgentHermesInteractionDto'), false)
})

test('Agent scopes and route visibility use the granular backend permissions', async () => {
  assert.equal(AGENT_SCOPES.providers.view, 'agent.providers.view')
  assert.equal(AGENT_SCOPES.providers.manage, 'agent.providers.manage')
  assert.equal(AGENT_SCOPES.definitions.view, 'agent.definitions.view')
  assert.equal(AGENT_SCOPES.credentials.manage, 'agent.credentials.manage')
  assert.equal(AGENT_SCOPES.credentials.verify, 'agent.credentials.verify')
  assert.equal(AGENT_SCOPES.routes.manage, 'agent.routes.manage')
  assert.equal(AGENT_SCOPES.equipment.manage, 'agent.equipment.manage')
  assert.equal(AGENT_SCOPES.captureRules.manage, 'agent.capture-rules.manage')
  assert.equal(AGENT_SCOPES.extractionFields.manage, 'agent.extraction-fields.manage')
  assert.equal(AGENT_SCOPES.prompts.manage, 'agent.prompts.manage')
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
    'AGENT_SCOPES.credentials.verify',
    'AGENT_SCOPES.routes.manage',
    'AGENT_SCOPES.equipment.manage',
    'AGENT_SCOPES.captureRules.manage',
    'AGENT_SCOPES.extractionFields.manage',
    'AGENT_SCOPES.prompts.manage',
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
    '/api/agents/credentials/{{credentialId}}/verify',
    '/api/agents/extraction-profiles/{{profileId}}/routes',
    '/api/agents/extraction-profiles/{{profileId}}/equipment',
    '/api/agents/extraction-profiles/{{profileId}}/captures',
    '/api/agents/extraction-profiles/{{profileId}}/fields',
    '/api/agents/extraction-profiles/{{profileId}}/prompt-preview',
    '/api/agents/browser-profiles',
    '/api/agents/schedules',
    '/api/agents/executions',
    '/api/agents/executions/{{executionId}}/prompt',
  ]) assert.ok(endpoints.includes(path), `Missing Agent endpoint: ${path}`)

  assert.equal(endpoints.includes("path: '/api/agents/extraction-profiles'"), false)
  assert.equal(endpoints.includes('/api/agents/extraction-profiles/{{profileId}}/run'), false)

  for (const placeholder of ['{{providerId}}', '{{definitionId}}', '{{credentialId}}', '{{profileId}}', '{{routeId}}', '{{equipmentId}}', '{{captureId}}', '{{fieldId}}', '{{scheduleId}}', '{{executionId}}']) {
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

test('Agent navigation centers the UX on extraction profiles', async () => {
  const layout = await source('../src/shared/components/layouts/MainLayout.vue')
  const router = await source('../src/core/router/index.ts')

  const primaryRoutes = [
    '/agents/profiles',
    '/agents/executions',
    '/agents/advanced',
  ]

  let previous = -1
  for (const route of primaryRoutes) {
    const index = layout.indexOf(route)
    assert.ok(index > previous, `Agent sidebar route out of order: ${route}`)
    previous = index
  }

  for (const technicalRoute of [
    '/agents/providers',
    '/agents/credentials',
    '/agents/browser-profiles',
    '/agents/definitions',
    '/agents/schedules',
  ]) {
    assert.equal(layout.includes(technicalRoute), false, `Technical route leaked into primary sidebar: ${technicalRoute}`)
  }

  assert.match(router, /path: 'agents'[\s\S]*redirect: '\/agents\/profiles'/)
  assert.match(router, /path: 'agents\/profiles'/)
  assert.match(router, /AgentProfilesView\.vue/)
  assert.match(router, /path: 'agents\/profiles\/new'/)
  assert.match(router, /AgentProfileWizardView\.vue/)
  assert.match(router, /path: 'agents\/profiles\/:id'/)
  assert.match(router, /AgentProfileDetailView\.vue/)
  assert.match(router, /path: 'agents\/advanced'/)
  assert.match(router, /AgentAdvancedSettingsView\.vue/)
})
