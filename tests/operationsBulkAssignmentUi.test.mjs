import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Operations uses Dhole native multi-select, not a native single-choice selector', () => {
  const view = read('src/modules/operations/views/OperationsTeamsView.vue')
  assert.match(view, /<DhMultiSelect v-else v-model="memberIds"/)
  assert.match(view, /operationsApi\.addMembers\(selected\.value\.id/)
  assert.match(view, /new Set\(memberIds\.value\)/)
  assert.match(view, /selectedMember \? t\('operations\.updateMember'\)/)
  assert.match(view, /operationsApi\.saveMember\(selected\.value\.id/)
  assert.doesNotMatch(view, /<DhSelect v-model="memberId"/)
})

test('Operations directory loads subsequent pages and does not keep ineligible search results', () => {
  const api = read('src/modules/operations/services/operationsApi.ts')
  const view = read('src/modules/operations/views/OperationsTeamsView.vue')
  assert.match(api, /while \(items\.length < total && page <= 50\)/)
  assert.match(api, /\/members\/bulk/)
  assert.match(view, /users\.value = result\.items/)
  assert.match(view, /filter\(user => !assigned\.has\(user\.id\)\)/)
})

test('Batch assignments have translated counters in both locales', () => {
  const file = read('src/modules/operations/i18n.ts')
  assert.match(file, /addMembers: 'Asignar varios colaboradores'/)
  assert.match(file, /addMembers: 'Assign multiple employees'/)
  assert.match(file, /assignedBatch: 'Se asignaron/)
  assert.match(file, /assignedBatch: '\{count\} employees/)
})
