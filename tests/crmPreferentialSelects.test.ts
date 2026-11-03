import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const picker = readFileSync('src/modules/crm/components/CrmMultiCatalogPicker.vue', 'utf8')
const builder = readFileSync('src/modules/crm/components/CrmPreferentialRouteBuilder.vue', 'utf8')
test('Preferential route uses Pricing-style selectors and single choice per field', () => {
  assert.ok(builder.includes("import DhSelect from '@/shared/components/atoms/DhSelect.vue'"))
  assert.ok(builder.includes('<DhSelect :model-value="route.modality"'))
  assert.ok(builder.includes('<DhSelect :model-value="route.shipment"'))
  assert.match(builder, /<CrmMultiCatalogPicker v-model="route.equipmentCodes" single/)
  assert.match(builder, /<CrmMultiCatalogPicker v-model="route.polCodes" single/)
  assert.match(builder, /<CrmMultiCatalogPicker v-model="route.poeCodes" single/)
  assert.ok(builder.includes('single label="POD requerido"'))
})
test('Catalog picker offers search, inline labels, controls, and backwards-compatible multi selection', () => {
  assert.ok(picker.includes('single?: boolean'))
  assert.ok(picker.includes('emit(\'update:modelValue\', [value])'))
  assert.ok(picker.includes('savedLabels.value'))
  assert.ok(picker.includes('Buscar por nombre o código'))
  assert.ok(picker.includes('text-xs font-black uppercase tracking-'))
  assert.ok(picker.includes('!single && selectedOptions.length'))
  assert.ok(picker.includes('outsidePointer'))
})
