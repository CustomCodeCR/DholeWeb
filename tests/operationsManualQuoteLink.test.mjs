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
  const search = opening.slice(opening.indexOf('async function searchQuotes()'), opening.indexOf('// Resolve real catalog identifiers'))
  assert.doesNotMatch(search.split('const generation')[0], /!accountId\.value|!modality\.value/)
  assert.doesNotMatch(opening, /Selecciona primero el cliente y el tipo de embarque/)
  assert.ok(opening.indexOf('title="Cotización (QUO)"') < opening.indexOf('title="Modalidad y embarque"'))
  assert.match(opening, /label="Buscar QUO"/)
  assert.match(opening, /label="Vincular QUO"/)
  assert.match(opening, /!accountId\.value \|\| rate\.clientAccountId === accountId\.value/)
  assert.match(opening, /accountId\.value = rate\.clientAccountId/)
  assert.match(opening, /selectTransport\(quoteTransport\(mode\)\)/)
  assert.match(opening, /selectShipment\(mode\)/)
  assert.match(opening, /applyingQuote = true/)
  assert.match(opening, /finally \{ applyingQuote = false \}/)
  assert.match(opening, /:initial-name="selectedClientName"/)
})

test('selecting a QUO loads detail, maps logistics and restores old drafts', () => {
  assert.match(opening, /await operationsQuoteApi\.detail\(id\)/)
  assert.match(opening, /hydrateQuoteOpening\(rate\)/)
  assert.match(opening, /normalizeIncotermCode\(rate\.incotermCode, rate\.incotermName\)/)
  assert.match(opening, /\['pol', selectedPol, rate\.polId, rate\.polCode, rate\.polName\]/)
  assert.match(opening, /\['poe', selectedPoe, rate\.poeId, rate\.poeCode, rate\.poeName\]/)
  assert.match(opening, /\['pod', selectedPod, rate\.podId, rate\.podCode, rate\.podName\]/)
  assert.match(opening, /form\.value\.estimatedWeightValue = String\(rate\.totalWeightKg\)/)
  assert.match(opening, /form\.value\.volumeValue = String\(rate\.totalVolumeCbm\)/)
  assert.match(opening, /form\.value\.packageCount = String\(rate\.totalPackages\)/)
  assert.match(opening, /rate\.containers\?\.length/)
  assert.match(opening, /rate\.services\.map/)
  assert.match(opening, /rate\.inlandPickupLocations/)
  assert.match(opening, /rate\.inlandDeliveryLocations/)
  assert.match(opening, /quoteHydrated: quoteHydrated\.value/)
  assert.match(opening, /quoteRateId\.value && !quoteHydrated\.value && !assignmentPendingId\.value\) await selectQuote/)
  assert.match(opening, /label="Cargar datos de QUO"/)
  assert.doesNotMatch(opening.slice(opening.indexOf('function hydrateQuoteOpening'), opening.indexOf('async function selectQuote')), /actualWeight|form\.value\.weightValue\s*=/)
})


test('Operations quote lookup and link use dedicated scopes, never commercial rate access', () => {
  const lookup = read('src/modules/operations/services/operationsQuoteApi.ts')
  for (const view of [opening, detail]) {
    assert.match(view, /operations\.pricing\.quote\.read/)
    assert.match(view, /operations\.pricing\.quote\.link/)
    assert.match(view, /operationsQuoteApi\.search/)
    assert.doesNotMatch(view, /PricingService\.browseRates|pricing\.rate\.update/)
  }
  assert.match(lookup, /\/api\/pricing\/operations-quotes/)
  assert.doesNotMatch(lookup, /totalCostAmount|marginPercentage|rateDetails/)
  assert.match(opening, /mode="operations"/)
  assert.match(opening, /crmPath\('operations\/accounts', id, 'contacts'\)/)
})

test('delivery visibility is derived from contracted services, not the Incoterm or a manual switch', () => {
  assert.match(opening, /const deliveryRequired = computed\(\(\) => \(form\.value\.services/)
  assert.match(opening, /<PricingInlandServiceLocation v-if="deliveryRequired"/)
  assert.doesNotMatch(opening, /label="¿Requiere entrega\?"/)
  assert.match(opening, /requiresDelivery: deliveryRequired\.value/)
})
