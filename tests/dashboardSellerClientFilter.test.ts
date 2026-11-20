import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sellerClientKey, sellerClientOptions, filterSellerRatesByClient } from '../src/modules/dashboard/utils/sellerClientTableFilter.ts'

test('selector solo lista clientes presentes en las filas autorizadas del seguimiento', () => {
  const rates = [
    { clientName: 'Corporación Álamo', id: '1' },
    { clientName: 'CORPORACION ALAMO', id: '2' },
    { clientName: 'Cliente B', id: '3' },
    { clientName: '  ', id: '4' },
  ]
  assert.deepEqual(sellerClientOptions(rates), [
    { value: 'cliente b', label: 'Cliente B' },
    { value: 'corporacion alamo', label: 'Corporación Álamo' },
  ])
  assert.deepEqual(filterSellerRatesByClient(rates, 'CORPORACION ALAMO').map(rate => rate.id), ['1', '2'])
  assert.equal(filterSellerRatesByClient(rates, '').length, 4)
  assert.equal(sellerClientKey(null), '')
})

test('las tarjetas filtran dentro del dashboard y desplazan a la tabla, sin navegar a Pricing', () => {
  const view = readFileSync(new URL('../src/modules/dashboard/components/SellerRoleDashboard.vue', import.meta.url), 'utf8')
  assert.match(view, /@click="selectStatusCard\(card\.filter\)"/)
  assert.match(view, /statusFilter\.value = filter/)
  assert.match(view, /ratesSection\.value\?\.scrollIntoView/)
  assert.doesNotMatch(view, /function openStatusRates/)
  assert.match(view, /ref="ratesSection" data-seller-guide="rates"/)
})

test('el filtro de cliente usa exactamente las filas previas a elegir cliente y reinicia paginación', () => {
  const view = readFileSync(new URL('../src/modules/dashboard/components/SellerRoleDashboard.vue', import.meta.url), 'utf8')
  assert.match(view, /const clientOptions = computed\(\(\) => sellerClientOptions\(ratesForClientOptions\.value\)\)/)
  assert.match(view, /filterSellerRatesByClient\(ratesForClientOptions\.value, selectedClient\.value\)/)
  assert.match(view, /v-model="selectedClient"/)
  assert.match(view, /watch\(\[search, statusFilter, selectedClient,/)
})
