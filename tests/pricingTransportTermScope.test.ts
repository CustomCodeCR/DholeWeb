import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isInternationalTransportTerm,
  filterTransportOnlyTerms,
  filterTransportOnlyTermSelection,
} from '../src/modules/pricing/services/pricingTransportTermScope.ts'

test('customs-only rate excludes ocean freight, carrier and inland concepts', () => {
  const maritime = [
    'Flete internacional marítimo',
    'Manejos',
    'HBL',
    'Cargos en destino de la línea naviera',
    'THC / Destino',
    'Interno Puerto Caldera → SJO',
    'Inland Caldera a GAM (Naviera)',
    'Carrusel',
    'Doc Fee',
    'Redestino',
    'Pase VIP (inland Naviera ET)',
    'Release',
    'Marchamo USD 100 + IVA',
    'Demoras de contenedor USD 130 + IVA',
  ]
  for (const term of maritime) {
    assert.equal(isInternationalTransportTerm(term), true, term)
  }
  assert.deepEqual(filterTransportOnlyTerms(maritime, false), [])
  assert.deepEqual(filterTransportOnlyTerms(maritime, true), maritime)
})

test('customs and independently contracted services are preserved', () => {
  const customs = [
    'Trámites de aduanas',
    'Trámite de exportación',
    'Inspecciones',
    'revisiones y escáner',
    'Permisos',
    'Mensajería USD 8 a 15 IVI',
    'Bodegaje',
    'Seguro de carga',
  ]
  assert.deepEqual(filterTransportOnlyTerms(customs, false), customs)
})

test('conditions in all three columns are scoped without changing source', () => {
  const selected = {
    includes: ['Flete internacional marítimo', 'Trámites de aduanas', 'HBL'],
    subjectTo: ['Marchamo USD 100 + IVA', 'Inspecciones'],
    excludes: ['Cargos en destino de la línea naviera', 'Permisos'],
  }
  assert.deepEqual(filterTransportOnlyTermSelection(selected, false), {
    includes: ['Trámites de aduanas'],
    subjectTo: ['Inspecciones'],
    excludes: ['Permisos'],
  })
  assert.deepEqual(selected.includes, ['Flete internacional marítimo', 'Trámites de aduanas', 'HBL'])
  assert.strictEqual(filterTransportOnlyTermSelection(selected, true), selected)
})
