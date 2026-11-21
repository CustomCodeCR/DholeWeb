import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { incotermSectionApplicability as category } from '../src/modules/pricing/utils/pricingIncotermPerspective.ts'

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
test('FOB export highlights freight, destination and delivery red; origin stays assigned to exporter', () => {
  assert.equal(category('Export', 'FOB', 'international_freight'), 'other-party')
  assert.equal(category('Export', 'FOB', 'destination_charges'), 'other-party')
  assert.equal(category('Export', 'FOB', 'delivery_destination'), 'other-party')
  assert.equal(category('Export', 'FOB', 'origin_charges'), 'client')
  assert.equal(category('Import', 'FOB', 'international_freight'), 'client')
})
test('All 11 Incoterms have a visual responsibility; ambiguous destinations are mixed', () => {
  const terms = ['EXW','FCA','FAS','FOB','CFR','CIF','CPT','CIP','DAP','DPU','DDP']
  const blocks = ['pickup_origin','origin_charges','international_freight','destination_charges','delivery_destination'] as const
  for(const term of terms) {
    for(const block of blocks) {
      assert.notEqual(category('Import', term, block), 'unknown', term+' '+block)
      assert.notEqual(category('Export', term, block), 'unknown', term+' '+block)
    }
  }
  for(const term of ['CFR','CIF','CPT','CIP','DAP','DPU']) {
    assert.equal(category('Export', term, 'destination_charges'), 'mixed')
  }
  assert.equal(category('Import', 'FCA', 'origin_charges'), 'mixed')
  assert.equal(category('Export', 'DPU', 'delivery_destination'), 'client')
  assert.equal(category('Import', 'DDP', 'delivery_destination'), 'other-party')
})
test('Insurance can be mandatory to document without being billed twice', () => {
  assert.equal(category('Import','CIF','insurance'), 'other-party')
  assert.equal(category('Export','CIP','insurance'), 'client')
  assert.equal(category('Import','FOB','insurance'), 'mixed')
})
test('Unknown context or agent fees never falsely show no aplica', () => {
  assert.equal(category('TransitDomestic','FOB','international_freight'), 'unknown')
  assert.equal(category('Import','unknown','international_freight'), 'unknown')
  assert.equal(category('Export','FOB','agent'), 'unknown')
})
test('Both wizards only style headers; they do not filter, hide or mutate charges by visual classification', () => {
  for (const path of [
    'src/modules/pricing/components/PricingAlternativeWizardCrystal.vue',
    'src/modules/pricing/components/PricingRateExistingWizardStable.vue',
  ]) {
    const code = read(path)
    assert.match(code, /function categoryIncotermApplicability\(groupKey: string\)/)
    assert.match(code, /categoryIncotermApplicability\(group.key\) === 'other-party'/)
    assert.match(code, /border-red-500\/50 bg-red-500\/5/)
    assert.match(code, /v-for="line in group.lines"/)
    assert.match(code, /const orderedRateGroups = computed/)
    assert.doesNotMatch(code, /v-if="categoryIncotermApplicability\(group.key\) !== 'other-party'"/)
  }
})
