import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const component = readFileSync('src/modules/pricing/components/PricingLinkedSellerRequest.vue', 'utf8')
const wizard = readFileSync('src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', 'utf8')

test('quote view loads the complete seller request history with read-only permission', () => {
  assert.match(wizard, /<PricingLinkedSellerRequest v-if="editingRate && authStore\.hasScope\(PRICING_SCOPES\.rates\.view\)"/)
  assert.match(component, /\/api\/pricing\/rate-requests\/by-rate\//)
  assert.match(component, /encodeURIComponent\(rateId\) \+ '\/history'/)
})

test('original and modification requests are distinguished without replacing snapshots', () => {
  assert.match(component, /const originals = computed\(\(\) => requests\.value\.filter\(request => !isModification\(request\)\)\)/)
  assert.match(component, /const modifications = computed\(\(\) => requests\.value\.filter\(isModification\)\)/)
  assert.match(component, /<PricingSellerHandoffPreview/)
  assert.match(component, /request\.payload\?\.modification\?\.sourceRevisionNumber/)
  assert.match(component, /Valor original/)
  assert.match(component, /Solicitado por Ventas/)
  assert.match(component, /No se encontraron solicitudes de Ventas vinculadas/)
})
