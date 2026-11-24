import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const buildSource = readFileSync(
  new URL('../build/pricingConsolidatedCargo20261001.ts', import.meta.url),
  'utf8',
)
const encodedRuntime = buildSource.split('\n').find(line => line.startsWith('const CARGO_RUNTIME = '))
assert.ok(encodedRuntime, 'Consolidated cargo runtime must remain available')
const runtime = JSON.parse(encodedRuntime.slice('const CARGO_RUNTIME = '.length))

function createCargoRuntime(lines) {
  const conversionStart = runtime.indexOf('let consolidatedCargoStorageUnit:')
  const conversionEnd = runtime.indexOf('function cargoLineQuantity(', conversionStart)
  const watcherStart = runtime.indexOf('watch(isUnitedStatesPol, (current, previous) => {')
  const watcherEnd = runtime.indexOf('\n\nfunction hydrateConsolidatedCargoLines(', watcherStart)
  assert.ok(conversionStart > 0 && conversionEnd > conversionStart && watcherStart > 0 && watcherEnd > watcherStart)

  const conversions = runtime.slice(conversionStart, conversionEnd)
    .replace("let consolidatedCargoStorageUnit: 'in' | 'cm'", 'let consolidatedCargoStorageUnit')
    .replaceAll('value: number', 'value')
  let onOriginChange
  const originalLines = lines.map(([length, width, height]) => ({ length, width, height }))
  const context = {
    isUnitedStatesPol: { value: true },
    INCH_TO_CM: 2.54,
    number: value => Number(value) || 0,
    consolidatedCargoLines: { value: originalLines },
    watch: (_source, handler) => { onOriginChange = handler },
    syncConsolidatedCargoForm: () => {},
  }
  const script = conversions + '\n' + runtime.slice(watcherStart, watcherEnd)
    + '\n;({ toCm: cargoDimensionToCm, fromCm: cargoDimensionFromCm, unit: () => consolidatedCargoStorageUnit })'
  const helpers = vm.runInNewContext(script, context)
  assert.equal(typeof onOriginChange, 'function')
  return { helpers, context, lines: originalLines, onOriginChange }
}

const miamiLines = [
  [50, 44, 29],
  [21, 12, 7],
  [21, 12, 7],
  [21, 12, 7],
  [40, 37, 33],
]

function physicalCft(lines, toCm) {
  const cbm = lines.reduce((total, line) =>
    total + toCm(line.length) * toCm(line.width) * toCm(line.height) / 1_000_000, 0)
  return cbm * 35.31466672148859
}

test('LCL Miami retains all five physical dimensions before and after POL hydration', () => {
  const { helpers, context, lines, onOriginChange } = createCargoRuntime(miamiLines)
  const before = physicalCft(lines, helpers.toCm)
  assert.ok(Math.abs(before - 68.248) < 0.001, 'volume before save matches screenshots')
  assert.equal(helpers.toCm(50), 127)
  assert.equal(helpers.unit(), 'in')

  // A pending origin/catalog update must not reinterpret a 50-in value as 50 cm.
  context.isUnitedStatesPol.value = false
  assert.equal(helpers.toCm(50), 127)
  assert.ok(Math.abs(physicalCft(lines, helpers.toCm) - before) < 1e-9)

  onOriginChange(false, true)
  assert.equal(helpers.unit(), 'cm')
  assert.equal(lines[0].length, 127)
  assert.equal(lines[0].width, 111.76)
  assert.ok(Math.abs(physicalCft(lines, helpers.toCm) - before) < 1e-9)

  context.isUnitedStatesPol.value = true
  assert.equal(helpers.toCm(127), 127)
  onOriginChange(true, false)
  assert.equal(helpers.unit(), 'in')
  assert.ok(Math.abs(lines[0].length - 50) < 1e-10)
  assert.ok(Math.abs(physicalCft(lines, helpers.toCm) - before) < 1e-9)
})

test('persisted cargoLines always serialize length, width, height to centimeters', () => {
  assert.match(runtime, /lengthCm: cargoDimensionToCm\(line\.length\)/)
  assert.match(runtime, /widthCm: cargoDimensionToCm\(line\.width\)/)
  assert.match(runtime, /heightCm: cargoDimensionToCm\(line\.height\)/)
  assert.match(runtime, /length: cargoDimensionFromCm\(number\(row\.lengthCm\)\)/)
  assert.match(runtime, /width: cargoDimensionFromCm\(number\(row\.widthCm\)\)/)
  assert.match(runtime, /height: cargoDimensionFromCm\(heightCm\)/)
})
