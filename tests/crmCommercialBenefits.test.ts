import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path: string) => readFileSync(path, 'utf8')
const manager = read('src/modules/crm/components/CrmCommercialBenefitsManager.vue')
const hub = read('src/modules/crm/components/CrmAccountHub.vue')
const catalog = read('src/modules/crm/components/CrmMultiCatalogPicker.vue')
const editor = read('src/modules/crm/components/CrmAccountEditor.vue')

test('Benefits live inside a CRM account and do not change Pricing quotes', () => {
  assert.ok(hub.includes("key: 'benefits' as const"))
  assert.ok(hub.includes('<CrmCommercialBenefitsManager'))
  assert.ok(manager.includes("crmPath('accounts', props.accountId, 'commercial-benefits')"))
  assert.doesNotMatch(manager, /\/api\/pricing/)
})
test('Miami tier uses the existing account category, never a second selector', () => {
  assert.ok(manager.includes('response.categoryType'))
  assert.ok(manager.includes('response.categoryCode'))
  assert.ok(manager.includes('No existe un segundo tipo de cliente'))
  assert.doesNotMatch(manager, /selectedPlan/)
  assert.ok(editor.includes("value:'LITTLE'"))
})
test('Five modalities and Pricing cost rubros are shared in the benefit editor', () => {
  for (const mode of ['FCL','LCL','FTL','LTL','AIR'])
    assert.ok(manager.includes("key: '" + mode + "'"))
  for (const type of ['Freight','OriginCharge','DestinationCharge','PortCharge',
    'CustomsCharge','InlandTransport','AgentCharge','Documentation','Insurance','Other'])
    assert.ok(manager.includes("value: '" + type + "'"))
  assert.ok(manager.includes('PricingService.selectCosts({ isActive: true })'))
  assert.ok(manager.includes("auth.hasScope('pricing.cost.select')"))
})
test('Insurance captures separate cost and sale percentages on declared cargo value', () => {
  assert.ok(manager.includes('insuranceCostPercent'))
  assert.ok(manager.includes('insuranceSalePercent'))
  assert.ok(manager.includes('validPercent(draft.insuranceCostPercent)'))
  assert.ok(manager.includes('validPercent(draft.insuranceSalePercent)'))
  assert.ok(manager.includes('valor de la mercancía'))
})
test('Equipment POL POE POD use multiselect Config catalogs and versioned saves', () => {
  for (const prop of ['equipmentCodes','polCodes','poeCodes','podCodes'])
    assert.ok(manager.includes('v-model="draft.' + prop + '"'))
  for (const slug of ['container-types','land-equipment-sizes','pol','poe','pod'])
    assert.ok(manager.includes("'" + slug + "'"))
  assert.ok(catalog.includes('CatalogItemsService.select'))
  assert.ok(catalog.includes("emit('update:modelValue'"))
  assert.ok(manager.includes('expectedVersion: rate.rowVersion'))
  assert.ok(manager.includes('validFrom: toUtc(draft.validFrom)'))
  assert.ok(manager.includes('validUntil: toUtc(draft.validUntil)'))
  assert.ok(manager.includes('isActive: active'))
})
