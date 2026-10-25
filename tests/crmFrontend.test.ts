import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (file: string) => readFileSync(file, 'utf8')
const api = read('src/modules/crm/services/crmApi.ts')
const routes = read('src/core/router/index.ts')
const sidebar = read('src/core/composables/useSidebarItems.ts')
const views = read('src/modules/crm/views/CrmWorkspaceView.vue') +
  read('src/modules/crm/views/CrmRecordDetailView.vue')
const forms = read('src/modules/crm/model/crmForms.ts')

test('CRM route and menu are both guarded by a disabled-by-default flag', () => {
  assert.match(api, /VITE_CRM_ENABLED === 'true'/)
  assert.match(routes, /to.path.startsWith\('\/crm\/'\) && !crmEnabled\(\)/)
  assert.match(sidebar, /item.name === 'crm-root' && !crmEnabled\(\)/)
})
test('CRM requests use authenticated existing gateway client and idempotency', () => {
  assert.match(api, /import \{ fetchClient \} from '@\/core\/api\/fetchConfig'/)
  assert.match(api, /Idempotency-Key/)
  assert.doesNotMatch(api, /grpc:\/\//i)
  assert.doesNotMatch(api, /http:\/\/crm-api/)
})
test('CRM route metadata declares the real record-level read scopes', () => {
  for (const scope of ['crm.account.read', 'crm.lead.read', 'crm.opportunity.read',
    'crm.activity.read', 'crm.analysis.read', 'crm.credit.read', 'crm.contract.read']) {
    assert.ok(routes.includes(scope), 'missing scope ' + scope)
  }
  assert.match(routes, /requiredAnyScopes/)
})
test('Finance visibility and pricing linkage require independent scopes', () => {
  assert.match(views, /crm\.credit\.read/)
  assert.match(views, /crm\.contract\.read/)
  assert.match(views, /crm\.quote\.link/)
  assert.match(views, /expectedVersion/)
})
test('No fake backend success for reports, marketing or Dynamics sync', () => {
  assert.doesNotMatch(views, /api\/crm\/campaigns/)
  assert.doesNotMatch(views, /api\/crm\/integrations\/dynamics/)
  assert.doesNotMatch(views, /api\/crm\/targets/)
})
test('Editable CRM records preserve optimistic concurrency and ISO UTC', () => {
  assert.match(forms, /expectedVersion/)
  assert.match(forms, /toUtc/)
  assert.match(forms, /customerTypeCode/)
})
