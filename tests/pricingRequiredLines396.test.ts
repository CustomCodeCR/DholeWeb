import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ensureMiamiPlanVgm396, ensureIndependentRoadFreight396,
  isRealRoadFreight396, hasActualVgm396,
  type RequiredPricingLine396,
} from '../src/modules/pricing/utils/pricingRequiredLines396.ts'
import { patchPricingP7Reconcile391 } from '../build/pricingP7Reconcile391.ts'

type Line = RequiredPricingLine396 & { key: string }
const vgm = (sale: number, key = 'own:vgm'): Line => ({
  key, name: 'VGM', saleAmount: sale, costAmount: 0,
  costDetailType: 'DestinationCharge', included: sale > 0, manual: false,
  section: 'destination_charges',
})
const road = (sale = 2140): Line => ({
  key: 'p7-393-panama-gam-fcl-land', name: 'Flete internacional terrestre',
  costDetailType: 'Freight', costAmount: 2140, saleAmount: sale,
  section: 'international_freight', included: true, manual: false,
})
test('DH-396 Miami VGM is priced for actual A/B/C/D/NVOCC/LITTLE plans and is idempotent', () => {
  const plans = [
    ['A', 20], ['B', 25], ['C', 25], ['D', 45],
    ['NVOCC-B', 20], ['NVOCC-A', 0], ['LITTLE', 15],
  ] as const
  for (const [plan, amount] of plans) {
    const base: Line[] = [vgm(0)]
    const completed = ensureMiamiPlanVgm396(base, amount, () => vgm(amount, 'plan:vgm'))
    assert.equal(completed.length, 1, plan)
    assert.equal(completed[0].saleAmount, amount, plan)
    assert.equal(completed[0].included, amount > 0, plan)
    const stable = ensureMiamiPlanVgm396(completed, amount, () => vgm(amount))
    assert.equal(stable.length, 1, plan)
    assert.equal(stable[0].saleAmount, amount, plan)
  }
})
test('DH-396 missing VGM is created; a zero-priced matrix row never suppresses the plan', () => {
  const lines: Line[] = [{ key: 'freight:miami', name: 'Flete', included: true }]
  let result = ensureMiamiPlanVgm396(lines, 45, () => vgm(45, 'p7-394-miami:vgm'))
  assert.equal(result.length, 2)
  assert.equal(result.find(hasActualVgm396)?.saleAmount, 45)
  result = ensureMiamiPlanVgm396(result, 45, () => vgm(45))
  assert.equal(result.length, 2)
  const withZero = [vgm(0)]
  withZero[0].included = false
  const fixed = ensureMiamiPlanVgm396(withZero, 20, () => vgm(20))
  assert.equal(fixed.length, 1)
  assert.equal(fixed[0].saleAmount, 20)
  assert.equal(fixed[0].included, true)
})
test('DH-396 positive provider, saved and manual Miami VGM prices are preserved', () => {
  const positive = [vgm(90)]
  ensureMiamiPlanVgm396(positive, 45, () => vgm(45))
  assert.equal(positive[0].saleAmount, 90)
  const saved = [{ ...vgm(0), detailId: 'saved-detail' }]
  ensureMiamiPlanVgm396(saved, 45, () => vgm(45))
  assert.equal(saved[0].saleAmount, 0)
  const manual = [{ ...vgm(0), manual: true }]
  ensureMiamiPlanVgm396(manual, 45, () => vgm(45))
  assert.equal(manual[0].saleAmount, 0)
})
test('DH-396 Balboa bunker cannot replace the independent FCL terrestrial Freight', () => {
  const maritime: Line = { key: 'freight', name: 'Flete internacional marítimo',
    costDetailType: 'Freight', costAmount: 5300, saleAmount: 5800, included: true }
  const bunker: Line = { key: 'bunker', name: 'Bunker Flete Internacional Terrestre Panama a Costa Rica',
    costDetailType: 'DestinationCharge', costAmount: 280, saleAmount: 280, included: true }
  assert.equal(isRealRoadFreight396(bunker), false)
  assert.equal(isRealRoadFreight396(maritime), false)
  let lines = ensureIndependentRoadFreight396([maritime, bunker], true, () => road())
  assert.equal(lines.length, 3)
  assert.equal(lines.filter(isRealRoadFreight396).length, 1)
  assert.equal(lines.filter(x => x.costDetailType === 'Freight').length, 2)
  assert.equal(lines.find(isRealRoadFreight396)?.costAmount, 2140)
  lines = ensureIndependentRoadFreight396(lines, true, () => road())
  assert.equal(lines.length, 3)
  assert.equal(lines.find(x => x.key === 'freight')?.saleAmount, 5800)
  assert.equal(lines.find(x => x.key === 'bunker')?.saleAmount, 280)
})
test('DH-396 automatically restores an existing unpriced or hidden land leg', () => {
  const ghost = [{ ...road(0), key: 'cost:land', costAmount: 0, saleAmount: 0, included: false }]
  const fixed = ensureIndependentRoadFreight396(ghost, true, () => road(2360))
  assert.equal(fixed.length, 1)
  assert.equal(fixed[0].key, 'cost:land')
  assert.equal(fixed[0].costAmount, 2140)
  assert.equal(fixed[0].saleAmount, 2360)
  assert.equal(fixed[0].included, true)
  const hidden = [{ ...road(2400), included: false }]
  ensureIndependentRoadFreight396(hidden, true, () => null)
  assert.equal(hidden[0].included, true)
  const saved = [{ ...road(), detailId: 'saved-fcl' }]
  ensureIndependentRoadFreight396(saved, true, () => road())
  assert.equal(saved.length, 1)
  const otherRoute = ensureIndependentRoadFreight396([], false, () => road())
  assert.deepEqual(otherRoute, [])
})
test('DH-396 Vite patch actually wires P7 rebuild and pre-save, not just a watcher', () => {
  const fixture = [
    '<script setup lang="ts">',
    'function rebuildRateLines() {',
    '  rateLines.value = lines',
    '  lastTierPricingInputKey.value = tierPricingInputKey',
    '}',
    'function saveRate() {',
    '  rateLines.value = removeDuplicateFclFreight(rateLines.value, shipmentModeForApi.value)',
    '  if (!editingRate.value) applyIncotermAutomaticChargeGuard()',
    '}',
    'function isAutomaticOutsideIncoterm(line: RateLine) { return true }',
    'function quoteEditApplyDelta387() {}',
    'function syncPanamaOverweightLines() {}',
    'function syncOwnLclCrcAgencyLine() {}',
    '</script>',
    '<div>{{ line.name }}</div>',
  ].join('\n')
  const code = patchPricingP7Reconcile391(fixture)
  assert.match(code, /if \(step.value === 7\) p7PresentOrReconcile391\(\)/)
  assert.match(code, /if \(!props.rateId\) p7PresentOrReconcile391\(true\)/)
  assert.match(code, /p7SyncMiamiCommercialItems394\(force\)/)
  assert.match(code, /ensureMiamiPlanVgm396\(rateLines.value, item.sale/)
  assert.match(code, /ensureIndependentRoadFreight396\(rateLines.value, true/)
  assert.match(code, /isRealRoadFreight396\(line\)/)
  assert.match(code, /normalizeCatalogValue\(line.name\) === "vgm"\) return false/)
  assert.match(code, /\(hasInternationalTransportService.value \|\| number\(form.freightCost\) > 0\)/)
  assert.equal(patchPricingP7Reconcile391(code), code)
})

test('DH-398: server-applicable Panama land Freight is reconciled on async P7 arrival', () => {
  const fixture = [
    '<script setup lang="ts">',
    'function rebuildRateLines() {',
    '  rateLines.value = lines',
    '  lastTierPricingInputKey.value = tierPricingInputKey',
    '}',
    'function saveRate() {',
    '  rateLines.value = removeDuplicateFclFreight(rateLines.value, shipmentModeForApi.value)',
    '  if (!editingRate.value) applyIncotermAutomaticChargeGuard()',
    '}',
    'function isAutomaticOutsideIncoterm(line: RateLine) { return true }',
    'function quoteEditApplyDelta387() {}',
    'function syncPanamaOverweightLines() {}',
    'function syncOwnLclCrcAgencyLine() {}',
    '</script>',
    '<div>{{ line.name }}</div>',
  ].join('\n')
  const code = patchPricingP7Reconcile391(fixture)
  assert.match(code, /costResolvedByBackendContext\(cost\)/,
    'only the active request-context applicable master may create CostId-backed freight')
  assert.match(code, /form\.modality === 'Multimodal' \|\| p7IsPanamaCorridor391\(\)/,
    'Panama road leg is independent from the maritime part of the modality selector')
  assert.match(code, /form\.serviceIds\.join\('\|'\), costs\.value/,
    'watch the resolved server-applicable list, not only initial navigation')
  assert.match(code, /\{ flush: 'post' \}/)
  assert.match(code, /p7PresentOrReconcile391\(\)/)
  assert.match(code, /isRealRoadFreight396\(line\)\) return false/,
    'Incoterm responsibility may not silently remove a contracted land leg')
  assert.equal(patchPricingP7Reconcile391(code), code)
})
