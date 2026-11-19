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
  assert.match(view, /to="\/operations\/apertures"/)
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
