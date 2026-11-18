import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { isSrmCostaRicaCountry, isSrmHaciendaMatch, normalizeSrmTaxId,
  srmHaciendaFields, srmHaciendaMainActivity, retrySrmHaciendaNetwork, srmHaciendaErrorMessage } from '../src/modules/srm/utils/srmHacienda.ts'

const verified = {
  identification: '1-1910-0208',
  name: 'Compañía de Prueba, S.A.',
  identificationType: '02',
  regime: 'General',
  verifiedAt: '2026-11-16T22:00:00Z',
  activities: [
    { code: '4923', description: 'Transporte de carga', type: 'principal' },
    { code: '5229', description: 'Servicios de apoyo', type: 'secundaria' },
  ],
}
test('CRM-compatible Hacienda response maps directly to supplier name and primary activity', () => {
  assert.equal(normalizeSrmTaxId('1-1910-0208'), '119100208')
  assert.equal(isSrmHaciendaMatch(verified, '119100208', '119100208'), true)
  assert.equal(srmHaciendaFields(verified).name, 'COMPAÑÍA DE PRUEBA, S.A.')
  assert.equal(srmHaciendaFields(verified).economicActivityCode, '4923')
  assert.equal(srmHaciendaFields(verified).identificationType, '02')
  assert.equal(srmHaciendaFields(verified).regime, 'GENERAL')
})
test('stale or mismatched Hacienda responses cannot overwrite a new supplier tax ID', () => {
  assert.equal(isSrmHaciendaMatch(verified, '119100209', '119100208'), false)
  assert.equal(isSrmHaciendaMatch(verified, '119100208', '119100209'), false)
  assert.equal(isSrmHaciendaMatch({ ...verified, name: '' }, '119100208', '119100208'), false)
})
test('countries and missing activities are handled explicitly without fabricated codes', () => {
  assert.equal(isSrmCostaRicaCountry('Costa Rica'), true)
  assert.equal(isSrmCostaRicaCountry('CR'), true)
  assert.equal(isSrmCostaRicaCountry('Panamá'), false)
  const result = { ...verified, activities: [] }
  assert.equal(srmHaciendaMainActivity(result), null)
  assert.equal(srmHaciendaFields(result).economicActivityCode, '')
})

test('SRM Hacienda interaction follows CRM: resolves automatically without a second Apply action', () => {
  const view = readFileSync('src/modules/srm/views/SrmWorkspaceView.vue', 'utf8')
  assert.match(view, /watch\(\[taxId, costaRicaCountryId, formVisible\]/)
  assert.match(view, /setTimeout\(\(\) => \{/)
  assert.match(view, /applyHaciendaResult\(response, identification, countryId\)/)
  assert.match(view, /if \(version !== haciendaLookupVersion\) return false/)
  assert.match(view, /await pendingHaciendaRequest\.promise/)
  assert.match(view, /haciendaVerifiedAt: haciendaApplied\.value/)
  assert.match(view, /data-srm-accordion="identity"/)
  assert.match(view, /data-srm-accordion="contacts"/)
  assert.match(view, /data-srm-accordion="banks"/)
  assert.match(view, /data-srm-accordion="credit"/)
  assert.doesNotMatch(view, /Aplicar razón social y actividad principal/)
  assert.doesNotMatch(view, /@click="applyHaciendaResult"/)
})

test('SRM Hacienda retries one transient browser network failure but never HTTP errors', async () => {
  let calls = 0
  const network = new Error('Network error while accessing /api/config/srm/hacienda/lookup?identificacion=123456789')
  network.name = 'NetworkError'
  let paused = 0
  const result = await retrySrmHaciendaNetwork(async () => {
    calls += 1
    if (calls === 1) throw network
    return 'OK'
  }, async milliseconds => { paused = milliseconds })
  assert.equal(result, 'OK')
  assert.equal(calls, 2)
  assert.equal(paused, 650)
  for (const status of [400, 401, 403, 404, 429, 502, 503, 504]) {
    let requests = 0
    const error = Object.assign(new Error('Request blocked'), { status, name: 'ClientError' })
    await assert.rejects(retrySrmHaciendaNetwork(async () => {
      requests += 1
      throw error
    }, async () => {}), (value: unknown) => value === error)
    assert.equal(requests, 1)
  }
})

test('Hacienda messages never expose endpoint URLs or tax identification', () => {
  const raw = new Error('Network error while accessing /api/config/srm/hacienda/lookup?identificacion=123456789')
  raw.name = 'NetworkError'
  const message = srmHaciendaErrorMessage(raw)
  assert.match(message, /API de Dhole/)
  assert.doesNotMatch(message, /identificacion|123456789|\/api\/config/)
  assert.match(srmHaciendaErrorMessage(Object.assign(new Error('Blocked'), { status: 403 })), /permiso/)
  assert.match(srmHaciendaErrorMessage(Object.assign(new Error('Limit'), { status: 429 })), /limitando/)
  assert.match(srmHaciendaErrorMessage(Object.assign(new Error('Not found'), { status: 404 })), /no figura/)
  assert.match(srmHaciendaErrorMessage(Object.assign(new Error('Timeout'), { status: 504 })), /temporalmente/)
})

test('SRM footer stays outside the scroller and submits the supplier form', () => {
  const view = readFileSync('src/modules/srm/views/SrmWorkspaceView.vue', 'utf8')
  const modal = readFileSync('src/shared/components/organisms/DhModal.vue', 'utf8')
  assert.match(view, /<form id="srm-supplier-form"/)
  assert.match(view, /<\/form>\s*<template #footer>/)
  assert.match(view, /type="submit" form="srm-supplier-form"/)
  assert.match(view, /srmHaciendaErrorMessage\(cause, en.value\)/)
  assert.doesNotMatch(view, /class="sticky bottom-0 z-20 md:col-span-2/)
  assert.match(modal, /<footer v-if="\$slots.footer"/)
  assert.match(modal, /<slot name="footer"/)
})

test('authenticated GET does not send an unnecessary JSON Content-Type to Gateway', () => {
  const client = readFileSync('src/core/api/fetchConfig.ts', 'utf8')
  assert.match(client, /options\.isFormData \|\| options\.method === 'GET'/)
  assert.match(client, /options\.body === undefined/)
})
