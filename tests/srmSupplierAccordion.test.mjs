import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const view = readFileSync(new URL('../src/modules/srm/views/SrmWorkspaceView.vue', import.meta.url), 'utf8')
test('supplier profile and routes use native DhDrawers with accessible tabs', () => {
  assert.match(view, /<DhDrawer :open="formVisible"/)
  assert.match(view, /<DhDrawer :open="detailsVisible/)
  assert.match(view, /role="tablist"/)
  assert.match(view, /role="tabpanel"/)
  assert.match(view, /SrmSupplierRoutesPanel/)
  assert.doesNotMatch(view, /<DhModal :open="formVisible"/)
  for (const key of ['identity', 'contacts', 'banks', 'credit', 'tariffs']) {
    assert.ok(view.includes('data-srm-accordion="' + key + '"'))
  }
})
test('a validation error expands the proper collapsed section', () => {
  assert.match(view, /anchor\?\.closest\('details'\)/)
  assert.match(view, /accordion\.open = true/)
  assert.match(view, /data-srm-save-section="bank"/)
  assert.match(view, /data-srm-save-section="credit"/)
  assert.match(view, /data-srm-save-section="contacts"/)
})
