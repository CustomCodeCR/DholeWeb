import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(path, 'utf8')
const detail = read('src/modules/crm/views/CrmRecordDetailView.vue')
const commercial = read('src/modules/crm/components/CrmLeadCommercialPanel.vue')
const dashboard = read('src/modules/crm/components/CrmAccountQuotesDashboard.vue')
const legacy = read('src/modules/crm/components/CrmLegacyQuoteManager.vue')

test('prospects show account-style tab panels according to permissions', () => {
  assert.match(detail, /role="tablist" aria-label="Secciones del prospecto"/)
  for (const tab of ['summary', 'profile', 'analysis', 'quotes', 'history', 'agenda', 'conversion']) {
    assert.match(detail, new RegExp("leadTab === '" + tab + "'"))
    assert.match(detail, new RegExp("crm-lead-panel-" + tab))
  }
  assert.match(detail, /:aria-selected="leadTab === tab.key"/)
  assert.match(detail, /role="tabpanel"/)
  assert.match(detail, /crm\.quote\.read/)
})

test('prospect Quotes read directly from Pricing ClientLeadId, not only CRM opportunities', () => {
  assert.match(commercial, /\/api\/pricing\/rates\/crm-lead\//)
  assert.match(commercial, /quote\.pricingQuoteId/)
  assert.match(commercial, /quoteNumberSnapshot/)
  assert.match(commercial, /quote\.polName/)
  assert.match(commercial, /quote\.executiveName/)
  assert.match(commercial, /loadQuotes\(\)/)
  assert.match(detail, /view="history"/)
  assert.match(commercial, /data-crm-lead-pricing-analysis/)
  assert.doesNotMatch(commercial, /crmPath\('leads', leadId, 'quotes'\)/)
})

test('shared KPI dashboard asks Pricing for official lead and account totals', () => {
  assert.match(dashboard, /\/api\/pricing\/rates\/crm-lead\//)
  assert.match(dashboard, /\/api\/pricing\/rates\/crm-account\//)
  assert.match(dashboard, /props\.leadId/)
  assert.match(commercial, /CrmAccountQuotesDashboard/)
})

test('only privileged users may reconcile historical QUO to a lead', () => {
  assert.match(commercial, /canManageHistoricalQuoteLinks/)
  assert.match(commercial, /hasRole\(role\)/)
  assert.match(commercial, /CrmLegacyQuoteManager/)
  assert.match(legacy, /crm-legacy-lead-reconcile/)
  assert.match(legacy, /confirmedForLead: true/)
  assert.match(legacy, /clientLeadId/)
  assert.match(legacy, /linkStatus: 'unlinked'/)
  assert.match(legacy, /!quote\.clientAccountId && !quote\.clientLeadId/)
})

test('conversion deep links open the conversion tab', () => {
  assert.match(detail, /route\.hash === '#crm-lead-conversion'/)
  assert.match(detail, /@click\.prevent="showLeadTab\('conversion'\)"/)
  assert.match(detail, /id="crm-lead-conversion"/)
})
