import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const wizard = readFileSync(new URL('../src/modules/pricing/components/PricingAlternativeWizardCrystal.vue', import.meta.url), 'utf8')
const picker = readFileSync(new URL('../src/modules/pricing/components/PricingInlandServiceLocation.vue', import.meta.url), 'utf8')
const summary = readFileSync(new URL('../src/modules/pricing/components/PricingSellerHandoffPreview.vue', import.meta.url), 'utf8')
const amendments = readFileSync(new URL('../build/pricingSellerModificationWizard.ts', import.meta.url), 'utf8')
const sellerMultimodal = readFileSync(new URL('../build/pricingSellerMultimodalStep3Fix.ts', import.meta.url), 'utf8')

test('selected inland transport services expose independent pickup and delivery maps', () => {
  assert.match(wizard, /const inlandPickupServiceSelected = computed/)
  assert.match(wizard, /const inlandDeliveryServiceSelected = computed/)
  assert.match(wizard, /v-if="inlandPickupServiceSelected"[\s\S]*?v-model="form\.inlandPickupLocation"/)
  assert.match(wizard, /v-if="inlandDeliveryServiceSelected"[\s\S]*?v-model="form\.inlandDeliveryLocation"/)
  assert.match(picker, /PricingInteractiveOsmMap/)
  assert.match(picker, /@select-point="selectPoint"/)
  assert.match(picker, /update:modelValue/)
})

test('both service locations require an address and map coordinates before continuing', () => {
  assert.match(wizard, /inlandServiceLocationsReady\.value/)
  assert.match(wizard, /form\.inlandPickupLocation\.latitude != null/)
  assert.match(wizard, /form\.inlandDeliveryLocation\.longitude != null/)
  assert.match(sellerMultimodal, /Dirección y punto en mapa para transporte de recolección/)
  assert.match(sellerMultimodal, /Dirección y punto en mapa para transporte de entrega/)
})

test('saved request and modification review preserve the inland addresses', () => {
  assert.match(wizard, /inlandPickupLocation: \{ address: ''/)
  assert.match(wizard, /inlandDeliveryLocation: \{ address: ''/)
  assert.match(summary, /inlandPickupLocation/)
  assert.match(summary, /inlandDeliveryLocation/)
  assert.match(amendments, /'inlandPickupLocation', 'inlandDeliveryLocation'/)
  assert.match(amendments, /Ubicación transporte de entrega/)
})
