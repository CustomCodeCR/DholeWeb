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

test('Dynamics-style CRM account shows full-width three-column workspace and timeline', () => {
  const hub = read('src/modules/crm/components/CrmAccountHub.vue')
  const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
  for (const marker of [
    'hub-record-header sticky', 'role="tablist"',
    'xl:grid-cols-[minmax(0,.94fr)_minmax(0,1.14fr)_minmax(265px,.86fr)]',
    'Escala de tiempo', 'Contactos relacionados', 'Historial de tarifas',
    'Ficha comercial', '<CrmCatalogPicker', '<DhDrawer :open="routeEditor"',
    '<DhDrawer :open="Boolean(editor)"', 'var(--dh-card)', 'var(--dh-border)',
  ]) assert.ok(hub.includes(marker), 'Missing CRM UI element: ' + marker)
  assert.ok(detail.includes('max-w-[1750px]'))
  assert.ok(detail.includes('@change-executive="openExecutiveDrawer"'))
  assert.ok(!hub.includes('<form v-if="routeEditor"'))
  assert.ok(!hub.includes('<form v-if="editor"'))
})

test('CRM has scoped contacts directory and detail routes like Dynamics', () => {
  const contacts = read('src/modules/crm/views/CrmContactsDirectory.vue')
  const detail = read('src/modules/crm/views/CrmContactDetailView.vue')
  const main = read('src/shared/components/layouts/MainLayout.vue')
  const router = read('src/core/router/index.ts')
  const scopes = read('src/core/auth/scopes.ts')
  assert.ok(router.includes("path: 'crm/contacts'"))
  assert.ok(router.includes("path: 'crm/contacts/:id'"))
  assert.ok(router.includes("requiredScope: 'crm.contact.read'"))
  assert.ok(main.includes("key: 'contacts'"))
  assert.ok(main.includes("group: 'CLIENTES'"))
  assert.ok(scopes.includes("'crm.contact.read'"))
  assert.ok(contacts.includes("crmList('contacts'"))
  assert.ok(contacts.includes("'/api/crm/accounts/'"))
  assert.ok(contacts.includes("CrmReferencePicker"))
  assert.ok(contacts.includes("DhDrawer"))
  assert.ok(detail.includes("crmPatch('contacts'"))
  assert.ok(detail.includes("Preferencias de contacto"))
})

test('CRM account creation uses true multi-section form and opens completed record', () => {
  const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
  assert.ok(workspace.includes("accountFormTab"))
  assert.ok(workspace.includes("Contactos y logística"))
  assert.ok(workspace.includes("CrmHaciendaLookup"))
  assert.ok(workspace.includes("countryLabels"))
  assert.ok(workspace.includes("customerTypeCode: accountTypeFilter.value"))
  assert.ok(workspace.includes("categoryCode: accountCategoryFilter.value"))
  assert.ok(workspace.includes("router.push('/crm/accounts/'"))
  assert.ok(workspace.includes("Guardar y abrir ficha"))
  assert.ok(workspace.includes('size="xl"') || workspace.includes("'xl' : 'lg'"))
  assert.ok(workspace.includes("La consulta fiscal de Hacienda"))
})

test('CRM Config selectors are searchable in a single control', () => {
  const picker = read('src/modules/crm/components/CrmCatalogPicker.vue')
  assert.ok(picker.includes("data-crm-catalog-picker"))
  assert.ok(picker.includes("aria-haspopup=\"listbox\""))
  assert.ok(picker.includes("catalogGroupSlug: props.catalogGroupSlug"))
  assert.ok(picker.includes("role=\"option\""))
  assert.ok(picker.includes("clearTimeout"))
  assert.ok(!picker.includes("<DhSelect"))
})

test('CRM customer onboarding persists authorized contact and address as related records', () => {
  const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
  const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
  assert.ok(workspace.includes("relatedDraft.contactName"))
  assert.ok(workspace.includes("relatedDraft.addressText"))
  assert.ok(workspace.includes("can('crm.contact.create')"))
  assert.ok(workspace.includes("can('crm.account.update')"))
  assert.ok(workspace.includes("'/contacts', 'POST'"))
  assert.ok(workspace.includes("'/addresses', 'POST'"))
  assert.ok(workspace.includes("missing.push('contactos')"))
  assert.ok(workspace.includes("missing.push('direcciones')"))
  assert.ok(detail.includes("route.query.onboarding === 'partial'"))
})

test('Sidebar sections remain accessible and CRM groups preserve navigation with a refined layout', () => {
  const component = read('src/shared/components/organisms/DhSidebar.vue')
  for (const group of ['INICIO', 'CLIENTES', 'VENTAS', 'ACTIVIDADES', 'ANÁLISIS', 'ADMINISTRACIÓN']) {
    assert.ok(mainLayout.includes("group: '" + group + "'"), 'missing CRM group: ' + group)
  }
  assert.match(component, /function groupedChildren\(item: SidebarItem\)/)
  assert.match(component, /sectionStateKey\(item\)/)
  assert.match(component, /groupStateKey\(item, group\.id\)/)
  assert.match(component, /groupStateKey\(item, group\.id\) === key && groupIsActive\(group\)/)
  assert.match(component, /if \(!key\.includes\(':group:'\)\) return true/)
  assert.match(component, /function onSectionClick\(item: SidebarItem\)/)
  assert.match(component, /@click="onSectionClick\(item\)"/)
  assert.match(component, /@click="toggleExpanded\(groupStateKey\(item, group\.id\)\)"/)
  assert.match(component, /:aria-expanded="isExpanded\(groupStateKey\(item, group\.id\)\)"/)
  assert.match(component, /localStorage\.setItem\(NAVIGATION_STATE_KEY/)
  assert.match(component, /watch\(\s*\(\) => route\.path/)
  assert.match(component, /v-if="!compact && isExpanded\(sectionStateKey\(item\)\)"/)
  assert.match(component, /v-if="!group\.label \|\| isExpanded/)
  assert.match(component, /:to="child\.path \?\? '\/'"/)
  assert.match(component, /active-class="sidebar-nav-link-active"/)
  assert.match(component, /@click="emit\('close'\)"/)
  assert.match(component, /sidebar-nav-link-active::before/)
  assert.match(component, /sidebar-module-toggle--current/)
  assert.match(component, /sidebar-subgroup-toggle--current/)
  assert.ok(!component.includes("border-t border-[var(--dh-border)]"), 'avoid repeating dividers for every group')
})

test('CRM route history is sourced from completed meetings or linked quotes', () => {
  const hub = read('src/modules/crm/components/CrmAccountHub.vue')
  const sidebar = read('src/shared/components/organisms/DhSidebar.vue')
  assert.ok(hub.includes("'route-history'"))
  assert.ok(hub.includes("sourceKind: routeSourceKind.value"))
  assert.ok(hub.includes("routeSourceId.value"))
  assert.ok(hub.includes("routeHistoryTotal"))
  assert.ok(hub.includes("popularRoutes"))
  assert.ok(hub.includes("catalog-group-slug=\"pol\""))
  assert.ok(hub.includes("catalog-group-slug=\"poe\""))
  assert.ok(hub.includes("catalog-group-slug=\"pod\""))
  assert.ok(hub.includes("Registrar una visita") || hub.includes("Programar una visita"))
  assert.ok(sidebar.includes("isCrmSection(item) || !group.label"))
  assert.ok(sidebar.includes("group.label && isCrmSection(item)"))
})

test('CRM business profile is editable and new clients can capture corporate details', () => {
  const hub = read('src/modules/crm/components/CrmAccountHub.vue')
  const workspace = read('src/modules/crm/views/CrmWorkspaceView.vue')
  assert.ok(hub.includes("'business-profile'"))
  assert.ok(hub.includes("profileDraft"))
  assert.ok(hub.includes("expectedVersion: businessProfile.value?.rowVersion"))
  assert.ok(hub.includes("companyHistory"))
  assert.ok(hub.includes("operationalInstructions"))
  assert.ok(workspace.includes("Datos empresariales"))
  assert.ok(workspace.includes("companyDraft.businessActivity"))
  assert.ok(workspace.includes("companyDraft.products"))
  assert.ok(workspace.includes("'/business-profile', 'PUT'"))
  assert.ok(workspace.includes("missing.push('datos empresariales')"))
})
