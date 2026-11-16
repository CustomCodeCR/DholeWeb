import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync('src/modules/pricing/views/PricingOwnLclView.vue', 'utf8')
const service = readFileSync('src/core/services/ownLclConsolidationService.ts', 'utf8')

test('consolidado shows linked quotations with stale response guards', () => {
  assert.match(view, /QUOs vinculadas a este consolidado/)
  assert.match(view, /v-for="quote in linkedQuotes"/)
  assert.match(view, /OwnLclConsolidationService\.getLinkedQuotes\(consolidationId\)/)
  assert.match(view, /selectedId\.value !== consolidationId/)
})
test('linked quote opens in read-only wizard, respecting rate view scope', () => {
  assert.match(view, /name: 'pricing-rate-wizard', params: \{ rateId: quote\.id \}, query: \{ mode: 'view' \}/)
  assert.match(service, /\/api\/pricing\/own-lcl-consolidations\/\{\{id\}\}\/quotes/)
  assert.match(view, /hasScope\('pricing\.rate\.view'\)/)
})

