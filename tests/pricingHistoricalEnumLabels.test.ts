import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  historicalChargeBasisLabel,
  historicalCostDetailTypeLabel,
  historicalCostTypeLabel,
} from '../src/modules/pricing/utils/pricingHistoricalEnumLabels.ts'

test('revision snapshot ChargeBasis numerical codes match the Pricing backend', () => {
  const cases = {
    0: 'Por embarque',
    1: 'Por contenedor',
    2: 'Por camión',
    3: 'Por TEU',
    4: 'Por recolecta',
    10: 'Por CBM',
    11: 'Por CBM cobrable',
    12: 'Por CFT',
    13: 'Por CFT cobrable',
    20: 'Por kg',
    21: 'Por 100 kg',
    22: 'Por tonelada',
    23: 'Por lb',
    30: 'Por pallet',
    31: 'Por bulto',
    40: 'Por documento',
    50: 'Por servicio',
  }
  for (const [code, label] of Object.entries(cases)) {
    assert.equal(historicalChargeBasisLabel(code), label)
    assert.equal(historicalChargeBasisLabel(Number(code)), label)
  }
  assert.equal(historicalChargeBasisLabel('PerChargeableCbm'), 'Por CBM cobrable')
  assert.equal(historicalChargeBasisLabel('perkg'), 'Por kg')
})

test('revision snapshot CostDetailType numerical codes match the Pricing backend', () => {
  const cases = {
    0: 'Otro',
    1: 'Flete internacional',
    2: 'Cargo en origen',
    3: 'Cargo en destino',
    4: 'Cargo portuario',
    5: 'Aduana',
    6: 'Transporte interno',
    7: 'Costo de agente',
    8: 'Documentación',
    9: 'Seguro',
  }
  for (const [code, label] of Object.entries(cases)) {
    assert.equal(historicalCostDetailTypeLabel(code), label)
    assert.equal(historicalCostDetailTypeLabel(Number(code)), label)
  }
  assert.equal(historicalCostDetailTypeLabel('Freight'), 'Flete internacional')
  assert.equal(historicalCostDetailTypeLabel('origincharge'), 'Cargo en origen')
})

test('historical fallbacks preserve missing and unfamiliar enums without guessing', () => {
  assert.equal(historicalCostTypeLabel(1), 'Fijo')
  assert.equal(historicalCostTypeLabel('Variable'), 'Variable')
  assert.equal(historicalCostTypeLabel(0), 'Opcional')
  assert.equal(historicalChargeBasisLabel(null), '—')
  assert.equal(historicalCostDetailTypeLabel(undefined), '—')
  assert.equal(historicalChargeBasisLabel('FutureBasis'), 'FutureBasis')
  assert.equal(historicalCostDetailTypeLabel(55), '55')
})

test('revision viewer translates both columns, without rewriting historical amounts', () => {
  const component = readFileSync(new URL('../src/modules/pricing/components/PricingRateRevisionViewer.vue', import.meta.url), 'utf8')
  assert.match(component, /historicalChargeBasisLabel\(pick\(detail, 'ChargeBasis', 'chargeBasis'\)\)/)
  assert.match(component, /lineDetailType\(detail\)/)
  assert.match(component, /historicalCostDetailTypeLabel\(detailType\)/)
  assert.match(component, /<th class="px-3 py-2">Tipo de cargo<\/th>/)
  assert.match(component, /lineSubtotal\(detail\)/)
  assert.match(component, /lineTax\(detail\)/)
})
