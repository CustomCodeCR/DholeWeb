<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Blocks, Check, Copy, Eye, EyeOff, LoaderCircle, PanelRight, PanelsTopLeft, Plus, Trash2, TriangleAlert } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhIconButton, DhSelect, DhSkeleton } from '@/shared/components/atoms'
import { DhBlockDropZone, DhConfirmDialog } from '@/shared/components/molecules'
import { DhDrawer, DhModal, DhPropertyPanel, DhSortable, type DhSortableItem } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { ContentRouteService } from '@/core/services/contentRouteService'
import { PageBuilderService } from '@/core/services/pageBuilderService'
import { useLocale } from '@/core/stores/locale'
import { useToastStore } from '@/core/stores/toastStore'
import type { ContentItemDto, ContentItemListDto } from '@/core/interfaces/content'
import type { CmsAnimationConfig, CmsMotionPreset, PageBuilderBlock, PageBuilderOperationRequest } from '@/core/interfaces/pageBuilder'
import MarketingBlockLibrary from '@/modules/marketing/components/MarketingBlockLibrary.vue'
import MarketingBlockPicker from '@/modules/marketing/components/MarketingBlockPicker.vue'
import MarketingBlockPropertiesContent from '@/modules/marketing/components/MarketingBlockPropertiesContent.vue'
import MarketingInlineEditableText from '@/modules/marketing/components/MarketingInlineEditableText.vue'
import MarketingLivePreview from '@/modules/marketing/components/MarketingLivePreview.vue'
import { localizeMarketingBlock } from '@/modules/marketing/config/marketingBlockCatalog'
import {
  MARKETING_BLOCK_DRAG_MIME,
  createMarketingBlockData,
  getMarketingBlockDefinition,
  getMarketingBlockDefinitionForBuilderBlock,
  getMarketingBuilderType,
  parsePageBuilderBlocks,
} from '@/modules/marketing/config/marketingPageBuilder'

interface InlineTextField {
  key: string
  value: string
  placeholder: string
}

interface AnimationSettingsPatch {
  distance?: number
  duration?: number
}

interface PendingTextAutosave {
  contentId: string
  blockId: string
  key: string
  value: string
}

interface ApplyBuilderOperationOptions {
  contentId?: string
  showSuccessToast?: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_DELAY_MS = 800
const AUTOSAVE_BUSY_RETRY_MS = 250

const props = withDefaults(defineProps<{ siteKey?: string }>(), { siteKey: 'main' })
const emit = defineEmits<{ close: [] }>()

const localeStore = useLocale()
const toastStore = useToastStore()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loadingPages = ref(false)
const loadingPage = ref(false)
const builderBusy = ref(false)
const saveFailed = ref(false)
const libraryDragActive = ref(false)
const pages = ref<ContentItemListDto[]>([])
const selectedPageId = ref<string | null>(null)
const page = ref<ContentItemDto | null>(null)
const publicPath = ref<string | null>(null)
const builderBlocks = ref<PageBuilderBlock[]>([])
const previewTextDrafts = ref<Record<string, Record<string, string>>>({})
const pendingTextAutosave = ref<PendingTextAutosave | null>(null)
const selectedLibraryBlockId = ref<string | null>(null)
const selectedBuilderBlockId = ref<string | null>(null)
const deleteCandidate = ref<PageBuilderBlock | null>(null)
const propertySection = ref('content')
const blocksDrawerOpen = ref(false)
const propertiesDrawerOpen = ref(false)
const blockPickerOpen = ref(false)
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const pageOptions = computed(() => pages.value.map((item) => ({ label: item.title, value: item.id })))
const propertySections = computed(() => [
  { key: 'content', label: tr('Contenido', 'Content') },
  { key: 'design', label: tr('Diseño', 'Design') },
  { key: 'animation', label: tr('Animación', 'Animation') },
  { key: 'advanced', label: tr('Avanzado', 'Advanced') },
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

const saveState = computed<SaveState>(() => {
  if (!page.value) return 'idle'
  if (saveFailed.value) return 'error'
  if (builderBusy.value || pendingTextAutosave.value) return 'saving'
  return 'saved'
})

const saveStateLabel = computed(() => {
  if (saveState.value === 'saving') return tr('Guardando...', 'Saving...')
  if (saveState.value === 'error') return tr('No guardado', 'Not saved')
  if (saveState.value === 'saved') return tr('Guardado', 'Saved')
  return ''
})

const livePreviewBlocks = computed(() => builderBlocks.value.map((block) => {
  const draft = previewTextDrafts.value[block.id]
  return draft
    ? { ...block, data: { ...block.data, ...draft } }
    : block
}))

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

const selectedBuilderBlock = computed(() => builderBlocks.value.find((block) => block.id === selectedBuilderBlockId.value) ?? null)
const selectedLibraryBlock = computed(() => getMarketingBlockDefinition(selectedLibraryBlockId.value))
const selectedDefinition = computed(() => selectedBuilderBlock.value
  ? getMarketingBlockDefinitionForBuilderBlock(selectedBuilderBlock.value)
  : selectedLibraryBlock.value)
const selectedTextField = computed(() => selectedBuilderBlock.value ? inlineTextField(selectedBuilderBlock.value) : null)
const propertyTitle = computed(() => selectedDefinition.value
  ? localizeMarketingBlock(selectedDefinition.value.title, localeStore.locale)
  : tr('Propiedades', 'Properties'))
const propertyDescription = computed(() => selectedBuilderBlock.value
  ? tr('Edite el contenido y las opciones comprensibles de esta sección.', 'Edit this section’s content and understandable options.')
  : tr('Seleccione una sección de la página para ver sus propiedades.', 'Select a page section to view its properties.'))

function sortableBlock(item: DhSortableItem) {
  return item.block as PageBuilderBlock
}

function sortableText(item: DhSortableItem, key: 'title' | 'description') {
  return typeof item[key] === 'string' ? item[key] : ''
}

function blockEditorKey(block: PageBuilderBlock) {
  return typeof block.data.editorBlockKey === 'string' ? block.data.editorBlockKey : null
}

function inlineTextField(block: PageBuilderBlock): InlineTextField | null {
  const editorKey = blockEditorKey(block)
  const candidates = editorKey === 'text'
    ? ['text', 'body', 'content']
    : editorKey === 'button'
      ? ['label', 'text', 'title']
      : editorKey === 'heading'
        ? ['title', 'heading', 'text']
        : ['title', 'headline', 'heading', 'name']

  for (const key of candidates) {
    const value = block.data[key]
    if (typeof value === 'string') return { key, value, placeholder: tr('Haga clic para editar', 'Click to edit') }
  }

  if (['image', 'video', 'divider', 'gallery', 'slider'].includes(editorKey ?? '')) return null
  const fallbackKey = editorKey === 'text' ? 'text' : editorKey === 'button' ? 'label' : 'title'
  return {
    key: fallbackKey,
    value: '',
    placeholder: fallbackKey === 'label'
      ? tr('Haga clic para escribir el botón', 'Click to write the button label')
      : fallbackKey === 'text'
        ? tr('Haga clic para escribir el texto', 'Click to write the text')
        : tr('Haga clic para escribir el título', 'Click to write the title'),
  }
}

function replaceBuilderBlockLocal(blockId: string, replacement: PageBuilderBlock) {
  builderBlocks.value = builderBlocks.value.map((candidate) => candidate.id === blockId ? replacement : candidate)
}

function completeAnimation(block: PageBuilderBlock, patch: Partial<CmsAnimationConfig>): CmsAnimationConfig {
  return {
    preset: 'none',
    duration: 600,
    delay: 0,
    easing: 'standard',
    stagger: 100,
    trigger: 'scroll',
    once: true,
    distance: 32,
    ...block.animation,
    ...patch,
  }
}

function clearAutosaveTimer() {
  if (!autosaveTimer) return
  clearTimeout(autosaveTimer)
  autosaveTimer = null
}

function armAutosaveTimer(delay = AUTOSAVE_DELAY_MS) {
  clearAutosaveTimer()
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void flushPendingTextAutosave(true)
  }, delay)
}

function cancelPendingTextAutosave(blockId?: string, key?: string) {
  const pending = pendingTextAutosave.value
  if (!pending) return
  if (blockId && pending.blockId !== blockId) return
  if (key && pending.key !== key) return
  clearAutosaveTimer()
  pendingTextAutosave.value = null
}

function scheduleTextAutosave(block: PageBuilderBlock, key: string, value: string) {
  const contentId = selectedPageId.value
  if (!contentId) return
  const persisted = typeof block.data[key] === 'string' ? String(block.data[key]) : ''
  if (value === persisted) {
    cancelPendingTextAutosave(block.id, key)
    saveFailed.value = false
    return
  }

  saveFailed.value = false
  pendingTextAutosave.value = { contentId, blockId: block.id, key, value }
  armAutosaveTimer()
}

function previewBlockText(block: PageBuilderBlock, key: string, value: string, autosave = true) {
  const persisted = typeof block.data[key] === 'string' ? String(block.data[key]) : ''
  const allDrafts = { ...previewTextDrafts.value }
  const blockDraft = { ...(allDrafts[block.id] ?? {}) }

  if (value === persisted) delete blockDraft[key]
  else blockDraft[key] = value

  if (Object.keys(blockDraft).length) allDrafts[block.id] = blockDraft
  else delete allDrafts[block.id]
  previewTextDrafts.value = allDrafts
  if (autosave) scheduleTextAutosave(block, key, value)
}

function clearPreviewTextDraft(blockId: string, key?: string) {
  const allDrafts = { ...previewTextDrafts.value }
  if (!key) {
    delete allDrafts[blockId]
    previewTextDrafts.value = allDrafts
    return
  }
  const blockDraft = { ...(allDrafts[blockId] ?? {}) }
  delete blockDraft[key]
  if (Object.keys(blockDraft).length) allDrafts[block.id] = blockDraft
  else delete allDrafts[blockId]
  previewTextDrafts.value = allDrafts
}

async function loadPages() {
  loadingPages.value = true
  try {
    const response = await ContentService.browseEditor({ pageNumber: 1, pageSize: 200, siteKey: props.siteKey, type: 'Page' })
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
  blockPickerOpen.value = false
  propertiesDrawerOpen.value = false
  previewTextDrafts.value = {}
  pendingTextAutosave.value = null
  clearAutosaveTimer()
  saveFailed.value = false
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

async function applyBuilderOperation(
  request: PageBuilderOperationRequest,
  successMessage: string,
  options: ApplyBuilderOperationOptions = {},
) {
  const contentId = options.contentId ?? selectedPageId.value
  if (!contentId || builderBusy.value) return null
  builderBusy.value = true
  saveFailed.value = false
  try {
    const document = await PageBuilderService.apply(contentId, request)
    const next = parsePageBuilderBlocks(document.blocksJson)
    if (selectedPageId.value === contentId) builderBlocks.value = next
    if (options.showSuccessToast !== false && successMessage) toastStore.success(successMessage)
    return next
  } catch (error) {
    saveFailed.value = true
    toastStore.backendError(error, tr('No se pudo actualizar la página.', 'The page could not be updated.'))
    return null
  } finally {
    builderBusy.value = false
  }
}

async function flushPendingTextAutosave(retryIfBusy = false) {
  clearAutosaveTimer()
  const pending = pendingTextAutosave.value
  if (!pending) return true

  if (builderBusy.value) {
    if (retryIfBusy) armAutosaveTimer(AUTOSAVE_BUSY_RETRY_MS)
    return false
  }

  if (selectedPageId.value !== pending.contentId) return false
  const block = builderBlocks.value.find((candidate) => candidate.id === pending.blockId)
  if (!block) {
    pendingTextAutosave.value = null
    return true
  }

  const current = typeof block.data[pending.key] === 'string' ? String(block.data[pending.key]) : ''
  if (current === pending.value) {
    pendingTextAutosave.value = null
    clearPreviewTextDraft(block.id, pending.key)
    return true
  }

  const nextData = { ...block.data, [pending.key]: pending.value }
  const previousBlocks = builderBlocks.value
  pendingTextAutosave.value = null
  replaceBuilderBlockLocal(block.id, { ...block, data: nextData })
  const next = await applyBuilderOperation({
    operation: 'edit',
    blockId: block.id,
    dataJson: JSON.stringify(nextData),
  }, '', { contentId: pending.contentId, showSuccessToast: false })

  if (!next) {
    builderBlocks.value = previousBlocks
    pendingTextAutosave.value = pending
    return false
  }

  clearPreviewTextDraft(block.id, pending.key)
  selectedBuilderBlockId.value = block.id
  return true
}

async function selectEditorPage(value: string | number) {
  const nextPageId = String(value)
  if (nextPageId === selectedPageId.value || builderBusy.value) return
  if (!await flushPendingTextAutosave(false)) return
  selectedPageId.value = nextPageId
}

async function closeEditor() {
  if (builderBusy.value) return
  if (!await flushPendingTextAutosave(false)) return
  emit('close')
}

function selectLibraryBlock(blockId: string) {
  selectedLibraryBlockId.value = blockId
  selectedBuilderBlockId.value = null
}

function selectPageBlock(block: PageBuilderBlock, openResponsivePanel = true) {
  selectedBuilderBlockId.value = block.id
  selectedLibraryBlockId.value = null
  propertySection.value = 'content'
  if (openResponsivePanel && typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches) {
    propertiesDrawerOpen.value = true
  }
}

function handleLibraryDragStart(_event: DragEvent, blockId: string) {
  selectLibraryBlock(blockId)
  libraryDragActive.value = true
}

function handleLibraryDragEnd() {
  libraryDragActive.value = false
}

async function insertLibraryBlockAt(blockId: string, targetIndex: number) {
  const blockType = getMarketingBuilderType(blockId)
  if (!blockType) return false
  const next = await applyBuilderOperation({ operation: 'add', blockType, targetIndex, isVisible: true, dataJson: createMarketingBlockData(blockId) }, tr('Sección agregada', 'Section added'))
  if (!next?.length) return false
  const insertedIndex = Math.min(Math.max(targetIndex, 0), next.length - 1)
  selectedBuilderBlockId.value = next[insertedIndex]?.id ?? null
  selectedLibraryBlockId.value = null
  return true
}

async function dropLibraryBlockAt(event: DragEvent, targetIndex: number) {
  const blockId = event.dataTransfer?.getData(MARKETING_BLOCK_DRAG_MIME)
  libraryDragActive.value = false
  if (!blockId) return
  if (await insertLibraryBlockAt(blockId, targetIndex)) blocksDrawerOpen.value = false
}

async function addBlockFromPicker(blockId: string) {
  selectLibraryBlock(blockId)
  const targetIndex = builderBlocks.value.length
  if (await insertLibraryBlockAt(blockId, targetIndex)) blockPickerOpen.value = false
}

async function saveBlockTextProperty(block: PageBuilderBlock, key: string, value: string) {
  selectPageBlock(block, false)
  const current = typeof block.data[key] === 'string' ? String(block.data[key]) : ''
  if (current === value) {
    cancelPendingTextAutosave(block.id, key)
    return
  }
  cancelPendingTextAutosave(block.id, key)
  const nextData = { ...block.data, [key]: value }
  const previousBlocks = builderBlocks.value
  const previousDrafts = previewTextDrafts.value
  replaceBuilderBlockLocal(block.id, { ...block, data: nextData })
  clearPreviewTextDraft(block.id, key)
  const next = await applyBuilderOperation({
    operation: 'edit',
    blockId: block.id,
    dataJson: JSON.stringify(nextData),
  }, tr('Contenido actualizado', 'Content updated'))
  if (!next) {
    builderBlocks.value = previousBlocks
    previewTextDrafts.value = previousDrafts
    return
  }
  selectedBuilderBlockId.value = block.id
}

async function saveInlineText(block: PageBuilderBlock, field: InlineTextField, value: string) {
  await saveBlockTextProperty(block, field.key, value)
}

async function saveBlockAnimation(block: PageBuilderBlock, preset: CmsMotionPreset) {
  selectPageBlock(block, false)
  if ((block.animation?.preset ?? 'none') === preset) return
  const animation = block.animation ? { ...block.animation, preset } : { preset }
  const previousBlocks = builderBlocks.value
  replaceBuilderBlockLocal(block.id, { ...block, animation: completeAnimation(block, { preset }) })
  const next = await applyBuilderOperation({
    operation: 'edit',
    blockId: block.id,
    animationJson: JSON.stringify(animation),
  }, preset === 'none' ? tr('Animación desactivada', 'Animation disabled') : tr('Animación actualizada', 'Animation updated'))
  if (!next) {
    builderBlocks.value = previousBlocks
    return
  }
  selectedBuilderBlockId.value = block.id
}

async function saveBlockAnimationSettings(block: PageBuilderBlock, patch: AnimationSettingsPatch) {
  selectPageBlock(block, false)
  const currentDistance = block.animation?.distance ?? 32
  const currentDuration = block.animation?.duration ?? 600
  if ((patch.distance === undefined || patch.distance === currentDistance)
    && (patch.duration === undefined || patch.duration === currentDuration)) return
  const animation = block.animation
    ? { ...block.animation, ...patch }
    : { preset: 'none' as CmsMotionPreset, ...patch }
  const previousBlocks = builderBlocks.value
  replaceBuilderBlockLocal(block.id, { ...block, animation: completeAnimation(block, patch) })
  const next = await applyBuilderOperation({
    operation: 'edit',
    blockId: block.id,
    animationJson: JSON.stringify(animation),
  }, tr('Animación actualizada', 'Animation updated'))
  if (!next) {
    builderBlocks.value = previousBlocks
    return
  }
  selectedBuilderBlockId.value = block.id
}

async function handleReorder(_items: DhSortableItem[], from: number, to: number) {
  if (from === to) return
  const block = builderBlocks.value[from]
  if (!block) return
  const next = await applyBuilderOperation({ operation: 'move', blockId: block.id, targetIndex: to }, tr('Sección movida', 'Section moved'))
  if (next) selectedBuilderBlockId.value = block.id
}

async function duplicateBlock(block: PageBuilderBlock) {
  const sourceIndex = builderBlocks.value.findIndex((item) => item.id === block.id)
  const next = await applyBuilderOperation({ operation: 'duplicate', blockId: block.id }, tr('Sección duplicada', 'Section duplicated'))
  if (next) selectedBuilderBlockId.value = next[sourceIndex + 1]?.id ?? block.id
}

async function setVisibility(block: PageBuilderBlock, visible: boolean) {
  if (block.isVisible === visible) return
  const previousBlocks = builderBlocks.value
  replaceBuilderBlockLocal(block.id, { ...block, isVisible: visible })
  const next = await applyBuilderOperation({ operation: visible ? 'show' : 'hide', blockId: block.id }, visible ? tr('Sección visible', 'Section visible') : tr('Sección oculta', 'Section hidden'))
  if (!next) {
    builderBlocks.value = previousBlocks
    return
  }
  selectedBuilderBlockId.value = block.id
}

async function toggleVisibility(block: PageBuilderBlock) {
  await setVisibility(block, !block.isVisible)
}

function requestDelete(block: PageBuilderBlock) {
  deleteCandidate.value = block
  selectPageBlock(block, false)
}

async function confirmDeleteBlock() {
  const block = deleteCandidate.value
  if (!block) return
  const next = await applyBuilderOperation({ operation: 'delete', blockId: block.id }, tr('Sección eliminada', 'Section deleted'))
  if (!next) return
  clearPreviewTextDraft(block.id)
  if (pendingTextAutosave.value?.blockId === block.id) cancelPendingTextAutosave(block.id)
  if (selectedBuilderBlockId.value === block.id) selectedBuilderBlockId.value = null
  deleteCandidate.value = null
}

function openPreview() {
  if (!publicPath.value) return
  window.open(new URL(publicPath.value, window.location.origin).toString(), '_blank', 'noopener,noreferrer')
}

watch(selectedPageId, (id) => void loadSelectedPage(id))
onMounted(() => void loadPages())
onBeforeUnmount(() => {
  clearAutosaveTimer()
  if (pendingTextAutosave.value && !builderBusy.value) void flushPendingTextAutosave(false)
})
</script>

<template>
  <section class="visual-editor-shell">
    <header class="visual-editor-toolbar">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <DhButton :label="tr('Páginas', 'Pages')" :icon="ArrowLeft" variant="ghost" size="sm" @click="closeEditor" />
        <span class="hidden h-7 w-px bg-[var(--dh-border)] sm:block" />
        <div class="min-w-0 flex-1 sm:max-w-sm">
          <DhSelect v-if="!loadingPages && pageOptions.length" :model-value="selectedPageId" :options="pageOptions" placeholder="" @update:model-value="selectEditorPage" />
          <DhSkeleton v-else height="2.75rem" rounded="md" />
        </div>
        <DhBadge v-if="page" class="hidden sm:inline-flex" :label="statusLabel" :variant="statusVariant" />
        <span
          v-if="page && saveState !== 'idle'"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--dh-border)] bg-[var(--dh-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--dh-text-muted)]"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle v-if="saveState === 'saving'" class="h-3.5 w-3.5 animate-spin text-[var(--dh-primary)]" />
          <Check v-else-if="saveState === 'saved'" class="h-3.5 w-3.5 text-emerald-500" />
          <TriangleAlert v-else class="h-3.5 w-3.5 text-amber-500" />
          <span>{{ saveStateLabel }}</span>
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <DhButton class="xl:hidden" :label="tr('Bloques', 'Blocks')" :icon="Blocks" variant="secondary" size="sm" @click="blocksDrawerOpen = true" />
        <DhButton class="xl:hidden" :label="tr('Propiedades', 'Properties')" :icon="PanelRight" variant="secondary" size="sm" @click="propertiesDrawerOpen = true" />
        <DhButton :label="tr('Vista previa', 'Preview')" :icon="Eye" variant="secondary" size="sm" :disabled="!publicPath" @click="openPreview" />
      </div>
    </header>

    <div class="visual-editor-grid">
      <aside class="visual-editor-side hidden xl:flex">
        <div class="visual-editor-side-header"><Blocks class="h-4 w-4" /><span>{{ tr('Bloques', 'Blocks') }}</span></div>
        <MarketingBlockLibrary :selected-id="selectedLibraryBlockId" @select="selectLibraryBlock" @dragstart="handleLibraryDragStart" @dragend="handleLibraryDragEnd" />
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
            <div class="space-y-4 p-6"><DhSkeleton height="4rem" rounded="lg" /><DhSkeleton height="12rem" rounded="lg" /><DhSkeleton height="8rem" rounded="lg" /></div>
          </template>

          <template v-else-if="page">
            <section class="visual-editor-structure">
              <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="text-xs font-black text-[var(--dh-text)]">{{ tr('Secciones de la página', 'Page sections') }}</p>
                  <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">{{ tr('Haga clic sobre el texto para editarlo directamente, o seleccione una sección para abrir sus propiedades.', 'Click text to edit it directly, or select a section to open its properties.') }}</p>
                </div>
                <div class="flex items-center gap-2">
                  <DhBadge :label="String(builderBlocks.length)" variant="neutral" />
                  <DhButton :label="tr('Agregar sección', 'Add section')" :icon="Plus" size="sm" :disabled="builderBusy" @click="blockPickerOpen = true" />
                </div>
              </div>

              <DhBlockDropZone :visible="libraryDragActive" :disabled="builderBusy" :accept-mime-type="MARKETING_BLOCK_DRAG_MIME" :label="tr('Soltar sección aquí', 'Drop section here')" @drop="dropLibraryBlockAt($event, 0)" />

              <DhSortable v-if="sortableBlocks.length" :model-value="sortableBlocks" :item-label="(item) => sortableText(item, 'title')" @reorder="handleReorder">
                <template #item="{ item }">
                  <div
                    class="flex min-w-0 items-start gap-2 rounded-2xl transition"
                    :class="selectedBuilderBlockId === sortableBlock(item).id ? 'bg-[var(--dh-card-hover)] ring-1 ring-[var(--dh-primary)]' : ''"
                    @click="selectPageBlock(sortableBlock(item))"
                  >
                    <div class="min-w-0 flex-1 rounded-xl p-1">
                      <div class="flex items-center gap-2">
                        <span class="truncate text-xs font-black uppercase tracking-[.08em] text-[var(--dh-text-muted)]">{{ sortableText(item, 'title') }}</span>
                        <DhBadge v-if="!sortableBlock(item).isVisible" :label="tr('Oculta', 'Hidden')" variant="neutral" />
                      </div>
                      <span class="mt-1 line-clamp-1 block text-xs text-[var(--dh-text-muted)]">{{ sortableText(item, 'description') }}</span>
                      <MarketingInlineEditableText
                        v-if="inlineTextField(sortableBlock(item))"
                        :model-value="inlineTextField(sortableBlock(item))!.value"
                        :placeholder="inlineTextField(sortableBlock(item))!.placeholder"
                        :disabled="builderBusy"
                        @activate="selectPageBlock(sortableBlock(item), false)"
                        @preview="previewBlockText(sortableBlock(item), inlineTextField(sortableBlock(item))!.key, $event, false)"
                        @save="saveInlineText(sortableBlock(item), inlineTextField(sortableBlock(item))!, $event)"
                      />
                      <p v-else class="mt-2 px-2 text-[11px] text-[var(--dh-text-muted)]">{{ tr('Este bloque no tiene texto editable directamente.', 'This block has no directly editable text.') }}</p>
                    </div>

                    <div class="flex shrink-0 items-center gap-1 p-1">
                      <DhIconButton :icon="Copy" :label="tr('Duplicar sección', 'Duplicate section')" size="sm" :disabled="builderBusy" @click.stop="duplicateBlock(sortableBlock(item))" />
                      <DhIconButton :icon="sortableBlock(item).isVisible ? EyeOff : Eye" :label="sortableBlock(item).isVisible ? tr('Ocultar sección', 'Hide section') : tr('Mostrar sección', 'Show section')" size="sm" :disabled="builderBusy" @click.stop="toggleVisibility(sortableBlock(item))" />
                      <DhIconButton :icon="Trash2" :label="tr('Eliminar sección', 'Delete section')" variant="danger" size="sm" :disabled="builderBusy" @click.stop="requestDelete(sortableBlock(item))" />
                    </div>
                  </div>
                </template>
                <template #after="{ index }">
                  <DhBlockDropZone :visible="libraryDragActive" :disabled="builderBusy" :accept-mime-type="MARKETING_BLOCK_DRAG_MIME" :label="tr('Soltar sección aquí', 'Drop section here')" @drop="dropLibraryBlockAt($event, index + 1)" />
                </template>
              </DhSortable>

              <DhEmptyState v-else-if="!libraryDragActive" :icon="PanelsTopLeft" :title="tr('La página todavía no tiene secciones', 'The page has no sections yet')" :description="tr('Arrastre un bloque desde el panel izquierdo o use Agregar sección para comenzar.', 'Drag a block from the left panel or use Add section to get started.')" />
            </section>

            <section class="visual-editor-preview">
              <div class="flex items-center justify-between gap-2 border-b border-[var(--dh-border)] px-4 py-3">
                <p class="text-xs font-black text-[var(--dh-text)]">{{ tr('Vista actual', 'Current view') }}</p>
                <DhBadge :label="tr('Cambios en vivo', 'Live changes')" variant="success" />
              </div>
              <MarketingLivePreview
                :blocks="livePreviewBlocks"
                :page-title="page.title"
                :fallback-html="page.renderedHtml"
                :selected-block-id="selectedBuilderBlockId"
                @select="selectPageBlock"
              />
            </section>
          </template>

          <DhEmptyState v-else class="m-auto" :icon="PanelsTopLeft" :title="tr('No hay una página seleccionada', 'No page selected')" :description="tr('Elija una página arriba para abrirla en el editor visual.', 'Choose a page above to open it in the visual editor.')" />
        </div>
      </main>

      <aside class="hidden min-h-0 xl:block">
        <DhPropertyPanel v-model="propertySection" :sections="propertySections" :title="propertyTitle" :description="propertyDescription" class="h-full">
          <template #default="{ activeKey }">
            <MarketingBlockPropertiesContent
              :block="selectedBuilderBlock"
              :text-field="selectedTextField"
              :active-section="activeKey"
              :disabled="builderBusy"
              @preview-text="selectedBuilderBlock && previewBlockText(selectedBuilderBlock, $event.key, $event.value)"
              @save-text="selectedBuilderBlock && saveBlockTextProperty(selectedBuilderBlock, $event.key, $event.value)"
              @save-animation="selectedBuilderBlock && saveBlockAnimation(selectedBuilderBlock, $event)"
              @save-animation-settings="selectedBuilderBlock && saveBlockAnimationSettings(selectedBuilderBlock, $event)"
              @set-visibility="selectedBuilderBlock && setVisibility(selectedBuilderBlock, $event)"
              @duplicate="selectedBuilderBlock && duplicateBlock(selectedBuilderBlock)"
              @delete="selectedBuilderBlock && requestDelete(selectedBuilderBlock)"
            />
          </template>
        </DhPropertyPanel>
      </aside>
    </div>

    <DhDrawer :open="blocksDrawerOpen" :title="tr('Bloques', 'Blocks')" size="sm" @close="blocksDrawerOpen = false">
      <MarketingBlockLibrary :selected-id="selectedLibraryBlockId" @select="selectLibraryBlock" @dragstart="handleLibraryDragStart" @dragend="handleLibraryDragEnd" />
    </DhDrawer>

    <DhDrawer :open="propertiesDrawerOpen" :title="tr('Propiedades', 'Properties')" size="md" @close="propertiesDrawerOpen = false">
      <DhPropertyPanel v-model="propertySection" :sections="propertySections" :description="propertyDescription">
        <template #default="{ activeKey }">
          <MarketingBlockPropertiesContent
            :block="selectedBuilderBlock"
            :text-field="selectedTextField"
            :active-section="activeKey"
            :disabled="builderBusy"
            @preview-text="selectedBuilderBlock && previewBlockText(selectedBuilderBlock, $event.key, $event.value)"
            @save-text="selectedBuilderBlock && saveBlockTextProperty(selectedBuilderBlock, $event.key, $event.value)"
            @save-animation="selectedBuilderBlock && saveBlockAnimation(selectedBuilderBlock, $event)"
            @save-animation-settings="selectedBuilderBlock && saveBlockAnimationSettings(selectedBuilderBlock, $event)"
            @set-visibility="selectedBuilderBlock && setVisibility(selectedBuilderBlock, $event)"
            @duplicate="selectedBuilderBlock && duplicateBlock(selectedBuilderBlock)"
            @delete="selectedBuilderBlock && requestDelete(selectedBuilderBlock)"
          />
        </template>
      </DhPropertyPanel>
    </DhDrawer>

    <DhModal :open="blockPickerOpen" :title="tr('Agregar sección', 'Add section')" size="lg" @close="blockPickerOpen = false">
      <MarketingBlockPicker v-model="selectedLibraryBlockId" @select="addBlockFromPicker" />
    </DhModal>

    <DhModal :open="Boolean(deleteCandidate)" :title="tr('Confirmar eliminación', 'Confirm deletion')" size="sm" @close="deleteCandidate = null">
      <DhConfirmDialog :title="tr('¿Eliminar esta sección?', 'Delete this section?')" :message="tr('La sección se quitará de la página. Esta acción quedará registrada en el historial del contenido.', 'The section will be removed from the page. This action will remain recorded in the content history.')" :confirm-label="tr('Eliminar', 'Delete')" :cancel-label="tr('Cancelar', 'Cancel')" :danger="true" :on-confirm="confirmDeleteBlock" :on-cancel="() => { deleteCandidate = null }" />
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
.visual-editor-structure{padding:1rem}.visual-editor-preview{overflow:hidden}
@media (min-width:1280px){.visual-editor-grid{grid-template-columns:280px minmax(0,1fr) 300px}.visual-editor-canvas-wrap{padding:1.25rem}.visual-editor-grid>aside:last-child{border-left:1px solid var(--dh-border);background:var(--dh-input);padding:.75rem}}
@media (max-width:640px){.visual-editor-shell{min-height:calc(100dvh - 5rem);border-radius:22px}.visual-editor-toolbar{align-items:stretch}.visual-editor-toolbar>div:first-child{width:100%}.visual-editor-canvas-wrap{padding:.65rem}.visual-editor-canvas{min-height:560px;border-radius:18px;padding:.65rem}.visual-editor-structure{padding:.75rem}}
</style>
