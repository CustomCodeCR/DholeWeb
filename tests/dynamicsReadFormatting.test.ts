import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { formatDynamicsReadCell, dynamicsFormattedSuffix } from '../src/modules/dynamics/utils/dynamicsReadFormatting.ts'

const choices = [{ value: 100000004, labels: { '3082': 'Costa Rica', '1033': 'Costa Rica (English)' } }]

test('Dataverse formatted option is preferred while exposing raw code', () => {
  const cell = formatDynamicsReadCell({
    new_origen: 100000004,
    ['new_origen' + dynamicsFormattedSuffix]: 'Costa Rica desde Dynamics',
  }, 'new_origen', choices)
  assert.deepEqual(cell, { text: 'Costa Rica desde Dynamics', raw: '100000004' })
})

test('approved metadata supplies labels if Dataverse omits the annotation', () => {
  assert.deepEqual(formatDynamicsReadCell({ new_origen: 100000004 }, 'new_origen', choices),
    { text: 'Costa Rica', raw: '100000004' })
})

test('unknown values and nulls are never turned into invented labels', () => {
  assert.deepEqual(formatDynamicsReadCell({ new_origen: 9999 }, 'new_origen', choices),
    { text: '9999', raw: null })
  assert.deepEqual(formatDynamicsReadCell({ new_origen: null }, 'new_origen', choices),
    { text: '—', raw: null })
})

test('Query Builder uses the formatter for result cells', () => {
  const view = readFileSync('src/modules/dynamics/views/DynamicsDataWorkspace.vue', 'utf8')
  assert.match(view, /formatReadCell\(item, name\)\.text/)
  assert.match(view, /formatReadCell\(item, name\)\.raw/)
})
