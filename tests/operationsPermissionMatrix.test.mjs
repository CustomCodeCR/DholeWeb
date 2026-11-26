import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('Team displays the automatically synchronized backend scope profiles', () => {
  const view = read('src/modules/operations/views/OperationsTeamsView.vue')
  const api = read('src/modules/operations/services/operationsApi.ts')
  assert.ok(view.includes('selected.operatorScopes'))
  assert.ok(view.includes('selected.supervisorScopes'))
  assert.ok(view.includes('operations.teamScopeProfileHint'))
  assert.ok(api.includes('operatorScopes?: string[]'))
  assert.ok(api.includes('supervisorScopes?: string[]'))
  const translations = read('src/modules/operations/i18n.ts')
  assert.ok(translations.includes('Scopes automáticos del equipo'))
  assert.ok(translations.includes('se conceden automáticamente'))
  assert.ok(!translations.includes('Deben concederse explícitamente en Auth'))
})
test('Origin exposes conditional pickup and correct LCL and AIR states', () => {
  const view = read('src/modules/operations/views/OperationsCaseDetailView.vue')
  const choices = view.slice(view.indexOf('const originStatusChoices'), view.indexOf('const postingNote'))
  assert.ok(choices.includes('openingData.value.requiresPickup === true'))
  assert.ok(choices.includes('CARGO_PICKUP'))
  assert.ok(choices.slice(choices.indexOf("case 'LCL'"), choices.indexOf("case 'AIR'")).includes('ORIGIN_WAREHOUSE'))
  assert.ok(choices.slice(choices.indexOf("case 'AIR'"), choices.indexOf("case 'FTL'")).includes('BOOKING_READY'))
  assert.ok(!choices.includes('IN_TRANSIT'))
})
