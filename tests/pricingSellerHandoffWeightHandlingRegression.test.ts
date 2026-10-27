import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const weightsPatch = readFileSync(
  new URL('../build/pricingFclUnitWeights20261015.ts', import.meta.url), 'utf8',
)
const sellerPatch = readFileSync(
  new URL('../build/pricingSellerRateRequestResponsibilities.ts', import.meta.url), 'utf8',
)
const conditionsPatch = readFileSync(
  new URL('../build/pricingCostOperationalConditions.ts', import.meta.url), 'utf8',
)

function unitWeightRestoration() {
  const start = weightsPatch.indexOf('function restoreFclUnitWeights(')
  const end = weightsPatch.indexOf('// Use the individual unit weights', start)
  assert.ok(start >= 0 && end > start, 'weight hydration function is present')
  const runtime = ts.transpileModule(weightsPatch.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  const scope: Record<string, any> = {
    fclUnitWeightsKg: { value: {} },
    number: (value: unknown) => Number(value) || 0,
  }
  vm.runInNewContext(runtime + '\nthis.restore = restoreFclUnitWeights', scope)
  return {
    restore: scope.restore as (rows: Array<{ containerTypeId: string; quantity: number; unitWeightsKg?: number[] }>,
      total?: number) => void,
    current: () => scope.fclUnitWeightsKg.value as Record<string, number[]>,
  }
}

test('legacy seller FCL: 15,000 kg aggregate restores the missing single 40HC weight', () => {
  const units = unitWeightRestoration()
  units.restore([{ containerTypeId: '40HC', quantity: 1, unitWeightsKg: [0] }], 15000)
  assert.equal(units.current()['40HC']?.[0], 15000)
})

test('FCL with several physical units does not guess each unit weight from the aggregate', () => {
  const units = unitWeightRestoration()
  units.restore([
    { containerTypeId: '40HC', quantity: 1, unitWeightsKg: [0] },
    { containerTypeId: '20DV', quantity: 1, unitWeightsKg: [0] },
  ], 15000)
  assert.deepEqual(Array.from(units.current()['40HC'] ?? []), [0])
  assert.deepEqual(Array.from(units.current()['20DV'] ?? []), [0])
})

test('FCL keeps already-persisted individual weights', () => {
  const units = unitWeightRestoration()
  units.restore([{ containerTypeId: '40HC', quantity: 2, unitWeightsKg: [12000, 16000] }], 28000)
  assert.deepEqual(Array.from(units.current()['40HC'] ?? []), [12000, 16000])
})

test('rate and seller request hydrations use per-container weights with aggregate fallback', () => {
  assert.match(weightsPatch, /restoreFclUnitWeights\(allocations, number\(rate\.totalWeightKg\)\)/)
  assert.match(weightsPatch, /sellerEquipment\?\.fclContainers/)
  assert.match(weightsPatch, /restoreFclUnitWeights\(sellerUnits/)
  assert.match(weightsPatch, /fclMissingUnitCount\.value > 0/)
})

test('Anticipado / Redestino are persisted and applied to pricing condition', () => {
  assert.match(sellerPatch, /form\.portHandlingMode = sellerPortHandlingMode\.value/)
  assert.match(sellerPatch, /form\.portHandlingMode = requestedPortHandlingMode\.value/)
  assert.match(conditionsPatch, /form\.portHandlingMode !== \(anticipado \? 'Anticipado' : 'Redestino'\)/)
  assert.match(conditionsPatch, /operationalConditionsSatisfied\(line\)/)
})
