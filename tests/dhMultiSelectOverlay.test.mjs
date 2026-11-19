import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('DhMultiSelect dropdown renders above translucent Dhole cards with a solid theme surface', () => {
  const select = read('src/shared/components/atoms/DhMultiSelect.vue')
  const theme = read('src/assets/theme.css')
  assert.ok(select.includes('<Teleport to="body">'))
  assert.ok(select.includes('ref="menuRef"'))
  assert.ok(select.includes('class="dh-multi-popover fixed z-[120]'))
  assert.ok(select.includes('background-color: var(--dh-card-solid)'))
  assert.ok(!select.includes('bg-[var(--dh-input)] p-3 shadow-[var(--dh-shadow-lg)]'))
  assert.ok(theme.includes('--dh-card-solid: #ffffff'))
  assert.ok(theme.includes('--dh-card-solid: #18181b'))
})

test('Portaled dropdown remains interactive and anchored during scrolling and responsive layout changes', () => {
  const select = read('src/shared/components/atoms/DhMultiSelect.vue')
  assert.ok(select.includes('detailsRef.value.getBoundingClientRect()'))
  assert.ok(select.includes("window.addEventListener('scroll', handleViewportChange, true)"))
  assert.ok(select.includes("window.addEventListener('resize', handleViewportChange)"))
  assert.ok(select.includes('menuRef.value?.contains(target)'))
  assert.ok(select.includes("document.removeEventListener('pointerdown', handleOutsidePointer, true)"))
  assert.ok(select.includes('function toggle(value: string)'))
  assert.ok(select.includes('<Check v-if="modelValue.includes(option.value)"'))
})
