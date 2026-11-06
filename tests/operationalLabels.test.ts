import assert from 'node:assert/strict'
import { test } from 'node:test'
import { operationalLabelPairs } from '../src/core/i18n/operationalLabels.ts'

test('every legacy operational label has a unique nonempty translation', () => {
  const source = new Set<string>()
  for (const [spanish, english] of operationalLabelPairs) {
    assert.ok(spanish.trim() && english.trim())
    assert.ok(!source.has(spanish), 'Duplicated label: ' + spanish)
    source.add(spanish)
  }
  assert.ok(source.has('Filtros de fecha'))
  assert.ok(source.has('Tarifas pendientes para vendedores'))
  assert.ok(source.has('Solicitudes de tarifas de vendedores'))
})
