import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)

async function editorSource() {
  return readFile(editorUrl, 'utf8')
}

test('FASE 57 debounces property text and persists the draft automatically', async () => {
  const source = await editorSource()

  assert.match(source, /const AUTOSAVE_DELAY_MS = 800/)
  assert.match(source, /interface PendingTextAutosave/)
  assert.match(source, /function scheduleTextAutosave\(block: PageBuilderBlock, key: string, value: string\)/)
  assert.match(source, /scheduleTextAutosave\(block, key, value\)/)
  assert.match(source, /void flushPendingTextAutosave\(true\)/)
  assert.match(source, /operation: 'edit'/)
  assert.match(source, /dataJson: JSON\.stringify\(nextData\)/)
  assert.match(source, /PageBuilderService\.apply\(contentId, request\)/)
})

test('FASE 57 shows a discreet Saving then Saved state in the editor toolbar', async () => {
  const source = await editorSource()

  assert.match(source, /type SaveState = 'idle' \| 'saving' \| 'saved' \| 'error'/)
  assert.match(source, /tr\('Guardando\.\.\.', 'Saving\.\.\.'\)/)
  assert.match(source, /tr\('Guardado', 'Saved'\)/)
  assert.match(source, /role="status"/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /LoaderCircle/)
  assert.match(source, /<Check v-else-if="saveState === 'saved'"/)
  assert.doesNotMatch(source, /alert\s*\(/)
})

test('FASE 57 saves pending text before changing page or leaving the visual editor', async () => {
  const source = await editorSource()

  assert.match(source, /async function selectEditorPage\(value: string \| number\)/)
  assert.match(source, /if \(!await flushPendingTextAutosave\(false\)\) return/)
  assert.match(source, /selectedPageId\.value = nextPageId/)
  assert.match(source, /async function closeEditor\(\)/)
  assert.match(source, /emit\('close'\)/)
  assert.match(source, /@update:model-value="selectEditorPage"/)
  assert.match(source, /@click="closeEditor"/)
})

test('FASE 57 keeps automatic text saves quiet while existing explicit actions may still use toasts', async () => {
  const source = await editorSource()

  assert.match(source, /showSuccessToast\?: boolean/)
  assert.match(source, /showSuccessToast: false/)
  assert.match(source, /if \(options\.showSuccessToast !== false && successMessage\) toastStore\.success\(successMessage\)/)
})

test('FASE 57 does not advance Undo Redo from FASE 58', async () => {
  const source = await editorSource()

  assert.doesNotMatch(source, /Undo2|Redo2/)
  assert.doesNotMatch(source, /Deshacer|Rehacer/)
  assert.doesNotMatch(source, /undoStack|redoStack|historyStack/)
})
