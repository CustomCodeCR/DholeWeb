import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const view = readFileSync(new URL('../src/modules/ai/views/AiOperationsView.vue', import.meta.url), 'utf8')
const es = JSON.parse(readFileSync(new URL('../src/core/i18n/es.json', import.meta.url), 'utf8'))
const en = JSON.parse(readFileSync(new URL('../src/core/i18n/en.json', import.meta.url), 'utf8'))

test('AI operations uses the backend display status for job badges', () => {
  assert.match(view, /badgeVariant\(item\.displayStatus \?\? item\.status\)/)
  assert.match(view, /statusLabel\(item\.displayStatus \?\? item\.status\)/)
})

test('completed inference that needs review has a distinct counter', () => {
  assert.match(view, /state\.queue\.reviewRequired \?\? 0/)
  assert.match(view, /status === 'CompletedWithReview'/)
})

test('review status is translated in both languages, while real failures remain available', () => {
  assert.equal(es.ai.operations.statuses.CompletedWithReview, 'Completada · requiere revisión')
  assert.equal(en.ai.operations.statuses.CompletedWithReview, 'Completed · review required')
  assert.equal(es.ai.operations.statuses.Failed, 'Fallida')
  assert.equal(en.ai.operations.statuses.Failed, 'Failed')
})
