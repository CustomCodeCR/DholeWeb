import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const helper = readFileSync(new URL('../src/modules/crm/model/crmDuplicateProspect.ts', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/modules/crm/views/CrmWorkspaceView.vue', import.meta.url), 'utf8')
const crmSource = readFileSync(new URL('../src/modules/crm/services/crmApi.ts', import.meta.url), 'utf8')

test('duplicate prospect alert requires structured CRM 409 with seller name', () => {
  assert.match(helper, /CRM_LEAD_DUPLICATE/)
  assert.match(helper, /Number\(status\) !== 409/)
  assert.match(helper, /data\.sellerName/)
  assert.match(helper, /No se creó otro prospecto/)
})

test('prospect form preserves drawer and emits Dhole toast for duplicate identity', () => {
  assert.match(workspace, /crmDuplicateProspectAlert\(e\)/)
  assert.match(workspace, /toastStore\.warning\(duplicate\.title, duplicate\.message\)/)
  assert.match(workspace, /error\.value = duplicate\.message/)
  assert.match(crmSource, /status === 409/)
})
