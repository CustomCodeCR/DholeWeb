import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import test from 'node:test'

const hub = readFileSync(new URL('../src/modules/crm/components/CrmAccountHub.vue', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/modules/crm/components/CrmQuoteDeliveryPanel.vue', import.meta.url), 'utf8')

test('account header exposes permanent quote-delivery configuration independently of quotes', () => {
  const header = hub.slice(hub.indexOf('<header class="hub-record-header'), hub.indexOf('</header>'))
  assert.match(header, /Configurar envío de cotizaciones/)
  assert.match(header, /aria-controls="crm-account-quote-delivery"/)
  assert.doesNotMatch(header, /recentQuotes\.length\s*[!>=]/)
})

test('no per-quotation select or one-off send control remains', () => {
  assert.match(hub, /<CrmQuoteDeliveryPanel :account-id="rowId\(account.id\)"/)
  assert.doesNotMatch(panel, /selectedQuoteId|pricingQuoteId|setRateStatus|Seleccioná la cotización/)
  assert.doesNotMatch(hub, /@click="openQuoteDelivery\(q\)"/)
  assert.match(panel, /todas las próximas cotizaciones/)
})

test('CRM contacts use Dhole native multiselect and contactIds array', () => {
  assert.match(panel, /import DhMultiSelect from '@\/shared\/components\/atoms\/DhMultiSelect\.vue'/)
  assert.match(panel, /<DhMultiSelect v-model="selectedContactIds" :options="contactOptions"/)
  assert.match(panel, /contactIds: destination\.value === 'client' \? selectedContactIds\.value : \[\]/)
  assert.match(panel, /selectedContactIds\.value\.length === selectedContacts\.value\.length/)
  assert.match(panel, /selectionValid\.value/)
  assert.match(panel, /Con copia al vendedor|con copia al vendedor/i)
})

test('preference is loaded on account switch and saved for future quotation sends', () => {
  assert.match(panel, /watch\(\(\) => props\.accountId, \(\) => \{ void loadPreference\(\) \}, \{ immediate: true \}\)/)
  assert.match(panel, /crmPath\('accounts', props\.accountId, 'quote-delivery-preference'\)/)
  assert.match(panel, /'PUT'/)
  assert.match(panel, /expectedVersion: rowVersion\.value/)
  assert.match(panel, /:disabled="!canSave"/)
})
