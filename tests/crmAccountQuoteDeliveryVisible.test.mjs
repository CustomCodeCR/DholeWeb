import { readFileSync } from 'node:fs'
import { strict as assert } from 'node:assert'
import test from 'node:test'

const hub = readFileSync(new URL('../src/modules/crm/components/CrmAccountHub.vue', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../src/modules/crm/components/CrmQuoteDeliveryPanel.vue', import.meta.url), 'utf8')

test('account header renders Enviar cotización without requiring a linked rate or the Quotes tab', () => {
  const header = hub.slice(hub.indexOf('<header class="hub-record-header'), hub.indexOf('</header>'))
  assert.match(header, /<button v-if="!editing" type="button" class="hub-primary-button"[\s\S]*?Enviar cotización/)
  assert.doesNotMatch(header, /recentQuotes\.length\s*[!>=]/)
  assert.match(header, /aria-controls="crm-account-quote-delivery"/)
  assert.match(header, /@click="quoteDeliveryOpen \? closeQuoteDelivery\(\) : openQuoteDelivery\(\)"/)
})

test('delivery panel is global above any account section and shared with quote-row actions', () => {
  const globalPanel = hub.indexOf('<div v-if="quoteDeliveryOpen" ref="quoteDeliveryAnchor"')
  assert.ok(globalPanel > 0)
  assert.ok(globalPanel < hub.indexOf('<div v-if="activeTab === \'summary\'"'))
  assert.match(hub, /<CrmQuoteDeliveryPanel :quote="quoteToSend" :quotes="sendableQuotes"/)
  assert.match(hub, /@click="openQuoteDelivery\(q\)"/)
  assert.match(hub, /@sent="quoteSent" @cancel="closeQuoteDelivery"/)
})

test('recipient and quotation choices remain accessible with zero linked quotes', () => {
  assert.match(panel, /<option value="">Seleccioná la cotización<\/option>/)
  assert.match(panel, /v-else-if="!quotes\.length"/)
  assert.match(panel, /Solo al vendedor/)
  assert.match(panel, /Enviar al cliente/)
  assert.match(panel, /v-model="selectedContactId"/)
  assert.match(panel, /v-if="!emailContacts\.length"/)
  assert.match(panel, /@click="emit\('open-contacts'\)"/)
  assert.match(panel, /:disabled="!canSend"/)
  assert.match(panel, /contactId: destination\.value === 'client' \? selectedContactId\.value : null/)
  assert.match(panel, /deliveryTarget: destination\.value/)
})

test('only sendable statuses are selectable and account permissions stay enforced', () => {
  assert.match(hub, /const sendableQuotes = computed\(\(\) => pricingQuotes\.value\.filter/)
  assert.match(hub, /'Open', 'ApprovedByManagement', 'RequestedByClient'/)
  assert.match(hub, /has\('crm\.quote\.read'\).*has\('crm\.account\.update'\)/s)
  assert.match(panel, /props\.authorized && !sending\.value/)
  assert.match(panel, /Boolean\(selectedQuote\.value\)/)
})
