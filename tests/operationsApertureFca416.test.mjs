import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const opening = readFileSync(new URL('../src/modules/operations/views/OperationsManualCreateView.vue', import.meta.url), 'utf8')

test('FCA demands warehouse for FCL, FTL, LCL and LTL alike', () => {
  assert.match(opening, /const requiresWarehouse = computed\(\(\) => form\.value\.incoterm\?\.trim\(\)\.toUpperCase\(\) === 'FCA'\)/)
  assert.match(opening, /requiresWarehouse\.value && !form\.value\.whsName\.trim\(\)/)
  assert.match(opening, /Nombre WHS \(FCA\)/)
  assert.match(opening, /v-if="requiresWarehouse"/)
  assert.doesNotMatch(opening, /Nombre WHS \(FCA \+ LCL\/LTL\)/)
})
