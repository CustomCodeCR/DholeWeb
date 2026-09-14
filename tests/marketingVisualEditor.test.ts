import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { MARKETING_BLOCK_GROUPS, localizeMarketingBlock } from '../src/modules/marketing/config/marketingBlockCatalog.ts'

test('FASE 36 creates the main visual editor shell with the requested three-area layout', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  for (const expected of ['Bloques', 'Página visual', 'Propiedades', 'Contenido', 'Diseño', 'Animación', 'Espaciado', 'Vista previa']) {
    assert.ok(source.includes(expected), `Missing FASE 36 editor label: ${expected}`)
  }
  assert.match(source, /grid-template-columns:280px minmax\(0,1fr\) 300px/)
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

test('FASE 36 does not advance drag and drop or drop zones', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const library = await readFile(new URL('../src/modules/marketing/components/MarketingBlockLibrary.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /DhSortable/)
  assert.doesNotMatch(source, /@drop/)
  assert.doesNotMatch(source, /Soltar sección aquí/)
  assert.doesNotMatch(library, /draggable\s*=|:draggable|dragstart/)
})

test('FASE 37 exposes every requested block grouped by human category', () => {
  assert.deepEqual(MARKETING_BLOCK_GROUPS.map((group) => localizeMarketingBlock(group.title, 'es')), [
    'Básicos',
    'Diseño',
    'Empresa',
    'Marketing',
    'Contenido',
  ])

  const blocks = MARKETING_BLOCK_GROUPS.flatMap((group) => group.blocks)
  assert.equal(blocks.length, 25)

  const spanish = blocks.map((block) => localizeMarketingBlock(block.title, 'es'))
  for (const expected of [
    'Título', 'Texto', 'Imagen', 'Video', 'Botón', 'Separador',
    'Hero', 'Columnas', 'Imagen + Texto', 'Galería', 'Slider', 'Tabs',
    'Servicios', 'Equipo', 'Clientes', 'Estadísticas', 'Testimonios',
    'CTA', 'Banner', 'Formulario', 'Reunión', 'Campaña',
    'Noticias', 'FAQ', 'Posts relacionados',
  ]) {
    assert.ok(spanish.includes(expected), `Missing FASE 37 block: ${expected}`)
  }
})

test('FASE 37 block catalog uses Dhole cards and never exposes technical Cms names', async () => {
  const library = await readFile(new URL('../src/modules/marketing/components/MarketingBlockLibrary.vue', import.meta.url), 'utf8')
  const catalog = await readFile(new URL('../src/modules/marketing/config/marketingBlockCatalog.ts', import.meta.url), 'utf8')
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  assert.match(library, /DhBlockCard/)
  assert.match(library, /DhSearchInput/)
  assert.match(editor, /MarketingBlockLibrary/)
  assert.doesNotMatch(catalog, /Cms[A-Z]/)
  assert.doesNotMatch(library, /Cms[A-Z]/)
})
