import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync(
  new URL('../src/modules/dashboard/components/SellerRoleDashboard.vue', import.meta.url),
  'utf8',
)

test('seller status cards navigate to their filtered results instead of silently changing state', () => {
  assert.match(dashboard, /@click="selectStatus\(card\.filter\)"/)
  assert.match(dashboard, /aria-controls="seller-rates-section"/)
  assert.match(dashboard, /id="seller-rates-section" ref="ratesSection"/)
  assert.doesNotMatch(dashboard, /@click="statusFilter = card\.filter"/)
})

test('status card navigation clears stale searches, resets pagination and scrolls after rendering', () => {
  assert.match(
    dashboard,
    /async function selectStatus\(filter: SellerStatusFilter\) \{\s*search\.value = ''\s*statusFilter\.value = filter\s*currentPage\.value = 1\s*await nextTick\(\)\s*ratesSection\.value\?\.scrollIntoView\(/,
  )
})

test('supervisor rates continue using selected seller and are read-only', () => {
  assert.match(dashboard, /props\.adminPreview && selectedSellerId\.value/)
  assert.match(dashboard, /v-if="!props\.adminPreview"/)
  assert.match(dashboard, /\/api\/pricing\/seller-rates\/dashboard/)
})
