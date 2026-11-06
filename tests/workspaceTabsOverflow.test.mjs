import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/shared/components/organisms/DhWorkspaceTabs.vue', import.meta.url), 'utf8')
test('overflow expands below the workspace bar rather than covering application content', () => {
  assert.match(source, /ref="overflowPanelRef"/)
  assert.match(source, /class="order-last w-full/)
  assert.doesNotMatch(source, /absolute right-0 top-full z-50/)
  assert.match(source, /overflowPanelRef\.value\?\.contains\(event\.target as Node\)/)
})
test('overflow entries support navigation, closing and keyboard escape', () => {
  assert.match(source, /v-for="tab in hiddenTabs"/)
  assert.match(source, /@click="activate\(tab\.path, tab\.key\)"/)
  assert.match(source, /@click="close\(tab\.key\)"/)
  assert.match(source, /@keydown\.esc\.stop="overflowOpen = false"/)
})
