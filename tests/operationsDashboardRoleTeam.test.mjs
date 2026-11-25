import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Dashboard selects Operations only with operations.case.read, independent of team management', () => {
  const root = read('src/modules/dashboard/views/DashboardView.vue')
  assert.match(root, /authStore\.hasScope\('operations\.case\.read'\)/)
  assert.match(root, /activeDashboardRole === 'operations' && canUseOperations/)
  assert.match(root, /<OperationsRoleDashboard/)
  assert.match(root, /selectedDashboardRole\.value === 'operations' && canUseOperations\.value/)
})

test('Operations dashboard uses scoped API aggregates, DhSelect and a route to the opening queue', () => {
  const view = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  assert.match(api, /dashboard: \(teamId\?: string\)/)
  assert.match(api, /\/api\/operations\/dashboard/)
  assert.match(view, /operationsApi\.dashboard\(selectedTeamId\.value \|\| undefined\)/)
  assert.match(view, /<DhSelect v-model="selectedTeamId"/)
  assert.match(view, /to="\/operations\/cases"/)
  assert.match(view, /const current = \+\+requestId/)
})

test('Team directory is navigable, accessible, and audit is collapsed by default', () => {
  const teams = read('src/modules/operations/views/OperationsTeamsView.vue')
  assert.match(teams, /<nav v-else/)
  assert.match(teams, /:aria-current="selectedId === team\.id/)
  assert.match(teams, /<details v-if="canAudit"/)
  assert.match(teams, /<DhMultiSelect v-else v-model="memberIds"/)
})

test('Overview translations exist in Spanish and English', () => {
  const messages = read('src/modules/operations/i18n.ts')
  assert.equal(messages.match(/dashboard: \{/g)?.length, 2)
  assert.match(messages, /heading: 'Aperturas y validaciones'/)
  assert.match(messages, /heading: 'Openings and validations'/)
})

test('Operations uses one consolidated heading and shares permitted role selector', () => {
  const root = read('src/modules/dashboard/views/DashboardView.vue')
  const operations = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  assert.match(root, /v-if="activeDashboardRole !== 'operations'"/)
  assert.match(root, /<template #role-selector>/)
  assert.match(root, /<DhSelect/)
  assert.match(root, /@update:model-value="selectDashboardRole"/)
  assert.match(operations, /<slot name="role-selector"/)
  assert.match(operations, /lg:flex-row lg:items-end lg:justify-between/)
  assert.match(operations, /sm:max-w-\[320px\]/)
})

test('Dashboard does not show misleading zeros or stale team data during loading', () => {
  const operations = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  assert.match(operations, /data\.value = null/)
  assert.match(operations, /const accessibleTeams = ref/)
  assert.match(operations, /accessibleTeams\.value = result\.teams/)
  assert.match(operations, /card\.value \?\? '—'/)
  assert.match(operations, /v-if="loading" role="status"/)
  assert.match(operations, /v-else-if="!data\?\.items\.length"/)
  assert.match(operations, /to="\/operations\/cases"/)
  assert.doesNotMatch(operations, /py-10 text-center/)
})

test('Compact operations dashboard copy is translated in both languages', () => {
  const messages = read('src/modules/operations/i18n.ts')
  assert.match(messages, /workspace: 'Centro de operaciones'/)
  assert.match(messages, /workspace: 'Operations center'/)
  assert.match(messages, /emptyTitle: 'Sin aperturas para mostrar'/)
  assert.match(messages, /emptyTitle: 'No openings to display'/)
})


test('Operations dashboard subscribes to the existing SignalR Hub and reconciles after reconnect', () => {
  const view = read('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  const hook = read('src/modules/operations/composables/useOperationsCaseRealtime.ts')
  assert.match(view, /useOperationsDashboardRealtime\(\(\) =>/)
  assert.match(view, /endpoint: '\/api\/operations\/dashboard', method: 'SIGNALR'/)
  assert.match(view, /refresh: \(\) => loadDashboard\(true\)/)
  assert.match(hook, /dashboard \? 'JoinDashboard' : 'JoinCase'/)
  assert.match(hook, /message\.target\?\.toLowerCase\(\) === 'operationsdashboardchanged'/)
  assert.match(hook, /message\.type === 3 && message\.invocationId === '1'/)
  assert.match(hook, /joined = true[\s\S]*?onInvalidated\(id\)/)
  assert.match(hook, /resolveGatewayBaseUrl\(import\.meta\.env\.VITE_API_URL\)/)
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(cases, /useOperationsDashboardRealtime\(\(\) =>/)
  assert.match(cases, /endpoint: '\/api\/operations\/cases', method: 'SIGNALR'/)
  const nginx = read('nginx.conf')
  assert.match(nginx, /location = \/hubs\/operations\s*\{[\s\S]*?proxy_set_header Upgrade \$http_upgrade;/)
})
