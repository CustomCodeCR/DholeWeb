<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import {
  Archive,
  Bold,
  CalendarClock,
  Eye,
  FileText,
  Heading2,
  History,
  Image,
  Italic,
  Link,
  List,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from 'lucide-vue-next'
import {
  DhBadge,
  DhButton,
  DhCheckbox,
  DhEmptyState,
  DhInput,
  DhSelect,
  DhSkeleton,
  DhSwitch,
  DhTextarea,
} from '@/shared/components/atoms'
import { DhConfirmDialog, DhSearchInput } from '@/shared/components/molecules'
import { DhDrawer, DhMediaPicker, DhModal, type DhMediaPickerItem } from '@/shared/components/organisms'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { useLocale } from '@/core/stores/locale'
import { ContentService } from '@/core/services/contentService'
import { ContentRouteService } from '@/core/services/contentRouteService'
import { normalizePublicPath, shouldCreatePermanentRedirect } from '@/core/redirects/redirectFlow'
import { buildSeoPreview } from '@/core/seo/seoPreview'
import type {
  ContentItemDto,
  ContentItemListDto,
  ContentRevisionDto,
  ContentType,
  EditorContentRequest,
  MediaDto,
  TaxonomyTermDto,
} from '@/core/interfaces/content'
import type { ContentRouteDto } from '@/core/interfaces/contentRoutes'
import MarketingLivePreview from '@/modules/marketing/components/MarketingLivePreview.vue'

const props = withDefaults(defineProps<{
  siteKey: string
  contentType: ContentType
  title: string
  singular: string
  createNonce?: number
}>(), {
  createNonce: 0,
})

const authStore = useAuthStore()
const toastStore = useToastStore()
const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const loading = ref(false)
const saving = ref(false)
const items = ref<ContentItemListDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const search = ref('')
const statusFilter = ref('')
const editorOpen = ref(false)
const previewOpen = ref(false)
const historyOpen = ref(false)
const selected = ref<ContentItemDto | null>(null)
const revisions = ref<ContentRevisionDto[]>([])
const restoringRevisionId = ref<string | null>(null)
const editorRef = ref<HTMLElement | null>(null)
const media = ref<MediaDto[]>([])
const taxonomies = ref<TaxonomyTermDto[]>([])
const selectedCategoryIds = ref<string[]>([])
const scheduleAt = ref('')
const primaryRoute = ref<ContentRouteDto | null>(null)
const originalPublicPath = ref('')
const keepOldAddress = ref(true)
const mediaPickerOpen = ref(false)
const linkModalOpen = ref(false)
const linkUrl = ref('')
const confirmAction = ref<'delete' | 'archive' | 'unpublish' | null>(null)
let savedSelection: Range | null = null

const form = reactive({
  title: '',
  publicPath: '',
  excerpt: '',
  contentHtml: '',
  featuredMediaId: '',
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
})

const statusOptions = computed(() => [
  { value: '', label: tr('Todos los estados', 'All statuses') },
  { value: 'Draft', label: tr('Borrador', 'Draft') },
  { value: 'PendingReview', label: tr('Pendiente de aprobación', 'Pending approval') },
  { value: 'Scheduled', label: tr('Programado', 'Scheduled') },
  { value: 'Published', label: tr('Publicado', 'Published') },
  { value: 'Rejected', label: tr('Rechazado', 'Rejected') },
  { value: 'Archived', label: tr('Archivado', 'Archived') },
])

const canCreate = computed(() => authStore.hasScope(CONTENT_SCOPES.create))
const canEdit = computed(() => authStore.hasScope(CONTENT_SCOPES.edit))
const canDelete = computed(() => authStore.hasScope(CONTENT_SCOPES.delete))
const canPublish = computed(() => authStore.hasScope(CONTENT_SCOPES.publish))
const canEditSeo = computed(() => authStore.hasScope(CONTENT_SCOPES.seo.edit))

const canEditThisType = computed(() => {
  if (!canEdit.value) return false
  if (props.contentType === 'Page') return authStore.hasScope(CONTENT_SCOPES.pages.edit)
  if (props.contentType === 'Banner') return authStore.hasScope(CONTENT_SCOPES.banners.edit)
  if (props.contentType === 'News') return authStore.hasScope(CONTENT_SCOPES.news.edit)
  return true
})

const canSave = computed(() => selected.value ? canEditThisType.value : canCreate.value)
const taxonomyOptions = computed(() => taxonomies.value.filter((item) => ['category', 'tag'].includes(item.kind.toLowerCase())))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const publicPathChanged = computed(() => Boolean(primaryRoute.value && shouldCreatePermanentRedirect(originalPublicPath.value, form.publicPath)))
const selectedMediaName = computed(() => media.value.find((entry) => entry.id === form.featuredMediaId)?.fileName ?? '')
const mediaPickerItems = computed<DhMediaPickerItem[]>(() => media.value.map((entry) => ({
  id: entry.id,
  name: entry.fileName,
  kind: entry.contentType.startsWith('image/') ? 'image' : entry.contentType.startsWith('video/') ? 'video' : 'document',
  meta: entry.altText || entry.caption || undefined,
})))

const seoPreview = computed(() => buildSeoPreview({
  title: form.title,
  slug: form.publicPath,
  excerpt: form.excerpt,
  seoTitle: form.seoTitle,
  seoDescription: form.seoDescription,
  canonicalUrl: selected.value?.seo?.canonicalUrl ?? null,
}))

const confirmTitle = computed(() => {
  if (confirmAction.value === 'delete') return tr('Eliminar contenido', 'Delete content')
  if (confirmAction.value === 'archive') return tr('Archivar contenido', 'Archive content')
  return tr('Retirar publicación', 'Unpublish content')
})

const confirmMessage = computed(() => {
  const name = selected.value?.title || props.singular
  if (confirmAction.value === 'delete') return tr(`¿Desea eliminar “${name}”? Esta acción no se puede deshacer.`, `Delete “${name}”? This action cannot be undone.`)
  if (confirmAction.value === 'archive') return tr(`¿Desea archivar “${name}”?`, `Archive “${name}”?`)
  return tr(`¿Desea retirar “${name}” del sitio público?`, `Remove “${name}” from the public website?`)
})

function statusLabel(status: string) {
  return statusOptions.value.find((option) => option.value === status)?.label ?? status
}

function statusVariant(status: string): 'primary' | 'success' | 'warning' | 'neutral' {
  if (status === 'Published') return 'success'
  if (status === 'PendingReview' || status === 'Scheduled') return 'warning'
  if (status === 'Rejected' || status === 'Archived') return 'neutral'
  return 'primary'
}

function taxonomyKindLabel(kind: string) {
  return kind.toLowerCase() === 'tag' ? tr('Etiqueta', 'Tag') : tr('Categoría', 'Category')
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeStore.locale === 'en' ? 'en-US' : 'es-CR', { dateStyle: 'medium' }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeStore.locale === 'en' ? 'en-US' : 'es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function slugFromPath(path: string) {
  const parts = normalizePublicPath(path).split('/').filter(Boolean)
  return parts.at(-1) ?? null
}

function slugifyTitle(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensurePublicPath() {
  if (form.publicPath.trim()) return normalizePublicPath(form.publicPath)
  const slug = slugifyTitle(form.title) || 'contenido'
  form.publicPath = `/${slug}`
  return form.publicPath
}

function resetForm() {
  selected.value = null
  revisions.value = []
  restoringRevisionId.value = null
  previewOpen.value = false
  historyOpen.value = false
  primaryRoute.value = null
  originalPublicPath.value = ''
  keepOldAddress.value = true
  selectedCategoryIds.value = []
  scheduleAt.value = ''
  Object.assign(form, {
    title: '',
    publicPath: '',
    excerpt: '',
    contentHtml: '',
    featuredMediaId: '',
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
  })
}

async function placeEditorHtml() {
  await nextTick()
  if (editorRef.value) editorRef.value.innerHTML = form.contentHtml
}

async function newContent() {
  if (!canCreate.value) return
  resetForm()
  editorOpen.value = true
  await placeEditorHtml()
}

function closeEditor() {
  editorOpen.value = false
  resetForm()
}

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseEditor({
      pageNumber: page.value,
      pageSize,
      siteKey: props.siteKey || 'main',
      type: props.contentType,
      status: statusFilter.value || undefined,
      search: search.value.trim() || undefined,
    })
    items.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) {
    toastStore.backendError(error, tr(`No se pudieron cargar ${props.title.toLowerCase()}.`, `Could not load ${props.title.toLowerCase()}.`))
  } finally {
    loading.value = false
  }
}

async function loadAuxiliary() {
  try {
    const [mediaResponse, taxonomyResponse] = await Promise.all([
      ContentService.browseMedia({ pageNumber: 1, pageSize: 200 }),
      ContentService.browseTaxonomies({ pageNumber: 1, pageSize: 300, siteKey: props.siteKey || 'main' }),
    ])
    media.value = mediaResponse.items
    taxonomies.value = taxonomyResponse.items
  } catch (error) {
    toastStore.backendWarning(error, tr('No se pudieron cargar imágenes y taxonomías.', 'Images and taxonomies could not be loaded.'))
  }
}

function applyDetail(detail: ContentItemDto, route: ContentRouteDto | null) {
  selected.value = detail
  primaryRoute.value = route
  originalPublicPath.value = route?.path ?? ''
  keepOldAddress.value = true
  Object.assign(form, {
    title: detail.title,
    publicPath: route?.path ?? `/${detail.slug ?? ''}`,
    excerpt: detail.excerpt ?? '',
    contentHtml: detail.renderedHtml ?? '',
    featuredMediaId: detail.featuredMediaId ?? '',
    isFeatured: detail.isFeatured,
    seoTitle: detail.seo?.title ?? '',
    seoDescription: detail.seo?.description ?? '',
  })
  selectedCategoryIds.value = detail.taxonomyTermIds ?? []
  scheduleAt.value = detail.scheduledAtUtc ? new Date(detail.scheduledAtUtc).toISOString().slice(0, 16) : ''
}

async function openItem(item: ContentItemListDto) {
  try {
    const [detail, history] = await Promise.all([
      ContentService.getEditorContent(item.id),
      ContentService.getRevisions(item.id),
    ])
    let route: ContentRouteDto | null = null
    try {
      const routes = await ContentRouteService.getByContent(item.id)
      route = routes.find((entry) => entry.isPrimary) ?? routes.find((entry) => entry.isActive) ?? null
    } catch {
      route = null
    }

    revisions.value = history
    applyDetail(detail, route)
    editorOpen.value = true
    await placeEditorHtml()
  } catch (error) {
    toastStore.backendError(error, tr(`No se pudo abrir ${props.singular.toLowerCase()}.`, `Could not open ${props.singular.toLowerCase()}.`))
  }
}

function syncEditor() {
  form.contentHtml = editorRef.value?.innerHTML ?? ''
}

function openPreview() {
  syncEditor()
  previewOpen.value = true
}

function editorCommand(command: string, value?: string) {
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  syncEditor()
}

function openLinkDialog() {
  const selection = window.getSelection()
  savedSelection = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
  linkUrl.value = ''
  linkModalOpen.value = true
}

function applyLink() {
  const url = linkUrl.value.trim()
  if (!url) return
  if (savedSelection) {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(savedSelection)
  }
  editorCommand('createLink', url)
  linkModalOpen.value = false
  linkUrl.value = ''
  savedSelection = null
}

function toggleCategory(id: string, checked: boolean) {
  if (checked && !selectedCategoryIds.value.includes(id)) selectedCategoryIds.value.push(id)
  if (!checked) selectedCategoryIds.value = selectedCategoryIds.value.filter((value) => value !== id)
}

function buildPayload(): EditorContentRequest {
  syncEditor()
  const path = ensurePublicPath()
  return {
    type: props.contentType,
    title: form.title.trim(),
    contentHtml: form.contentHtml.trim() || null,
    slug: slugFromPath(path),
    excerpt: form.excerpt.trim() || null,
    featuredMediaId: form.featuredMediaId || null,
    locale: selected.value?.locale || 'es-CR',
    sortOrder: selected.value?.sortOrder ?? 0,
    isFeatured: form.isFeatured,
    categoryIds: selectedCategoryIds.value,
    seo: selected.value?.seo ?? null,
    siteKey: selected.value?.siteKey || props.siteKey || 'main',
    parentContentId: selected.value?.parentContentId ?? null,
    translationGroupId: selected.value?.translationGroupId ?? null,
    templateKey: selected.value?.templateKey ?? null,
    unpublishAtUtc: selected.value?.unpublishAtUtc ?? null,
    sitemapPriority: selected.value?.sitemapPriority ?? null,
    sitemapChangeFrequency: selected.value?.sitemapChangeFrequency ?? null,
  }
}

async function syncPublicRoute(contentId: string) {
  const path = ensurePublicPath()
  const siteKey = selected.value?.siteKey || props.siteKey || 'main'
  const locale = selected.value?.locale || 'es-CR'

  if (primaryRoute.value) {
    const changed = shouldCreatePermanentRedirect(originalPublicPath.value, path)
    await ContentRouteService.update(primaryRoute.value.id, {
      siteKey,
      locale,
      path,
      isPrimary: true,
      isActive: true,
      createPermanentRedirect: changed && keepOldAddress.value,
    })
    return
  }

  await ContentRouteService.create({ siteKey, contentId, locale, path, isPrimary: true, isActive: true })
}

async function persist(): Promise<string | null> {
  if (!canSave.value || !form.title.trim()) {
    toastStore.warning(tr('Falta el título', 'Title required'), tr(`Escriba un título para ${props.singular.toLowerCase()}.`, `Add a title for this ${props.singular.toLowerCase()}.`))
    return null
  }

  const payload = buildPayload()
  const id = selected.value
    ? (await ContentService.updateEditorContent(selected.value.id, payload), selected.value.id)
    : await ContentService.createEditorContent(payload)

  await syncPublicRoute(id)

  if (canEditSeo.value) {
    await ContentService.updateSeo(id, {
      ...(selected.value?.seo ?? {}),
      title: form.seoTitle.trim() || null,
      description: form.seoDescription.trim() || null,
      openGraphMediaId: form.featuredMediaId || selected.value?.seo?.openGraphMediaId || null,
    })
  }

  return id
}

async function saveDraft() {
  if (saving.value) return
  saving.value = true
  try {
    const id = await persist()
    if (!id) return
    toastStore.success(selected.value ? tr('Cambios guardados', 'Changes saved') : tr(`${props.singular} guardada como borrador`, `${props.singular} saved as draft`))
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr(`No se pudo guardar ${props.singular.toLowerCase()}.`, `Could not save ${props.singular.toLowerCase()}.`))
  } finally {
    saving.value = false
  }
}

async function saveAndPublish() {
  if (saving.value) return
  saving.value = true
  try {
    const id = await persist()
    if (!id) return
    if (canPublish.value) {
      await ContentService.publishEditor(id)
      toastStore.success(tr(`${props.singular} publicada`, `${props.singular} published`))
    } else {
      await ContentService.submitEditor(id)
      toastStore.success(tr(`${props.singular} enviada a aprobación`, `${props.singular} sent for approval`))
    }
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo completar la publicación.', 'Publishing could not be completed.'))
  } finally {
    saving.value = false
  }
}

async function schedule() {
  if (!canPublish.value || !scheduleAt.value || saving.value) return
  saving.value = true
  try {
    const id = await persist()
    if (!id) return
    await ContentService.scheduleEditor(id, new Date(scheduleAt.value).toISOString())
    toastStore.success(tr('Publicación programada', 'Publication scheduled'))
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo programar la publicación.', 'The publication could not be scheduled.'))
  } finally {
    saving.value = false
  }
}

async function restoreRevision(revision: ContentRevisionDto) {
  if (!selected.value || !canEditThisType.value || restoringRevisionId.value) return
  restoringRevisionId.value = revision.id
  try {
    await ContentService.restoreRevision(selected.value.id, revision.id, 'restored-from-marketing')
    const [detail, history] = await Promise.all([
      ContentService.getEditorContent(selected.value.id),
      ContentService.getRevisions(selected.value.id),
    ])
    revisions.value = history
    applyDetail(detail, primaryRoute.value)
    historyOpen.value = false
    await placeEditorHtml()
    toastStore.success(tr('Revisión restaurada como borrador', 'Revision restored as draft'))
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo restaurar la revisión.', 'The revision could not be restored.'))
  } finally {
    restoringRevisionId.value = null
  }
}

async function performConfirmedAction() {
  if (!selected.value || !confirmAction.value || saving.value) return
  const action = confirmAction.value
  saving.value = true
  try {
    if (action === 'unpublish') await ContentService.unpublishEditor(selected.value.id)
    if (action === 'archive') await ContentService.archiveEditor(selected.value.id)
    if (action === 'delete') await ContentService.deleteEditorContent(selected.value.id)
    toastStore.success(action === 'delete' ? tr('Contenido eliminado', 'Content deleted') : tr('Estado actualizado', 'Status updated'))
    confirmAction.value = null
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, tr('No se pudo aplicar la acción.', 'The action could not be completed.'))
  } finally {
    saving.value = false
  }
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  void load()
}

watch(() => props.siteKey, () => {
  page.value = 1
  void Promise.all([load(), loadAuxiliary()])
})
watch(() => props.contentType, () => {
  page.value = 1
  statusFilter.value = ''
  closeEditor()
  void load()
})
watch(() => props.createNonce, (value, previous) => {
  if (value !== previous && value > 0) void newContent()
})

onMounted(() => void Promise.all([load(), loadAuxiliary()]))
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[28px] p-5 sm:p-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h3 class="text-xl font-black">{{ title }}</h3>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">
          {{ total }} {{ total === 1 ? tr('elemento', 'item') : tr('elementos', 'items') }}
        </p>
      </div>
      <DhButton v-if="canCreate" :label="tr(`Nueva ${singular.toLowerCase()}`, `New ${singular.toLowerCase()}`)" :icon="Plus" size="sm" @click="newContent" />
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
      <DhSearchInput v-model="search" :placeholder="tr(`Buscar ${singular.toLowerCase()}…`, `Search ${singular.toLowerCase()}…`)" @search="page = 1; load()" />
      <DhSelect
        :model-value="statusFilter"
        :options="statusOptions"
        :placeholder="''"
        @update:model-value="statusFilter = String($event); page = 1; load()"
      />
      <DhButton :label="tr('Actualizar', 'Refresh')" :icon="RefreshCw" variant="secondary" :loading="loading" @click="load" />
    </div>

    <div v-if="loading" class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <DhSkeleton v-for="index in 6" :key="index" height="10rem" rounded="lg" />
    </div>

    <DhEmptyState
      v-else-if="!items.length"
      class="mt-5"
      :icon="FileText"
      :title="tr(`Aún no hay ${title.toLowerCase()}`, `No ${title.toLowerCase()} yet`)"
      :description="tr(`Cree la primera ${singular.toLowerCase()} para comenzar.`, `Create the first ${singular.toLowerCase()} to get started.`)"
      :action-label="canCreate ? tr(`Crear ${singular.toLowerCase()}`, `Create ${singular.toLowerCase()}`) : undefined"
      @action="newContent"
    />

    <div v-else class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <article v-for="item in items" :key="item.id" class="content-card">
        <div class="flex min-w-0 items-start justify-between gap-3">
          <span class="content-icon"><FileText class="h-5 w-5" /></span>
          <DhBadge :label="statusLabel(item.status)" :variant="statusVariant(item.status)" />
        </div>
        <h4 class="mt-4 line-clamp-2 font-black">{{ item.title }}</h4>
        <p class="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[var(--dh-text-muted)]">
          {{ item.excerpt || tr('Sin resumen todavía.', 'No summary yet.') }}
        </p>
        <div class="mt-4 flex items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-3">
          <span class="text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ formatDate(item.publishedAtUtc || item.updatedAtUtc || item.createdAtUtc) }}</span>
          <DhButton :label="tr('Editar', 'Edit')" variant="ghost" size="sm" @click="openItem(item)" />
        </div>
      </article>
    </div>

    <div v-if="totalPages > 1" class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dh-border)] pt-4">
      <span class="text-xs font-bold text-[var(--dh-text-muted)]">{{ tr('Página', 'Page') }} {{ page }} / {{ totalPages }}</span>
      <div class="flex gap-2">
        <DhButton :label="tr('Anterior', 'Previous')" variant="secondary" size="sm" :disabled="page <= 1" @click="changePage(page - 1)" />
        <DhButton :label="tr('Siguiente', 'Next')" variant="secondary" size="sm" :disabled="page >= totalPages" @click="changePage(page + 1)" />
      </div>
    </div>
  </section>

  <DhDrawer :open="editorOpen" :title="selected ? tr('Editar contenido', 'Edit content') : tr('Crear contenido', 'Create content')" size="xl" @close="closeEditor">
    <div class="space-y-5">
      <section class="editor-section">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-black uppercase tracking-[.15em] text-[var(--dh-primary)]">{{ selected ? tr('Edición', 'Editing') : tr('Nuevo contenido', 'New content') }}</p>
            <h3 class="mt-1 text-xl font-black">{{ form.title || singular }}</h3>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DhButton :label="tr('Vista previa', 'Preview')" :icon="Eye" variant="secondary" size="sm" @click="openPreview" />
            <DhButton v-if="selected" :label="tr(`Historial (${revisions.length})`, `History (${revisions.length})`)" :icon="History" variant="secondary" size="sm" @click="historyOpen = true" />
            <DhBadge :label="statusLabel(selected?.status || 'Draft')" :variant="statusVariant(selected?.status || 'Draft')" />
          </div>
        </div>
      </section>

      <section class="editor-section space-y-4">
        <div>
          <h4 class="font-black">{{ tr('Información principal', 'Main information') }}</h4>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ tr('Escriba lo que las personas verán, sin configurar campos internos.', 'Write what visitors will see without configuring internal fields.') }}</p>
        </div>
        <DhInput v-model="form.title" :label="tr('Título', 'Title')" :placeholder="tr(`Título de ${singular.toLowerCase()}`, `${singular} title`)" />
        <DhTextarea v-model="form.excerpt" :label="tr('Resumen', 'Summary')" :placeholder="tr('Una descripción corta para listados y buscadores.', 'A short description for listings and search engines.')" :rows="3" />
        <DhInput v-model="form.publicPath" :label="tr('Dirección de la página', 'Page address')" placeholder="/servicios/transporte-maritimo" />
        <DhSwitch
          v-if="publicPathChanged"
          v-model="keepOldAddress"
          :label="tr('Mantener funcionando la dirección anterior', 'Keep the old address working')"
          :description="tr('Las personas que usen el enlace anterior serán llevadas a la nueva dirección.', 'Visitors using the old link will be taken to the new address.')"
        />
      </section>

      <section class="editor-section">
        <div class="mb-3">
          <h4 class="font-black">{{ tr('Contenido', 'Content') }}</h4>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ tr('Edite el texto como en un documento normal.', 'Edit the text like a normal document.') }}</p>
        </div>
        <div class="editor-toolbar">
          <DhButton :icon="Bold" variant="ghost" size="sm" :title="tr('Negrita', 'Bold')" @click="editorCommand('bold')" />
          <DhButton :icon="Italic" variant="ghost" size="sm" :title="tr('Cursiva', 'Italic')" @click="editorCommand('italic')" />
          <DhButton :icon="Heading2" variant="ghost" size="sm" :title="tr('Título', 'Heading')" @click="editorCommand('formatBlock', 'H2')" />
          <DhButton :icon="List" variant="ghost" size="sm" :title="tr('Lista', 'List')" @click="editorCommand('insertUnorderedList')" />
          <DhButton :icon="Link" variant="ghost" size="sm" :title="tr('Enlace', 'Link')" @click="openLinkDialog" />
        </div>
        <div
          ref="editorRef"
          class="rich-editor"
          contenteditable="true"
          :data-placeholder="tr('Escriba aquí el contenido…', 'Write the content here…')"
          @input="syncEditor"
        />
      </section>

      <section class="editor-section space-y-4">
        <div class="flex items-center gap-2"><Image class="h-4 w-4 text-[var(--dh-primary)]" /><h4 class="font-black">{{ tr('Imagen principal', 'Main image') }}</h4></div>
        <div class="media-selection">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold">{{ selectedMediaName || tr('Sin imagen seleccionada', 'No image selected') }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ tr('Elija una imagen desde la biblioteca multimedia.', 'Choose an image from the media library.') }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <DhButton :label="tr('Seleccionar imagen', 'Choose image')" variant="secondary" size="sm" @click="mediaPickerOpen = true" />
            <DhButton v-if="form.featuredMediaId" :label="tr('Quitar', 'Remove')" variant="ghost" size="sm" @click="form.featuredMediaId = ''" />
          </div>
        </div>
        <DhSwitch v-model="form.isFeatured" :label="tr('Destacar este contenido', 'Feature this content')" :description="tr('Permite que el sitio lo priorice en espacios destacados.', 'Allows the website to prioritize it in featured areas.')" />
      </section>

      <section class="editor-section space-y-4">
        <div>
          <h4 class="font-black">{{ tr('Cómo aparecerá en Google', 'How it will appear on Google') }}</h4>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ tr('Solo mostramos los campos que Mercadeo necesita normalmente.', 'Only the fields Marketing normally needs are shown.') }}</p>
        </div>
        <DhInput v-model="form.seoTitle" :label="tr('Título para buscadores', 'Search title')" :placeholder="form.title || tr('Título de la página', 'Page title')" :disabled="selected !== null && !canEditSeo" />
        <DhTextarea v-model="form.seoDescription" :label="tr('Descripción para buscadores', 'Search description')" :placeholder="form.excerpt || tr('Descripción corta', 'Short description')" :rows="3" :disabled="selected !== null && !canEditSeo" />
        <div class="search-preview">
          <p class="truncate text-xs text-emerald-700 dark:text-emerald-400">{{ seoPreview.url }}</p>
          <p class="mt-1 text-lg font-semibold text-blue-700 dark:text-blue-400">{{ seoPreview.title }}</p>
          <p class="mt-1 line-clamp-2 text-sm leading-5 text-[var(--dh-text-muted)]">{{ seoPreview.description }}</p>
        </div>
      </section>

      <section v-if="taxonomyOptions.length" class="editor-section">
        <h4 class="font-black">{{ tr('Categorías y etiquetas', 'Categories and tags') }}</h4>
        <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ tr('Clasifique artículos y noticias usando las taxonomías disponibles.', 'Classify articles and news using the available taxonomies.') }}</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div v-for="term in taxonomyOptions" :key="term.id" class="taxonomy-option">
            <DhCheckbox
              :model-value="selectedCategoryIds.includes(term.id)"
              :label="term.name"
              @update:model-value="toggleCategory(term.id, $event)"
            />
            <span class="text-[10px] font-black uppercase tracking-[.12em] text-[var(--dh-text-muted)]">{{ taxonomyKindLabel(term.kind) }}</span>
          </div>
        </div>
      </section>

      <section v-if="canPublish" class="editor-section space-y-3">
        <div>
          <h4 class="font-black">{{ tr('Programar publicación', 'Schedule publication') }}</h4>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ tr('Elija una fecha si no desea publicar inmediatamente.', 'Choose a date if you do not want to publish immediately.') }}</p>
        </div>
        <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <DhInput v-model="scheduleAt" type="datetime-local" />
          <DhButton :label="tr('Programar', 'Schedule')" :icon="CalendarClock" variant="secondary" :disabled="!scheduleAt || saving" @click="schedule" />
        </div>
      </section>

      <section v-if="selected" class="editor-section">
        <h4 class="font-black">{{ tr('Otras acciones', 'Other actions') }}</h4>
        <div class="mt-3 flex flex-wrap gap-2">
          <DhButton v-if="selected.status === 'Published' && canPublish" :label="tr('Retirar publicación', 'Unpublish')" variant="secondary" size="sm" :disabled="saving" @click="confirmAction = 'unpublish'" />
          <DhButton v-if="canEditThisType && selected.status !== 'Archived'" :label="tr('Archivar', 'Archive')" :icon="Archive" variant="secondary" size="sm" :disabled="saving" @click="confirmAction = 'archive'" />
          <DhButton v-if="canDelete" :label="tr('Eliminar', 'Delete')" :icon="Trash2" variant="danger" size="sm" :disabled="saving" @click="confirmAction = 'delete'" />
        </div>
      </section>

      <footer class="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-[var(--dh-border)] bg-[var(--dh-surface)]/95 py-3 backdrop-blur-xl">
        <DhButton :label="tr('Cancelar', 'Cancel')" variant="ghost" :disabled="saving" @click="closeEditor" />
        <DhButton :label="tr('Vista previa', 'Preview')" :icon="Eye" variant="secondary" :disabled="saving" @click="openPreview" />
        <DhButton v-if="canSave" :label="tr('Guardar borrador', 'Save draft')" :icon="Save" variant="secondary" :loading="saving" @click="saveDraft" />
        <DhButton
          v-if="canSave && selected?.status !== 'Published'"
          :label="canPublish ? tr('Publicar', 'Publish') : tr('Enviar a aprobación', 'Send for approval')"
          :icon="canPublish ? Rocket : Send"
          :loading="saving"
          @click="saveAndPublish"
        />
      </footer>
    </div>
  </DhDrawer>

  <DhMediaPicker
    v-model="form.featuredMediaId"
    :open="mediaPickerOpen"
    :title="tr('Seleccionar imagen', 'Choose image')"
    :items="mediaPickerItems"
    :search-placeholder="tr('Buscar en multimedia…', 'Search media…')"
    :empty-title="tr('No hay archivos disponibles', 'No files available')"
    :empty-description="tr('Suba imágenes desde Multimedia para seleccionarlas aquí.', 'Upload images from Media to select them here.')"
    :confirm-label="tr('Usar imagen', 'Use image')"
    :cancel-label="tr('Cancelar', 'Cancel')"
    @close="mediaPickerOpen = false"
  />

  <DhModal :open="previewOpen" :title="tr('Vista previa del borrador', 'Draft preview')" size="xl" @close="previewOpen = false">
    <div class="space-y-3">
      <p class="text-xs leading-5 text-[var(--dh-text-muted)]">
        {{ tr('Esta vista previa pertenece al editor y no publica cambios en el sitio.', 'This preview belongs to the editor and does not publish changes to the website.') }}
      </p>
      <MarketingLivePreview :blocks="[]" :page-title="form.title" :fallback-html="form.contentHtml" />
    </div>
  </DhModal>

  <DhModal :open="historyOpen" :title="tr('Historial de revisiones', 'Revision history')" size="lg" @close="historyOpen = false">
    <div v-if="!revisions.length" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm text-[var(--dh-text-muted)]">
      {{ tr('Todavía no hay revisiones guardadas.', 'There are no saved revisions yet.') }}
    </div>
    <div v-else class="space-y-3">
      <article v-for="revision in revisions" :key="revision.id" class="revision-card">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <strong>{{ tr('Revisión', 'Revision') }} #{{ revision.revisionNumber }}</strong>
            <DhBadge :label="revision.reason || tr('Cambio editorial', 'Editorial change')" variant="neutral" />
          </div>
          <p class="mt-1 truncate text-sm font-semibold">{{ revision.title }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">/{{ revision.slug }} · {{ formatDateTime(revision.createdAtUtc) }}</p>
        </div>
        <DhButton
          v-if="canEditThisType"
          :label="tr('Restaurar', 'Restore')"
          :icon="RotateCcw"
          variant="secondary"
          size="sm"
          :loading="restoringRevisionId === revision.id"
          :disabled="Boolean(restoringRevisionId)"
          @click="restoreRevision(revision)"
        />
      </article>
    </div>
  </DhModal>

  <DhModal :open="linkModalOpen" :title="tr('Agregar enlace', 'Add link')" size="sm" @close="linkModalOpen = false">
    <div class="space-y-4">
      <DhInput v-model="linkUrl" :label="tr('Dirección del enlace', 'Link address')" placeholder="https://..." />
      <div class="flex justify-end gap-2">
        <DhButton :label="tr('Cancelar', 'Cancel')" variant="secondary" @click="linkModalOpen = false" />
        <DhButton :label="tr('Agregar enlace', 'Add link')" :disabled="!linkUrl.trim()" @click="applyLink" />
      </div>
    </div>
  </DhModal>

  <DhModal :open="confirmAction !== null" :title="confirmTitle" size="sm" @close="confirmAction = null">
    <DhConfirmDialog
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmAction === 'delete' ? tr('Eliminar', 'Delete') : tr('Confirmar', 'Confirm')"
      :cancel-label="tr('Cancelar', 'Cancel')"
      :danger="confirmAction === 'delete'"
      :on-confirm="performConfirmedAction"
      @cancel="confirmAction = null"
    />
  </DhModal>
</template>

<style scoped>
.content-card{min-width:0;border:1px solid var(--dh-border);border-radius:22px;padding:1rem;background:var(--dh-input);box-shadow:var(--dh-shadow-sm);transition:180ms}.content-card:hover{border-color:color-mix(in srgb,var(--dh-primary) 35%,var(--dh-border));transform:translateY(-1px)}
.content-icon{display:grid;height:40px;width:40px;place-items:center;border-radius:16px;background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}
.editor-section{border:1px solid var(--dh-border);border-radius:22px;padding:1rem;background:var(--dh-input);box-shadow:var(--dh-shadow-sm)}
.editor-toolbar{display:flex;flex-wrap:wrap;gap:.25rem;border:1px solid var(--dh-border);border-bottom:0;border-radius:18px 18px 0 0;padding:.45rem;background:var(--dh-surface)}
.rich-editor{min-height:300px;border:1px solid var(--dh-border);border-radius:0 0 18px 18px;padding:1rem;background:var(--dh-surface);outline:none;line-height:1.75;color:var(--dh-text)}
.rich-editor:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}
.rich-editor:empty:before{content:attr(data-placeholder);color:var(--dh-text-muted);pointer-events:none}
.media-selection{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:1rem;border:1px dashed var(--dh-border);border-radius:18px;padding:1rem;background:var(--dh-surface)}
.search-preview{border:1px solid var(--dh-border);border-radius:18px;padding:1rem;background:var(--dh-surface)}
.taxonomy-option{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:.75rem;border:1px solid var(--dh-border);border-radius:16px;padding:.75rem;background:var(--dh-surface)}
.revision-card{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:1rem;border:1px solid var(--dh-border);border-radius:18px;padding:1rem;background:var(--dh-input)}
@media (max-width:640px){.media-selection,.revision-card{align-items:flex-start;flex-direction:column}}
</style>