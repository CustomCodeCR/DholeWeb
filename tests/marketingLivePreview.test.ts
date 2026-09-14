import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)
const propertiesUrl = new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url)
const previewUrl = new URL('../src/modules/marketing/components/MarketingLivePreview.vue', import.meta.url)

test('FASE 52 replaces the published-only iframe path with the live Page Builder preview', async () => {
  const editor = await readFile(editorUrl, 'utf8')

  assert.match(editor, /MarketingLivePreview/)
  assert.match(editor, /:blocks="livePreviewBlocks"/)
  assert.match(editor, /Cambios en vivo/)
  assert.match(editor, /const livePreviewBlocks = computed/)
  assert.doesNotMatch(editor, /const visualHtml = computed/)
})

test('FASE 52 previews text drafts while Mercadeo types without requiring Save content', async () => {
  const properties = await readFile(propertiesUrl, 'utf8')
  const editor = await readFile(editorUrl, 'utf8')

  assert.match(properties, /'preview-text': \[payload: \{ key: string; value: string \}\]/)
  assert.equal((properties.match(/@update:model-value="previewText"/g) ?? []).length, 2)
  assert.match(editor, /previewTextDrafts/)
  assert.match(editor, /previewBlockText/)
  assert.equal((editor.match(/@preview-text=/g) ?? []).length, 2)
})

test('FASE 52 applies optimistic local updates before Page Builder persistence', async () => {
  const editor = await readFile(editorUrl, 'utf8')

  assert.match(editor, /function replaceBuilderBlockLocal/)
  assert.match(editor, /replaceBuilderBlockLocal\(block\.id, \{ \.\.\.block, data: nextData \}\)/)
  assert.match(editor, /replaceBuilderBlockLocal\(block\.id, \{ \.\.\.block, animation: completeAnimation/)
  assert.match(editor, /const previousBlocks = builderBlocks\.value/)
  assert.match(editor, /if \(!next\) \{\n\s+builderBlocks\.value = previousBlocks/)
})

test('FASE 52 live preview reflects image, design, color, spacing and animation data', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /editorMediaId/)
  assert.match(preview, /downloadFile\(`\/api\/content\/media\/\$\{id\}\/content`/)
  assert.match(preview, /editorDesignAlignment/)
  assert.match(preview, /editorDesignSpacing/)
  assert.match(preview, /editorDesignBackground/)
  assert.match(preview, /editorDesignColor/)
  assert.match(preview, /editorBackgroundColor/)
  assert.match(preview, /block\.animation\?\.preset/)
  assert.match(preview, /--preview-duration/)
  assert.match(preview, /--preview-distance/)
})

test('FASE 52 keeps published HTML only as a safe fallback when there are no builder sections', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /v-else-if="fallbackHtml"/)
  assert.match(preview, /:srcdoc="fallbackHtml"/)
  assert.match(preview, /sandbox=""/)
  assert.doesNotMatch(preview, /v-html/)
})

test('FASE 52 remains the live content engine when FASE 53 adds the device wrapper', async () => {
  const editor = await readFile(editorUrl, 'utf8')
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(editor, /MarketingLivePreview/)
  assert.match(editor, /:blocks="livePreviewBlocks"/)
  assert.match(preview, /DhDevicePreview/)
  assert.match(preview, /visibleBlocks/)
  assert.match(preview, /mediaUrl\(block\)/)
  assert.match(preview, /animationClass\(block\)/)
})
