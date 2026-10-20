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

test('both service locations require a written address without map coordinates', () => {
  assert.match(wizard, /inlandServiceLocationsReady\.value/)
  assert.match(wizard, /Boolean\(form\.inlandPickupLocation\?\.address\?\.trim\(\)\)/)
  assert.match(wizard, /Boolean\(form\.inlandDeliveryLocation\?\.address\?\.trim\(\)\)/)
  assert.doesNotMatch(wizard, /form\.inlandPickupLocation\.latitude != null/)
  assert.doesNotMatch(wizard, /form\.inlandDeliveryLocation\.longitude != null/)
  assert.match(sellerMultimodal, /Dirección para transporte de recolección/)
  assert.match(sellerMultimodal, /Dirección para transporte de entrega/)
  assert.doesNotMatch(sellerMultimodal, /inlandPickupLocation\.latitude == null/)
  assert.match(picker, /ubicar el punto en el mapa es opcional/)
})

test('EXW requires adding the pickup but allows null geographic coordinates', () => {
  const savePickup = wizard.match(/function savePickupLocation\(\) \{([\s\S]*?)\n\}/)?.[1] ?? ''
  assert.match(savePickup, /if \(!address\)/)
  assert.doesNotMatch(savePickup, /!pickupCoordinates/)
  assert.match(wizard, /!pickupLocations\.value\.length \|\| form\.pickupAddress\.trim\(\)/)
  assert.match(wizard, /:disabled="!form\.pickupAddress\.trim\(\) \|\| \(sellerRequestMode && !pickupCargoCondition\)"/)
  assert.match(wizard, /latitude: form\.pickupLatitude/)
  assert.match(wizard, /longitude: form\.pickupLongitude/)
  const rateEdit = readFileSync(new URL('../build/pricingRateEditCreateParity.ts', import.meta.url), 'utf8')
  assert.match(rateEdit, /const invalidPickup = pickupLocations\.value\.find/)
  assert.doesNotMatch(rateEdit, /pickup\.latitude == null/)
  assert.doesNotMatch(rateEdit, /Coordenadas requeridas/)
})

test('saved request and modification review preserve the inland addresses', () => {
  assert.match(wizard, /inlandPickupLocation: \{ address: ''/)
  assert.match(wizard, /inlandDeliveryLocation: \{ address: ''/)
  assert.match(summary, /inlandPickupLocation/)
  assert.match(summary, /inlandDeliveryLocation/)
  assert.match(amendments, /'inlandPickupLocation', 'inlandDeliveryLocation'/)
  assert.match(amendments, /Ubicación transporte de entrega/)
})


test('EXW pickup action appears before a separate optional map toolbar', () => {
  const exwSection = wizard.slice(wizard.indexOf('v-model="form.pickupAddress"'))
  const addAction = exwSection.indexOf('@click="savePickupLocation"')
  const mapSection = exwSection.indexOf('Ubicación en mapa (opcional)')
  const geocodeAction = exwSection.indexOf('@click="geocodePickupAddress')
  const map = exwSection.indexOf('<PricingInteractiveOsmMap')
  assert.ok(addAction >= 0 && mapSection > addAction)
  assert.ok(geocodeAction > mapSection && map > geocodeAction)
  assert.match(exwSection.slice(0, mapSection), /Agregar la recolecta es obligatorio para continuar/)
  assert.match(exwSection.slice(mapSection, map), /No es necesario usar el mapa para agregar la recolecta/)
  assert.match(exwSection.slice(mapSection, map), /@click="useCurrentLocation"/)
})
