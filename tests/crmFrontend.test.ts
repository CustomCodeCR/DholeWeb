import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (file: string) => readFileSync(file, 'utf8')
const api = read('src/modules/crm/services/crmApi.ts')
const routes = read('src/core/router/index.ts')
const sidebar = read('src/core/composables/useSidebarItems.ts')
const mainLayout = read('src/shared/components/layouts/MainLayout.vue')
const views = read('src/modules/crm/views/CrmWorkspaceView.vue') +
  read('src/modules/crm/views/CrmRecordDetailView.vue')
const forms = read('src/modules/crm/model/crmForms.ts')

test('CRM is enabled by default but restricted to authorized users', () => {
  assert.match(api, /VITE_CRM_ENABLED !== 'false'/)
  assert.ok(routes.includes("to.path === '/crm' || to.path.startsWith('/crm/')"))
  assert.ok(routes.includes("!crmEnabled()) return '/home'"))
  assert.match(routes, /path: 'crm'/)
  assert.match(sidebar, /name: 'crm-root'/)
  assert.match(mainLayout, /items.push\(\{ label: t\('crm.title'\)/)
  assert.match(mainLayout, /crmEnabled\(\) && CRM_WORKSPACE_SCOPES\.some\(scope => canView\(scope\)\)/)
  assert.match(mainLayout, /item.scopes.some\(scope => canView\(scope\)\)/)
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

test('Finance screen lists authorized CRM accounts instead of requesting a raw UUID', () => {
  const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
  assert.match(workspace, /crmList\('accounts', \{ q: financeQuery\.value\.trim\(\)/)
  assert.match(workspace, /crm\.account\.read-all/)
  assert.match(workspace, /:model-value="selectedAccount"/)
  assert.match(workspace, /@update:model-value="selectedAccount = String\(\$event\)"/)
  assert.doesNotMatch(workspace, /v-model\.trim="selectedAccount"/)
})

test('CRM weekly agenda groups actual UTC instants by viewer local date', () => {
  const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
  assert.match(workspace, /crmAgendaRecordsForDay/)
  assert.match(workspace, /crm\.partialAgenda/)
  assert.doesNotMatch(workspace, /\.toISOString\(\)\.slice\(0,10\)/)
})
