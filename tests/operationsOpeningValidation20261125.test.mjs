import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const source = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
test('transport changes remove equipment and use terminal metadata', () => {
  assert.ok(source.includes("form.value.equipment = []"))
  assert.ok(source.includes("form.value.transportType === 'AIR' ? 'APT'"))
  assert.ok(source.includes('v-if="needsEquipment"'))
  assert.ok(!source.includes('needsEquipment || form.equipment.length'))
  assert.ok(source.includes("selectedRouteType('pol', selectedPol.value) !== routeTerminal.value"))
})
test('new manual openings validate estimated weight, volume and bultos without editing actual weight', () => {
  assert.ok(source.includes('positive(form.value.estimatedWeightValue)'))
  assert.ok(source.includes("Number.isInteger(Number(form.value.packageCount))"))
  assert.ok(source.includes("weightValue: undefined, weightUnit: undefined, weightKg: undefined"))
  assert.ok(source.includes("openingValidationVersion: 5"))
})

test('route and commercial perspective follow Pricing', () => {
  assert.ok(source.includes('operationForClientCountry(clientCountry.value'))
  assert.ok(source.includes('resolveLocationCountryCode(item, currentCatalog'))
  assert.ok(source.includes('v-if="showPod"'))
  assert.ok(source.includes("pod: showPod.value ? form.value.pod : ''"))
  assert.ok(source.includes('PricingInlandServiceLocation'))
})


test('manual opening locations do not assign a commercial payer', () => {
  const component = readFileSync(new URL('../src/modules/pricing/components/PricingInlandServiceLocation.vue', import.meta.url), 'utf8')
  assert.ok(source.includes('kind="pickup" operational'))
  assert.ok(source.includes('kind="delivery" operational'))
  assert.ok(source.includes('operationalPoints(form.value.pickupLocations)'))
  assert.ok(source.includes('operationalPoints(form.value.deliveryLocations)'))
  assert.ok(!source.includes('incotermOperationExplanation'))
  assert.ok(component.includes('operational?: boolean'))
  assert.ok(component.includes('v-if="!props.operational" v-model="billingParty"'))
  assert.ok(component.includes('if (props.operational) delete nextPoint.billingParty'))
  assert.ok(component.includes('...(!props.operational ? { billingParty:'))
  assert.ok(component.includes('Se conservará en el trámite.'))
})

 test('review displays operational stops without requiring pickup contact or window', () => {
  assert.ok(!source.includes("result.push('Contacto de recolecta')"))
  assert.ok(!source.includes("result.push('Ventana de recolecta')"))
  assert.ok(source.includes('Puntos de recolecta'))
  assert.ok(source.includes('Puntos de entrega'))
  assert.ok(source.includes('pickupContact: undefined, pickupWindow: undefined'))
})


test('opening states come from the backend and approval requires zero blockers', () => {
  const panel = readFileSync(new URL('../src/modules/operations/components/OperationsApertureValidationPanel.vue', import.meta.url), 'utf8')
  const api = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')
  assert.ok(source.includes('operationsApi.previewOpeningCompleteness'))
  assert.ok(source.includes('serverBlockers.value > 0'))
  assert.ok(panel.includes('operationsApi.openingCompleteness'))
  assert.ok(panel.includes('!completeness.value?.canPassFieldValidation'))
  assert.ok(api.includes('/apertures/drafts/completeness'))
})


test('manual opening captures services, suppliers and observations and groups completeness', () => {
  assert.ok(source.includes('DhMultiSelect v-model="form.services"'))
  assert.ok(source.includes("currentCatalog('pricing-services')"))
  assert.ok(source.includes('serviceSelections:'))
  assert.ok(source.includes('providerSelections:'))
  assert.ok(source.includes('v-model="form.haulageMode"'))
  assert.ok(source.includes('v-model="form.observations"'))
  assert.ok(source.includes('statusGroups.find'))
  assert.ok(source.includes('max-h-72 overflow-y-auto'))
})


test('opening uses origin-filtered agents, shared searchable selects and neutral services wording', () => {
  assert.ok(source.includes('agentMatchesOrigin(item, origin'))
  assert.ok(source.includes('searchable :model-value="form.carrierId"'))
  assert.ok(!source.includes('Seleccionar servicios de Pricing'))
  const detail = readFileSync(new URL('../src/modules/operations/views/OperationsCaseDetailView.vue', import.meta.url), 'utf8')
  assert.ok(detail.includes('v-model="completenessGroup"'))
  assert.ok(detail.includes('serviceLabels(openingData.value)'))
})

test('Cargo dimensions keep original units and present normalized equivalents', () => {
  assert.match(source, /lengthValue/)
  assert.match(source, /dimensionOptions/)
  assert.match(source, /0\.45359237/)
  assert.match(source, /2\.54/)
  assert.match(source, /0\.028316846592/)
})

test('origin planning is separated from opening capture and uses a stage endpoint', () => {
  const detail = readFileSync(new URL('../src/modules/operations/views/OperationsCaseDetailView.vue', import.meta.url), 'utf8')
  const panel = readFileSync(new URL('../src/modules/operations/components/OperationsApertureValidationPanel.vue', import.meta.url), 'utf8')
  const labels = readFileSync(new URL('../src/modules/operations/utils/commercialPresentation.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /v-model="form\.(etm|eta|consolidationReference)"/)
  assert.match(detail, /operationsApi.updateOriginPlanning/)
  assert.match(panel, /Completar datos de apertura/)
  assert.match(panel, /DhTabs v-model="group"/)
  assert.match(labels, /catalogMatch\(services.value, raw\)/)
})
