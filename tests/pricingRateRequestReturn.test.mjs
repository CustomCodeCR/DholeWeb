import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const panel = read('src/modules/pricing/components/PricingRateRequestsPanel.vue')
const seller = read('src/modules/dashboard/components/SellerRoleDashboard.vue')
const edit = read('src/modules/pricing/views/PricingSellerRateRequestView.vue')
const transform = read('build/pricingSellerRequestEdit.ts')
const service = read('src/modules/pricing/services/rateRequestLeaseService.ts')
const navigation = read('src/core/utils/notificationNavigation.ts')

test('Pricing requires return reason and a valid lease, next to Continue', () => {
  assert.match(panel, /Devolver solicitud/)
  assert.match(panel, /returnReason\.trim\(\)\.length < 10/)
  assert.match(panel, /RateRequestLeaseService\.returnToSeller\(request\.id, reason\)/)
  assert.match(service, /return-to-seller/)
  assert.match(service, /X-Rate-Request-Lease/)
})

test('Seller dashboard shows reason and allows editing returned requests', () => {
  assert.match(seller, /Devuelta para corregir/)
  assert.match(seller, /request\.returnReason \|\| request\.payload\?\.pricingReturn\?\.reason/)
  assert.match(seller, /Corregir y reenviar/)
  assert.match(edit, /\['Open', 'Returned'\]\.includes\(request\.status\)/)
  assert.match(transform, /'Returned'\]\.includes\(request\.status\)/)
  assert.match(navigation, /pricing\.rate-request\.returned/)
})
