import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { MARKETING_BLOCK_GROUPS, localizeMarketingBlock } from '../src/modules/marketing/config/marketingBlockCatalog.ts'

test('FASE 36 creates the main visual editor shell with the requested three-area layout', async () => {
  const source = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  for (const expected of ['Bloques', 'Página visual', 'Propiedades', 'Contenido', 'Diseño', 'Animación', 'Vista previa']) assert.ok(source.includes(expected), `Missing FASE 36 editor label: ${expected}`)
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

test('FASE 37 exposes every requested block grouped by human category', () => {
  assert.deepEqual(MARKETING_BLOCK_GROUPS.map((group) => localizeMarketingBlock(group.title, 'es')), ['Básicos', 'Diseño', 'Empresa', 'Marketing', 'Contenido'])
  const blocks = MARKETING_BLOCK_GROUPS.flatMap((group) => group.blocks)
  assert.equal(blocks.length, 25)
  const spanish = blocks.map((block) => localizeMarketingBlock(block.title, 'es'))
  for (const expected of ['Título', 'Texto', 'Imagen', 'Video', 'Botón', 'Separador', 'Hero', 'Columnas', 'Imagen + Texto', 'Galería', 'Slider', 'Tabs', 'Servicios', 'Equipo', 'Clientes', 'Estadísticas', 'Testimonios', 'CTA', 'Banner', 'Formulario', 'Reunión', 'Campaña', 'Noticias', 'FAQ', 'Posts relacionados']) assert.ok(spanish.includes(expected), `Missing FASE 37 block: ${expected}`)
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

test('FASE 38 enables block selection and drag from the library into the page', async () => {
  const library = await readFile(new URL('../src/modules/marketing/components/MarketingBlockLibrary.vue', import.meta.url), 'utf8')
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  assert.match(library, /:draggable="true"/)
  assert.match(library, /MARKETING_BLOCK_DRAG_MIME/)
  assert.match(library, /@dragstart="startBlockDrag"/)
  assert.match(editor, /dropLibraryBlockAt/)
  assert.match(editor, /operation: 'add'/)
  assert.match(editor, /PageBuilderService\.apply/)
})

test('FASE 38 supports moving, duplicating, deleting and toggling section visibility', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  assert.match(editor, /DhSortable/)
  for (const operation of ['move', 'duplicate', 'delete', 'hide', 'show']) assert.ok(editor.includes(`'${operation}'`), `Missing FASE 38 operation: ${operation}`)
  assert.match(editor, /DhConfirmDialog/)
  assert.doesNotMatch(editor, /\bwindow\.(alert|confirm|prompt)\b/)
  assert.doesNotMatch(editor, /v-model[^\n]*blocksJson/)
})

test('FASE 38 maps all 25 human blocks to Page Builder types without exposing JSON editing', async () => {
  const catalog = await readFile(new URL('../src/modules/marketing/config/marketingBlockCatalog.ts', import.meta.url), 'utf8')
  const mapping = await readFile(new URL('../src/modules/marketing/config/marketingPageBuilder.ts', import.meta.url), 'utf8')
  const ids = MARKETING_BLOCK_GROUPS.flatMap((group) => group.blocks.map((block) => block.id))
  for (const id of ids) assert.match(mapping, new RegExp(`(?:'${id}'|${id}):\\s*'`), `Missing Page Builder mapping for ${id}`)
  assert.doesNotMatch(catalog, /ServicesGrid|MeetingForm|NewsGrid/)
  assert.doesNotMatch(mapping, /textarea|contenteditable/i)
})

test('FASE 39 shows Dhole visual drop zones only while a library block is being dragged', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const library = await readFile(new URL('../src/modules/marketing/components/MarketingBlockLibrary.vue', import.meta.url), 'utf8')
  const dropZone = await readFile(new URL('../src/shared/components/molecules/DhBlockDropZone.vue', import.meta.url), 'utf8')
  assert.match(editor, /DhBlockDropZone/)
  assert.match(editor, /libraryDragActive/)
  assert.match(editor, /Soltar sección aquí/)
  assert.match(library, /@dragend="endBlockDrag"/)
  assert.match(dropZone, /dh-block-drop-zone/)
  assert.match(dropZone, /border-2 border-dashed/)
  assert.doesNotMatch(editor, /class="[^"]*drop-zone/)
})

test('FASE 39 inserts at the exact visible drop position, including before and between sections', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const sortable = await readFile(new URL('../src/shared/components/organisms/DhSortable.vue', import.meta.url), 'utf8')
  assert.match(editor, /dropLibraryBlockAt\(\$event, 0\)/)
  assert.match(editor, /dropLibraryBlockAt\(\$event, index \+ 1\)/)
  assert.match(editor, /targetIndex,/)
  assert.match(sortable, /slot name="after"/)
  assert.match(sortable, /draggingIndex\.value === null/)
})

test('FASE 39 uses the Dhole Design System and does not introduce a visual drag library', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const packageJson = await readFile(new URL('../package.json', import.meta.url), 'utf8')
  const molecules = await readFile(new URL('../src/shared/components/molecules/index.ts', import.meta.url), 'utf8')
  assert.match(molecules, /DhBlockDropZone/)
  assert.match(editor, /MARKETING_BLOCK_DRAG_MIME/)
  assert.doesNotMatch(packageJson, /sortablejs|dnd-kit|vue-draggable|interactjs/i)
})

test('FASE 40 adds the Add section action and opens the DhBlockPicker flow', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPicker.vue', import.meta.url), 'utf8')
  assert.match(editor, /Agregar sección/)
  assert.match(editor, /blockPickerOpen/)
  assert.match(editor, /MarketingBlockPicker/)
  assert.match(picker, /DhBlockPicker/)
  assert.match(picker, /Buscar sección\.\.\./)
})

test('FASE 40 visually exposes all 25 human blocks with icons and search metadata', async () => {
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPicker.vue', import.meta.url), 'utf8')
  assert.match(picker, /MARKETING_BLOCK_GROUPS\.flatMap/)
  assert.match(picker, /iconMap\[block\.icon\]/)
  assert.match(picker, /description:/)
  assert.equal(MARKETING_BLOCK_GROUPS.flatMap((group) => group.blocks).length, 25)
  assert.doesNotMatch(picker, /ServicesGrid|MeetingForm|NewsGrid|Cms[A-Z]/)
})

test('FASE 40 inserts the selected picker block through Page Builder', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  assert.match(editor, /addBlockFromPicker/)
  assert.match(editor, /insertLibraryBlockAt\(blockId, targetIndex\)/)
  assert.match(editor, /const targetIndex = builderBlocks\.value\.length/)
})

test('FASE 41 edits recognized text directly inside the visual structure', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const inline = await readFile(new URL('../src/modules/marketing/components/MarketingInlineEditableText.vue', import.meta.url), 'utf8')
  assert.match(editor, /MarketingInlineEditableText/)
  assert.match(editor, /inlineTextField/)
  assert.match(editor, /Haga clic sobre el texto para editarlo directamente/)
  assert.match(inline, /contenteditable="true"/)
  assert.match(inline, /@keydown="handleKeydown"/)
  assert.match(inline, /@blur="commit"/)
})

test('FASE 41 persists inline changes with the official Page Builder edit operation', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  assert.match(editor, /saveInlineText/)
  assert.match(editor, /operation: 'edit'/)
  assert.match(editor, /dataJson: JSON\.stringify\(nextData\)/)
  assert.match(editor, /Contenido actualizado/)
  assert.doesNotMatch(editor, /\bwindow\.(alert|confirm|prompt)\b/)
})

test('FASE 41 keeps media-only blocks free of forced inline text fields', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  for (const id of ['image', 'video', 'divider', 'gallery', 'slider']) assert.ok(editor.includes(`'${id}'`))
  assert.match(editor, /Este bloque no tiene texto editable directamente/)
  assert.doesNotMatch(editor, /DhColorPicker|DhMediaPicker|DhIconPicker/)
})

test('FASE 42 creates the selected-block properties panel with the four requested tabs', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')

  for (const expected of ['Contenido', 'Diseño', 'Animación', 'Avanzado']) assert.ok(editor.includes(expected), `Missing FASE 42 property tab: ${expected}`)
  assert.match(editor, /MarketingBlockPropertiesContent/)
  assert.match(editor, /:block="selectedBuilderBlock"/)
  assert.match(editor, /selectPageBlock/)
  assert.match(properties, /activeSection === 'content'/)
  assert.match(properties, /activeSection === 'design'/)
  assert.match(properties, /activeSection === 'animation'/)
  assert.match(properties, /activeSection === 'advanced'/)
})

test('FASE 42 keeps property actions human and useful without technical configuration', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')

  assert.match(properties, /DhInput/)
  assert.match(properties, /DhTextarea/)
  assert.match(properties, /Guardar contenido/)
  assert.match(properties, /DhSwitch/)
  assert.match(properties, /Mostrar sección/)
  assert.match(properties, /Duplicar sección/)
  assert.match(properties, /Eliminar sección/)
  assert.doesNotMatch(properties, />\s*(CSS|HTML|JS|JSON)\s*</i)
})

test('FASE 42 opens responsive properties when selecting a section', async () => {
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  assert.match(editor, /propertiesDrawerOpen\.value = true/)
  assert.match(editor, /matchMedia\('\(max-width: 1279px\)'\)/)
})

test('FASE 43 replaces technical design configuration with alignment, spacing and background choices', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')

  for (const label of ['Alineación', 'Izquierda', 'Centro', 'Derecha', 'Espaciado', 'Pequeño', 'Normal', 'Grande', 'Muy grande', 'Fondo', 'Blanco', 'Claro', 'Corporativo', 'Oscuro', 'Imagen', 'Gradiente']) {
    assert.ok(properties.includes(label), `Missing FASE 43 design option: ${label}`)
  }
  assert.match(properties, /alignmentOptions/)
  assert.match(properties, /spacingOptions/)
  assert.match(properties, /backgroundOptions/)
  assert.match(properties, /DhButton/)
})

test('FASE 43 persists simple design choices through the existing Page Builder edit flow', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  for (const key of ['editorDesignAlignment', 'editorDesignSpacing', 'editorDesignBackground']) assert.ok(properties.includes(key), `Missing FASE 43 persisted preference: ${key}`)
  assert.match(properties, /saveDesignPreference/)
  assert.match(properties, /emit\('save-text'/)
  assert.match(editor, /saveBlockTextProperty/)
  assert.match(editor, /operation: 'edit'/)
})

test('FASE 43 keeps technical configuration out of the design UI', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')

  assert.doesNotMatch(properties, />\s*(CSS|HTML|JS|JSON)\s*</i)
  assert.doesNotMatch(properties, /DhMediaPicker|DhColorPicker/)
})

test('FASE 44 offers the five requested visual Hero layouts without manual column configuration', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingLayoutPresetPicker.vue', import.meta.url), 'utf8')

  assert.match(properties, /MarketingLayoutPresetPicker/)
  assert.match(properties, /isHeroLayoutBlock/)
  assert.match(properties, /No necesita configurar columnas manualmente/)
  for (const label of ['Texto centrado', 'Texto | Imagen', 'Imagen | Texto', 'Video completo', 'Slider']) {
    assert.ok(picker.includes(label), `Missing FASE 44 Hero layout: ${label}`)
  }
  assert.match(picker, /DhBlockCard/)
  assert.match(picker, /modelValue === preset\.id/)
})

test('FASE 44 persists the clicked layout through Page Builder edit and does not advance FASE 45 block presets', async () => {
  const properties = await readFile(new URL('../src/modules/marketing/components/MarketingBlockPropertiesContent.vue', import.meta.url), 'utf8')
  const picker = await readFile(new URL('../src/modules/marketing/components/MarketingLayoutPresetPicker.vue', import.meta.url), 'utf8')
  const editor = await readFile(new URL('../src/modules/marketing/components/MarketingVisualEditor.vue', import.meta.url), 'utf8')

  assert.match(properties, /editorLayoutPreset/)
  assert.match(properties, /saveLayoutPreset/)
  assert.match(properties, /saveDesignPreference\('editorLayoutPreset'/)
  assert.match(editor, /saveBlockTextProperty/)
  assert.match(editor, /operation: 'edit'/)
  assert.doesNotMatch(picker, /3 Cards|4 Cards|Cards con imagen|Cards con iconos|Lista alternada/)
})
