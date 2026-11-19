import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('DhMultiSelect dropdown renders above translucent Dhole cards with a solid theme surface', () => {
  const select = read('src/shared/components/atoms/DhMultiSelect.vue')
  const theme = read('src/assets/theme.css')
  assert.match(select, /<Teleport to="body">/)
  assert.match(select, /ref="menuRef"/)
  assert.match(select, /class="dh-multi-popover fixed z-\\[120\\]/)
  assert.match(select, /background-color: var\\(--dh-card-solid\\)/)
  assert.doesNotMatch(select, /bg-\\[var\\(--dh-input\\)\\] p-3 shadow-\\[var\\(--dh-shadow-lg\\)\\]/)
  assert.match(theme, /--dh-card-solid: #ffffff/)
  assert.match(theme, /--dh-card-solid: #18181b/)
})

test('Portaled dropdown remains interactive and anchored during scrolling and responsive layout changes', () => {
  const select = read('src/shared/components/atoms/DhMultiSelect.vue')
  assert.match(select, /detailsRef\.value\.getBoundingClientRect\\(\\)/)
  assert.match(select, /window\.addEventListener\\('scroll', handleViewportChange, true\\)/)
  assert.match(select, /window\.addEventListener\\('resize', handleViewportChange\\)/)
  assert.match(select, /menuRef\.value\?\.contains\\(target\\)/)
  assert.match(select, /document\.removeEventListener\\('pointerdown', handleOutsidePointer, true\\)/)
  assert.match(select, /function toggle\\(value: string\\)/)
  assert.match(select, /<Check v-if="modelValue\.includes\\(option\.value\\)"/)
})
