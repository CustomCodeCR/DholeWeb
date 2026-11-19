import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const builder = readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue', 'utf8')
const manager = readFileSync('src/modules/crm/components/CrmCommercialBenefitsManager.vue', 'utf8')

test('Quote-like route selector supports the four eligible shipments', () => {
  for (const part of ['FCL', 'FTL', 'LCL propio', 'LTL propio', 'POL', 'POE', 'POD',
    'Equipo', 'Tipo de cliente', 'Modalidad', 'Embarque'])
    assert.ok(builder.includes(part), part)
  assert.ok(manager.includes('<CrmPreferentialRouteBuilder'))
})
test('Sale overrides are linked to source cost without changing cost in Pricing', () => {
  assert.ok(builder.includes('cost.costAmount'))
  assert.ok(builder.includes('cost.saleAmount'))
  assert.ok(builder.includes('sourceCostId: cost.id'))
  assert.ok(builder.includes("rateType: 'FIXED_AMOUNT'"))
  assert.ok(builder.includes('insuranceCostPercent'))
  assert.ok(builder.includes('insuranceSalePercent'))
  assert.doesNotMatch(builder, /PricingService\.updateCost|PricingService\.createCost/)
})

test('Saved preferential tariffs are scoped by the selected carrier and Incoterm', () => {
  for (const part of ['route.carrierCode', 'route.incotermCode', 'matchesPreferentialCommercialScope',
    'Todas las navieras', 'Todos los Incoterms'])
    assert.ok(builder.includes(part), part)
  assert.ok(manager.includes('carrierCode: draft.carrierCode'))
  assert.ok(manager.includes('incotermCode: draft.incotermCode'))
  assert.ok(manager.includes("carrierCode: rate.carrierCode ?? ''"))
  assert.ok(manager.includes("incotermCode: rate.incotermCode ?? ''"))
})
