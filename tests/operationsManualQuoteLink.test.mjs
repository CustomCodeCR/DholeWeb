import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = read('src/modules/operations/views/OperationsManualCreateView.vue')
const api = read('src/modules/operations/services/operationsApi.ts')
const detail = read('src/modules/operations/views/OperationsCaseDetailView.vue')

test('manual opening uses optional explicit quote link and existing DH controls', () => {
  assert.match(opening, /<DhCard[^>]*title="Cotización \(QUO\)"/)
  assert.match(opening, /<DhSelect[^>]*label="Cotización aceptada"/)
  assert.match(opening, /watch\(\[accountId, modality\], clearQuote/)
  assert.match(opening, /quoteRateId: quoteRateId\.value/)
  assert.match(opening, /draft\.quoteRateId/)
  assert.match(opening, /rate\.clientAccountId === accountId\.value/)
  assert.match(opening, /rate\.shipmentMode\.toUpperCase\(\) === modality\.value\.toUpperCase\(\)/)
  assert.match(api, /quoteRateId\?: string/)
})

test('existing case previews selected quote before requesting link', () => {
  assert.match(detail, /title="Agregar QUO al expediente"/)
  assert.match(detail, /selectedQuoteCandidate\.idtraNumber/)
  assert.match(detail, /operationsApi\.linkQuote\(detail\.id, quoteSelection\.value, detail\.version\)/)
})
