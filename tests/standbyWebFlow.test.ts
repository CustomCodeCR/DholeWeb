import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const view = readFileSync(new URL('../src/modules/agent/views/AgentGenerationOrchestratorView.vue', import.meta.url), 'utf8')
const profileView = readFileSync(new URL('../src/modules/agent/views/AgentBrowserProfilesView.vue', import.meta.url), 'utf8')
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
  assert.match(view, /activeStandbyViewer/)
  assert.match(view, /<iframe :src="activeStandbyViewer.url"/)
  assert.doesNotMatch(view, /window.open\('about:blank'/)
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

test('all new generations authenticate by Hub without collecting account details', () => {
  assert.match(view, /Hub autenticado detectado/)
  assert.match(view, /Comprobar ahora/)
  assert.match(view, /No necesitás proporcionar nombre, usuario ni Customer ID/)
  assert.match(view, /Dhole detecta y registra el acceso automáticamente/)
  assert.doesNotMatch(view, /<strong>Customer ID:<\/strong>/)
  assert.doesNotMatch(view, /<strong>Usuario:<\/strong>/)
  assert.match(profileView, /Acceso al Hub confirmado, sin recopilar datos de la cuenta/)
  assert.match(view, /validStandbyName\(item.name\)/)
})

test('standby finalization explains conflicts without pretending login failed', () => {
  assert.match(view, /response.status === 'Verified'/)
  assert.match(view, /response.alreadyProcessing/)
  assert.match(view, /standby_hub_proof_expired/)
  assert.match(view, /standby_auth_session_expired/)
  assert.match(view, /standby_auth_session_not_ready_or_wrong_operator/)
  assert.match(view, /toast.warning\('Verificación del Hub vencida'/)
})

test('browser sessions distinguish prod1 original from isolated prod2 authorization', () => {
  assert.match(profileView, /Sesiones independientes de Maersk/)
  assert.match(profileView, /\/runtime-generations\/authentication\//)
  assert.match(profileView, /puerto 6080 corresponde al perfil original de prod1/)
  assert.match(profileView, /to="\/agents\/generations"/)
  assert.match(profileView, /entry\.accountVerifiedAtUtc/)
})

test('generation guide tracks six distinct stages and retains server-confirmed completion', () => {
  assert.match(view, /panel === 'guide'/)
  assert.match(view, /Paso 1 — Elegir o registrar el destino/)
  assert.match(view, /Paso 2 — Preparar la infraestructura/)
  assert.match(view, /Paso 3 — Verificar acceso autorizado al proveedor/)
  assert.match(view, /Paso 4 — Registrar la autorización independiente/)
  assert.match(view, /Paso 5 — Preflight y solicitud de relevo/)
  assert.match(view, /Paso 6 — Confirmar el resultado real/)
  assert.match(view, /providerReadinessStatus === 'Verified'/)
  assert.match(view, /guideRequest\?\.status === 'Completed' && state\.activeGeneration === guideTarget/)
  assert.match(view, /guideConfirmedTarget\.value === guideTarget\.value/)
  assert.match(view, /guideSubmittedId\.value = response\.id/)
})

test('generation guide delegates Docker operations to protected GitHub Actions', () => {
  assert.match(view, /production-generation-actions\.yml/)
  assert.match(view, /operator-verify-standby-readiness\.yml/)
  assert.match(view, /operation=<strong>preflight<\/strong>/)
  assert.match(view, /guideAuthorized\.value && manualEnabled\.value/)
  assert.match(view, /state\.value\?\.githubDispatcherConfigured/)
  assert.match(view, /trigger: 'manual'/)
  assert.match(view, /El entorno activo mostrado es el registro de PostgreSQL/)
  assert.doesNotMatch(view, /docker compose down -v/)
})
