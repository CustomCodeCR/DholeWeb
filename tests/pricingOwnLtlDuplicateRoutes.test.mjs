import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('../src/modules/pricing/views/PricingOwnLtlView.vue', import.meta.url),
  'utf8',
)

test('LTL routes compare both endpoints, not destination country alone', () => {
  assert.match(source, /const selectedRouteChanged = computed\(/)
  assert.match(source, /normalize\(formOrigin\.value\.name\) !== normalize\(selected\.value\.originName\)/)
  assert.match(source, /normalize\(formDestination\.value\.name\) !== normalize\(selected\.value\.destinationName\)/)
})

test('changing a route or duplicating it uses POST without overwriting its original ID', () => {
  assert.match(source, /!selectedId\.value \|\| duplicateMode\.value \|\| selectedRouteChanged\.value/)
  assert.match(source, /const editing = !willCreateNewRoute\.value/)
  assert.match(source, /if \(editing\) \{\s+await FtlTariffService\.update\(targetId, payload\)\s+\} else \{\s+const created = await FtlTariffService\.create\(payload\)/)
})

test('create path blocks already configured location and profile combinations', () => {
  assert.match(source, /const sameRoute = rows\.value\.find/)
  assert.match(source, /normalize\(row\.destinationName\) === normalize\(payload\.destinationName\)/)
  assert.match(source, /'Ruta LTL existente'/)
})

test('existing route provides an explicit duplicate action and a clear create label', () => {
  assert.match(source, /label="Crear otra ruta con estos valores"/)
  assert.match(source, /La tarifa original permanecerá sin cambios/)
  assert.match(source, /willCreateNewRoute \? 'Crear ruta' : 'Guardar cambios'/)
})
