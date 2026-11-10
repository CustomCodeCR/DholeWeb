import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync('src/modules/crm/components/CrmLegacyQuoteManager.vue', 'utf8')
const accountHub = readFileSync('src/modules/crm/components/CrmAccountHub.vue', 'utf8')

test('the historical QUO migration list only queries unlinked quotations', () => {
  assert.match(source, /crm-legacy-catalog/)
  assert.match(source, /linkStatus: 'unlinked'/)
  assert.doesNotMatch(source, /value="all">Todas las QUO/)
  assert.doesNotMatch(source, /value="linked">Ya vinculadas/)
  assert.match(source, /Cotizaciones históricas que aún no tienen cuenta o prospecto CRM/)
  assert.match(source, /catalogPage\.value = 1\s+await reloadAll\(\)/)
})
test('the unlinked list uses Dhole table and server pagination', () => {
  assert.match(source, /DhDataTable/)
  assert.match(source, /DhPagination/)
  assert.match(source, /page: String\(catalogPage\.value\)/)
  assert.match(source, /pageSize: String\(catalogPageSize\.value\)/)
  assert.match(source, /@update:page="changeCatalogPage"/)
  assert.match(source, /@update:page-size="changeCatalogPageSize"/)
  assert.match(source, /Math\.ceil\(catalogTotal\.value \/ catalogPageSize\.value\)/)
})
test('confirmed link persists the current CRM account display name and executive', () => {
  assert.match(source, /const canSelect = \(quote: Quote\) => !quote\.clientAccountId && !quote\.clientLeadId/)
  assert.match(source, /selected\.value\.length > 0 && confirmed\.value/)
  assert.match(source, /clientName: props\.clientName/)
  assert.match(source, /executiveName: props\.executiveName \|\| null/)
  assert.match(source, /confirmedForAccount: true/)
  assert.match(source, /rateIds: \[\.\.\.selected\.value\]/)
  assert.match(source, /emit\('changed'\)/)
})
test('already linked tariffs support explicit CRM identity reconciliation', () => {
  assert.match(source, /syncLinkedClient/)
  assert.match(source, /\/sync-client/)
  assert.match(source, /Sincronizar cliente y ejecutivo CRM en tarifas existentes/)
  assert.match(source, /Cotizaciones vinculadas a esta cuenta/)
  assert.match(source, /label: 'Cliente CRM'/)
  assert.match(source, /label: 'Ejecutivo'/)
  assert.equal((accountHub.match(/:executive-name="assignedSellerName"/g) ?? []).length, 2)
  assert.equal((accountHub.match(/@changed="handleQuoteLinked"/g) ?? []).length, 2)
  assert.match(accountHub, /function handleQuoteLinked\(\)/)
})
