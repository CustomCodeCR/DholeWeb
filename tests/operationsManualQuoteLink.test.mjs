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
  assert.match(opening, /watch\(\[accountId, modality\], \(\) => \{ if \(!applyingQuote\) clearQuote\(\)/)
  assert.match(opening, /quoteRateId: quoteRateId\.value/)
  assert.match(opening, /draft\.quoteRateId/)
  assert.match(opening, /rate\.clientAccountId === accountId\.value/)
  assert.match(opening, /!modality\.value \|\| mode === modality\.value\.toUpperCase\(\)/)
  assert.match(api, /quoteRateId\?: string/)
})

test('existing case previews selected quote before requesting link', () => {
  assert.match(detail, /title="Agregar QUO al expediente"/)
  assert.match(detail, /selectedQuoteCandidate\.idtraNumber/)
  assert.match(detail, /operationsApi\.linkQuote\(detail\.id, quoteSelection\.value, detail\.version\)/)
})

test('QUO search is the first optional step and does not require a client or modality', () => {
  const search = opening.slice(opening.indexOf('async function searchQuotes()'), opening.indexOf('function selectQuote('))
  assert.doesNotMatch(search.split('const generation')[0], /!accountId\.value|!modality\.value/)
  assert.doesNotMatch(opening, /Selecciona primero el cliente y el tipo de embarque/)
  assert.ok(opening.indexOf('title="Cotización (QUO)"') < opening.indexOf('title="Modalidad y embarque"'))
  assert.match(opening, /label="Buscar QUO"/)
  assert.match(opening, /label="Vincular QUO"/)
  assert.match(opening, /!accountId\.value \|\| rate\.clientAccountId === accountId\.value/)
  assert.match(opening, /accountId\.value = selected\.clientAccountId/)
  assert.match(opening, /selectTransport\(quoteTransport\(mode\)\)/)
  assert.match(opening, /selectShipment\(mode\)/)
  assert.match(opening, /applyingQuote = true/)
  assert.match(opening, /finally \{ applyingQuote = false \}/)
  assert.match(opening, /:initial-name="selectedClientName"/)
})
