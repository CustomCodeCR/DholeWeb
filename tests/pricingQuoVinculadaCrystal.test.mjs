import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')
const modal = readFileSync('src/modules/pricing/components/PricingLinkAcceptedQuoteModal.vue', 'utf8')
const duplicate = readFileSync('src/modules/pricing/components/PricingDuplicateRateModal.vue', 'utf8')

test('active Crystal wizard has the accepted-other-QUO action on commercial screen 9', () => {
  assert.match(wizard, /<DhButton[^\n]*@click="openLinkedQuoteModal\(editingRate\.id\)">Cliente aceptó otra QUO<\/DhButton>/)
  assert.match(wizard, /QUOVinculada: 'Cliente aceptó otra QUO'/)
  assert.match(wizard, /editingRate\.linkedAcceptedRateId/)
  assert.match(wizard, /canLinkAnotherQuote/)
})

test('FCL duplicate screen 8 exposes link for existing source QUO without saving draft', () => {
  assert.match(duplicate, /duplicateReview: '1'/)
  assert.match(duplicate, /duplicateFrom: props\.rate\.id/)
  assert.match(wizard, /router\.currentRoute\.value\.query/)
  assert.match(wizard, /linkedQuoteDuplicateSourceId/)
  assert.match(wizard, /<DhButton v-if="linkedQuoteDuplicateSourceId"/)
  assert.match(wizard, /@click="openLinkedQuoteModal\(linkedQuoteDuplicateSourceId\)"/)
  assert.match(wizard, /if \(props\.rateId\) \{\s*await hydrateExistingRate\(\)/)
})

test('modal lists sent/accepted quotations for the same customer, linking only accepted QUOs', () => {
  assert.match(modal, /PricingService\.getRate\(props\.rateId\)/)
  assert.match(modal, /crm-account\//)
  assert.match(modal, /crm-lead\//)
  assert.match(modal, /statuses: \['Sent', 'AcceptedByClient'\]/)
  assert.match(modal, /target\.status !== 'AcceptedByClient'/)
  assert.match(modal, /sameClient\(current, target\)/)
  assert.match(modal, /linkedAcceptedRateId: target\.id/)
  assert.match(modal, /status: 'QUOVinculada'/)
  assert.match(modal, /allowedStatuses\.has\(source\.value\.status\)/)
})
