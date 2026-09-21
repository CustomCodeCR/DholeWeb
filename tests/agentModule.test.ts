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



test('Agent service exposes profile-first grouped operations without inventing profile CRUD', async () => {
  const service = await source('../src/core/services/agentService.ts')

  for (const group of [
    'providers',
    'definitions',
    'credentials',
    'routes',
    'equipment',
    'captures',
    'fields',
    'prompts',
    'browserProfiles',
    'schedules',
    'executions',
  ]) {
    assert.ok(service.includes(`${group},`), `Missing AgentService group: ${group}`)
  }

  for (const operation of [
    'credentials.verify',
    'routes.browse',
    'routes.create',
    'routes.update',
    'routes.delete',
    'equipment.browse',
    'equipment.create',
    'captures.test',
    'fields.browse',
    'prompts.preview',
    'executions.getPrompt',
  ]) {
    const [group, method] = operation.split('.')
    assert.match(service, new RegExp(`const ${group} = \\{[\\s\\S]*?\\n  (?:async )?${method}\\(`))
  }

  assert.match(service, /profiles:\s*\{\s*contractAvailable:\s*false as const/)
  assert.equal(service.includes('browseProfiles()'), false)
  assert.equal(service.includes('runProfile('), false)
  assert.equal(/\bfetch\s*\(/.test(service), false)
})


test('Agent Pinia store keeps profile configuration state without inventing profile CRUD', async () => {
  const store = await source('../src/modules/agent/stores/agentStore.ts')

  for (const fragment of [
    'const routes = ref<AgentExtractionRouteDto[]>([])',
    'const equipment = ref<AgentExtractionEquipmentDto[]>([])',
    'const captures = ref<AgentEndpointCaptureDto[]>([])',
    'const fields = ref<AgentExtractionFieldDto[]>([])',
    'const selectedExecution = ref<AgentExecutionDto | null>(null)',
    'loadProfileConfiguration(profileId: string)',
    'AgentService.routes.browse(profileId)',
    'AgentService.equipment.browse(profileId)',
    'AgentService.captures.browse(profileId)',
    'AgentService.fields.browse(profileId)',
    'refreshExecution(executionId?: string)',
  ]) {
    assert.ok(store.includes(fragment), `Missing profile store behavior: ${fragment}`)
  }

  assert.match(store, /plannedSearchCount = computed\(\(\) => activeRoutes\.value\.length \* activeEquipment\.value\.length\)/)
  assert.match(store, /profileCrudAvailable = computed\(\(\) => AgentService\.profiles\.contractAvailable\)/)
  assert.equal(store.includes('password'), false)
  assert.equal(store.includes('loadProfiles('), false)
  assert.equal(store.includes('loadProfile('), false)
})


test('Credential UI never retains passwords and verifies through AgentService', async () => {
  const form = await source('../src/modules/agent/components/credentials/AgentCredentialForm.vue')
  const view = await source('../src/modules/agent/views/AgentCredentialsView.vue')

  assert.match(form, /form\.password = ''/)
  assert.match(form, /AgentService\.credentials\.create/)
  assert.match(form, /AgentService\.credentials\.update/)
  assert.equal(form.includes('localStorage'), false)
  assert.equal(form.includes('sessionStorage'), false)
  assert.equal(form.includes('console.log'), false)

  assert.match(view, /AgentService\.credentials\.verify\(row\.id\)/)
  assert.match(view, /permissions\.canVerifyCredentials\.value/)
  assert.match(view, /AgentCredentialForm/)
})


test('Extraction route UI maps the real route contract and CRUD service', async () => {
  const form = await source('../src/modules/agent/components/routes/AgentRouteForm.vue')
  const table = await source('../src/modules/agent/components/routes/AgentRoutesTable.vue')

  for (const field of [
    'polCode',
    'polName',
    'poeCode',
    'poeName',
    'podCode',
    'podName',
    'isActive',
    'sortOrder',
  ]) {
    assert.ok(form.includes(field), `Missing route field: ${field}`)
  }

  assert.match(form, /AgentService\.routes\.create\(props\.profileId, payload\)/)
  assert.match(form, /AgentService\.routes\.update\(props\.profileId, props\.route\.id, payload\)/)
  assert.match(table, /AgentExtractionRouteDto/)
  assert.match(table, /emit\('delete', row\)/)
  assert.match(table, /DhDataTable/)
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


test('Extraction equipment UI maps the real equipment contract and CRUD service', async () => {
  const form = await source('../src/modules/agent/components/equipment/AgentEquipmentForm.vue')
  const table = await source('../src/modules/agent/components/equipment/AgentEquipmentTable.vue')

  for (const field of [
    'code',
    'name',
    'quantity',
    'defaultWeightKg',
    'isActive',
    'sortOrder',
  ]) {
    assert.ok(form.includes(field), `Missing equipment field: ${field}`)
  }

  assert.match(form, /AgentService\.equipment\.create\(props\.profileId, payload\)/)
  assert.match(form, /AgentService\.equipment\.update\(props\.profileId, props\.equipment\.id, payload\)/)
  assert.match(table, /AgentExtractionEquipmentDto/)
  assert.match(table, /emit\('delete', row\)/)
  assert.match(table, /overflow-x-auto/)
  assert.match(table, /DhDataTable/)
})


test('Capture rule UI maps the real capture contract and test endpoint', async () => {
  const form = await source('../src/modules/agent/components/captures/AgentCaptureRuleForm.vue')
  const table = await source('../src/modules/agent/components/captures/AgentCaptureRulesTable.vue')

  for (const field of [
    'httpMethod',
    'urlPattern',
    'matchType',
    'contentType',
    'captureRequest',
    'captureResponse',
    'isRequired',
    'timeoutSeconds',
    'isActive',
    'sortOrder',
  ]) {
    assert.ok(form.includes(field), `Missing capture field: ${field}`)
  }

  assert.match(form, /AgentService\.captures\.create\(props\.profileId, payload\)/)
  assert.match(form, /AgentService\.captures\.update\(props\.profileId, props\.capture\.id, payload\)/)
  assert.match(form, /AgentService\.captures\.test\(props\.profileId, props\.capture\.id/)
  assert.match(form, /Coincide ✓/)
  assert.match(form, /No coincide/)
  assert.match(table, /AgentEndpointCaptureDto/)
  assert.match(table, /overflow-x-auto/)
})


test('Extraction field UI maps the real field contract and CRUD service', async () => {
  const form = await source('../src/modules/agent/components/fields/AgentExtractionFieldForm.vue')
  const table = await source('../src/modules/agent/components/fields/AgentExtractionFieldsTable.vue')

  for (const field of [
    'key',
    'label',
    'description',
    'dataType',
    'sourceType',
    'jsonPath',
    'required',
    'sortOrder',
    'isActive',
  ]) {
    assert.ok(form.includes(field), `Missing extraction field property: ${field}`)
  }

  for (const value of ['String', 'Number', 'Decimal', 'Date', 'DateTime', 'Boolean', 'Object', 'Array']) {
    assert.ok(form.includes('AGENT_EXTRACTION_DATA_TYPES'), 'Data types must come from the shared backend mirror')
    assert.ok((await source('../src/core/interfaces/agent.ts')).includes(`'${value}'`))
  }

  assert.match(form, /AgentService\.fields\.create\(props\.profileId, payload\)/)
  assert.match(form, /AgentService\.fields\.update\(props\.profileId, props\.field\.id, payload\)/)
  assert.match(table, /AgentExtractionFieldDto/)
  assert.match(table, /overflow-x-auto/)
  assert.equal(form.includes('Cargar campos recomendados de Maersk'), false)
})


test('Hermes prompt UI previews only through the backend contract', async () => {
  const editor = await source('../src/modules/agent/components/prompt/AgentPromptEditor.vue')
  const preview = await source('../src/modules/agent/components/prompt/AgentPromptPreview.vue')

  assert.match(editor, /Feature blocked by backend contract/)
  assert.equal(editor.includes('AgentService.profiles.update'), false)
  assert.equal(editor.toLowerCase().includes('password'), false)

  assert.match(preview, /AgentService\.prompts\.preview\(props\.profileId/)
  assert.match(preview, /cargoReadyDate/)
  assert.match(preview, /executionId/)
  assert.match(preview, /availableVariables/)
  assert.equal(preview.includes('{{providerName}}'), false)
  assert.equal(preview.toLowerCase().includes('password'), false)
  assert.equal(/\.replace\([^\n]*\{\{/.test(preview), false)
})

test('Execution detail uses tabs, real prompt snapshot and explicit backend-contract blockers', async () => {
  const detail = await source('../src/modules/agent/views/AgentExecutionDetailView.vue')

  for (const tab of ['summary', 'tasks', 'result', 'activity', 'prompt', 'captures', 'errors']) {
    assert.ok(detail.includes(`key: '${tab}'`), `Missing execution detail tab: ${tab}`)
  }

  assert.match(detail, /AgentService\.executions\.getPrompt\(executionId\.value\)/)
  assert.match(detail, /promptSnapshot\.promptSnapshot/)
  assert.match(detail, /configurationSnapshotJson/)
  assert.match(detail, /Feature blocked by backend contract: falta GET \/api\/agents\/executions\/\{id\}\/steps/)
  assert.match(detail, /Feature blocked by backend contract: falta GET \/api\/agents\/executions\/\{id\}\/network-captures/)
  assert.match(detail, /Route × Equipment/)
  assert.equal(detail.includes('/api/agents/executions/{id}/result'), false)
  assert.equal(detail.includes('/api/agents/executions/{id}/hermes') && detail.includes('AgentService.executions.hermes'), false)
})
