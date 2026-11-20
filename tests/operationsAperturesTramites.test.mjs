import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('trámites and Aperturas use paginated server filters instead of filtering one page locally', () => {
  const api = source('src/modules/operations/services/operationsApi.ts')
  const cases = source('src/modules/operations/views/OperationsCasesView.vue')
  const fullForm = source('src/modules/operations/views/OperationsManualOpeningView.vue')
  assert.match(api, /function caseQuery\(page: number, pageSize: number/)
  assert.match(api, /params\.set\('apertureType', filters\.apertureType\)/)
  assert.match(api, /params\.set\('q', filters\.q\.trim\(\)\)/)
  assert.match(cases, /operationsApi\.cases\(page\.value, \{/)
  assert.match(fullForm, /operationsApi\.createAperture/)
  assert.match(cases, /:rows="rows"/)
  assert.doesNotMatch(fullForm, /seriesCode|DhModal/)
})

test('manual creation uses CRM customer lookup and no placeholder sales executive', () => {
  const api = source('src/modules/operations/services/operationsApi.ts')
  const view = source('src/modules/operations/views/OperationsManualOpeningView.vue')
  assert.match(api, /\/api\/crm\/accounts\?/)
  assert.match(api, /\/api\/operations\/apertures\/create-context/)
  assert.match(view, /v-model="accountId"/)
  assert.match(view, /operationsApi\.createContext\(\)/)
  assert.match(view, /operationsApi\.crmAccounts\(clientQuery\.value\)/)
  assert.doesNotMatch(view, /blankUser|executiveUserId: blankUser/)
})

test('dashboard and Trámites distinguish the two aperture sources and retain eight case tabs', () => {
  const dashboard = source('src/modules/dashboard/components/OperationsRoleDashboard.vue')
  const cases = source('src/modules/operations/views/OperationsCasesView.vue')
  assert.match(dashboard, /stats\.automatic/)
  assert.match(dashboard, /stats\.manual/)
  const detail = source('src/modules/operations/views/OperationsCaseDetailView.vue')
  for (const tab of ['RESUMEN', 'QUO', 'COORDINACION_ORIGEN', 'DOCUMENTACION', 'TRANSITO', 'PANAMA', 'COSTA_RICA', 'FINANZAS'])
    assert.ok(detail.includes(`code: '${tab}'`), tab)
  assert.match(cases, /row\.sourceQuoteId/)
  assert.match(cases, /selected\.sourceQuoteId/)
  assert.match(cases, /selected\.apertureType/)
})
