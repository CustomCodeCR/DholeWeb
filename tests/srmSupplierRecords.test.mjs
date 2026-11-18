import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('supplier drawer retains followups, credit, tariffs and adds routes', () => {
  const view = read('src/modules/srm/views/SrmWorkspaceView.vue')
  assert.match(view, /SrmSupplierFollowupsPanel/)
  assert.match(view, /data-srm-accordion="tariffs"/)
  assert.match(view, /data-srm-accordion="followups"/)
  assert.match(view, /<DhDrawer :open="formVisible"/)
  assert.match(view, /role="tablist"/)
  assert.match(view, /SrmSupplierRoutesPanel/)
  assert.match(view, /kind="credit"/)
  assert.match(view, /kind="tariff"/)
})
test('supplier attachments are scoped per supplier and entity type', () => {
  const files = read('src/modules/srm/components/SrmSupplierFilesPanel.vue')
  assert.match(files, /DholeConfigService/)
  assert.match(files, /srm\.supplier\.credit/)
  assert.match(files, /srm\.supplier\.tariff/)
  assert.match(files, /storage\.files\.create/)
  assert.match(files, /storage\.files\.download/)
})
test('supplier followups use separate append-only API', () => {
  const api = read('src/modules/srm/services/srmApi.ts')
  assert.match(api, /async listFollowups/)
  assert.match(api, /async createFollowup/)
  const panel = read('src/modules/srm/components/SrmSupplierFollowupsPanel.vue')
  assert.match(panel, /createdAtUtc/)
  assert.match(panel, /createdByName/)
})
