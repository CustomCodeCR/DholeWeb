import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const themeUrl = new URL('../src/assets/theme.css', import.meta.url)
const editorUrl = new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url)
const libraryUrl = new URL('../src/modules/marketing/components/MarketingBlockLibrary.vue', import.meta.url)
const propertyPanelUrl = new URL('../src/shared/components/organisms/DhPropertyPanel.vue', import.meta.url)
const modalUrl = new URL('../src/shared/components/organisms/DhModal.vue', import.meta.url)
const drawerUrl = new URL('../src/shared/components/organisms/DhDrawer.vue', import.meta.url)

test('FASE 54 constrains the visual editor to the viewport instead of growing the application page', async () => {
  const theme = await readFile(themeUrl, 'utf8')

  assert.match(theme, /\.visual-editor-shell\s*\{[^}]*height:\s*calc\(100dvh - 7rem\)/s)
  assert.match(theme, /\.visual-editor-shell\s*\{[^}]*max-height:\s*calc\(100dvh - 7rem\)/s)
  assert.match(theme, /\.visual-editor-shell\s*>\s*\.visual-editor-grid\s*\{[^}]*overflow:\s*hidden/s)
  assert.match(theme, /overscroll-behavior:\s*none/)
  assert.doesNotMatch(theme, /body\s*\{[^}]*overflow-y:\s*hidden/s)
})

test('FASE 54 gives Blocks Canvas and Properties independent scroll ownership', async () => {
  const theme = await readFile(themeUrl, 'utf8')
  const editor = await readFile(editorUrl, 'utf8')
  const library = await readFile(libraryUrl, 'utf8')
  const properties = await readFile(propertyPanelUrl, 'utf8')

  assert.match(editor, /class="visual-editor-side hidden xl:flex"/)
  assert.match(editor, /class="visual-editor-canvas-wrap"/)
  assert.match(editor, /DhPropertyPanel[^>]*class="h-full"/s)

  assert.match(library, /overflow-y-auto overscroll-contain/)
  assert.match(properties, /overflow-y-auto overscroll-contain/)
  assert.match(theme, /\.visual-editor-shell \.visual-editor-canvas-wrap\s*\{[^}]*overflow-y:\s*auto !important/s)
  assert.match(theme, /\.visual-editor-shell \.visual-editor-grid > aside:last-child\s*\{[^}]*overflow:\s*hidden/s)
})

test('FASE 54 removes the accidental nested Canvas vertical scroller', async () => {
  const theme = await readFile(themeUrl, 'utf8')

  assert.match(theme, /\.visual-editor-shell \.visual-editor-canvas-wrap\s*\{[^}]*overflow-x:\s*hidden !important/s)
  assert.match(theme, /\.visual-editor-shell \.visual-editor-canvas\s*\{[^}]*overflow:\s*visible !important/s)
  assert.match(theme, /The Canvas wrapper is the only vertical scroller in the center zone/)
  assert.match(theme, /scrollbar-gutter:\s*stable/)
})

test('FASE 54 keeps editor modal and drawer surfaces scrollable on constrained viewports', async () => {
  const modal = await readFile(modalUrl, 'utf8')
  const drawer = await readFile(drawerUrl, 'utf8')

  assert.match(modal, /min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto/)
  assert.match(drawer, /min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto/)
  assert.match(modal, /max-h-\[90dvh\]/)
  assert.match(drawer, /h-\[calc\(100dvh-0\.5rem\)\]/)
})

test('FASE 54 stays scoped to the visual editor and does not perform the FASE 55 global Marketing audit', async () => {
  const theme = await readFile(themeUrl, 'utf8')

  assert.match(theme, /FASE 54/)
  assert.doesNotMatch(theme, /FASE 55/)
})
