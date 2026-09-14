<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Blocks, Copy, Eye, EyeOff, PanelRight, PanelsTopLeft, Trash2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhIconButton, DhSelect, DhSkeleton } from '@/shared/components/atoms'
import { DhBlockDropZone, DhConfirmDialog } from '@/shared/components/molecules'
import { DhDrawer, DhModal, DhPropertyPanel, DhSortable, type DhSortableItem } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { ContentRouteService } from '@/core/services/contentRouteService'
import { PageBuilderService } from '@/core/services/pageBuilderService'
import { useLocale } from '@/core/stores/locale'
import { useToastStore } from '@/core/stores/toastStore'
import type { ContentItemDto, ContentItemListDto } from '@/core/interfaces/content'
import type { PageBuilderBlock, PageBuilderOperationRequest } from '@/core/interfaces/pageBuilder'
import MarketingBlockLibrary from '@/modules/marketing/components/MarketingBlockLibrary.vue'
import { localizeMarketingBlock } from '@/modules/marketing/config/marketingBlockCatalog'
import {
  MARKETING_BLOCK_DRAG_MIME,
  createMarketingBlockData,
  getMarketingBlockDefinition,
  getMarketingBlockDefinitionForBuilderBlock,
  getMarketingBuilderType,
  parsePageBuilderBlocks,
} from '@/modules/marketing/config/marketingPageBuilder'

const props = withDefaults(defineProps<{ siteKey?: string }>(), { siteKey: 'main' })
const emit = defineEmits<{ close: [] }>()

const localeStore = useLocale()
const toastStore = useToastStore()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loadingPages = ref(false)
const loadingPage = ref(false)
const builderBusy = ref(false)
const libraryDragActive = ref(false)
const pages = ref<ContentItemListDto[]>([])
const selectedPageId = ref<string | null>(null)
const page = ref<ContentItemDto | null>(null)
const publicPath = ref<string | null>(null)
const builderBlocks = ref<PageBuilderBlock[]>([])
const selectedLibraryBlockId = ref<string | null>(null)
const selectedBuilderBlockId = ref<string | null>(null)
const deleteCandidate = ref<PageBuilderBlock | null>(null)
const propertySection = ref('content')
const blocksDrawerOpen = ref(false)
const propertiesDrawerOpen = ref(false)

const pageOptions = computed(() => pages.value.map((item) => ({ label: item.title, value: item.id })))
const propertySections = computed(() => [
  { key: 'content', label: tr('Contenido', 'Content') },
  { key: 'design', label: tr('Diseño', 'Design') },
  { key: 'animation', label: tr('Animación', 'Animation') },
  { key: 'spacing', label: tr('Espaciado', 'Spacing') },
])

const statusLabel = computed(() => {
  const status = page.value?.status
  if (status === 'Published') return tr('Publicado', 'Published')
  if (status === 'PendingReview') return tr('Pendiente', 'Pending')
  if (status === 'Scheduled') return tr('Programado', 'Scheduled')
  if (status === 'Archived') return tr('Archivado', 'Archived')
  return tr('Borrador', 'Draft')
})

const statusVariant = computed<'primary' | 'success' | 'warning' | 'neutral'>(() => {
  const status = page.value?.status
  if (status === 'Published') return 'success'
  if (status === 'PendingReview' || status === 'Scheduled') return 'warning'
  if (status === 'Archived') return 'neutral'
  return 'primary'
})

const visualHtml = computed(() => {
  const body = page.value?.renderedHtml?.trim()
    ? page.value.renderedHtml
    : `<main style="padding:64px 32px;text-align:center"><h1 style="font-size:32px;margin:0 0 12px">${escapeHtml(page.value?.title || tr('Página sin seleccionar', 'No page selected'))}</h1><p style="color:#64748b;margin:0">${escapeHtml(tr('Esta página todavía no tiene contenido visual.', 'This page does not have visual content yet.'))}</p></main>`

  return `<!doctype html><html lang="${localeStore.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fff;color:#111827}img,video{max-width:100%;height:auto}*{box-sizing:border-box}</style></head><body>${body}</body></html>`
})

const sortableBlocks = computed<DhSortableItem[]>(() => builderBlocks.value.map((block) => {
  const definition = getMarketingBlockDefinitionForBuilderBlock(block)
  return {
    id: block.id,
    block,
    disabled: builderBusy.value,
    title: definition ? localizeMarketingBlock(definition.title, localeStore.locale) : tr('Sección', 'Section'),
    description: definition
      ? localizeMarketingBlock(definition.description, localeStore.locale)
      : tr('Sección de contenido de la página.', 'Page content section.'),
  }
}))

const selectedBuilderBlock = computed(() =>
  builderBlocks.value.find((block) => block.id === selectedBuilderBlockId.value) ?? null,
)
const selectedLibraryBlock = computed(() => getMarketingBlockDefinition(selectedLibraryBlockId.value))
const selectedDefinition = computed(() => selectedBuilderBlock.value
  ? getMarketingBlockDefinitionForBuilderBlock(selectedBuilderBlock.value)
  : selectedLibraryBlock.value)

const propertyTitle = computed(() => selectedDefinition.value
  ? localizeMarketingBlock(selectedDefinition.value.title, localeStore.locale)
  : tr('Sin sección seleccionada', 'No section selected'))
const propertyDescription = computed(() => {
  if (selectedBuilderBlock.value) {
    return tr(
      'La sección está seleccionada. Sus opciones de contenido y diseño se mostrarán aquí en las siguientes fases.',
      'The section is selected. Its content and design options will appear here in the next phases.',
    )
  }
  if (selectedLibraryBlock.value) {
    return tr(
      'Arrastre este bloque hacia la página para agregarlo.',
      'Drag this block into the page to add it.',
    )
  }
  return tr(
    'Seleccione una sección de la página o un bloque del panel izquierdo.',
    'Select a page section or a block from the left panel.',
  )
})

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function sortableBlock(item: DhSortableItem) {
  return item.block as PageBuilderBlock
}

function sortableText(item: DhSortableItem, key: 'title' | 'description') {
  return typeof item[key] === 'string' ? item[key] : ''
}

async function loadPages() {
  loadingPages.value = true
  try {
    const response = await ContentService.browseEditor({
      pageNumber: 1,
      pageSize: 200,
      siteKey: props.siteKey,
      type: 'Page',
    })
    pages.value = response.items
    if (!selectedPageId.value && response.items.length) selectedPageId.value = response.items[0]!.id
  } catch (error) {
    toastStore.backendError(error, tr('No se pudieron cargar las páginas.', 'Pages could not be loaded.'))
  } finally {
    loadingPages.value = false
  }
}

async function loadSelectedPage(id: string | null) {
  selectedBuilderBlockId.value = null
  selectedLibraryBlockId.value = null
  deleteCandidate.value = null
  libraryDragActive.value = false

  if (!id) {
    page.value = null
    publicPath.value = null
    builderBlocks.value = []
    return
  }

  loadingPage.value = true
  try {
    const [detail, routes, builder] = await Promise.all([
      ContentService.getEditorContent(id),
      ContentRouteService.getByContent(id).catch(() => []),
      PageBuilderService.get(id),
    ])
    page.value = detail
    builderBlocks.value = parsePageBuilderBlocks(builder.blocksJson)
    const primary = routes.find((route) => route.isPrimary) ?? routes.find((route) => route.isActive) ?? null
    publicPath.value = primary?.path ?? null
  } catch (error) {
    page.value = null
    publicPath.value = null
    builderBlocks.value = []
    toastStore.backendError(error, tr('No se pudo abrir la página.', 'The page could not be opened.'))
  } finally {
    loadingPage.value = false
  }
}

async function applyBuilderOperation(request: PageBuilderOperationRequest, successMessage: string) {
  const contentId = selectedPageId.value
  if (!contentId || builderBusy.value) return null

  builderBusy.value = true
  try {
    const document = await PageBuilderService.apply(contentId, request)
    const next = parsePageBuilderBlocks(document.blocksJson)
    builderBlocks.value = next
    toastStore.success(successMessage)
    return next
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo actualizar la página.', 'The page could not be updated.'))
    return null
  } finally {
    builderBusy.value = false
  }
}

function selectLibraryBlock(blockId: string) {
  selectedLibraryBlockId.value = blockId
  selectedBuilderBlockId.value = null
}

function selectPageBlock(block: PageBuilderBlock) {
  selectedBuilderBlockId.value = block.id
  selectedLibraryBlockId.value = null
}

function handleLibraryDragStart(_event: DragEvent, blockId: string) {
  selectLibraryBlock(blockId)
  libraryDragActive.value = true
}

function handleLibraryDragEnd() {
  libraryDragActive.value = false
}

async function dropLibraryBlockAt(event: DragEvent, targetIndex: number) {
  const blockId = event.dataTransfer?.getData(MARKETING_BLOCK_DRAG_MIME)
  libraryDragActive.value = false
  if (!blockId) return

  const blockType = getMarketingBuilderType(blockId)
  if (!blockType) return

  const next = await applyBuilderOperation({
    operation: 'add',
    blockType,
    targetIndex,
    isVisible: true,
    dataJson: createMarketingBlockData(blockId),
  }, tr('Sección agregada', 'Section added'))

  if (!next?.length) return
  const insertedIndex = Math.min(Math.max(targetIndex, 0), next.length - 1)
  selectedBuilderBlockId.value = next[insertedIndex]?.id ?? null
  selectedLibraryBlockId.value = null
  blocksDrawerOpen.value = false
}

async function handleReorder(_items: DhSortableItem[], from: number, to: number) {
  if (from === to) return
  const block = builderBlocks.value[from]
  if (!block) return

  const next = await applyBuilderOperation({
    operation: 'move',
    blockId: block.id,
    targetIndex: to,
  }, tr('Sección movida', 'Section moved'))

  if (next) selectedBuilderBlockId.value = block.id
}

async function duplicateBlock(block: PageBuilderBlock) {
  const sourceIndex = builderBlocks.value.findIndex((item) => item.id === block.id)
  const next = await applyBuilderOperation({
    operation: 'duplicate',
    blockId: block.id,
  }, tr('Sección duplicada', 'Section duplicated'))

  if (next) selectedBuilderBlockId.value = next[sourceIndex + 1]?.id ?? block.id
}

async function toggleVisibility(block: PageBuilderBlock) {
  const next = await applyBuilderOperation({
    operation: block.isVisible ? 'hide' : 'show',
    blockId: block.id,
  }, block.isVisible ? tr('Sección oculta', 'Section hidden') : tr('Sección visible', 'Section visible'))

  if (next) selectedBuilderBlockId.value = block.id
}

function requestDelete(block: PageBuilderBlock) {
  deleteCandidate.value = block
  selectPageBlock(block)
}

async function confirmDeleteBlock() {
  const block = deleteCandidate.value
  if (!block) return

  const next = await applyBuilderOperation({
    operation: 'delete',
    blockId: block.id,
  }, tr('Sección eliminada', 'Section deleted'))

  if (!next) return
  if (selectedBuilderBlockId.value === block.id) selectedBuilderBlockId.value = null
  deleteCandidate.value = null
}

function openPreview() {
  if (!publicPath.value) return
  const url = new URL(publicPath.value, window.location.origin).toString()
  window.open(url, '_blank', 'noopener,noreferrer')
}

watch(selectedPageId, (id) => void loadSelectedPage(id))
onMounted(() => void loadPages())
</script>

<template>
  <section class="visual-editor-shell">
    <header class="visual-editor-toolbar">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <DhButton :label="tr('Páginas', 'Pages')" :icon="ArrowLeft" variant="ghost" size="sm" @click="emit('close')" />
        <span class="hidden h-7 w-px bg-[var(--dh-border)] sm:block" />
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <DhSelect
            v-if="!loadingPages && pageOptions.length"
            :model-value="selectedPageId"
            :options="pageOptions"
            placeholder=""
            @update:model-value="selectedPageId = String($event)"
          />
          <DhSkeleton v-else height="2.75rem" rounded="md" />
        </div>
        <DhBadge v-if="page" class="hidden sm:inline-flex" :label="statusLabel" :variant="statusVariant" />
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <DhButton class="xl:hidden" :label="tr('Bloques', 'Blocks')" :icon="Blocks" variant="secondary" size="sm" @click="blocksDrawerOpen = true" />
        <DhButton class="xl:hidden" :label="tr('Propiedades', 'Properties')" :icon="PanelRight" variant="secondary" size="sm" @click="propertiesDrawerOpen = true" />
        <DhButton :label="tr('Vista previa', 'Preview')" :icon="Eye" variant="secondary" size="sm" :disabled="!publicPath" @click="openPreview" />
      </div>
    </header>

    <div class="visual-editor-grid">
      <aside class="visual-editor-side hidden xl:flex">
        <div class="visual-editor-side-header">
          <Blocks class="h-4 w-4" />
          <span>{{ tr('Bloques', 'Blocks') }}</span>
        </div>
        <MarketingBlockLibrary
          :selected-id="selectedLibraryBlockId"
          @select="selectLibraryBlock"
          @dragstart="handleLibraryDragStart"
          @dragend="handleLibraryDragEnd"
        />
      </aside>

      <main class="visual-editor-canvas-wrap">
        <div class="mb-3 flex min-w-0 items-center justify-between gap-3 px-1">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">{{ tr('Página visual', 'Visual page') }}</p>
            <h1 class="truncate text-lg font-black text-[var(--dh-text)]">{{ page?.title || tr('Seleccione una página', 'Select a page') }}</h1>
          </div>
          <DhBadge v-if="page" class="sm:hidden" :label="statusLabel" :variant="statusVariant" />
        </div>

        <div class="visual-editor-canvas">
          <template v-if="loadingPage">
            <div class="space-y-4 p-6">
              <DhSkeleton height="4rem" rounded="lg" />
              <DhSkeleton height="12rem" rounded="lg" />
              <DhSkeleton height="8rem" rounded="lg" />
            </div>
          </template>

          <template v-else-if="page">
            <section class="visual-editor-structure">
              <div class="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-black text-[var(--dh-text)]">{{ tr('Secciones de la página', 'Page sections') }}</p>
                  <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">
                    {{ tr('Arrastre un bloque y elija visualmente dónde insertarlo.', 'Drag a block and choose visually where to insert it.') }}
                  </p>
                </div>
                <DhBadge :label="String(builderBlocks.length)" variant="neutral" />
              </div>

              <DhBlockDropZone
                :visible="libraryDragActive"
                :disabled="builderBusy"
                :accept-mime-type="MARKETING_BLOCK_DRAG_MIME"
                :label="tr('Soltar sección aquí', 'Drop section here')"
                @drop="dropLibraryBlockAt($event, 0)"
              />

              <DhSortable
                v-if="sortableBlocks.length"
                :model-value="sortableBlocks"
                :item-label="(item) => sortableText(item, 'title')"
                @reorder="handleReorder"
              >
                <template #item="{ item }">
                  <div class="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      class="min-w-0 flex-1 rounded-xl p-1 text-left outline-none transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      @click="selectPageBlock(sortableBlock(item))"
                    >
                      <span class="flex items-center gap-2">
                        <span class="truncate text-sm font-black text-[var(--dh-text)]">{{ sortableText(item, 'title') }}</span>
                        <DhBadge
                          v-if="!sortableBlock(item).isVisible"
                          :label="tr('Oculta', 'Hidden')"
                          variant="neutral"
                        />
                      </span>
                      <span class="mt-1 line-clamp-1 block text-xs text-[var(--dh-text-muted)]">{{ sortableText(item, 'description') }}</span>
                    </button>

                    <div class="flex shrink-0 items-center gap-1">
                      <DhIconButton
                        :icon="Copy"
                        :label="tr('Duplicar sección', 'Duplicate section')"
                        size="sm"
                        :disabled="builderBusy"
                        @click.stop="duplicateBlock(sortableBlock(item))"
                      />
                      <DhIconButton
                        :icon="sortableBlock(item).isVisible ? EyeOff : Eye"
                        :label="sortableBlock(item).isVisible ? tr('Ocultar sección', 'Hide section') : tr('Mostrar sección', 'Show section')"
                        size="sm"
                        :disabled="builderBusy"
                        @click.stop="toggleVisibility(sortableBlock(item))"
                      />
                      <DhIconButton
                        :icon="Trash2"
                        :label="tr('Eliminar sección', 'Delete section')"
                        variant="danger"
                        size="sm"
                        :disabled="builderBusy"
                        @click.stop="requestDelete(sortableBlock(item))"
                      />
                    </div>
                  </div>
                </template>

                <template #after="{ index }">
                  <DhBlockDropZone
                    :visible="libraryDragActive"
                    :disabled="builderBusy"
                    :accept-mime-type="MARKETING_BLOCK_DRAG_MIME"
                    :label="tr('Soltar sección aquí', 'Drop section here')"
                    @drop="dropLibraryBlockAt($event, index + 1)"
                  />
                </template>
              </DhSortable>

              <DhEmptyState
                v-else-if="!libraryDragActive"
                :icon="PanelsTopLeft"
                :title="tr('La página todavía no tiene secciones', 'The page has no sections yet')"
                :description="tr('Arrastre un bloque desde el panel izquierdo para comenzar.', 'Drag a block from the left panel to get started.')"
              />
            </section>

            <section class="visual-editor-preview">
              <div class="border-b border-[var(--dh-border)] px-4 py-3">
                <p class="text-xs font-black text-[var(--dh-text)]">{{ tr('Vista actual', 'Current view') }}</p>
              </div>
              <iframe
                :title="tr('Vista visual de la página', 'Visual page preview')"
                :srcdoc="visualHtml"
                sandbox=""
                class="h-[440px] w-full border-0 bg-white"
              />
            </section>
          </template>

          <DhEmptyState
            v-else
            class="m-auto"
            :icon="PanelsTopLeft"
            :title="tr('No hay una página seleccionada', 'No page selected')"
            :description="tr('Elija una página arriba para abrirla en el editor visual.', 'Choose a page above to open it in the visual editor.')"
          />
        </div>
      </main>

      <aside class="hidden min-h-0 xl:block">
        <DhPropertyPanel
          v-model="propertySection"
          :sections="propertySections"
          :title="tr('Propiedades', 'Properties')"
          :description="tr('Configuración de la sección seleccionada.', 'Settings for the selected section.')"
          class="h-full"
        >
          <DhEmptyState :icon="PanelRight" :title="propertyTitle" :description="propertyDescription" />
        </DhPropertyPanel>
      </aside>
    </div>

    <DhDrawer :open="blocksDrawerOpen" :title="tr('Bloques', 'Blocks')" size="sm" @close="blocksDrawerOpen = false">
      <MarketingBlockLibrary
        :selected-id="selectedLibraryBlockId"
        @select="selectLibraryBlock"
        @dragstart="handleLibraryDragStart"
        @dragend="handleLibraryDragEnd"
      />
    </DhDrawer>

    <DhDrawer :open="propertiesDrawerOpen" :title="tr('Propiedades', 'Properties')" size="md" @close="propertiesDrawerOpen = false">
      <DhPropertyPanel
        v-model="propertySection"
        :sections="propertySections"
        :description="tr('Configuración de la sección seleccionada.', 'Settings for the selected section.')"
      >
        <DhEmptyState :icon="PanelRight" :title="propertyTitle" :description="propertyDescription" />
      </DhPropertyPanel>
    </DhDrawer>

    <DhModal
      :open="Boolean(deleteCandidate)"
      :title="tr('Confirmar eliminación', 'Confirm deletion')"
      size="sm"
      @close="deleteCandidate = null"
    >
      <DhConfirmDialog
        :title="tr('¿Eliminar esta sección?', 'Delete this section?')"
        :message="tr('La sección se quitará de la página. Esta acción quedará registrada en el historial del contenido.', 'The section will be removed from the page. This action will remain recorded in the content history.')"
        :confirm-label="tr('Eliminar', 'Delete')"
        :cancel-label="tr('Cancelar', 'Cancel')"
        :danger="true"
        :on-confirm="confirmDeleteBlock"
        :on-cancel="() => { deleteCandidate = null }"
      />
    </DhModal>
  </section>
</template>

<style scoped>
.visual-editor-shell{display:flex;min-height:calc(100dvh - 7rem);min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--dh-border);border-radius:30px;background:var(--dh-surface);box-shadow:var(--dh-shadow-sm)}
.visual-editor-toolbar{display:flex;min-width:0;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;border-bottom:1px solid var(--dh-border);padding:.75rem;background:var(--dh-input)}
.visual-editor-grid{display:grid;min-height:0;min-width:0;flex:1;grid-template-columns:minmax(0,1fr)}
.visual-editor-side{min-height:0;min-width:0;flex-direction:column;border-right:1px solid var(--dh-border);background:var(--dh-input)}
.visual-editor-side-header{display:flex;align-items:center;gap:.5rem;border-bottom:1px solid var(--dh-border);padding:1rem;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.13em;color:var(--dh-text-muted)}
.visual-editor-canvas-wrap{min-height:0;min-width:0;overflow:auto;background:color-mix(in srgb,var(--dh-bg) 86%,var(--dh-surface));padding:1rem}
.visual-editor-canvas{display:flex;min-height:680px;min-width:0;flex-direction:column;gap:1rem;overflow:auto;border:1px solid var(--dh-border);border-radius:24px;background:var(--dh-input);padding:1rem;box-shadow:var(--dh-shadow-lg)}
.visual-editor-structure,.visual-editor-preview{min-width:0;border:1px solid var(--dh-border);border-radius:20px;background:var(--dh-surface);box-shadow:var(--dh-shadow-sm)}
.visual-editor-structure{padding:1rem}
.visual-editor-preview{overflow:hidden}
@media (min-width:1280px){.visual-editor-grid{grid-template-columns:280px minmax(0,1fr) 300px}.visual-editor-canvas-wrap{padding:1.25rem}.visual-editor-grid>aside:last-child{border-left:1px solid var(--dh-border);background:var(--dh-input);padding:.75rem}}
@media (max-width:640px){.visual-editor-shell{min-height:calc(100dvh - 5rem);border-radius:22px}.visual-editor-toolbar{align-items:stretch}.visual-editor-toolbar>div:first-child{width:100%}.visual-editor-canvas-wrap{padding:.65rem}.visual-editor-canvas{min-height:560px;border-radius:18px;padding:.65rem}.visual-editor-structure{padding:.75rem}}
</style>
