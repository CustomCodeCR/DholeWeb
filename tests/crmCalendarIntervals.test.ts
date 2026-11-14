import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crmCalendarCoversDay, crmCalendarWeekLayout, crmCalendarTimedBlock } from '../src/modules/crm/model/crmCalendarIntervals.ts'

const date = (day: number, hour = 0) => new Date(2026, 10, day, hour)
const event = (key: string, from: Date, end: Date | null) => ({ key, at: from, endsAt: end })

test('multi-day events cover every local calendar day and end exclusively at midnight', () => {
  const item = event('trip', date(12, 9), date(15))
  assert.equal(crmCalendarCoversDay(item, date(11)), false)
  assert.equal(crmCalendarCoversDay(item, date(12)), true)
  assert.equal(crmCalendarCoversDay(item, date(13)), true)
  assert.equal(crmCalendarCoversDay(item, date(14)), true)
  assert.equal(crmCalendarCoversDay(item, date(15)), false)
})

test('a bar continues across week boundaries in the same lane', () => {
  const item = event('trip', date(12, 9), date(20, 17))
  const first = crmCalendarWeekLayout([9,10,11,12,13,14,15].map(d => date(d)), [item])
  assert.deepEqual(first.bars.map(b => [b.from,b.span,b.begins,b.finishes]), [[3,4,true,false]])
  const second = crmCalendarWeekLayout([16,17,18,19,20,21,22].map(d => date(d)), [item])
  assert.deepEqual(second.bars.map(b => [b.from,b.span,b.begins,b.finishes]), [[0,5,false,true]])
})

test('colliding spans use distinct lanes; excess is counted on all days affected', () => {
  const days = [9,10,11,12,13,14,15].map(d => date(d))
  const records = ['a','b','c','d'].map(key => event(key, date(10, 8), date(12, 18)))
  const result = crmCalendarWeekLayout(days, records)
  assert.equal(result.bars.length, 3)
  assert.equal(result.extra[1], 1)
  assert.equal(result.extra[3], 1)
  assert.equal(result.extra[4], 0)
})

test('long events take proportionate vertical space and survive crossing midnight', () => {
  const item = event('long', date(12, 10), date(13, 11))
  const first = crmCalendarTimedBlock(item, date(12))
  const second = crmCalendarTimedBlock(item, date(13))
  assert.ok(first && second)
  assert.equal(first.top, 6 * 52)
  assert.equal(first.height, 22 * 52)
  assert.equal(second.top, 0)
  assert.equal(second.height, 8 * 52)
})

test('legacy events without a finish remain visible as a single instant', () => {
  const item = event('legacy', date(12, 9), null)
  assert.equal(crmCalendarCoversDay(item, date(12)), true)
  assert.equal(crmCalendarCoversDay(item, date(13)), false)
  assert.equal(crmCalendarTimedBlock(item, date(12))?.height, 24)
})
