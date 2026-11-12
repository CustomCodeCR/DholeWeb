import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const modal = readFileSync('src/modules/pricing/components/PricingLinkAcceptedQuoteModal.vue', 'utf8')
const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')

test('loads every page of sent and accepted quotes using exact CRM client identity', () => {
  assert.match(modal, /onMounted\(loadSource\)/)
  assert.match(modal, /await loadCandidates\(\)/)
  assert.match(modal, /crm-account\//)
  assert.match(modal, /crm-lead\//)
  assert.match(modal, /pageSize=100/)
  assert.match(modal, /page \* 100 >= response\.total/)
  assert.match(modal, /clientAccountId !== rate\.clientAccountId/)
  assert.match(modal, /clientLeadId !== rate\.clientLeadId/)
})

test('historical quotations paginate and check exact same client', () => {
  assert.match(modal, /PricingService\.browseRates/)
  assert.match(modal, /statuses: \['Sent', 'AcceptedByClient'\]/)
  assert.match(modal, /sameClient\(source\.value, rate\)/)
  assert.match(modal, /page \* 100 >= \(response\.totalCount \?\? 0\)/)
})

test('UI lists quote, route and status without requesting typed QUO number', () => {
  assert.match(modal, /v-for="rate in filteredQuotes"/)
  assert.match(modal, /rate\.mode }} · {{ rate\.route/)
  assert.match(modal, /rate\.status === 'AcceptedByClient' \? 'Aceptada' : 'Enviada'/)
  assert.match(modal, /target\.status !== 'AcceptedByClient'/)
  assert.match(modal, /!sameClient\(current, target\)/)
  assert.match(modal, /linkedAcceptedRateId: target\.id/)
  assert.match(wizard, /size: 'lg'/)
})
