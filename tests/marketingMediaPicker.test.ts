import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('FASE 46 opens the official DhMediaPicker instead of asking for a technical file id', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')

  assert.match(properties, /MarketingMediaPicker/)
  assert.match(properties, /Seleccionar imagen/)
  assert.match(properties, /editorMediaId/)
  assert.match(picker, /DhMediaPicker/)
  assert.doesNotMatch(properties, /StorageFileId/i)
  assert.doesNotMatch(picker, /StorageFileId/i)
})

test('FASE 46 supports search, filter, upload, selection and preview from the media library', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')
  const shared = await readFile(new URL('../src/shared/components/organisms/DhMediaPicker.vue', import.meta.url), 'utf8')

  assert.match(picker, /ContentService\.browseMedia/)
  assert.match(picker, /ContentService\.uploadMedia/)
  assert.match(picker, /Buscar imagen\.\.\./)
  assert.match(picker, /filterOptions/)
  assert.match(picker, /Subir imagen/)
  assert.match(picker, /downloadFile/)
  assert.match(picker, /Seleccionar imagen/)
  assert.match(shared, /DhSelect/)
  assert.match(shared, /searchPlaceholder/)
  assert.match(shared, /slot name="details"/)
})

test('FASE 46 edits ALT and caption while preserving FASE 47 drag and drop for later', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')

  assert.match(picker, /ALT Text/)
  assert.match(picker, /Caption/)
  assert.match(picker, /ContentService\.updateMedia/)
  assert.match(picker, /Guardar detalles/)
  assert.doesNotMatch(picker, /Arrastre una imagen aquí/)
  assert.doesNotMatch(picker, /@drop/)
})
