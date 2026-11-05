import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isTranslatableContentText, parseContentTranslationResponse } from '../src/core/i18n/contentTranslation.ts'

test('translate prose but not identifiers', () => {
  assert.equal(isTranslatableContentText('The shipment is ready for customs clearance.'), true)
  assert.equal(isTranslatableContentText('El embarque está listo para despacho aduanal.'), true)
  assert.equal(isTranslatableContentText('hello@example.com'), false)
  assert.equal(isTranslatableContentText('https://example.com/track'), false)
  assert.equal(isTranslatableContentText('9f865613-2d16-4cba-92f6-202f6f1f0000'), false)
  assert.equal(isTranslatableContentText('USD 1,234.00'), false)
})

test('translation response must match the requested text count', () => {
  assert.deepEqual(parseContentTranslationResponse('{"translations":["Entrega confirmada","En tránsito"]}', 2), ['Entrega confirmada', 'En tránsito'])
  assert.deepEqual(parseContentTranslationResponse('["Ready"]', 1), ['Ready'])
  assert.throws(() => parseContentTranslationResponse('{"translations":[]}', 1))
  assert.throws(() => parseContentTranslationResponse('Not available', 1))
  assert.throws(() => parseContentTranslationResponse('[""]', 1))
})
