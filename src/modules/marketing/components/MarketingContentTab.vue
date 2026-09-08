<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Archive, FileText, Plus, RefreshCw, Rocket, Save, Search, Trash2 } from 'lucide-vue-next'
import { CONTENT_SCOPES } from '@/core/auth/scopes'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { ContentService } from '@/core/services/contentService'
import type {
  ContentItemDto,
  ContentItemListDto,
  ContentRevisionDto,
  ContentType,
  MediaDto,
  TaxonomyTermDto,
} from '@/core/interfaces/content'

const props = defineProps<{ siteKey: string }>()
const authStore = useAuthStore()
const toastStore = useToastStore()

const contentTypes: ContentType[] = ['Page', 'News', 'Post', 'Announcement', 'Banner', 'Video', 'ReusableBlock']
const statuses = ['Draft', 'PendingReview', 'Scheduled', 'Published', 'Archived']

const loading = ref(false)
const items = ref<ContentItemListDto[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 25
const search = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const localeFilter = ref('')
const editorOpen = ref(false)
const selected = ref<ContentItemDto | null>(null)
const revisions = ref<ContentRevisionDto[]>([])
const media = ref<MediaDto[]>([])
const taxonomies = ref<TaxonomyTermDto[]>([])
const taxonomyTermIds = ref<string[]>([])
const scheduleAt = ref('')

const form = reactive({
  type: 'Page' as ContentType,
  title: '',
  slug: '',
  excerpt: '',
  blocksJson: '[]',
  renderedHtml: '',
  featuredMediaId: '',
  locale: 'es-CR',
  sortOrder: 0,
  isFeatured: false,
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  seoCanonicalUrl: '',
  seoRobots: 'index,follow',
  seoOpenGraphMediaId: '',
  seoStructuredDataJson: '',
})

const canCreate = computed(() => authStore.hasScope(CONTENT_SCOPES.create))
const canEdit = computed(() => authStore.hasScope(CONTENT_SCOPES.edit))
const canDelete = computed(() => authStore.hasScope(CONTENT_SCOPES.delete))
const canPublish = computed(() => authStore.hasScope(CONTENT_SCOPES.publish))
const canEditSeo = computed(() => authStore.hasScope(CONTENT_SCOPES.seo.edit))

function canEditType(type: string) {
  if (!canEdit.value) return false
  if (type === 'Page') return authStore.hasScope(CONTENT_SCOPES.pages.edit)
  if (type === 'Banner') return authStore.hasScope(CONTENT_SCOPES.banners.edit)
  if (['News', 'Post', 'Announcement'].includes(type)) return authStore.hasScope(CONTENT_SCOPES.news.edit)
  return true
}

const canSave = computed(() => selected.value ? canEditType(form.type) : canCreate.value)

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

function validJson(value: string, label: string) {
  if (!value.trim()) return true
  try {
    JSON.parse(value)
    return true
  } catch {
    toastStore.warning('JSON inválido', `${label} debe contener JSON válido.`)
    return false
  }
}

function resetForm() {
  selected.value = null
  revisions.value = []
  taxonomyTermIds.value = []
  scheduleAt.value = ''
  Object.assign(form, {
    type: 'Page', title: '', slug: '', excerpt: '', blocksJson: '[]', renderedHtml: '',
    featuredMediaId: '', locale: 'es-CR', sortOrder: 0, isFeatured: false,
    seoTitle: '', seoDescription: '', seoKeywords: '', seoCanonicalUrl: '',
    seoRobots: 'index,follow', seoOpenGraphMediaId: '', seoStructuredDataJson: '',
  })
}

function newContent() {
  if (!canCreate.value) return
  resetForm()
  editorOpen.value = true
}

async function load() {
  loading.value = true
  try {
    const response = await ContentService.browseContent({
      pageNumber: page.value,
      pageSize,
      siteKey: props.siteKey || 'main',
      search: search.value || undefined,
      type: typeFilter.value || undefined,
      status: statusFilter.value || undefined,
      locale: localeFilter.value || undefined,
    })
    items.value = response.items
    total.value = response.totalCount ?? response.items.length
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el contenido.')
  } finally {
    loading.value = false
  }
}

async function loadAuxiliary() {
  try {
    const [mediaResponse, taxonomyResponse] = await Promise.all([
      ContentService.browseMedia({ pageNumber: 1, pageSize: 100 }),
      ContentService.browseTaxonomies({ pageNumber: 1, pageSize: 200, siteKey: props.siteKey || 'main' }),
    ])
    media.value = mediaResponse.items
    taxonomies.value = taxonomyResponse.items
  } catch (error) {
    toastStore.backendWarning(error, 'No se pudieron cargar medios o taxonomías auxiliares.')
  }
}

async function openItem(item: ContentItemListDto) {
  try {
    const detail = await ContentService.getContent(item.id)
    selected.value = detail
    Object.assign(form, {
      type: detail.type as ContentType,
      title: detail.title,
      slug: detail.slug,
      excerpt: detail.excerpt ?? '',
      blocksJson: detail.blocksJson || '[]',
      renderedHtml: detail.renderedHtml ?? '',
      featuredMediaId: detail.featuredMediaId ?? '',
      locale: detail.locale || 'es-CR',
      sortOrder: detail.sortOrder ?? 0,
      isFeatured: detail.isFeatured,
      seoTitle: detail.seo?.title ?? '',
      seoDescription: detail.seo?.description ?? '',
      seoKeywords: detail.seo?.keywords ?? '',
      seoCanonicalUrl: detail.seo?.canonicalUrl ?? '',
      seoRobots: detail.seo?.robots ?? 'index,follow',
      seoOpenGraphMediaId: detail.seo?.openGraphMediaId ?? '',
      seoStructuredDataJson: detail.seo?.structuredDataJson ?? '',
    })
    scheduleAt.value = detail.scheduledAtUtc ? new Date(detail.scheduledAtUtc).toISOString().slice(0, 16) : ''
    editorOpen.value = true
    revisions.value = await ContentService.getRevisions(item.id)
  } catch (error) {
    toastStore.backendError(error, 'No se pudo abrir el contenido.')
  }
}

function seoPayload() {
  if (selected.value && !canEditSeo.value) return null
  return {
    title: form.seoTitle || null,
    description: form.seoDescription || null,
    keywords: form.seoKeywords || null,
    canonicalUrl: form.seoCanonicalUrl || null,
    robots: form.seoRobots || null,
    openGraphMediaId: form.seoOpenGraphMediaId || null,
    structuredDataJson: form.seoStructuredDataJson || null,
  }
}

async function save() {
  if (!canSave.value || !form.title.trim()) {
    toastStore.warning('Datos incompletos', 'El título es obligatorio y debe contar con permisos de edición.')
    return
  }
  if (!validJson(form.blocksJson, 'Bloques JSON') || !validJson(form.seoStructuredDataJson, 'Structured data')) return

  const payload = {
    title: form.title.trim(),
    slug: form.slug.trim() || null,
    excerpt: form.excerpt.trim() || null,
    blocksJson: form.blocksJson.trim() || '[]',
    renderedHtml: form.renderedHtml.trim() || null,
    featuredMediaId: form.featuredMediaId || null,
    locale: form.locale.trim() || 'es-CR',
    sortOrder: Number(form.sortOrder) || 0,
    isFeatured: form.isFeatured,
    seo: seoPayload(),
  }

  try {
    if (selected.value) {
      // The detail DTO does not expose taxonomyTermIds; null prevents accidental relationship loss.
      await ContentService.updateContent(selected.value.id, { ...payload, taxonomyTermIds: null })
      toastStore.success('Contenido actualizado')
    } else {
      await ContentService.createContent({
        ...payload,
        type: form.type,
        taxonomyTermIds: taxonomyTermIds.value.length ? taxonomyTermIds.value : null,
        authorUserId: null,
        siteKey: props.siteKey || 'main',
      })
      toastStore.success('Contenido creado')
    }
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el contenido.')
  }
}

async function applyAction(action: 'review' | 'publish' | 'unpublish' | 'archive' | 'delete') {
  if (!selected.value) return
  if (action === 'delete' && !window.confirm(`¿Eliminar definitivamente “${selected.value.title}”?`)) return

  try {
    if (action === 'review') await ContentService.submitForReview(selected.value.id)
    if (action === 'publish') await ContentService.publish(selected.value.id)
    if (action === 'unpublish') await ContentService.unpublish(selected.value.id)
    if (action === 'archive') await ContentService.archive(selected.value.id)
    if (action === 'delete') await ContentService.deleteContent(selected.value.id)
    toastStore.success('Estado actualizado')
    editorOpen.value = false
    resetForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo aplicar la acción editorial.')
  }
}

async function schedule() {
  if (!selected.value || !scheduleAt.value || !canPublish.value) return
  try {
    await ContentService.schedule(selected.value.id, new Date(scheduleAt.value).toISOString())
    toastStore.success('Publicación programada')
    editorOpen.value = false
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo programar la publicación.')
  }
}

async function restore(revision: ContentRevisionDto) {
  if (!selected.value || !canEditType(form.type)) return
  if (!window.confirm(`¿Restaurar la revisión #${revision.revisionNumber}?`)) return
  try {
    await ContentService.restoreRevision(selected.value.id, revision.id, 'Restaurada desde Mercadeo')
    toastStore.success('Revisión restaurada')
    await openItem(selected.value)
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo restaurar la revisión.')
  }
}

watch(() => props.siteKey, () => { page.value = 1; void Promise.all([load(), loadAuxiliary()]) })
onMounted(() => void Promise.all([load(), loadAuxiliary()]))
</script>

<template>
  <div class="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(390px,.9fr)]">
    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><p class="text-xs font-black uppercase tracking-[.2em] text-[var(--dh-primary)]">CMS</p><h2 class="text-xl font-black">Contenido</h2><p class="text-sm opacity-60">{{ total }} registros</p></div>
        <button v-if="canCreate" class="primary-action" @click="newContent"><Plus class="h-4 w-4" /> Nuevo contenido</button>
      </div>

      <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="relative xl:col-span-2"><Search class="pointer-events-none absolute left-3 top-3.5 h-4 w-4 opacity-50" /><input v-model="search" class="field w-full pl-10" placeholder="Buscar título o slug" @keyup.enter="load" /></label>
        <select v-model="typeFilter" class="field" @change="load"><option value="">Todos los tipos</option><option v-for="type in contentTypes" :key="type" :value="type">{{ type }}</option></select>
        <select v-model="statusFilter" class="field" @change="load"><option value="">Todos los estados</option><option v-for="status in statuses" :key="status" :value="status">{{ status }}</option></select>
        <input v-model="localeFilter" class="field" placeholder="Locale (ej. es-CR)" @keyup.enter="load" />
        <button class="secondary-action" @click="load"><RefreshCw class="h-4 w-4" /> Actualizar</button>
      </div>

      <div class="mt-5 overflow-hidden rounded-3xl border border-[var(--dh-border)]">
        <div v-if="loading" class="p-10 text-center text-sm opacity-60">Cargando contenido…</div>
        <button v-for="item in items" v-else :key="item.id" class="flex w-full items-start justify-between gap-4 border-b border-[var(--dh-border)] p-4 text-left transition last:border-b-0 hover:bg-black/[.03] dark:hover:bg-white/[.04]" @click="openItem(item)">
          <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><strong class="truncate">{{ item.title }}</strong><span class="rounded-full px-2.5 py-1 text-[10px] font-black" :class="statusClass(item.status)">{{ item.status }}</span><span v-if="item.isFeatured" class="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-600">DESTACADO</span></div><p class="mt-1 truncate text-xs opacity-55">{{ item.type }} · /{{ item.slug }} · {{ item.locale }}</p><p v-if="item.excerpt" class="mt-2 line-clamp-2 text-sm opacity-70">{{ item.excerpt }}</p></div>
          <span class="shrink-0 text-xs opacity-45">{{ formatDate(item.updatedAtUtc || item.createdAtUtc) }}</span>
        </button>
        <div v-if="!loading && !items.length" class="p-10 text-center text-sm opacity-60">No hay contenido para estos filtros.</div>
      </div>

      <div class="mt-4 flex items-center justify-between"><button class="secondary-action" :disabled="page <= 1" @click="page--; load()">Anterior</button><span class="text-xs opacity-60">Página {{ page }}</span><button class="secondary-action" :disabled="page * pageSize >= total" @click="page++; load()">Siguiente</button></div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div v-if="!editorOpen" class="flex min-h-[440px] flex-col items-center justify-center text-center opacity-55"><FileText class="mb-4 h-12 w-12" /><p class="font-black">Seleccione un contenido</p><p class="mt-1 max-w-xs text-sm">Puede crear, editar y gestionar el flujo editorial según sus scopes.</p></div>
      <div v-else class="space-y-4">
        <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-[.2em] text-[var(--dh-primary)]">{{ selected ? 'Editar' : 'Nuevo' }}</p><h2 class="text-xl font-black">{{ form.title || 'Contenido sin título' }}</h2></div><button class="secondary-action" @click="editorOpen = false">Cerrar</button></div>

        <div class="grid gap-3 sm:grid-cols-2"><label class="label">Tipo<select v-model="form.type" class="field w-full" :disabled="Boolean(selected)"><option v-for="type in contentTypes" :key="type" :value="type">{{ type }}</option></select></label><label class="label">Locale<input v-model="form.locale" class="field w-full" /></label></div>
        <label class="label">Título<input v-model="form.title" class="field w-full" /></label>
        <label class="label">Slug<input v-model="form.slug" class="field w-full" placeholder="Opcional; el backend puede generarlo" /></label>
        <label class="label">Extracto<textarea v-model="form.excerpt" class="field min-h-20 w-full" /></label>
        <div class="grid gap-3 sm:grid-cols-2"><label class="label">Imagen destacada<select v-model="form.featuredMediaId" class="field w-full"><option value="">Sin imagen</option><option v-for="entry in media" :key="entry.id" :value="entry.id">{{ entry.fileName }}</option></select></label><label class="label">Orden<input v-model.number="form.sortOrder" class="field w-full" type="number" /></label></div>
        <label class="flex items-center gap-2 text-sm font-bold"><input v-model="form.isFeatured" type="checkbox" /> Contenido destacado</label>
        <label class="label">Bloques JSON<textarea v-model="form.blocksJson" class="field min-h-32 w-full font-mono text-xs" spellcheck="false" /></label>
        <label class="label">HTML renderizado<textarea v-model="form.renderedHtml" class="field min-h-32 w-full font-mono text-xs" spellcheck="false" /></label>

        <div v-if="!selected && taxonomies.length" class="rounded-2xl border border-[var(--dh-border)] p-3"><p class="mb-2 text-sm font-black">Taxonomías iniciales</p><div class="flex max-h-32 flex-wrap gap-2 overflow-auto"><label v-for="term in taxonomies" :key="term.id" class="flex items-center gap-1 rounded-xl bg-black/5 px-2 py-1 text-xs dark:bg-white/5"><input v-model="taxonomyTermIds" type="checkbox" :value="term.id" /> {{ term.kind }} · {{ term.name }}</label></div></div>

        <details class="rounded-2xl border border-[var(--dh-border)] p-4" :open="canEditSeo"><summary class="cursor-pointer font-black">SEO</summary><div class="mt-4 space-y-3" :class="{ 'pointer-events-none opacity-50': selected && !canEditSeo }"><input v-model="form.seoTitle" class="field w-full" placeholder="Título SEO" /><textarea v-model="form.seoDescription" class="field w-full" placeholder="Meta descripción" /><input v-model="form.seoKeywords" class="field w-full" placeholder="Keywords" /><input v-model="form.seoCanonicalUrl" class="field w-full" placeholder="URL canónica" /><input v-model="form.seoRobots" class="field w-full" placeholder="index,follow" /><select v-model="form.seoOpenGraphMediaId" class="field w-full"><option value="">Imagen Open Graph</option><option v-for="entry in media" :key="entry.id" :value="entry.id">{{ entry.fileName }}</option></select><textarea v-model="form.seoStructuredDataJson" class="field min-h-24 w-full font-mono text-xs" placeholder="Structured data JSON" /></div></details>

        <div class="flex flex-wrap gap-2"><button v-if="canSave" class="primary-action" @click="save"><Save class="h-4 w-4" /> Guardar</button><button v-if="selected && canEditType(form.type) && selected.status === 'Draft'" class="secondary-action" @click="applyAction('review')">Enviar a revisión</button><button v-if="selected && canPublish && selected.status !== 'Published'" class="secondary-action" @click="applyAction('publish')"><Rocket class="h-4 w-4" /> Publicar</button><button v-if="selected && canPublish && selected.status === 'Published'" class="secondary-action" @click="applyAction('unpublish')">Despublicar</button><button v-if="selected && canEditType(form.type)" class="secondary-action" @click="applyAction('archive')"><Archive class="h-4 w-4" /> Archivar</button><button v-if="selected && canDelete" class="secondary-action text-red-500" @click="applyAction('delete')"><Trash2 class="h-4 w-4" /> Eliminar</button></div>

        <div v-if="selected && canPublish" class="rounded-2xl border border-[var(--dh-border)] p-3"><p class="mb-2 text-sm font-black">Programar publicación</p><div class="flex gap-2"><input v-model="scheduleAt" class="field flex-1" type="datetime-local" /><button class="secondary-action" :disabled="!scheduleAt" @click="schedule">Programar</button></div></div>

        <details v-if="selected" class="rounded-2xl border border-[var(--dh-border)] p-4"><summary class="cursor-pointer font-black">Revisiones ({{ revisions.length }})</summary><div class="mt-3 space-y-2"><div v-for="revision in revisions" :key="revision.id" class="flex items-center justify-between gap-3 rounded-xl bg-black/[.03] p-3 dark:bg-white/[.04]"><div><p class="text-sm font-bold">#{{ revision.revisionNumber }} · {{ revision.title }}</p><p class="text-xs opacity-50">{{ formatDate(revision.createdAtUtc) }} · {{ revision.reason || 'Sin motivo' }}</p></div><button v-if="canEditType(form.type)" class="secondary-action" @click="restore(revision)">Restaurar</button></div></div></details>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field{border:1px solid var(--dh-border);border-radius:14px;background:color-mix(in srgb,var(--dh-surface) 86%,transparent);padding:.7rem .85rem;color:inherit;outline:none}.field:focus{border-color:var(--dh-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dh-primary) 14%,transparent)}.field:disabled{opacity:.55}.label{display:block;font-size:.8rem;font-weight:800}.primary-action,.secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border-radius:14px;padding:.65rem .85rem;font-size:.8rem;font-weight:800;transition:160ms}.primary-action{background:var(--dh-primary);color:white}.secondary-action:hover:not(:disabled){background:color-mix(in srgb,var(--dh-primary) 9%,transparent)}.primary-action:disabled,.secondary-action:disabled{opacity:.4}
</style>
