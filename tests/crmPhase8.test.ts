import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const view = read('src/modules/crm/views/CrmIntegrationsView.vue')
const router = read('src/core/router/index.ts')
const sidebar = read('src/core/composables/useSidebarItems.ts')
const crmApi = read('src/modules/crm/services/crmApi.ts')
const translations = read('src/modules/crm/i18n.ts')

test('Phase 8 console is hidden without CRM feature and integration read permission', () => {
  assert.match(view, /crmEnabled\(\) && auth\.hasScope\('crm\.integration\.read'\)/)
  assert.match(view, /crm\.integration\.manage/)
  assert.match(router, /path: 'crm\/integrations'/)
  assert.match(router, /requiredAnyScopes: \['crm\.integration\.read'\]/)
  assert.match(sidebar, /'crm\.nav\.integrations'/)
  assert.match(crmApi, /VITE_CRM_ENABLED === 'true'/)
})

test('read-only users cannot trigger dry-run/import/retry', () => {
  assert.match(view, /v-if="canManage"/)
  assert.match(view, /if \(!canManage\.value/)
  assert.match(view, /@click="dryRun"/)
  assert.match(view, /@click="enqueue"/)
  assert.match(view, /@click="retry\(job\)"/)
})

test('phase 8 console uses persistent server jobs and does not simulate success', () => {
  assert.match(view, /api\/crm\/integrations\/jobs/)
  assert.match(view, /api\/crm\/integrations\/dynamics\/dry-run/)
  assert.match(view, /api\/crm\/integrations\/dynamics\/run/)
  assert.match(view, /Idempotency-Key|pendingKey/)
  assert.match(view, /preview\.truncated \|\| preview\.conflicts > 0/)
  assert.doesNotMatch(view, /localStorage\./)
  assert.doesNotMatch(view, /http:\/\/crm-api/)
  assert.match(translations, /"integrations": "Dynamics y Hacienda"/)
  assert.match(translations, /"integrations": "Dynamics and Hacienda"/)
})
