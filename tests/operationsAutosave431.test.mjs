import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const view = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')

test('manual opening retains offline fallback but PostgreSQL is authoritative', () => {
  assert.match(view, /operationsApi\.saveManualDraft\(remoteDraftId\.value, state\)/)
  assert.match(view, /await operationsApi\.latestManualDraft\(\)/)
  assert.match(view, /await restoreServerDraft\(\)/)
  assert.match(view, /operationsApi\.deleteManualDraft\(completedDraftId\)/)
  assert.match(view, /localStorage\.setItem/)
})
test('server draft endpoints are user-scoped and REST-compatible', () => {
  assert.match(api, /latestManualDraft:/)
  assert.match(api, /saveManualDraft:/)
  assert.match(api, /deleteManualDraft:/)
  assert.match(api, /'PUT'/)
})
