import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('own LCL solo presenta el POL real para consolidados distintos de Shanghai', () => {
  const view = readFileSync(new URL('../src/modules/pricing/views/PricingOwnLclView.vue', import.meta.url), 'utf8')
  const selector = readFileSync(new URL('../src/modules/pricing/components/PricingLclRateSourceSelector.vue', import.meta.url), 'utf8')
  assert.ok(view.includes("Escenarios FOB · POL único"))
  assert.ok(view.includes("POL seleccionado"))
  assert.ok(view.includes("!isShanghaiOriginValue(currentPolLabel.value)"))
  assert.ok(view.includes("selected.value?.polId === form.polId"))
  assert.ok(selector.includes("yantian: 'yantian'"))
  assert.ok(selector.includes("cnytn: 'yantian'"))
  assert.ok(selector.includes("if (consolidationOrigin !== 'shanghai') return consolidationOrigin.toUpperCase()"))
  assert.ok(selector.includes("if (!consolidationOrigins.has('shanghai')) return false"))
})
