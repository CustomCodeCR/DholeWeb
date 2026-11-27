import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')
const pricingEquipment = readFileSync(new URL('../src/modules/pricing/components/PricingContainerSelector.vue', import.meta.url), 'utf8')
const operationsApi = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')

test('operations auto-saves local recovery without premature IDTRA creation', () => {
  for (const fragment of ['draftStorageKey', 'auth.userId', 'auth.clientId', 'window.localStorage.setItem',
    'restoreLocalDraft()', 'persistLocalDraft()', 'autosaveReady', 'contactsTouched', 'onBeforeUnmount',
    'lastAutoSaveAt', '650', 'clearLocalDraft()']) {
    assert.ok(opening.includes(fragment), fragment)
  }
  assert.match(opening, /watch\(\[form, accountId, selectedClientName, modality, activeStep/)
  assert.match(opening, /async function save\(\)/)
  assert.doesNotMatch(opening, /Guardar borrador/)
})

test('new manual cases delegate direct origin assignment to Operations', () => {
  assert.match(opening, /Crear y enviar a Coordinación Origen/)
  assert.match(opening, /operationsApi\.createAperture\(/)
  assert.doesNotMatch(opening, /operationsApi\.assign\(result\.id/)
  assert.match(opening, /manualSubmitted: '1'/)
  assert.doesNotMatch(opening, /<DhSelect v-model="assignedTeamId"/)
  assert.match(opening, /assignmentPendingId\.value = result\.id/)
  assert.match(opening, /assignmentPendingId\.value\s*\? \{ id: assignmentPendingId\.value \}/)
  assert.match(operationsApi, /aperture-validations\/assign/)
  assert.match(opening, /blockers\.value\.length > 0/)
})

test('container and trailer cards reuse Pricing selections, exclude duplicates and defer weight to origin', () => {
  assert.match(opening, /Distribución de contenedores FCL/)
  assert.match(opening, /Distribución de furgones FTL/)
  assert.match(opening, /<PricingContainerSelector/)
  assert.match(opening, /:excluded-equipment-ids="form\.equipment\.filter/)
  assert.match(opening, /uniqueEquipment\.value/)
  assert.match(opening, /Math\.max\(1, Math\.floor\(Number\(\$event\)/)
  assert.doesNotMatch(opening, /label="Peso \(kg\)"/)
  assert.match(pricingEquipment, /excludedEquipmentIds/)
})

test('shared DH selection controls replace free text', () => {
  assert.match(opening, /<DhSelect v-if="editingId" v-model="form\.packageType"/)
  assert.match(opening, /<DhSelect v-if="editingId" v-model="form\.cargoNature"/)
  assert.match(opening, /packageTypeChoiceOptions/)
  assert.match(opening, /cargoNatureChoiceOptions/)
  assert.match(opening, /<DhSelect label="Modalidad de transporte"/)
  assert.match(opening, /<DhSelect label="Tipo de embarque"/)
  assert.match(opening, /<DhCard v-show="activeStep === 1" title="Modalidad y embarque"/)
  assert.match(opening, /mt-6 space-y-5/)
})

test('eligible operational contacts are selected by default but can be deselected', () => {
  assert.match(opening, /if \(!contactsTouched\.value && !form\.value\.contactIds\.length\)/)
  assert.match(opening, /form\.value\.contactIds = defaultDivisionContacts\(operationalContacts\.value, form\.value\.crmDivisionId, crmDivisions\.value\.length > 0\)\.map\(contact => contact\.id\)/)
  assert.match(opening, /contactsTouched\.value = true/)
  assert.match(opening, /form\.value\.contactIds\.filter\(x => x !== id\)/)
})

test('opening review excludes later origin coordination legend and uses compact summary', () => {
  assert.doesNotMatch(opening, /Datos operativos que pueden confirmarse después/)
  assert.doesNotMatch(opening, /Naviera y booking, si aplica/)
  assert.match(opening, /Ruta e itinerario/)
  assert.match(opening, /Coordinación Origen/)
})
