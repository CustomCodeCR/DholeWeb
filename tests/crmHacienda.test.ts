import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  retryCrmHaciendaNetwork, isMatchingCrmHaciendaResult, crmHaciendaErrorMessage,
} from '../src/modules/crm/utils/crmHacienda.ts'

test('CRM retries one transport failure and keeps the authenticated GET idempotent', async () => {
  let calls = 0
  const transport = Object.assign(new Error('Network error while accessing /api/crm/hacienda/lookup?identificacion=123456789'), { name: 'NetworkError' })
  let delay = 0
  const value = await retryCrmHaciendaNetwork(async () => {
    calls++
    if (calls === 1) throw transport
    return 'verified'
  }, () => true, async ms => { delay = ms })
  assert.equal(value, 'verified')
  assert.equal(calls, 2)
  assert.equal(delay, 650)
})

test('CRM never retries HTTP failures or a stale lookup', async () => {
  for (const status of [400, 401, 403, 404, 429, 502, 503, 504]) {
    let calls = 0
    const failure = Object.assign(new Error('HTTP failure'), { status })
    await assert.rejects(retryCrmHaciendaNetwork(async () => {
      calls++
      throw failure
    }, () => true, async () => {}), (error: unknown) => error === failure)
    assert.equal(calls, 1)
  }
  let calls = 0
  const network = Object.assign(new Error('Failed to fetch'), { name: 'NetworkError' })
  await assert.rejects(retryCrmHaciendaNetwork(async () => {
    calls++
    throw network
  }, () => false, async () => {}))
  assert.equal(calls, 1)
})

test('CRM verifies matching identification, legal name and activities', () => {
  const result = { identification: '3-102-942691', name: 'TEST SRL', activities: [] }
  assert.equal(isMatchingCrmHaciendaResult(result, '3102942691'), true)
  assert.equal(isMatchingCrmHaciendaResult({ ...result, identification: '3102942692' }, '3102942691'), false)
  assert.equal(isMatchingCrmHaciendaResult({ ...result, name: '' }, '3102942691'), false)
  assert.equal(isMatchingCrmHaciendaResult({ ...result, activities: null }, '3102942691'), false)
})

test('CRM Hacienda errors never disclose tax ID, backend URL or browser traces', () => {
  const failure = Object.assign(new Error('Network error while accessing /api/crm/hacienda/lookup?identificacion=3102942691'), { name: 'NetworkError' })
  const message = crmHaciendaErrorMessage(failure)
  assert.match(message, /API de Dhole/)
  assert.doesNotMatch(message, /3102942691|identificacion|\/api\/crm|NetworkError/)
  assert.match(crmHaciendaErrorMessage(Object.assign(new Error('Forbidden'), { status: 403 })), /permiso/)
  assert.match(crmHaciendaErrorMessage(Object.assign(new Error('Rate limit'), { status: 429 })), /limitando/)
})
