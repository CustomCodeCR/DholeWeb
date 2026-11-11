import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import test from 'node:test'

const hub = readFileSync(new URL('../src/modules/crm/components/CrmAccountHub.vue', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/modules/crm/components/CrmQuoteDeliveryPanel.vue', import.meta.url), 'utf8')

test('account-wide configuration remains accessible with zero linked quotations', () => {
  const header = hub.slice(hub.indexOf('<header class="hub-record-header'), hub.indexOf('</header>'))
  assert.match(header, /Configurar envío de cotizaciones/)
  assert.doesNotMatch(header, /recentQuotes\.length\s*[!>=]/)
  assert.match(header, /aria-controls="crm-account-quote-delivery"/)
  assert.match(hub, /<CrmQuoteDeliveryPanel :account-id="rowId\(account\.id\)"/)
})

test('save a persistent account-level rule, not send a particular quotation', () => {
  assert.match(panel, /Destinatarios de futuras cotizaciones/)
  assert.match(panel, /No envía ninguna cotización ahora/)
  assert.match(panel, /crmPath\('accounts', props\.accountId, 'quote-delivery'\)/)
  assert.match(panel, /crmRequest<Preference>\(endpoint\(\), 'PUT'/)
  assert.match(panel, /expectedVersion: rowVersion\.value/)
  assert.match(panel, /deliveryTarget: destination\.value/)
  assert.match(panel, /contactId: destination\.value === 'client'/)
  assert.doesNotMatch(panel, /PricingService\.setRateStatus/)
  assert.doesNotMatch(panel, /selectedQuoteId/)
})

test('seller-only versus client + assigned seller CC with contact validity', () => {
  assert.match(panel, /Solo al vendedor/)
  assert.match(panel, /Al contacto del cliente/)
  assert.match(panel, /Con copia al vendedor asignado/)
  assert.match(panel, /v-model="contactId"/)
  assert.match(panel, /selectedContact\?\.email/)
  assert.match(panel, /!saving\.value/)
  assert.match(panel, /props\.authorized/)
})

test('the per-quotation send action was removed from the list', () => {
  assert.doesNotMatch(hub, /@click="openQuoteDelivery\(q\)"/)
  assert.doesNotMatch(hub, /const quoteToSend/)
  assert.doesNotMatch(hub, /sendableQuotes/)
})
