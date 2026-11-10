import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')

test('historical QUO catalog loads all quotations without a required historical client name', () => {
  assert.match(source, /crm-legacy-catalog/)
  assert.match(source, /linkStatus = ref<'all' \| 'unlinked' \| 'linked'>\('all'\)/)
  assert.match(source, /void reloadAll\(\)/)
  assert.doesNotMatch(source, /name\.value\.trim\(\)\.length < 3/)
})
test('historical QUO listing uses Dhole table, server-side paging, and link filters', () => {
  assert.match(source, /DhDataTable/)
  assert.match(source, /DhPagination/)
  assert.match(source, /page: String\(catalogPage\.value\)/)
  assert.match(source, /pageSize: String\(catalogPageSize\.value\)/)
  assert.match(source, /@update:page="changeCatalogPage"/)
  assert.match(source, /@update:page-size="changeCatalogPageSize"/)
})
test('historical quotes are only manually linked when unassigned and ownership confirmed', () => {
  assert.match(source, /const canSelect = \(quote: Quote\) => !quote\.clientAccountId && !quote\.clientLeadId/)
  assert.match(source, /selected\.value\.length > 0 && confirmed\.value/)
  assert.match(source, /confirmedForAccount: true/)
  assert.match(source, /rateIds: \[\.\.\.selected\.value\]/)
  assert.match(source, /emit\('changed'\)/)
})
