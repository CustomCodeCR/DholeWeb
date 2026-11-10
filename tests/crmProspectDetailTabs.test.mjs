import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const detail = readFileSync('src/modules/crm/views/CrmRecordDetailView.vue', 'utf8')
const commercial = readFileSync('src/modules/crm/components/CrmLeadCommercialPanel.vue', 'utf8')

test('prospects show one role-authorized tab panel at a time like CRM accounts', () => {
  assert.match(detail, /role="tablist" aria-label="Secciones del prospecto"/)
  for (const tab of ['summary', 'analysis', 'quotes', 'agenda', 'conversion']) {
    assert.match(detail, new RegExp("leadTab === '" + tab + "'"))
    assert.match(detail, new RegExp("crm-lead-panel-" + tab))
  }
  assert.match(detail, /:aria-selected="leadTab === tab.key"/)
  assert.match(detail, /role="tabpanel"/)
})
test('commercial analysis and quote panels are separately rendered and loaded', () => {
  assert.match(detail, /view="analysis"/)
  assert.match(detail, /view="quotes"/)
  assert.match(commercial, /props.view !== 'quotes' \? \[loadAnalyses\(\)\]/)
  assert.match(commercial, /props.view !== 'analysis' \? \[loadQuotes\(\), loadOpportunities\(\)\]/)
})
test('conversion deep links open the conversion tab', () => {
  assert.match(detail, /route.hash === '#crm-lead-conversion'/)
  assert.match(detail, /@click.prevent="showLeadTab\('conversion'\)"/)
  assert.match(detail, /id="crm-lead-conversion"/)
})
