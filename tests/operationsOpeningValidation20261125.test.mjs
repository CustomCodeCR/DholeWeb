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
  assert.ok(source.includes("openingValidationVersion: 8"))
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
  assert.doesNotMatch(source, /v-model="form\.(etm|eta)"/)
  assert.match(source, /label="Nombre del consolidado"/)
  assert.match(source, /operationsQuoteApi\.consolidations\('LCL'\)/)
  assert.match(source, /consolidationId: effectiveShipment\.value === 'LCL'/)
  assert.match(detail, /operationsApi.updateOriginPlanning/)
  assert.match(panel, /Completar datos de apertura/)
  assert.match(panel, /DhTabs v-model="group"/)
  assert.match(labels, /catalogMatch\(services.value, raw\)/)
})

test('manual review shows basic opening information and only blocking validation, not origin-stage pending groups', () => {
  const review = source.slice(source.indexOf('data-testid="manual-opening-review"'), source.indexOf('<div v-if="editingId && activeStep === 3"'))
  const sections = source.slice(source.indexOf('const manualReviewSections'), source.indexOf('async function save()'))
  assert.ok(review.length > 1000)
  for (const field of ['Consecutivo IDTRA', 'Estado inicial', 'Equipo', 'Operativo']) assert.ok(review.includes(field), field)
  for (const field of ['Cliente', 'Vendedor', 'Contacto operativo', 'QUO', 'Transporte', 'Tipo de embarque', 'Incoterm', 'POL · Origen', 'POE · Entrada', 'POD · Destino final', 'WHS', 'Cantidad de bultos', 'Peso estimado', 'Volumen', 'Servicios', 'Naviera', 'Agente']) assert.ok(sections.includes(field), field)
  assert.match(sections, /requiresWarehouse\.value \?/)
  assert.match(sections, /showCarrier\.value \?/)
  assert.match(sections, /needsEquipment\.value \?/)
  assert.match(review, /v-for="item in manualReviewBlockers"/)
  assert.doesNotMatch(review, /statusGroups|PENDIENTE_PERMITIDO|NO_APLICA|pendientes permitidos|openingStatusLabel/)
  assert.match(source, /completeness\.value\?\.missingFields \?\? \[\]/)
  assert.match(source, /completeness\.value\?\.canPassFieldValidation === true/)
  assert.match(review, /<DhCard/)
  assert.match(review, /completenessError/)
  assert.match(review, /retryCompleteness\+\+/)
})

test('manual opening review displays planned team without implying an assigned operator', () => {
  assert.match(source, /const originTeamPreview = computed/)
  for (const team of ['Origen · Estados Unidos', 'Origen · Centroamérica', 'Origen · Tránsito', 'Origen · FCL internacional', 'Origen · LCL y Aéreo internacional', 'Origen · FTL', 'Origen · LTL'])
    assert.ok(source.includes(team), team)
  assert.match(source, /originCountryCode: routingCountries\.value\.origin/)
  assert.match(source, /destinationCountryCode: routingCountries\.value\.destination/)
  assert.match(source, /Equipo previsto/)
  assert.match(source, /El servidor confirma el equipo/)
  assert.match(source, /<DhCard v-if="requiresWarehouse"/)
  const step2 = source.indexOf('<div v-show="activeStep === 2"')
  assert.ok(source.indexOf('title="Equivalencias de la mercancía"') > step2)
  const review = source.slice(source.indexOf('data-testid="manual-opening-review"'), source.indexOf('<div v-if="editingId && activeStep === 3"'))
  assert.ok(review.indexOf('title="Validación de apertura"') < review.indexOf('v-for="section in manualReviewSections"'))
  assert.match(source, /:class="editingId \? 'sticky bottom-3 z-30 shadow-xl' : ''"/)
})

test('open WHS menu escapes the DH card clipping and stacks above sibling cards', () => {
  const picker = readFileSync(new URL('../src/modules/pricing/components/PricingLocationSearchSelect.vue', import.meta.url), 'utf8')
  const theme = readFileSync(new URL('../src/assets/theme.css', import.meta.url), 'utf8')
  const card = readFileSync(new URL('../src/shared/components/molecules/DhCard.vue', import.meta.url), 'utf8')
  assert.match(source, /<DhCard v-if="requiresWarehouse"/)
  assert.match(source, /<PricingLocationSearchSelect v-if="!editingId \|\| warehouseOptions.length"/)
  assert.match(card, /dh-glass dh-liquid/)
  assert.ok(picker.includes(':data-dh-whs-menu-open="terminalType === \'WHS\' && open && !disabled ? \'true\' : undefined"'))
  assert.match(theme, /\.dh-liquid:has\(> \[data-dh-whs-menu-open="true"\]\)\s*\{\s*overflow: visible;\s*z-index: 20;/)
  assert.match(theme, /\.dh-liquid > \[data-dh-whs-menu-open="true"\]\s*\{\s*z-index: 2;/)
  assert.match(picker, /pricing-location-menu absolute z-\[120\]/)
  assert.match(picker, /function closeSearch\(\)\s*\{\s*open.value = false/)
})

test('new WHS opening selects the agent first and filters by explicit Config identity', () => {
  const drawer = readFileSync(new URL('../src/modules/catalogs/components/CatalogItemFormDrawer.vue', import.meta.url), 'utf8')
  assert.match(drawer, /label="Agente propietario del WHS"/)
  assert.match(drawer, /metadata\.agentId = id/)
  assert.match(drawer, /catalogGroupSlug: 'agents'/)
  assert.match(drawer, /isGeneric: true, .*agentId: warehouseAgentId\.value/)
  const filter = source.slice(source.indexOf('const warehouseOptions = computed'), source.indexOf('const incotermChoices = computed'))
  assert.match(filter, /eligibleAgents\.value\.find/)
  assert.match(filter, /if \(!agent\) return \[\]/)
  assert.match(filter, /warehouseAgentOwnership\(item\?\.metadataJson, agent\)/)
  const whs = source.slice(source.indexOf('<DhCard v-if="requiresWarehouse"'), source.indexOf('<DhCard v-if="!editingId" title="Equipo previsto"'))
  assert.ok(whs.indexOf('label="Agente / oficina de origen"') < whs.indexOf('label="WHS global"'))
  assert.match(whs, /Agente:<\/strong>/)
  assert.match(source, /!warehouseOptions\.value\.some\(option => option\.value === selectedWarehouse\.value\)/)
  assert.match(source, /WHS compatible con el agente/)
  assert.match(source, /v-if="editingId \|\| !requiresWarehouse" searchable/)
})

test('legacy WHS without ownership remains selectable without claiming ownership', () => {
  const filter = source.slice(source.indexOf('const warehouseOptions = computed'), source.indexOf('const incotermChoices = computed'))
  assert.match(filter, /ownership === 'linked'/)
  assert.match(filter, /else if \(ownership === 'unlinked'\)/)
  assert.match(filter, /!country \|\| !origin \|\| country === origin/)
  assert.match(filter, /Sin agente vinculado/)
  assert.match(filter, /const available = \[\.\.\.linked, \.\.\.unlinked\]/)
  assert.match(source, /:disabled="!editingId && !form.agentId"/)
  assert.match(source, /únicamente en este trámite/)
  assert.match(source, /changed && warehouseAgentOwnership\(warehouse.value\?\.metadataJson\) === 'unlinked'/)
})

test('warehouse ownership respects existing agent codes and names without collapsing warehouse IDs', async () => {
  const { warehouseAgentOwnership, warehouseAgentNames } = await import('../src/modules/catalogs/utils/warehouseAgentOwnership.ts')
  const wwl = { id: 'wwl-id', code: 'AGENT_WWL', value: 'WWL', label: 'Worldwide Logistics' }
  const rs = { id: 'rs-id', code: 'AGENT_RS', value: 'RS Logistics', label: 'RS' }
  const xiamenWwl = JSON.stringify({ agentCode: 'WWL', agentCodes: ['WWL'], agentName: 'Worldwide Logistics', agentNames: ['Worldwide Logistics'] })
  const xiamenRs = JSON.stringify({ agentCodes: ['RS'], agentNames: ['RS Logistics'] })
  assert.equal(warehouseAgentOwnership(xiamenWwl, wwl), 'linked')
  assert.equal(warehouseAgentOwnership(xiamenRs, wwl), 'other')
  assert.equal(warehouseAgentOwnership(xiamenRs, rs), 'linked')
  assert.equal(warehouseAgentOwnership(xiamenWwl, rs), 'other')
  assert.deepEqual(warehouseAgentNames(xiamenWwl), ['Worldwide Logistics'])
  assert.equal(warehouseAgentOwnership('{"agentNames":["Worldwide Logistics"]}', wwl), 'linked')
  assert.equal(warehouseAgentOwnership('{"agentCodes":["OTHER"],"agentNames":["Worldwide Logistics"]}', wwl), 'other')
  assert.equal(warehouseAgentOwnership('{"agentCodes":["RS","WWL"]}', wwl), 'linked')
  assert.equal(warehouseAgentOwnership('{"agentCodes":["RS","WWL"]}', rs), 'linked')
  assert.equal(warehouseAgentOwnership('{"agentId":"rs-id","agentCodes":["WWL"]}', wwl), 'other')
  assert.equal(warehouseAgentOwnership('{}', wwl), 'unlinked')
  assert.equal(warehouseAgentOwnership('{"agentCodes":[123]}', wwl), 'other')
  assert.equal(warehouseAgentOwnership('invalid', wwl), 'other')
  assert.match(source, /catalogCode\('warehouses', option.value\)/)
})


test('Opening exposes CABYS on creation and preserves physical quantity on unit changes', () => {
  assert.match(source, /v-model="weightUnitSelection"/)
  assert.match(source, /v-model="volumeUnitSelection"/)
  assert.match(source, /kg \/ \(unit === 'LB' \? 0\.45359237 : 1\)/)
  assert.match(source, /cbm \/ \(unit === 'CFT' \? 0\.028316846592 : 1\)/)
  assert.match(source, /<DhTextarea v-model="form\.cargoDescription"/)
})


test('opening edits omit Origin-only measurements and serialize historical zero volume as unknown', () => {
  const source = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
  const payload = source.slice(source.indexOf('function buildOpeningData('), source.indexOf('const completeness ='))
  assert.ok(payload.includes('weightValue: undefined, weightUnit: undefined, weightKg: undefined'))
  assert.ok(payload.includes('actualWeightValue: undefined, actualWeightUnit: undefined, actualWeightKg: undefined, equipmentUnits: undefined'))
  assert.ok(payload.includes('volumeValue: editingId.value && Number(form.value.volumeValue) === 0 ? null : form.value.volumeValue'))
  assert.ok(payload.includes('volumeCbm: normalizedVolume.value'))
})
