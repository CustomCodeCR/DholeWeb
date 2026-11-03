import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const builder = readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue', 'utf8')
const locations = readFileSync('src/modules/crm/components/CrmPricingLocationSelect.vue', 'utf8')
const equipment = readFileSync('src/modules/crm/components/CrmPricingEquipmentSelect.vue', 'utf8')
const pricing = readFileSync('src/modules/pricing/components/PricingLocationSearchSelect.vue', 'utf8')

test('The CRM preferential route uses the EXACT Pricing location search component', () => {
  assert.ok(locations.includes("import PricingLocationSearchSelect from '@/modules/pricing/components/PricingLocationSearchSelect.vue'"))
  assert.ok(locations.includes('<PricingLocationSearchSelect'))
  assert.match(builder, /<CrmPricingLocationSelect v-model="route.polCodes"/)
  assert.match(builder, /<CrmPricingLocationSelect v-model="route.poeCodes"/)
  assert.match(builder, /<CrmPricingLocationSelect v-if="route.modality==='MARITIME'" v-model="route.podCodes"/)
  assert.doesNotMatch(builder, /<CrmMultiCatalogPicker/)
  assert.ok(pricing.includes('pricing-location-option'))
  assert.ok(locations.includes('terminalType'))
})
test('Pricing location selector loads the Config catalog and stores a single route code', () => {
  assert.ok(locations.includes('CatalogItemsService.select'))
  assert.ok(locations.includes('isCompatibleBenefitLocation'))
  assert.ok(locations.includes("emit('update:modelValue', code ? [code] : [])"))
  assert.ok(locations.includes('@open="loadCatalog"'))
})
test('Equipment uses the real DhSelect control used by Pricing', () => {
  assert.ok(equipment.includes("import DhSelect from '@/shared/components/atoms/DhSelect.vue'"))
  assert.ok(equipment.includes('<DhSelect'))
  assert.ok(builder.includes('<CrmPricingEquipmentSelect v-model="route.equipmentCodes"'))
  assert.ok(builder.includes('<DhSelect :model-value="route.modality"'))
  assert.ok(builder.includes('<DhSelect :model-value="route.shipment"'))
})
