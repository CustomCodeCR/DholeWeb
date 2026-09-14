<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Blocks, Eye, PanelRight, PanelsTopLeft } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhSelect, DhSkeleton } from '@/shared/components/atoms'
import { DhPropertyPanel, DhDrawer } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { ContentRouteService } from '@/core/services/contentRouteService'
import { useLocale } from '@/core/stores/locale'
import { useToastStore } from '@/core/stores/toastStore'
import type { ContentItemDto, ContentItemListDto } from '@/core/interfaces/content'
import MarketingBlockLibrary from '@/modules/marketing/components/MarketingBlockLibrary.vue'

const props = withDefaults(defineProps<{ siteKey?: string }>(), { siteKey: 'main' })
const emit = defineEmits<{ close: [] }>()

const localeStore = useLocale()
const toastStore = useToastStore()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loadingPages = ref(false)
const loadingPage = ref(false)
const pages = ref<ContentItemListDto[]>([])
const selectedPageId = ref<string | null>(null)
const page = ref<ContentItemDto | null>(null)
const publicPath = ref<string | null>(null)
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
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
  if (!id) {
    page.value = null
    publicPath.value = null
    return
  }

  loadingPage.value = true
  try {
    const [detail, routes] = await Promise.all([
      ContentService.getEditorContent(id),
      ContentRouteService.getByContent(id).catch(() => []),
    ])
    page.value = detail
    const primary = routes.find((route) => route.isPrimary) ?? routes.find((route) => route.isActive) ?? null
    publicPath.value = primary?.path ?? null
  } catch (error) {
    page.value = null
    publicPath.value = null
    toastStore.backendError(error, tr('No se pudo abrir la página.', 'The page could not be opened.'))
  } finally {
    loadingPage.value = false
  }
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
        <MarketingBlockLibrary />
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
          <iframe
            v-else-if="page"
            :title="tr('Vista visual de la página', 'Visual page preview')"
            :srcdoc="visualHtml"
            sandbox=""
            class="h-full min-h-[620px] w-full border-0 bg-white"
          />
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
          <DhEmptyState
            :icon="PanelRight"
            :title="tr('Sin sección seleccionada', 'No section selected')"
            :description="tr('Las propiedades de contenido, diseño, animación y espaciado aparecerán aquí al seleccionar una sección.', 'Content, design, animation and spacing properties will appear here when a section is selected.')"
          />
        </DhPropertyPanel>
      </aside>
    </div>

    <DhDrawer :open="blocksDrawerOpen" :title="tr('Bloques', 'Blocks')" size="sm" @close="blocksDrawerOpen = false">
      <MarketingBlockLibrary />
    </DhDrawer>

    <DhDrawer :open="propertiesDrawerOpen" :title="tr('Propiedades', 'Properties')" size="md" @close="propertiesDrawerOpen = false">
      <DhPropertyPanel
        v-model="propertySection"
        :sections="propertySections"
        :description="tr('Configuración de la sección seleccionada.', 'Settings for the selected section.')"
      >
        <DhEmptyState
          :icon="PanelRight"
          :title="tr('Sin sección seleccionada', 'No section selected')"
          :description="tr('Las propiedades aparecerán aquí cuando seleccione una sección.', 'Properties will appear here when you select a section.')"
        />
      </DhPropertyPanel>
    </DhDrawer>
  </section>
</template>

<style scoped>
.visual-editor-shell{display:flex;min-height:calc(100dvh - 7rem);min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--dh-border);border-radius:30px;background:var(--dh-surface);box-shadow:var(--dh-shadow-sm)}
.visual-editor-toolbar{display:flex;min-width:0;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;border-bottom:1px solid var(--dh-border);padding:.75rem;background:var(--dh-input)}
.visual-editor-grid{display:grid;min-height:0;min-width:0;flex:1;grid-template-columns:minmax(0,1fr)}
.visual-editor-side{min-height:0;min-width:0;flex-direction:column;border-right:1px solid var(--dh-border);background:var(--dh-input)}
.visual-editor-side-header{display:flex;align-items:center;gap:.5rem;border-bottom:1px solid var(--dh-border);padding:1rem;font-size:.72rem;font-weight:900;text-transform:uppercase;letter-spacing:.13em;color:var(--dh-text-muted)}
.visual-editor-canvas-wrap{min-height:0;min-width:0;overflow:auto;background:color-mix(in srgb,var(--dh-bg) 86%,var(--dh-surface));padding:1rem}
.visual-editor-canvas{display:flex;min-height:680px;min-width:0;overflow:hidden;border:1px solid var(--dh-border);border-radius:24px;background:#fff;box-shadow:var(--dh-shadow-lg)}
@media (min-width:1280px){.visual-editor-grid{grid-template-columns:280px minmax(0,1fr) 300px}.visual-editor-canvas-wrap{padding:1.25rem}.visual-editor-grid>aside:last-child{border-left:1px solid var(--dh-border);background:var(--dh-input);padding:.75rem}}
@media (max-width:640px){.visual-editor-shell{min-height:calc(100dvh - 5rem);border-radius:22px}.visual-editor-toolbar{align-items:stretch}.visual-editor-toolbar>div:first-child{width:100%}.visual-editor-canvas-wrap{padding:.65rem}.visual-editor-canvas{min-height:560px;border-radius:18px}}
</style>
