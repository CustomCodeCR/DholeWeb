<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { DhBadge, DhButton, DhEmptyState, DhSkeleton } from '@/shared/components/atoms'
import { DhSearchInput } from '@/shared/components/molecules'
import { ContentService } from '@/core/services/contentService'
import { MarketingService } from '@/core/services/marketingService'
import { useToastStore } from '@/core/stores/toastStore'
import { useLocale } from '@/core/stores/locale'
import type { MarketingResourceKind } from '@/core/interfaces/marketing'

interface ResourceRow {
  id: string
  title: string
  subtitle?: string
  status?: string
  detail?: string
  date?: string | null
}

const props = withDefaults(defineProps<{
  kind: MarketingResourceKind
  title: string
  subtitle: string
  siteKey?: string
}>(), {
  siteKey: 'main',
})

const toastStore = useToastStore()
const localeStore = useLocale()
const loading = ref(false)
const rows = ref<ResourceRow[]>([])
const search = ref('')
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const visibleRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return rows.value
  return rows.value.filter((row) =>
    `${row.title} ${row.subtitle ?? ''} ${row.status ?? ''} ${row.detail ?? ''}`.toLowerCase().includes(term),
  )
})

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(localeStore.locale === 'en' ? 'en-US' : 'es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusLabel(status?: string) {
  const value = (status ?? '').toLowerCase()
  const labels: Record<string, [string, string]> = {
    active: ['Activo', 'Active'],
    inactive: ['Inactivo', 'Inactive'],
    draft: ['Borrador', 'Draft'],
    pendingreview: ['Pendiente', 'Pending'],
    pendingconfirmation: ['Por confirmar', 'Pending confirmation'],
    requested: ['Solicitada', 'Requested'],
    confirmed: ['Confirmada', 'Confirmed'],
    scheduled: ['Programado', 'Scheduled'],
    published: ['Publicado', 'Published'],
    archived: ['Archivado', 'Archived'],
    rejected: ['Rechazado', 'Rejected'],
    cancelled: ['Cancelado', 'Cancelled'],
    completed: ['Completado', 'Completed'],
  }
  const label = labels[value]
  return label ? tr(label[0], label[1]) : status
}

function statusVariant(status?: string): 'primary' | 'success' | 'warning' | 'danger' | 'neutral' {
  const value = (status ?? '').toLowerCase()
  if (['published', 'active', 'confirmed', 'completed'].includes(value)) return 'success'
  if (['pendingreview', 'pendingconfirmation', 'scheduled', 'requested'].includes(value)) return 'warning'
  if (['rejected', 'cancelled'].includes(value)) return 'danger'
  if (['archived', 'inactive'].includes(value)) return 'neutral'
  return 'primary'
}

function contentTypeLabel(type: string) {
  const labels: Record<string, [string, string]> = {
    Page: ['Página', 'Page'],
    News: ['Noticia', 'News'],
    Post: ['Publicación', 'Post'],
    Video: ['Video', 'Video'],
    Banner: ['Banner', 'Banner'],
    ReusableBlock: ['Sección reutilizable', 'Reusable section'],
  }
  const value = labels[type]
  return value ? tr(value[0], value[1]) : tr('Contenido', 'Content')
}

function meetingModeLabel(mode?: string | null) {
  if (!mode) return tr('Reunión', 'Meeting')
  const normalized = mode.toLowerCase()
  if (normalized.includes('virtual') || normalized.includes('online')) return tr('Virtual', 'Virtual')
  if (normalized.includes('presential') || normalized.includes('inperson') || normalized.includes('office')) return tr('Presencial', 'In person')
  return tr('Reunión', 'Meeting')
}

async function loadContentStatus(status: string) {
  const response = await ContentService.browseEditor({ pageNumber: 1, pageSize: 250, siteKey: props.siteKey, status })
  return response.items.map<ResourceRow>((item) => ({
    id: item.id,
    title: item.title,
    subtitle: contentTypeLabel(String(item.type)),
    status: item.status,
    detail: item.excerpt || undefined,
    date: item.publishedAtUtc ?? item.updatedAtUtc ?? item.createdAtUtc,
  }))
}

async function load() {
  loading.value = true
  try {
    if (props.kind === 'placements') {
      rows.value = (await MarketingService.getPlacements(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: tr('Ubicación disponible para contenido', 'Available content placement'),
        status: item.isActive ? 'Active' : 'Inactive',
        detail: tr(`Hasta ${item.maxItems} elementos`, `Up to ${item.maxItems} items`),
        date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'collections') {
      rows.value = (await MarketingService.getCollections(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: tr('Colección reutilizable', 'Reusable collection'),
        status: item.isActive ? 'Active' : 'Inactive',
        date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'redirects') {
      rows.value = (await MarketingService.getRedirects(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.sourcePath,
        subtitle: `${tr('Ahora lleva a', 'Now goes to')} ${item.targetUrl}`,
        status: item.isActive ? 'Active' : 'Inactive',
        detail: item.statusCode === 301 ? tr('Cambio permanente', 'Permanent change') : tr('Cambio temporal', 'Temporary change'),
        date: item.validFromUtc ?? item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'forms') {
      rows.value = (await MarketingService.getForms(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.purpose || tr('Formulario del sitio', 'Website form'),
        status: item.status,
        date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'submissions') {
      rows.value = (await MarketingService.getSubmissions()).map((item) => ({
        id: item.id,
        title: tr('Respuesta recibida', 'Received response'),
        subtitle: item.sourceUrl || tr('Formulario del sitio', 'Website form'),
        status: item.status,
        detail: item.utmCampaign ? `${tr('Campaña', 'Campaign')}: ${item.utmCampaign}` : undefined,
        date: item.submittedAtUtc,
      }))
    } else if (props.kind === 'leads') {
      rows.value = (await MarketingService.getLeads(props.siteKey)).map((item) => ({
        id: item.id,
        title: [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email || item.phone || tr('Contacto sin nombre', 'Unnamed contact'),
        subtitle: item.company || item.email || item.phone || undefined,
        status: item.status,
        detail: [item.source, item.country].filter(Boolean).join(' · ') || undefined,
        date: item.lastTouchAtUtc,
      }))
    } else if (props.kind === 'meeting-types') {
      rows.value = (await MarketingService.getMeetingTypes(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: `${meetingModeLabel(item.meetingMode)} · ${item.durationMinutes} min`,
        status: item.isActive ? 'Active' : 'Inactive',
        date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'meeting-requests' || props.kind === 'meeting-agenda') {
      rows.value = (await MarketingService.getMeetingRequests()).map((item) => ({
        id: item.id,
        title: item.subject,
        subtitle: tr('Solicitud de reunión', 'Meeting request'),
        status: item.status,
        detail: item.timeZone || undefined,
        date: item.confirmedStartUtc ?? item.requestedStartUtc,
      })).sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
    } else if (props.kind === 'campaigns') {
      rows.value = (await MarketingService.getCampaigns(props.siteKey)).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.goalType || tr('Campaña de Mercadeo', 'Marketing campaign'),
        status: item.status,
        date: item.startsAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'sites') {
      rows.value = (await MarketingService.getSites()).map((item) => ({
        id: item.id,
        title: item.name,
        subtitle: item.primaryDomain,
        status: item.status,
        detail: `${item.defaultLocale} · ${item.timeZone}`,
        date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'content-pending') {
      rows.value = await loadContentStatus('PendingReview')
    } else if (props.kind === 'content-scheduled' || props.kind === 'content-calendar') {
      rows.value = await loadContentStatus('Scheduled')
    } else if (props.kind === 'content-history') {
      const [published, archived] = await Promise.all([loadContentStatus('Published'), loadContentStatus('Archived')])
      rows.value = [...published, ...archived].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
    }
  } catch (error) {
    rows.value = []
    toastStore.backendError(error, tr(`No se pudo cargar ${props.title.toLowerCase()}.`, `Could not load ${props.title.toLowerCase()}.`))
  } finally {
    loading.value = false
  }
}

watch(() => props.kind, () => void load())
onMounted(() => void load())
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[28px] p-5 sm:p-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div class="min-w-0">
        <h3 class="text-xl font-black">{{ title }}</h3>
        <p class="mt-1 max-w-3xl text-sm leading-6 text-[var(--dh-text-muted)]">{{ subtitle }}</p>
      </div>
      <DhButton :label="tr('Actualizar', 'Refresh')" :icon="RefreshCw" variant="secondary" size="sm" :loading="loading" @click="load" />
    </div>

    <div class="mt-5 flex min-w-0 items-center gap-3">
      <DhSearchInput v-model="search" class="min-w-0 flex-1" :placeholder="tr('Buscar…', 'Search…')" />
      <span class="shrink-0 text-xs font-black text-[var(--dh-text-muted)]">{{ visibleRows.length }}</span>
    </div>

    <div v-if="loading" class="mt-5 grid gap-3 md:grid-cols-2">
      <DhSkeleton v-for="index in 6" :key="index" height="7.5rem" rounded="lg" />
    </div>

    <DhEmptyState
      v-else-if="visibleRows.length === 0"
      class="mt-5"
      :title="tr('Todavía no hay información', 'Nothing here yet')"
      :description="tr('Cuando existan registros aparecerán aquí de forma simple.', 'When records are available they will appear here in a simple format.')"
    />

    <div v-else class="mt-5 grid gap-3 xl:grid-cols-2">
      <article v-for="row in visibleRows" :key="row.id" class="resource-card">
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 flex-wrap items-center gap-2">
            <strong class="min-w-0 truncate text-sm">{{ row.title }}</strong>
            <DhBadge v-if="row.status" :label="statusLabel(row.status)" :variant="statusVariant(row.status)" />
          </div>
          <p v-if="row.subtitle" class="mt-1 break-words text-sm text-[var(--dh-text-muted)]">{{ row.subtitle }}</p>
          <p v-if="row.detail" class="mt-2 line-clamp-2 text-xs leading-5 text-[var(--dh-text-muted)]">{{ row.detail }}</p>
        </div>
        <time v-if="row.date" class="shrink-0 text-right text-[11px] font-semibold text-[var(--dh-text-muted)]">{{ formatDate(row.date) }}</time>
      </article>
    </div>
  </section>
</template>

<style scoped>
.resource-card{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:1rem;border:1px solid var(--dh-border);border-radius:20px;padding:1rem;background:var(--dh-input);box-shadow:var(--dh-shadow-sm)}
@media (max-width:640px){.resource-card{flex-direction:column}.resource-card time{text-align:left}}
</style>
