import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { isSrmCostaRicaCountry, isSrmHaciendaMatch, normalizeSrmTaxId,
  srmHaciendaFields, srmHaciendaMainActivity } from '../src/modules/srm/utils/srmHacienda.ts'

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
  assert.match(view, /supplierFormTab === 'identity'/)
  assert.match(view, /supplierFormTab === 'contacts'/)
  assert.match(view, /supplierFormTab === 'banks'/)
  assert.match(view, /supplierFormTab === 'credit'/)
  assert.doesNotMatch(view, /Aplicar razón social y actividad principal/)
  assert.doesNotMatch(view, /@click="applyHaciendaResult"/)
})
