import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  crmAgendaDays,
  crmAgendaRecordsForDay,
  crmLocalDateKey,
} from '../src/modules/crm/model/crmAgenda.ts'

test('a UTC late-night follow-up belongs to its Costa Rican local date', () => {
  const original = process.env.TZ
  process.env.TZ = 'America/Costa_Rica'
  try {
    assert.equal(crmLocalDateKey('2026-10-26T01:30:00Z'), '2026-10-25')
    const items = [
      { id: 'next', dueAt: '2026-10-26T07:00:00Z' },
      { id: 'today', dueAt: '2026-10-26T01:30:00Z' },
    ]
    assert.deepEqual(crmAgendaRecordsForDay(items, '2026-10-25').map(x => x.id), ['today'])
    assert.deepEqual(crmAgendaRecordsForDay(items, '2026-10-26').map(x => x.id), ['next'])
  } finally {
    process.env.TZ = original
  }
})

test('local agenda advances by calendar day, including month/year boundaries', () => {
  const original = process.env.TZ
  process.env.TZ = 'America/Costa_Rica'
  try {
    const days = crmAgendaDays(new Date('2026-12-31T18:00:00Z'))
    assert.equal(days.length, 7)
    assert.deepEqual(days.map(d => d.dateKey), [
      '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
      '2027-01-04', '2027-01-05', '2027-01-06',
    ])
    assert.ok(days[0]?.label.length)
  } finally {
    process.env.TZ = original
  }
})

test('agenda ordering is chronological and ignores invalid timestamps', () => {
  const original = process.env.TZ
  process.env.TZ = 'America/Costa_Rica'
  try {
    const records = [
      { id: 'later', scheduledStartAt: '2026-10-25T22:00:00Z' },
      { id: 'bad', dueAt: 'not-a-timestamp' },
      { id: 'early', dueAt: '2026-10-25T14:00:00Z' },
    ]
    assert.deepEqual(crmAgendaRecordsForDay(records, '2026-10-25').map(x => x.id), [
      'early', 'later',
    ])
    assert.equal(crmLocalDateKey('not-a-timestamp'), null)
  } finally {
    process.env.TZ = original
  }
})

test('a seven-day span does not skip a day when daylight saving changes', () => {
  const original = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    const days = crmAgendaDays(new Date('2027-03-13T17:00:00Z'), 'en-US')
    assert.deepEqual(days.map(d => d.dateKey).slice(0, 4), [
      '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16',
    ])
  } finally {
    process.env.TZ = original
  }
})
