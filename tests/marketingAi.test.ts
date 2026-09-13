import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MARKETING_AI_PROFILE_KEY,
  MARKETING_AI_REQUIRES_HUMAN_APPROVAL,
  MARKETING_AI_TASKS,
  buildMarketingAiRequest,
  isMarketingAiTask,
  normalizeMarketingAiOutput,
} from '../src/core/marketing/marketingAi.ts'

test('phase 25 exposes every requested Marketing AI capability', () => {
  assert.deepEqual(
    MARKETING_AI_TASKS.map((task) => task.key),
    [
      'suggest-title',
      'improve-text',
      'meta-title',
      'meta-description',
      'keywords',
      'alt-text',
      'json-ld',
      'summarize-news',
      'translate-es-en',
      'translate-en-es',
    ],
  )
  assert.equal(MARKETING_AI_PROFILE_KEY, 'assistant')
})

test('Marketing AI requests explicitly require human review and forbid automatic publication', () => {
  const request = buildMarketingAiRequest('suggest-title', 'Servicio logístico para exportadores', {
    siteKey: 'main',
    contentType: 'Page',
  })

  assert.equal(MARKETING_AI_REQUIRES_HUMAN_APPROVAL, true)
  assert.equal(request.profileKey, 'assistant')
  assert.equal(request.messages.length, 2)
  assert.match(request.messages[0]!.content, /revisión humana/i)
  assert.match(request.messages[0]!.content, /nunca publicar/i)
  assert.match(request.messages[0]!.content, /No inventes hechos/i)
})

test('JSON-LD suggestions accept fenced JSON but normalize to a valid object', () => {
  const normalized = normalizeMarketingAiOutput(
    'json-ld',
    '```json\n{"@context":"https://schema.org","@type":"Article","headline":"Ejemplo"}\n```',
  )
  const parsed = JSON.parse(normalized)
  assert.equal(parsed['@context'], 'https://schema.org')
  assert.equal(parsed['@type'], 'Article')
})

test('JSON-LD suggestions reject non-object output', () => {
  assert.throws(() => normalizeMarketingAiOutput('json-ld', '["invalid"]'))
  assert.throws(() => normalizeMarketingAiOutput('json-ld', 'not-json'))
})

test('task guard only accepts registered phase 25 tasks', () => {
  assert.equal(isMarketingAiTask('alt-text'), true)
  assert.equal(isMarketingAiTask('translate-en-es'), true)
  assert.equal(isMarketingAiTask('publish'), false)
  assert.equal(isMarketingAiTask(null), false)
})
