import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const route = readFileSync(new URL('../src/core/router/index.ts', import.meta.url), 'utf8')
const lab = readFileSync(new URL('../src/modules/dashboard/views/UiMotionLabView.vue', import.meta.url), 'utf8')

test('the animation lab is a closable authenticated workspace view', () => {
  assert.match(route, /path:\s*'lab\/animaciones'/)
  assert.match(route, /name:\s*'ui-motion-lab'/)
  assert.match(route, /component:.*UiMotionLabView\.vue/)
  assert.match(route, /tabTitle:\s*'Laboratorio de animaciones', closable: true/)
})

test('the lab is interactive, self-contained, and respects reduced-motion', () => {
  assert.match(lab, /@pointermove="moveSpotlight"/)
  assert.match(lab, /@click="selectedRate = option"/)
  assert.match(lab, /@click="advanceStep"/)
  assert.match(lab, /@click="showNotification = !showNotification"/)
  assert.match(lab, /prefers-reduced-motion: reduce/)
  assert.match(lab, /@media\(prefers-reduced-motion:reduce\)/)
  assert.match(lab, /motion-disabled/)
  assert.doesNotMatch(lab, /(?:\bfetch\s*\(|\baxios\b|\buseMutation\b)/)
})
