import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const detail = readFileSync(new URL('../src/modules/operations/views/OperationsCaseDetailView.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/modules/pricing/views/PricingOperationsReviewsView.vue', import.meta.url), 'utf8')
test('Accepted QUO summary and discrepancy workflow are separate from service creation', () => {
  assert.match(detail, /title="Cotización vinculada"/)
  assert.match(detail, /title="Agregar QUO al expediente"/)
  assert.match(detail, /Semáforo comercial/)
  assert.match(detail, /comparisonColumns/)
  assert.match(detail, /La QUO original permanece sin modificaciones/)
  assert.doesNotMatch(detail, /Servicios del expediente y revisiones comerciales/)
  assert.doesNotMatch(detail, /newService\.serviceCode/)
  assert.doesNotMatch(detail, /label="Prioridad"|label="Complejidad"/)
  assert.match(detail, /operationsApi\.requestQuoteReview/)
  assert.match(detail, /expectedVersion: selected\.version, fingerprint: selected\.fingerprint/)
  assert.match(detail, /operationsApi\.caseContacts/)
  assert.match(detail, /Detalles de la cuenta/)
  assert.match(detail, /Contactos operativos/)
  assert.match(api, /commercial\/comparison\/review/)
  assert.match(api, /operations-contacts/)
  assert.match(pricing, /QUOTE_DISCREPANCY/)
})
test('Legacy service request API is retained for compatible callers', () => {
  assert.match(api, /caseServicesAndReviews: \(id: string\)/)
  assert.match(api, /addCaseService: \(id: string, input:/)
  assert.match(api, /OPERATIONS_ADDED/)
})

test('Origin actual weight is independently captured and commercial reviews require justification', () => {
  assert.match(detail, /title="Peso de la mercancía"/)
  assert.match(detail, /operationsApi\.confirmOriginWeight/)
  assert.match(detail, /level\('COORDINACION_ORIGEN'\) === 'EDITABLE'/)
  assert.match(detail, /merged\.actualWeightValue = raw\.actualWeightValue/)
  assert.match(detail, /!reviewComment\.trim\(\)/)
  assert.match(api, /origin\/actual-weight/)
})

test('commercial UX reuses DH controls and shows only persisted HOLD status', () => {
  assert.match(detail, /<DhTabs v-model="comparisonFilter"/)
  assert.match(detail, /:rows="visibleComparisonRows"/)
  assert.match(detail, /isOperationsCaseOnHold\(record\.value\?\.status\)/)
  assert.match(detail, /no confirman un bloqueo HOLD/)
  assert.match(detail, /Solicitud de modificación a Pricing/)
  assert.match(pricing, /Datos de la solicitud/)
})
