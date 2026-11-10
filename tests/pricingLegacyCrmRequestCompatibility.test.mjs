import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const commercial = readFileSync('build/pricingCommercialIdentityFields.ts', 'utf8')
const edit = readFileSync('build/pricingSellerRequestEdit.ts', 'utf8')
const requests = readFileSync('build/pricingSellerRateRequests.ts', 'utf8')
const picker = readFileSync('src/modules/pricing/components/PricingCrmClientSelect.vue', 'utf8')
const manager = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')

test('Only persisted legacy work can bypass immediate CRM linking', () => {
  assert.match(commercial, /allowLegacyUnlinkedCrmWork = computed/)
  assert.match(commercial, /props\.sellerEditRequestId \|\|/)
  assert.match(commercial, /props\.rateRequestId \|\|/)
  assert.match(commercial, /!editingRate\.value\.clientAccountId/)
  assert.match(commercial, /!props\.sellerEditRequestId &&/)
  assert.match(commercial, /Seleccione una cuenta o prospecto válido del CRM para solicitudes nuevas/)
  assert.match(commercial, /legacy-optional=/)
  assert.match(picker, /legacyOptional\?: boolean/)
})

test('Seller requests display current linked CRM identity without rewriting the original form', () => {
  assert.match(requests, /if \(request\.clientName\) form\.clientName = request\.clientName/)
  assert.match(requests, /if \(request\.executiveName\) form\.executiveName = request\.executiveName/)
  assert.match(edit, /if \(request\.clientName\) form\.clientName = request\.clientName/)
  assert.match(manager, /requestsUpdated/)
})
