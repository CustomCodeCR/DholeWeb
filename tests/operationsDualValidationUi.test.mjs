import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Operations pages and sidebar require explicit scopes', () => {
  const routes = read('src/core/router/index.ts')
  const sidebar = read('src/shared/components/layouts/MainLayout.vue')
  assert.match(routes, /operations\/teams/)
  assert.match(routes, /operations\/apertures/)
  assert.match(routes, /requiredAnyScopes: \['operations\.team\.read', 'operations\.team\.manage'\]/)
  assert.match(routes, /requiredScope: 'operations\.case\.read'/)
  assert.match(sidebar, /canView\('operations\.team\.read'\) \|\| canView\('operations\.team\.manage'\)/)
})
test('the first Aperturas workspace invokes dual validator endpoints, not a single assignee', () => {
  const api = read('src/modules/operations/services/operationsApi.ts')
  const view = read('src/modules/operations/views/OperationsAperturesView.vue')
  assert.match(api, /aperture-validations\/assign/)
  assert.match(api, /aperture-validations\/\$\{validationId\}\/decision/)
  assert.match(view, /operations\.validation\.reviewHint/)
  assert.match(view, /operations\.audit\.read/)
})
