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

test('Configurador permite ítems manuales, todos los conceptos y servicios opcionales', () => {
  for (const phrase of ['saveManual()', 'sourceCostId: null', 'serviceCodes: [...route.serviceCodes]',
    'showAllCosts', 'mostSpecificPreferentialRate', 'Agregar ítem manual', 'pricing-services',
    'Mostrar todos los ítems de Pricing', 'AIR']) assert.ok(builder.includes(phrase),phrase)
  assert.ok(manager.includes('v-model="draft.serviceCodes"'))
  assert.ok(manager.includes('Todos los ítems preferenciales guardados'))
})

test('Mostrar todos los ítems nunca omite la coincidencia de POL, POE o POD', () => {
  assert.ok(builder.includes('matchesPreferentialRoute(cost, {'))
  assert.ok(builder.includes('includeOtherShipmentModes: showAllCosts.value'))
  assert.ok(builder.includes('poeCode: route.poeCodes[0]'))
  assert.ok(builder.includes('podCode: route.podCodes[0]'))
  assert.doesNotMatch(builder, /showAllCosts\.value\s*\|\|\s*matchesPreferentialRoute/)
  assert.ok(builder.includes('compatibles con los puertos seleccionados'))
})

test('Manual preferential rate is verified from CRM and remains visible near the form', () => {
  assert.match(builder, /if \(saving\.value\) return/)
  assert.ok(builder.includes('crmRequest<{ rates: SavedRate[] }>'))
  assert.ok(builder.includes('persisted.rates?.find(rate => rate.id === saved.id)'))
  assert.ok(builder.includes('stored.currencyCode !== manual.currency'))
  assert.ok(builder.includes('stored.unitCode !== manual.unit'))
  assert.ok(builder.includes("if (accepted) emit('saved')"))
  assert.ok(builder.includes('data-crm-saved-manual-rates'))
  assert.ok(builder.includes('Ítems manuales guardados para esta combinación'))
})
