import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('FASE 36 creates the main visual editor shell with the requested three-area layout', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  for (const expected of ['Bloques', 'Página visual', 'Propiedades', 'Contenido', 'Diseño', 'Animación', 'Espaciado', 'Vista previa']) {
    assert.ok(source.includes(expected), `Missing FASE 36 editor label: ${expected}`)
  }
  assert.match(source, /grid-template-columns:240px minmax\(0,1fr\) 300px/)
  assert.match(source, /DhPropertyPanel/)
  assert.match(source, /ContentService\.browseEditor/)
  assert.match(source, /ContentService\.getEditorContent/)
})

test('FASE 36 is reachable from Marketing and from the Pages workspace', async () => {
  const view = await readFile(new URL('../src/modules/marketing/views/MarketingView.vue', import.meta.url), 'utf8')

  assert.match(view, /MarketingVisualEditor/)
  assert.match(view, /Editor visual/)
  assert.match(view, /Abrir editor visual/)
  assert.match(view, /activeSection === 'content-pages'/)
})

test('FASE 36 does not advance block catalog, drag and drop or drop zones', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /DhBlockPicker/)
  assert.doesNotMatch(source, /DhSortable/)
  assert.doesNotMatch(source, /dragstart/)
  assert.doesNotMatch(source, /@drop/)
  assert.doesNotMatch(source, /Soltar sección aquí/)
})
