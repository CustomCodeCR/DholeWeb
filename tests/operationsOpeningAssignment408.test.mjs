import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = read('src/modules/operations/views/OperationsManualCreateView.vue')
const api = read('src/modules/operations/services/operationsApi.ts')
const cases = read('src/modules/operations/views/OperationsCasesView.vue')

test('select Aperturas team before creating the IDTRA and recover chosen team after refresh', () => {
  assert.match(api, /apertures\/assignment-teams/)
  assert.match(opening, /<DhSelect v-model="assignedTeamId"/)
  assert.match(opening, /assignedTeamId: assignedTeamId\.value/)
  assert.match(opening, /assignedTeamId\.value = String\(draft\.assignedTeamId/)
  assert.match(opening, /operationsApi\.assign\(result\.id, assignedTeamId\.value\)/)
  assert.match(opening, /selectedOpeningTeam\.value\?\.canAssign/)
  assert.match(opening, /dos validadores/)
  assert.match(opening, /assignmentPendingId\.value = result\.id/)
})

test('Aperturas does not collect weight or per-container weight', () => {
  assert.doesNotMatch(opening, /label="Peso bruto"/)
  assert.doesNotMatch(opening, /label="Unidad peso"/)
  assert.doesNotMatch(opening, /label="Peso \(kg\)"/)
  assert.match(opening, /weightValue: undefined, weightUnit: undefined, weightKg: undefined/)
  assert.match(opening, /editingId\.value && item\.weightKg != null/)
})
test('stackable is only displayed and persisted for LCL or LTL', () => {
  assert.match(opening, /v-if="\['LCL', 'LTL'\]\.includes\(effectiveShipment\)"/)
  assert.match(opening, /stackable: \['LCL', 'LTL'\]\.includes\(effectiveShipment\.value\)/)
  assert.match(cases, /\['LCL','LTL'\]\.includes\(openingText\('shipmentType'\)/)
})
test('review and drawer use structured client, route, cargo, documents and team sections', () => {
  for (const marker of ['Revisión de apertura', 'Cliente y responsable', 'Ruta e itinerario',
    'Mercancía y equipos', 'Equipo de Aperturas', 'Completitud']) {
    assert.ok(opening.includes(marker), marker)
  }
  for (const marker of ['Expediente operativo', 'Cliente y comercial', 'Ruta del embarque',
    'Mercancía y equipos', 'Responsables y validación', 'Documentos']) {
    assert.ok(cases.includes(marker), marker)
  }
  assert.doesNotMatch(cases, /Ruta · países/)
  assert.match(cases, /openingDataJson/)
  assert.match(cases, /clientExecutiveName/)
})
