import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync(new URL('../src/modules/agent/views/AgentGenerationOrchestratorView.vue', import.meta.url), 'utf8')
const callEndpoint = readFileSync(new URL('../src/core/api/callEndpoint.ts', import.meta.url), 'utf8')
const fetchConfig = readFileSync(new URL('../src/core/api/fetchConfig.ts', import.meta.url), 'utf8')

test('standby authorization controls live inside DholeWeb', () => {
  assert.match(view, /async function prepareStandby\(/)
  assert.match(view, /async function inspectStandby\(/)
  assert.match(view, /async function completeStandby\(/)
  assert.match(view, /\/runtime-generations\/authentication\/\{\{generation\}\}\/prepare/)
  assert.match(view, /\/runtime-generations\/authentication\/\{\{generation\}\}\/inspect/)
  assert.match(view, /\/runtime-generations\/authentication\/\{\{generation\}\}\/complete/)
})

test('web viewer uses a short-lived authorized cookie rather than SSH or CDP URLs', () => {
  assert.match(view, /async function openStandbyViewer\(/)
  assert.match(view, /\/viewer\/access/)
  assert.match(view, /credentials: 'include'/)
  assert.doesNotMatch(view, /ssh -N -L/)
  assert.doesNotMatch(view, /http:\/\/localhost:\$\{standbyPorts/)
  assert.match(callEndpoint, /credentials\?: RequestCredentials/)
  assert.match(fetchConfig, /options\.credentials/)
})

test('status rendering is actionable and does not silently dispatch inspections', () => {
  assert.match(view, /Solicitud vencida/)
  assert.match(view, /La preparación necesita atención/)
  assert.match(view, /standbyDiagnosticLabels/)
  assert.doesNotMatch(view, /lastAutomaticInspection/)
})
