import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('FASE 55 keeps the main sidebar editor and properties independently scrollable', async () => {
  const [sidebar, marketingView, editor, properties, theme] = await Promise.all([
    source('src/shared/components/organisms/DhSidebar.vue'),
    source('src/modules/marketing/views/MarketingView.vue'),
    source('src/modules/marketing/components/MarketingVisualEditor.vue'),
    source('src/shared/components/organisms/DhPropertyPanel.vue'),
    source('src/assets/theme.css'),
  ])

  assert.match(sidebar, /dh-scrollbar min-h-0 flex-1[^\n]*overflow-y-auto overscroll-contain/)
  assert.match(marketingView, /xl:max-h-\[calc\(100dvh-11rem\)\][^\n]*xl:overflow-y-auto/)
  assert.match(editor, /class="visual-editor-side hidden xl:flex"/)
  assert.match(editor, /class="visual-editor-canvas-wrap"/)
  assert.match(properties, /dh-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain/)
  assert.match(theme, /\.visual-editor-shell\s*\{[^}]*height:\s*calc\(100dvh - 7rem\)/s)
  assert.match(theme, /\.visual-editor-shell \.visual-editor-canvas-wrap\s*\{[^}]*overflow-y:\s*auto !important/s)
  assert.match(theme, /\.visual-editor-shell \.visual-editor-canvas\s*\{[^}]*overflow:\s*visible !important/s)
  assert.doesNotMatch(theme, /body\s*\{[^}]*overflow-y:\s*hidden/s)
})

test('FASE 55 keeps modal drawer Block Picker and Media Picker reachable with long content', async () => {
  const [modal, drawer, blockPicker, mediaPicker] = await Promise.all([
    source('src/shared/components/organisms/DhModal.vue'),
    source('src/shared/components/organisms/DhDrawer.vue'),
    source('src/shared/components/organisms/DhBlockPicker.vue'),
    source('src/shared/components/organisms/DhMediaPicker.vue'),
  ])

  assert.match(modal, /max-h-\[90dvh\]/)
  assert.match(modal, /min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto/)
  assert.match(drawer, /h-\[calc\(100dvh-0\.5rem\)\]/)
  assert.match(drawer, /min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto/)

  assert.match(blockPicker, /max-h-\[min\(64dvh,36rem\)\]/)
  assert.match(blockPicker, /min-h-0[^\n]*overflow-hidden/)
  assert.match(blockPicker, /dh-scrollbar[^\n]*overflow-y-auto overscroll-contain/)

  assert.match(mediaPicker, /max-h-\[calc\(90dvh-8rem\)\]/)
  assert.match(mediaPicker, /dh-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain/)
  assert.equal((mediaPicker.match(/overflow-y-auto/g) ?? []).length, 1)
  assert.doesNotMatch(mediaPicker, /max-h-\[44vh\]/)
})

test('FASE 55 constrains long dropdowns and wide tables without blocking the page', async () => {
  const [dropdown, table] = await Promise.all([
    source('src/shared/components/molecules/DhDropdownMenu.vue'),
    source('src/shared/components/molecules/DhDataTable.vue'),
  ])

  assert.match(dropdown, /max-h-\[min\(70dvh,24rem\)\]/)
  assert.match(dropdown, /overflow-y-auto overscroll-contain/)
  assert.match(dropdown, /max-w-\[calc\(100vw-1rem\)\]/)
  assert.match(dropdown, /break-words/)

  assert.match(table, /overflow-x-auto overscroll-contain/)
  assert.match(table, /max-w-full/)
  assert.match(table, /break-words/)
})

test('FASE 55 verifies preview and media surfaces contain overflow instead of clipping content', async () => {
  const [devicePreview, mediaTab] = await Promise.all([
    source('src/shared/components/molecules/DhDevicePreview.vue'),
    source('src/modules/marketing/components/MarketingMediaTab.vue'),
  ])

  assert.match(devicePreview, /dh-scrollbar[^\n]*overflow-x-auto/)
  assert.match(devicePreview, /dh-scrollbar max-w-full overflow-auto/)
  assert.match(mediaTab, /class="media-gallery-card"/)
  assert.match(mediaTab, /block truncate text-sm/)
  assert.match(mediaTab, /truncate text-xs/)
})

test('FASE 55 verifies cards menus forms calendar and meetings remain readable with long content', async () => {
  const [view, resources, menus, workspace] = await Promise.all([
    source('src/modules/marketing/views/MarketingView.vue'),
    source('src/modules/marketing/components/MarketingResourceTab.vue'),
    source('src/modules/marketing/components/MarketingMenusTab.vue'),
    source('src/modules/marketing/components/MarketingContentWorkspace.vue'),
  ])

  for (const kind of ['forms', 'meeting-types', 'meeting-requests', 'meeting-agenda', 'content-calendar']) {
    assert.ok(view.includes(`kind: '${kind}'`), `Missing audited Marketing resource: ${kind}`)
  }

  assert.match(resources, /class="resource-card"/)
  assert.match(resources, /break-words/)
  assert.match(resources, /line-clamp-2/)
  assert.match(menus, /class="grid min-w-0 flex-1/)
  assert.match(menus, /class="field mt-1\.5 w-full"/)
  assert.match(workspace, /line-clamp-2/)
  assert.match(workspace, /DhDrawer/)
})

test('FASE 55 functional scroll audit remains compatible with the FASE 56 visual standard', async () => {
  const [theme, dropdown, blockPicker, mediaPicker, table] = await Promise.all([
    source('src/assets/theme.css'),
    source('src/shared/components/molecules/DhDropdownMenu.vue'),
    source('src/shared/components/organisms/DhBlockPicker.vue'),
    source('src/shared/components/organisms/DhMediaPicker.vue'),
    source('src/shared/components/molecules/DhDataTable.vue'),
  ])

  for (const audited of [dropdown, blockPicker, mediaPicker, table]) assert.match(audited, /dh-scrollbar/)
  assert.match(theme, /FASE 56 — One Dhole scrollbar contract/)
  assert.match(theme, /:where\(html, body, body \*, \.dh-scrollbar\)/)
})
