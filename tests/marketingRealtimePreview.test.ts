import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const inlineUrl = new URL('../src/modules/marketing/components/MarketingInlineEditableText.vue', import.meta.url)
const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)
const previewUrl = new URL('../src/modules/marketing/components/MarketingLivePreview.vue', import.meta.url)

test('FASE 58 inline editing sends every typed value to the live Canvas before commit', async () => {
  const inline = await readFile(inlineUrl, 'utf8')
  const editor = await readFile(editorUrl, 'utf8')

  assert.match(inline, /preview: \[value: string\]/)
  assert.match(inline, /emit\('preview', draft\.value\)/)
  assert.match(inline, /emit\('preview', props\.modelValue\)/)
  assert.match(editor, /@preview="previewBlockText\(sortableBlock\(item\), inlineTextField\(sortableBlock\(item\)\)!\.key, \$event, false\)"/)
  assert.match(editor, /function previewBlockText\(block: PageBuilderBlock, key: string, value: string, autosave = true\)/)
  assert.match(editor, /const livePreviewBlocks = computed\(\(\) => builderBlocks\.value\.map/)
  assert.match(editor, /data: \{ \.\.\.block\.data, \.\.\.draft \}/)
})

test('FASE 58 keeps inline Escape reversible while property-panel text still autosaves', async () => {
  const inline = await readFile(inlineUrl, 'utf8')
  const editor = await readFile(editorUrl, 'utf8')

  assert.match(inline, /function cancel\(\)[\s\S]*emit\('preview', props\.modelValue\)/)
  assert.match(editor, /if \(autosave\) scheduleTextAutosave\(block, key, value\)/)
  assert.match(editor, /@preview-text="selectedBuilderBlock && previewBlockText\(selectedBuilderBlock, \$event\.key, \$event\.value\)"/)
})

test('FASE 58 live renderer reacts to image, layout, background, animation and spacing data', async () => {
  const preview = await readFile(previewUrl, 'utf8')

  assert.match(preview, /editorMediaId/)
  assert.match(preview, /editorLayoutPreset/)
  assert.match(preview, /editorDesignBackground/)
  assert.match(preview, /editorDesignSpacing/)
  assert.match(preview, /block\.animation\?\.preset/)
  assert.match(preview, /watch\(mediaKey, syncMedia, \{ immediate: true \}\)/)
})

test('FASE 58 applies persistent visual changes optimistically before the backend response', async () => {
  const editor = await readFile(editorUrl, 'utf8')

  const textStart = editor.indexOf('async function saveBlockTextProperty')
  const animationStart = editor.indexOf('async function saveBlockAnimation')
  const textSection = editor.slice(textStart, animationStart)
  const animationSection = editor.slice(animationStart, editor.indexOf('async function saveBlockAnimationSettings'))

  assert.ok(textSection.indexOf('replaceBuilderBlockLocal') < textSection.indexOf('await applyBuilderOperation'))
  assert.ok(animationSection.indexOf('replaceBuilderBlockLocal') < animationSection.indexOf('await applyBuilderOperation'))
})
