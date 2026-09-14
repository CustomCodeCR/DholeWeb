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

test('FASE 46 edits ALT and caption through the existing media service', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')

  assert.match(picker, /ALT Text/)
  assert.match(picker, /Caption/)
  assert.match(picker, /ContentService\.updateMedia/)
  assert.match(picker, /Guardar detalles/)
})

test('FASE 47 adds the requested image drop zone and keeps library selection available', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')
  const dropZone = await readFile(new URL('../src/shared/components/molecules/DhDropZone.vue', import.meta.url), 'utf8')

  assert.match(picker, /DhDropZone/)
  assert.match(picker, /Arrastre una imagen aquí/)
  assert.match(picker, /Seleccionar desde biblioteca/)
  assert.match(picker, /handleDroppedFiles/)
  assert.match(dropZone, /@drop\.prevent="onDrop"/)
})

test('FASE 47 uploads, creates the media reference, auto-selects it and shows preview', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')

  assert.match(picker, /async function uploadImage\(file: File, autoSelect: boolean\)/)
  assert.match(picker, /ContentService\.uploadMedia\(file, generatedAlt\)/)
  assert.match(picker, /selectedId\.value = uploaded\.id/)
  assert.match(picker, /if \(autoSelect\) emit\('select'/)
  assert.match(picker, /previewUrl\.value = URL\.createObjectURL\(file\)/)
  assert.match(picker, /La imagen se subirá a Storage, se creará su referencia y quedará seleccionada automáticamente/)
  assert.doesNotMatch(picker, /StorageFileId/i)
})

test('FASE 47 does not advance the FASE 48 multimedia gallery redesign', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingMediaPicker.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(picker, /Buscar por fecha|Search by date/)
  assert.doesNotMatch(picker, />\s*Videos\s*</)
  assert.doesNotMatch(picker, />\s*Documentos\s*</)
})
