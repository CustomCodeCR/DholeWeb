import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Operations has protected cases, opening queue and team destinations', () => {
  const sidebar = read('src/shared/components/layouts/MainLayout.vue')
  const router = read('src/core/router/index.ts')
  assert.match(sidebar, /t\('operations\.title'\)/)
  assert.match(sidebar, /t\('operations\.cases'\)/)
  assert.doesNotMatch(sidebar, /t\('operations\.apertures'\)/)
  assert.match(router, /path: 'operations\/apertures'/)
  assert.match(sidebar, /t\('operations\.teams'\)/)
  assert.match(router, /path: 'operations\/cases'/)
  assert.match(router, /component: \(\) => import\('@\/modules\/operations\/views\/OperationsCasesView\.vue'\)/)
  assert.match(router, /requiredScope: 'operations\.case\.read'/)
  assert.match(router, /requiredAnyScopes: \['operations\.team\.read', 'operations\.team\.manage'\]/)
})

test('Team screen is assignment-first, without raw company UUID or manual team creation', () => {
  const screen = read('src/modules/operations/views/OperationsTeamsView.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  assert.match(screen, /operationsApi\.initializeTeams\(\)/)
  assert.match(screen, /operationsApi\.saveMember/)
  assert.match(screen, /operationsApi\.removeMember/)
  assert.match(screen, /operationsApi\.setTeamActive/)
  assert.match(screen, /operationsApi\.teamAudit/)
  assert.match(screen, /operationsApi\.users/)
  assert.doesNotMatch(screen, /Nuevo equipo operativo|Empresa · UUID|createTeam\(/)
  assert.match(api, /teams\/initialize/)
  assert.match(api, /auth\/users\/operations-directory/)
})

test('Operations translations are registered for Spanish and English', () => {
  const index = read('src/core/i18n/index.ts')
  const catalog = read('src/modules/operations/i18n.ts')
  const aperture = read('src/modules/operations/views/OperationsAperturesView.vue')
  const cases = read('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(index, /operations: operationsMessages\.es/)
  assert.match(index, /operations: operationsMessages\.en/)
  assert.match(catalog, /title: 'Operaciones'/)
  assert.match(catalog, /title: 'Operations'/)
  assert.match(catalog, /casesView: \{/)
  assert.match(aperture, /useI18n\(\)/)
  assert.match(cases, /operationsApi\.cases\(page\.value,\s*\{/)
  assert.match(cases, /operationsApi\.caseDetail\(id\)/)
})
