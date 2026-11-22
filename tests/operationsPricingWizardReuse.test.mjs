import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = source('src/modules/operations/views/OperationsManualCreateView.vue')
const pricing = source('src/modules/pricing/components/PricingRateFormDrawer.vue')
const stepper = source('src/modules/pricing/components/PricingWizardStepper.vue')

test('manual opening and pricing editor share their stepper component', () => {
  assert.match(opening, /import PricingWizardStepper from '@\/modules\/pricing\/components\/PricingWizardStepper.vue'/)
  assert.match(pricing, /import PricingWizardStepper from '.\/PricingWizardStepper.vue'/)
  assert.match(opening, /<PricingWizardStepper/)
  assert.match(pricing, /<PricingWizardStepper/)
  assert.match(stepper, /:style="\{ '--wizard-step-columns': steps\.length \}"/)
  assert.match(stepper, /aria-current/)
  assert.match(stepper, /update:activeStep/)
  assert.match(opening, /activeStep === 5/)
})

test('opening reuses live Pricing service and location catalogs', () => {
  assert.match(opening, /PricingCrystalMultiSelect/)
  assert.match(opening, /<PricingCrystalMultiSelect v-model="form.services"/)
  assert.match(opening, /PricingLocationSearchSelect/)
  assert.match(opening, /<PricingLocationSearchSelect v-if="polOptions.length"/)
  assert.match(opening, /<PricingLocationSearchSelect v-if="poeOptions.length"/)
  assert.match(opening, /<PricingLocationSearchSelect v-if="podOptions.length"/)
  assert.match(opening, /CatalogItemsService.select/)
  for (const catalog of ['pol','poe','pod','container-types','land-equipment-sizes','pricing-services','carriers','agents'])
    assert.ok(opening.includes(catalog), catalog)
  assert.match(opening, /<DhCheckbox/)
  assert.match(opening, /<DhSelect/)
  assert.match(opening, /<DhTextarea/)
})

test('wizard continues to save the existing Operations opening contract and draft', () => {
  assert.match(opening, /operationsApi.createAperture/)
  assert.match(opening, /operationsApi.updateCase/)
  assert.match(opening, /completionStatus: blockers.value.length/)
  assert.match(opening, /commercialStatus: 'SIN_QUO'/)
  assert.match(opening, /await router.push/)
  assert.match(opening, /restoringOpening = true/)
  assert.match(opening, /reconcileLocations/)
  assert.match(opening, /Guardar borrador/)
  assert.doesNotMatch(opening, /seriesCode/)
})
