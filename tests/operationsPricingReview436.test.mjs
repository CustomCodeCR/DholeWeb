import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const detail = readFileSync(new URL('../src/modules/operations/views/OperationsCaseDetailView.vue', import.meta.url), 'utf8')
const api = readFileSync(new URL('../src/modules/operations/services/operationsApi.ts', import.meta.url), 'utf8')

test('Operations distinguishes quoted and added services and preserves commercial quotation', () => {
  assert.match(detail, /service\.source === 'QUOTED'/)
  assert.match(detail, /QUO original permanece sin modificaciones/)
  assert.match(detail, /pendingCommercialAlerts\.length/)
  assert.match(detail, /role="alert"/)
  assert.match(detail, /<DhCard title="Servicios del expediente/)
  assert.match(detail, /<DhInput v-model="newService\.serviceCode"/)
  assert.match(detail, /<DhTextarea v-model="newService\.reason"/)
  assert.match(detail, /!validNewService/)
  assert.match(detail, /operationsApi\.addCaseService/)
})

test('Added service retries reuse idempotency key until confirmed', () => {
  const create = detail.slice(detail.indexOf('async function addOperationalService()'),
    detail.indexOf('async function addNote()'))
  assert.match(create, /idempotencyKey: addServiceKey\.value/)
  assert.match(create, /addServiceKey\.value = crypto\.randomUUID\(\)/)
  assert.match(create, /Se generó una alerta amarilla/)
  assert.match(create, /El motivo y los datos se conservaron/)
  assert.match(api, /caseServicesAndReviews: \(id: string\)/)
  assert.match(api, /addCaseService: \(id: string, input:/)
  assert.match(api, /OPERATIONS_ADDED/)
})
