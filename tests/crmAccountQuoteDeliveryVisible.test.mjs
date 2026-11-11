import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import test from 'node:test'

const hub = readFileSync(new URL('../src/modules/crm/components/CrmAccountHub.vue', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/modules/crm/components/CrmQuoteDeliveryPanel.vue', import.meta.url), 'utf8')

test('the account header always exposes Configurar envío de cotizaciones', () => {
  const header = hub.slice(hub.indexOf('<header class="hub-record-header'), hub.indexOf('</header>'))
  assert.match(header, /Configurar envío de cotizaciones/)
  assert.match(header, /aria-controls="crm-account-quote-delivery"/)
  assert.doesNotMatch(header, /recentQuotes\.length\s*[!>=]/)
})

test('account-level preference selector does not request an individual QUO', () => {
  assert.match(hub, /<CrmQuoteDeliveryPanel :account-id="rowId\(account.id\)"/)
  assert.doesNotMatch(panel, /selectedQuoteId|setRateStatus|pricingQuoteId|Confirmar y enviar cotización/)
  assert.match(panel, /todas las próximas cotizaciones/i)
  assert.match(panel, /<option value="">Seleccioná un contacto<\/option>/)
  assert.match(panel, /Solo al vendedor/)
  assert.match(panel, /Enviar al cliente/)
  assert.match(panel, /Con copia al vendedor asignado/)
})

test('preference is persisted to CRM and reloaded on account switch', () => {
  assert.match(panel, /watch\(\(\) => props.accountId, \(\) => \{ void loadPreference\(\) \}, \{ immediate: true \}\)/)
  assert.match(panel, /crmPath\('accounts', props.accountId, 'quote-delivery-preference'\)/)
  assert.match(panel, /'PUT'/)
  assert.match(panel, /expectedVersion: rowVersion.value/)
  assert.match(panel, /contactId: destination.value === 'client' \? selectedContactId.value : null/)
  assert.match(panel, /:disabled="!canSave"/)
  assert.match(panel, /props.authorized/)
})
