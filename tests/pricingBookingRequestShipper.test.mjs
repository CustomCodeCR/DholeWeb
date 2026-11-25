import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const paths = [
  "src/modules/pricing/components/PricingAlternativeWizardCrystal.vue",
  "src/modules/pricing/components/PricingRateExistingWizardStable.vue",
  "src/modules/pricing/existing/src/modules/pricing/components/PricingAlternativeWizardCrystal.vue"
]
for (const path of paths) {
  test('Booking Request Shipper uses existing Storage upload: ' + path, () => {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
    assert.equal(source.split("{ key: 'booking-request-shipper', label: 'Booking Request Shipper' }").length, 2)
    assert.ok(source.includes('uploadSupportDocument(category.key, category.label, $event)'))
    assert.ok(source.includes("entityType: 'PricingRequestSupport'"))
    assert.ok(source.includes('metadataJson: JSON.stringify({ category, categoryLabel,'))
    assert.ok(source.includes('v-for="category in supportCategories"'))
  })
}
