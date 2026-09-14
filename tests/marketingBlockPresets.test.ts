import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('FASE 45 exposes the six requested Services block presets with visual thumbnails', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPresetPicker.vue', import.meta.url), 'utf8')

  assert.match(properties, /MarketingBlockPresetPicker/)
  assert.match(properties, /isServicesPresetBlock/)
  assert.match(properties, /Diseño de Servicios/)
  for (const label of ['3 Cards', '4 Cards', 'Cards con imagen', 'Cards con iconos', 'Slider', 'Lista alternada']) {
    assert.ok(picker.includes(label), `Missing FASE 45 Services preset: ${label}`)
  }
  assert.match(picker, /DhBlockCard/)
  assert.match(picker, /modelValue === preset\.id/)
  assert.match(picker, /#icon/)
})

test('FASE 45 persists the clicked Services preset through the existing Page Builder edit flow', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  assert.match(properties, /editorBlockPreset/)
  assert.match(properties, /saveBlockPreset/)
  assert.match(properties, /saveDesignPreference\('editorBlockPreset'/)
  assert.match(editor, /saveBlockTextProperty/)
  assert.match(editor, /operation: 'edit'/)
})

test('FASE 45 keeps presets human and does not advance the Media Picker work from FASE 46', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPresetPicker.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(picker, /StorageFileId|JSON|ServicesGrid/)
  assert.doesNotMatch(properties, /DhMediaPicker/)
})
