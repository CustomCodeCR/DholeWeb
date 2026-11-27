import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const opening = read('src/modules/operations/views/OperationsManualCreateView.vue')
const api = read('src/modules/operations/services/operationsApi.ts')
const cases = read('src/modules/operations/views/OperationsCasesView.vue')

test('manual opening delegates direct Origin handoff to backend without dual review', () => {
  assert.match(opening, /operationsApi\.createAperture/)
  assert.doesNotMatch(opening, /operationsApi\.assign\(result\.id/)
  assert.doesNotMatch(opening, /<DhSelect v-model="assignedTeamId"/)
  assert.match(opening, /Crear y enviar a Coordinación Origen/)
  assert.match(opening, /assignmentPendingId\.value = result\.id/)
  assert.match(opening, /manualSubmitted: '1'/)
})

test('Aperturas does not collect weight or per-container weight', () => {
  assert.doesNotMatch(opening, /label="Peso bruto"/)
  assert.doesNotMatch(opening, /label="Unidad peso"/)
  assert.doesNotMatch(opening, /label="Peso \(kg\)"/)
  assert.match(opening, /weightValue: undefined, weightUnit: undefined, weightKg: undefined/)
  assert.match(opening, /editingId\.value && item\.weightKg != null/)
})
test('stackable is captured in new and existing openings with explicit unknown state', () => {
  assert.match(opening, /v-if="stackableApplicable"[^\n]*Estibable/)
  assert.match(opening, /stackable: stackableApplicable\.value \? form\.value\.stackable : null/)
  assert.ok(opening.includes("stackable: null as boolean | null"))
  assert.match(opening, /toggleCondition\(form\.stackable\)/)
  assert.match(cases, /opening\.value\.stackable === false/)
})
test('review and drawer use structured client, route, cargo, documents and team sections', () => {
  for (const marker of ['Revisión de apertura', 'Cliente y responsable', 'Ruta e itinerario',
    'Mercancía y equipos', 'Coordinación Origen', 'Completitud']) {
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
