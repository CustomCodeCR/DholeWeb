import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const manager = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')
const account = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')
const dashboard = readFileSync('src/modules/crm/components/CrmAccountQuotesDashboard.vue', 'utf8')

test('historical quote migration has page-wide and filtered cross-page select-all', () => {
  assert.match(manager, /selectCurrentPage\(\)/)
  assert.match(manager, /selectAllMatching\(\)/)
  assert.match(manager, /Seleccionar toda la página/)
  assert.match(manager, /Seleccionar todos los resultados/)
  assert.match(manager, /Math\.ceil\(catalogTotal\.value \/ 100\)/)
  assert.match(manager, /pageSize: '100'/)
  assert.match(manager, /catalogTotal\.value > 1000/)
  assert.match(manager, /!query/)
  assert.match(manager, /!confirmed\.value|confirmed\.value/)
  assert.match(manager, /linkStatus: 'unlinked'/)
})

test('pricing account quotes, not opportunity snapshots, drive CRM indicators', () => {
  assert.match(dashboard, /fetchClient<QuoteDashboard>/)
  assert.match(dashboard, /\/crm-account\/' \+ encodeURIComponent\(id\) \+ '\/dashboard'/)
  assert.doesNotMatch(dashboard, /crmPath\('accounts', props\.accountId, 'quote-dashboard'\)/)
  assert.match(dashboard, /props\.refreshKey/)
  assert.match(account, /<CrmAccountQuotesDashboard[^>]+:refresh-key="quoteRefreshKey"/)
})

test('route and account quote history use authoritative Pricing link by account id', () => {
  assert.match(account, /async function loadPricingQuotes\(\)/)
  assert.match(account, /async function loadQuotedRoutes\(\)/)
  assert.match(account, /\/api\/pricing\/rates\/crm-account\//)
  assert.doesNotMatch(account, /'quote-route-snapshots'/)
  assert.match(account, /quoteRouteTotal\.value = Math\.max\(byId\.size,/)
  assert.match(account, /const recentQuotes = computed\(\(\) => pricingQuotes\.value\)/)
  assert.match(account, /quoteRefreshKey\.value\+\+/)
  assert.match(account, /hasOpportunityQuote\(rowId\(q\.pricingQuoteId\)\)/)
})

test('link changes refresh quote history, routes and KPI independently', () => {
  assert.match(account, /function handleQuoteLinked\(\)/)
  assert.match(account, /void loadPricingQuotes\(\)/)
  assert.match(account, /void loadQuotedRoutes\(\)/)
  assert.match(manager, /emit\('changed'\)/)
})

test('popular routes are aggregated only from authorized Pricing account quotations', () => {
  assert.match(account, /const pricingPopularRoutes = computed/)
  assert.match(account, /pricingQuotes\.value/)
  assert.match(account, /route\.count/)
  assert.match(account, /Rutas más cotizadas \(Pricing\)/)
  assert.match(account, /quoteRouteTotal/)
})
