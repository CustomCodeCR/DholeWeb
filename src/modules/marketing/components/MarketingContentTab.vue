<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import {
  Archive,
  Bold,
  CalendarClock,
  FileText,
  Heading2,
  Image,
  Italic,
  Link,
  List,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Search,
  Send,
  Trash2,
} from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type {
  ContentItemDto,
  ContentItemListDto,
  ContentType,
  EditorContentRequest,
  MediaDto,
  TaxonomyTermDto,
} from '@/core/interfaces/content'

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

const loading = ref(false)
const saving = ref(false)
const items = ref<ContentItemListDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const search = ref('')
const statusFilter = ref('')
const editorOpen = ref(false)
const selected = ref<ContentItemDto | null>(null)
const editorRef = ref<HTMLElement | null>(null)
const media = ref<MediaDto[]>([])
const taxonomies = ref<TaxonomyTermDto[]>([])
const selectedCategoryIds = ref<string[]>([])
const scheduleAt = ref('')

const statuses = [
  { value: '', label: 'Todos los estados' },
  { value: 'Draft', label: 'Borrador' },
  { value: 'PendingReview', label: 'Pendiente de aprobación' },
  { value: 'Scheduled', label: 'Programado' },
  { value: 'Published', label: 'Publicado' },
  { value: 'Archived', label: 'Archivado' },
]

const form = reactive({
  title: '',
  slug: '',
  excerpt: '',
  contentHtml: '',
  featuredMediaId: '',
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  seoCanonicalUrl: '',
  seoOpenGraphMediaId: '',
})

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
const categories = computed(() => taxonomies.value.filter((item) => item.kind.toLowerCase() === 'category'))
const tags = computed(() => taxonomies.value.filter((item) => item.kind.toLowerCase() === 'tag'))

function statusLabel(status: string) {
  return statuses.find((item) => item.value === status)?.label ?? status
}

function statusClass(status: string) {
  if (status === 'Published') return 'bg-emerald-500/10 text-emerald-600'
  if (status === 'PendingReview') return 'bg-amber-500/10 text-amber-600'
  if (status === 'Scheduled') return 'bg-sky-500/10 text-sky-600'
  if (status === 'Archived') return 'bg-slate-500/10 text-slate-500'
  return 'bg-black/5 dark:bg-white/10'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function resetForm() {
  selected.value = null
  selectedCategoryIds.value = []
  scheduleAt.value = ''
  Object.assign(form, {
    title: '',
    slug: '',
    excerpt: '',
    contentHtml: '',
    featuredMediaId: '',
    isFeatured: false,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    seoCanonicalUrl: '',
    seoOpenGraphMediaId: '',
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
    toastStore.backendError(error, `No se pudieron cargar ${props.title.toLowerCase()}.`)
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
    toastStore.backendWarning(error, 'No se pudo cargar la biblioteca auxiliar de Mercadeo.')
  }
}

async function openItem(item: ContentItemListDto) {
  try {
    const detail = await ContentService.getEditorContent(item.id)
    selected.value = detail
    Object.assign(form, {
      title: detail.title,
      slug: detail.slug ?? '',
      excerpt: detail.excerpt ?? '',
      contentHtml: detail.renderedHtml ?? '',
      featuredMediaId: detail.featuredMediaId ?? '',
      isFeatured: detail.isFeatured,
      seoTitle: detail.seo?.title ?? '',
      seoDescription: detail.seo?.description ?? '',
      seoKeywords: detail.seo?.keywords ?? '',
      seoCanonicalUrl: detail.seo?.canonicalUrl ?? '',
      seoOpenGraphMediaId: detail.seo?.openGraphMediaId ?? '',
    })
    selectedCategoryIds.value = (detail as ContentItemDto & { taxonomyTermIds?: string[] }).taxonomyTermIds ?? []
    scheduleAt.value = detail.scheduledAtUtc
      ? new Date(detail.scheduledAtUtc).toISOString().slice(0, 16)
      : ''
    editorOpen.value = true
    await placeEditorHtml()
  } catch (error) {
    toastStore.backendError(error, `No se pudo abrir ${props.singular.toLowerCase()}.`)
  }
}

function syncEditor() {
  form.contentHtml = editorRef.value?.innerHTML ?? ''
}

function editorCommand(command: string, value?: string) {
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  syncEditor()
}

function addLink() {
  const url = window.prompt('Pegue la dirección del enlace:')?.trim()
  if (!url) return
  editorCommand('createLink', url)
}

function seoPayload() {
  if (selected.value && !canEditSeo.value) return null
  return {
    title: form.seoTitle.trim() || null,
    description: form.seoDescription.trim() || null,
    keywords: form.seoKeywords.trim() || null,
    canonicalUrl: form.seoCanonicalUrl.trim() || null,
    openGraphMediaId: form.seoOpenGraphMediaId || null,
  }
}

function buildPayload(): EditorContentRequest {
  syncEditor()
  return {
    type: props.contentType,
    title: form.title.trim(),
    contentHtml: form.contentHtml.trim() || null,
    slug: form.slug.trim() || null,
    excerpt: form.excerpt.trim() || null,
    featuredMediaId: form.featuredMediaId || null,
    locale: 'es-CR',
    sortOrder: 0,
    isFeatured: form.isFeatured,
    categoryIds: selectedCategoryIds.value,
    seo: seoPayload(),
    siteKey: props.siteKey || 'main',
  }
}

async function persist(): Promise<string | null> {
  if (!canSave.value || !form.title.trim()) {
    toastStore.warning('Falta el título', `Escriba un título para ${props.singular.toLowerCase()}.`)
    return null
  }

  const payload = buildPayload()
  if (selected.value) {
    await ContentService.updateEditorContent(selected.value.id, payload)
    return selected.value.id
  }
  return await ContentService.createEditorContent(payload)
}

async function saveDraft() {
  if (saving.value) return
  saving.value = true
  try {
    const id = await persist()
    if (!id) return
    toastStore.success(selected.value ? 'Cambios guardados' : `${props.singular} guardada como borrador`)
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, `No se pudo guardar ${props.singular.toLowerCase()}.`)
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
      toastStore.success(`${props.singular} publicada`)
    } else {
      await ContentService.submitEditor(id)
      toastStore.success(`${props.singular} enviada a aprobación`)
    }
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo completar la publicación.')
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
    toastStore.success('Publicación programada')
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo programar la publicación.')
  } finally {
    saving.value = false
  }
}

async function applyAction(action: 'unpublish' | 'archive' | 'delete') {
  if (!selected.value || saving.value) return
  if (action === 'delete' && !window.confirm(`¿Eliminar “${selected.value.title}”?`)) return
  if (action === 'archive' && !window.confirm(`¿Archivar “${selected.value.title}”?`)) return

  saving.value = true
  try {
    if (action === 'unpublish') await ContentService.unpublishEditor(selected.value.id)
    if (action === 'archive') await ContentService.archiveEditor(selected.value.id)
    if (action === 'delete') await ContentService.deleteEditorContent(selected.value.id)
    toastStore.success(action === 'delete' ? 'Contenido eliminado' : 'Estado actualizado')
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aplicar la acción.')
  } finally {
    saving.value = false
  }
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
  <div class="space-y-5">
    <section class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-black">{{ title }}</h2>
          <p class="mt-1 text-sm opacity-60">{{ total }} {{ total === 1 ? 'elemento' : 'elementos' }}</p>
        </div>
        <button v-if="canCreate" class="primary-action" @click="newContent">
          <Plus class="h-4 w-4" /> Nueva {{ singular.toLowerCase() }}
        </button>
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
        <label class="relative">
          <Search class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 opacity-45" />
          <input
            v-model="search"
            class="field w-full pl-10"
            :placeholder="`Buscar ${singular.toLowerCase()}…`"
            @keyup.enter="load"
          />
        </label>
        <select v-model="statusFilter" class="field" @change="load">
          <option v-for="status in statuses" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
        <button class="secondary-action" @click="load">
          <RefreshCw class="h-4 w-4" /> Actualizar
        </button>
      </div>

      <div class="mt-5 overflow-hidden rounded-2xl border border-[var(--dh-border)]">
        <div v-if="loading" class="p-10 text-center text-sm opacity-60">Cargando…</div>
        <button
          v-for="item in items"
          v-else
          :key="item.id"
          class="grid w-full gap-2 border-b border-[var(--dh-border)] p-4 text-left transition last:border-b-0 hover:bg-black/[.03] md:grid-cols-[minmax(0,1fr)_170px_180px] md:items-center dark:hover:bg-white/[.04]"
          @click="openItem(item)"
        >
          <div class="min-w-0">
            <p class="truncate font-bold">{{ item.title }}</p>
            <p class="mt-1 truncate text-xs opacity-50">/{{ item.slug }}</p>
          </div>
          <div>
            <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-black" :class="statusClass(item.status)">
              {{ statusLabel(item.status) }}
            </span>
          </div>
          <span class="text-xs opacity-50">{{ formatDate(item.updatedAtUtc || item.createdAtUtc) }}</span>
        </button>
        <div v-if="!loading && !items.length" class="p-10 text-center text-sm opacity-60">
          No hay {{ title.toLowerCase() }} todavía.
        </div>
      </div>

      <div class="mt-4 flex items-center justify-between">
        <button class="secondary-action" :disabled="page <= 1" @click="page--; load()">Anterior</button>
        <span class="text-xs opacity-60">Página {{ page }}</span>
        <button class="secondary-action" :disabled="page * pageSize >= total" @click="page++; load()">Siguiente</button>
      </div>
    </section>

    <section v-if="editorOpen" class="dh-glass dh-liquid rounded-[30px] p-5">
      <div class="flex flex-col gap-4 border-b border-[var(--dh-border)] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">
            {{ selected ? 'Editar' : 'Agregar nueva' }}
          </p>
          <h2 class="mt-1 text-2xl font-black">{{ selected?.title || singular }}</h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="secondary-action" @click="closeEditor">Cancelar</button>
          <button v-if="canSave" class="secondary-action" :disabled="saving" @click="saveDraft">
            <Save class="h-4 w-4" /> Guardar
          </button>
          <button
            v-if="canSave && selected?.status !== 'Published'"
            class="primary-action"
            :disabled="saving"
            @click="saveAndPublish"
          >
            <Rocket v-if="canPublish" class="h-4 w-4" />
            <Send v-else class="h-4 w-4" />
            {{ canPublish ? 'Publicar' : 'Enviar a aprobación' }}
          </button>
        </div>
      </div>

      <div class="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="space-y-5">
          <input
            v-model="form.title"
            class="title-field w-full"
            :placeholder="`Título de ${singular.toLowerCase()}`"
          />

          <div>
            <div class="editor-toolbar">
              <button type="button" title="Negrita" @click="editorCommand('bold')"><Bold class="h-4 w-4" /></button>
              <button type="button" title="Cursiva" @click="editorCommand('italic')"><Italic class="h-4 w-4" /></button>
              <button type="button" title="Título" @click="editorCommand('formatBlock', 'H2')"><Heading2 class="h-4 w-4" /></button>
              <button type="button" title="Lista" @click="editorCommand('insertUnorderedList')"><List class="h-4 w-4" /></button>
              <button type="button" title="Enlace" @click="addLink"><Link class="h-4 w-4" /></button>
            </div>
            <div
              ref="editorRef"
              class="rich-editor"
              contenteditable="true"
              data-placeholder="Escriba aquí el contenido…"
              @input="syncEditor"
            />
          </div>

          <label class="label">
            Resumen <span class="font-normal opacity-45">(opcional)</span>
            <textarea
              v-model="form.excerpt"
              class="field mt-2 min-h-24 w-full"
              placeholder="Una descripción corta para listados y resultados de búsqueda."
            />
          </label>

          <details class="rounded-2xl border border-[var(--dh-border)] p-4">
            <summary class="cursor-pointer font-black">SEO avanzado</summary>
            <div class="mt-4 grid gap-3" :class="{ 'pointer-events-none opacity-50': selected && !canEditSeo }">
              <input v-model="form.seoTitle" class="field" placeholder="Título para Google" />
              <textarea v-model="form.seoDescription" class="field min-h-24" placeholder="Descripción para buscadores" />
              <input v-model="form.seoKeywords" class="field" placeholder="Palabras clave" />
              <input v-model="form.seoCanonicalUrl" class="field" placeholder="URL canónica (opcional)" />
              <select v-model="form.seoOpenGraphMediaId" class="field">
                <option value="">Usar imagen destacada al compartir</option>
                <option v-for="entry in media" :key="entry.id" :value="entry.id">{{ entry.fileName }}</option>
              </select>
            </div>
          </details>
        </div>

        <aside class="space-y-4">
          <div class="editor-card">
            <h3 class="font-black">Publicación</h3>
            <p class="mt-2 text-sm opacity-60">
              Estado: <strong>{{ statusLabel(selected?.status || 'Draft') }}</strong>
            </p>
            <label class="label mt-4">
              Dirección
              <div class="mt-2 flex items-center rounded-xl border border-[var(--dh-border)] px-3">
                <span class="text-sm opacity-40">/</span>
                <input v-model="form.slug" class="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm outline-none" placeholder="se-genera-del-titulo" />
              </div>
            </label>
            <label v-if="canPublish" class="label mt-4">
              Programar
              <div class="mt-2 flex gap-2">
                <input v-model="scheduleAt" class="field min-w-0 flex-1" type="datetime-local" />
                <button class="icon-action" :disabled="!scheduleAt || saving" title="Programar" @click="schedule">
                  <CalendarClock class="h-4 w-4" />
                </button>
              </div>
            </label>
          </div>

          <div class="editor-card">
            <div class="flex items-center gap-2"><Image class="h-4 w-4" /><h3 class="font-black">Imagen destacada</h3></div>
            <select v-model="form.featuredMediaId" class="field mt-3 w-full">
              <option value="">Sin imagen</option>
              <option v-for="entry in media" :key="entry.id" :value="entry.id">{{ entry.fileName }}</option>
            </select>
            <p class="mt-2 text-xs opacity-50">Suba imágenes desde Multimedia y selecciónelas aquí.</p>
          </div>

          <div v-if="categories.length || tags.length" class="editor-card">
            <h3 class="font-black">Categorías y etiquetas</h3>
            <div class="mt-3 flex max-h-48 flex-wrap gap-2 overflow-auto">
              <label
                v-for="term in taxonomies"
                :key="term.id"
                class="taxonomy-pill"
                :class="{ 'taxonomy-pill-active': selectedCategoryIds.includes(term.id) }"
              >
                <input v-model="selectedCategoryIds" class="sr-only" type="checkbox" :value="term.id" />
                {{ term.name }}
              </label>
            </div>
          </div>

          <div class="editor-card">
            <label class="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold">
              Destacar contenido
              <input v-model="form.isFeatured" type="checkbox" />
            </label>
          </div>

          <div v-if="selected" class="editor-card space-y-2">
            <button
              v-if="selected.status === 'Published' && canPublish"
              class="secondary-action w-full"
              :disabled="saving"
              @click="applyAction('unpublish')"
            >
              Retirar publicación
            </button>
            <button
              v-if="canEditThisType && selected.status !== 'Archived'"
              class="secondary-action w-full"
              :disabled="saving"
              @click="applyAction('archive')"
            >
              <Archive class="h-4 w-4" /> Archivar
            </button>
            <button
              v-if="canDelete"
              class="danger-action w-full"
              :disabled="saving"
              @click="applyAction('delete')"
            >
              <Trash2 class="h-4 w-4" /> Eliminar
            </button>
          </div>
        </aside>
      </div>
    </section>

    <section v-else class="dh-glass dh-liquid rounded-[30px] p-8 text-center">
      <FileText class="mx-auto h-9 w-9 opacity-35" />
      <p class="mt-3 font-black">Seleccione una {{ singular.toLowerCase() }} para editarla</p>
      <p class="mt-1 text-sm opacity-55">O use “Nueva {{ singular.toLowerCase() }}” para agregar contenido.</p>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:12px;background:color-mix(in srgb,var(--dh-surface) 88%,transparent);padding:.7rem .8rem;color:inherit;outline:none}.field:focus,.title-field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.field:disabled{opacity:.5}.title-field{border:1px solid var(--dh-border);border-radius:16px;background:color-mix(in srgb,var(--dh-surface) 90%,transparent);padding:1rem 1.1rem;font-size:1.45rem;font-weight:800;color:inherit;outline:none}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action,.danger-action,.icon-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:12px;padding:.68rem .9rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:#fff}.secondary-action:hover:not(:disabled),.icon-action:hover:not(:disabled){background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.danger-action{color:#dc2626}.danger-action:hover:not(:disabled){background:rgb(239 68 68 / .1)}.primary-action:disabled,.secondary-action:disabled,.danger-action:disabled,.icon-action:disabled{opacity:.4}.editor-toolbar{display:flex;flex-wrap:wrap;gap:.35rem;border:1px solid var(--dh-border);border-bottom:0;border-radius:16px 16px 0 0;padding:.55rem;background:color-mix(in srgb,var(--dh-surface) 94%,transparent)}.editor-toolbar button{display:grid;height:34px;width:34px;place-items:center;border-radius:9px;transition:160ms}.editor-toolbar button:hover{background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}.rich-editor{min-height:330px;border:1px solid var(--dh-border);border-radius:0 0 16px 16px;padding:1.1rem;background:color-mix(in srgb,var(--dh-surface) 90%,transparent);outline:none;line-height:1.7}.rich-editor:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 12%,transparent)}.rich-editor:empty:before{content:attr(data-placeholder);opacity:.4;pointer-events:none}.editor-card{border:1px solid var(--dh-border);border-radius:16px;padding:1rem;background:color-mix(in srgb,var(--dh-surface) 82%,transparent)}.taxonomy-pill{cursor:pointer;border:1px solid var(--dh-border);border-radius:999px;padding:.4rem .65rem;font-size:.75rem;font-weight:700;transition:160ms}.taxonomy-pill-active{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}
</style>
