import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
const selector = readFileSync(new URL('../src/modules/pricing/components/PricingCrmClientSelect.vue', import.meta.url), 'utf8')

test('manual opening offers only maritime, air and road selection; historical cases remain readable', () => {
  const selection = opening.slice(opening.indexOf('const transportSelectionOptions ='), opening.indexOf('const shipmentOptionsByTransport:'))
  for (const mode of ['MARITIME', 'AIR', 'ROAD']) assert.ok(selection.includes(mode))
  assert.doesNotMatch(selection, /Multimodal|MULTIMODAL/)
  assert.match(opening, /<DhSelect label="Modalidad de transporte"/)
  assert.match(opening, /@update:model-value="selectTransport\(String\(\$event\)\)"/)
  assert.match(opening, /<DhSelect label="Tipo de embarque"/)
  assert.match(opening, /@update:model-value="selectShipment\(String\(\$event\)\)"/)
  assert.match(opening, /Boolean\(editingId\.value\) && modality\.value === 'MULTIMODAL'/)
})

test('executive name is sourced from CRM account and owner labels rather than creator', () => {
  assert.match(opening, /crmGet\('operations\/accounts', id\)/)
  assert.match(opening, /crmPath\('calendar\/labels'\)/)
  assert.match(opening, /executiveUserId/)
  assert.match(opening, /institutionalExecutive/)
  assert.match(opening, /executiveAssigned/)
  assert.match(opening, /clientGeneration/)
  assert.match(opening, /Ejecutivo comercial responsable \(CRM\)/)
  assert.match(opening, /Ejecutivo comercial por asignar en CRM/)
  assert.match(selector, /emit\('selected',client\)/)
})

test('only actual active operational CRM contacts can be selected for notices', () => {
  assert.match(opening, /crmPath\('operations\/accounts', id, 'contacts'\)/)
  assert.match(opening, /isOperationsContact/)
  assert.match(opening, /operationalContacts\.value = entries\.flatMap/)
  assert.match(opening, /toggleOperationalContact/)
  assert.match(opening, /contactIds: \[\] as string\[\]/)
  assert.match(opening, /:checked="form\.contactIds\.includes\(contact\.id\)"/)
  assert.match(opening, /form\.value\.contactReferences = form\.value\.contactIds\.join/)
})

test('special conditions are accessible toggles and destination handling is exclusive', () => {
  for (const binding of ['form.isImo','form.stackable','form.overweight',
    "form.portHandlingMode === 'Redestino'", "form.portHandlingMode === 'Anticipado'"]) {
    assert.ok(opening.includes(':aria-pressed="' + binding + '"'))
  }
  assert.match(opening, /:model-value="effectiveShipment"/)
  assert.match(opening, /Muellaje en destino/)
  assert.match(opening, /toggleHandling\('Redestino'\)/)
  assert.match(opening, /toggleHandling\('Anticipado'\)/)
})

test('drafts, supported documents and backend completion requirements are preserved', () => {
  for (const fragment of ['operationsApi.createAperture', 'operationsApi.updateCase',
    'missingFields: blockers.value', "commercialStatus: 'SIN_QUO'",
    'StorageService.uploadFile', 'supportDocuments', 'Crear y enviar a Coordinación Origen',
    'requiresWarehouse', 'IMO / Peligrosa', 'manualSubmitted']) {
    assert.ok(opening.includes(fragment), fragment)
  }
})
