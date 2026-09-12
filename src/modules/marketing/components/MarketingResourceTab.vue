<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw, Search } from 'lucide-vue-next'
import { ContentService } from '@/core/services/contentService'
import { MarketingService } from '@/core/services/marketingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { MarketingResourceKind } from '@/core/interfaces/marketing'

interface ResourceRow {
  id: string
  title: string
  subtitle?: string
  status?: string
  meta?: string
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
const loading = ref(false)
const rows = ref<ResourceRow[]>([])
const search = ref('')

const visibleRows = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return rows.value
  return rows.value.filter((row) =>
    `${row.title} ${row.subtitle ?? ''} ${row.status ?? ''} ${row.meta ?? ''}`.toLowerCase().includes(term),
  )
})

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function statusClass(status?: string) {
  const value = (status ?? '').toLowerCase()
  if (['published', 'active', 'confirmed', 'completed'].includes(value)) return 'status-ok'
  if (['pendingreview', 'pendingconfirmation', 'scheduled', 'requested'].includes(value)) return 'status-warn'
  if (['rejected', 'cancelled', 'archived', 'inactive'].includes(value)) return 'status-muted'
  return 'status-default'
}

async function loadContentStatus(status: string) {
  const response = await ContentService.browseEditor({
    pageNumber: 1,
    pageSize: 250,
    siteKey: props.siteKey,
    status,
  })
  return response.items.map<ResourceRow>((item) => ({
    id: item.id,
    title: item.title,
    subtitle: `${item.type} · /${item.slug}`,
    status: item.status,
    meta: item.locale,
    date: item.publishedAtUtc ?? item.updatedAtUtc ?? item.createdAtUtc,
  }))
}

async function load() {
  loading.value = true
  try {
    if (props.kind === 'placements') {
      rows.value = (await MarketingService.getPlacements(props.siteKey)).map((item) => ({
        id: item.id, title: item.name, subtitle: item.code, status: item.isActive ? 'Active' : 'Inactive',
        meta: `Máximo ${item.maxItems} · ${item.allowedTypesJson}`, date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'collections') {
      rows.value = (await MarketingService.getCollections(props.siteKey)).map((item) => ({
        id: item.id, title: item.name, subtitle: item.code, status: item.isActive ? 'Active' : 'Inactive',
        meta: item.settingsJson ?? undefined, date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'redirects') {
      rows.value = (await MarketingService.getRedirects(props.siteKey)).map((item) => ({
        id: item.id, title: item.sourcePath, subtitle: item.targetUrl, status: item.isActive ? 'Active' : 'Inactive',
        meta: String(item.statusCode), date: item.validFromUtc ?? item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'forms') {
      rows.value = (await MarketingService.getForms(props.siteKey)).map((item) => ({
        id: item.id, title: item.name, subtitle: item.formKey, status: item.status,
        meta: `${item.purpose} · v${item.version}`, date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'submissions') {
      rows.value = (await MarketingService.getSubmissions()).map((item) => ({
        id: item.id, title: `Submission ${item.id.slice(0, 8)}`, subtitle: item.sourceUrl, status: item.status,
        meta: item.utmCampaign ? `UTM ${item.utmCampaign}` : `Formulario ${item.formId.slice(0, 8)}`, date: item.submittedAtUtc,
      }))
    } else if (props.kind === 'leads') {
      rows.value = (await MarketingService.getLeads(props.siteKey)).map((item) => ({
        id: item.id,
        title: [item.firstName, item.lastName].filter(Boolean).join(' ') || item.email || item.phone || 'Lead sin nombre',
        subtitle: item.company || item.email || item.phone || undefined,
        status: item.status,
        meta: item.source || item.country || undefined,
        date: item.lastTouchAtUtc,
      }))
    } else if (props.kind === 'meeting-types') {
      rows.value = (await MarketingService.getMeetingTypes(props.siteKey)).map((item) => ({
        id: item.id, title: item.name, subtitle: item.slug, status: item.isActive ? 'Active' : 'Inactive',
        meta: `${item.meetingMode} · ${item.durationMinutes} min`, date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'meeting-requests' || props.kind === 'meeting-agenda') {
      rows.value = (await MarketingService.getMeetingRequests()).map((item) => ({
        id: item.id, title: item.subject, subtitle: item.timeZone, status: item.status,
        meta: item.meetingUrl || `Tipo ${item.meetingTypeId.slice(0, 8)}`, date: item.confirmedStartUtc ?? item.requestedStartUtc,
      })).sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())
    } else if (props.kind === 'campaigns') {
      rows.value = (await MarketingService.getCampaigns(props.siteKey)).map((item) => ({
        id: item.id, title: item.name, subtitle: item.slug, status: item.status,
        meta: `${item.goalType}${item.utmCampaign ? ` · UTM ${item.utmCampaign}` : ''}`, date: item.startsAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'sites') {
      rows.value = (await MarketingService.getSites()).map((item) => ({
        id: item.id, title: item.name, subtitle: item.primaryDomain, status: item.status,
        meta: `${item.defaultLocale} · ${item.timeZone}`, date: item.updatedAtUtc ?? item.createdAtUtc,
      }))
    } else if (props.kind === 'content-pending') {
      rows.value = await loadContentStatus('PendingReview')
    } else if (props.kind === 'content-scheduled' || props.kind === 'content-calendar') {
      rows.value = await loadContentStatus('Scheduled')
    } else if (props.kind === 'content-history') {
      const [published, archived] = await Promise.all([
        loadContentStatus('Published'),
        loadContentStatus('Archived'),
      ])
      rows.value = [...published, ...archived].sort((a, b) =>
        new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
      )
    }
  } catch (error) {
    rows.value = []
    toastStore.backendError(error, `No se pudo cargar ${props.title.toLowerCase()}.`)
  } finally {
    loading.value = false
  }
}

watch(() => props.kind, () => void load())
onMounted(() => void load())
</script>

<template>
  <section class="dh-glass dh-liquid rounded-[30px] p-5 sm:p-6">
    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">Mercadeo</p>
        <h2 class="mt-1 text-2xl font-black">{{ title }}</h2>
        <p class="mt-1 max-w-3xl text-sm opacity-60">{{ subtitle }}</p>
      </div>
      <button class="refresh-button" :disabled="loading" @click="load">
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /> Actualizar
      </button>
    </div>

    <div class="mt-5 flex items-center gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-surface)] px-3 py-2.5">
      <Search class="h-4 w-4 opacity-45" />
      <input v-model="search" class="w-full bg-transparent text-sm outline-none" :placeholder="`Buscar en ${title.toLowerCase()}…`" />
      <span class="text-xs font-bold opacity-45">{{ visibleRows.length }}</span>
    </div>

    <div v-if="loading" class="mt-5 rounded-2xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm opacity-55">
      Cargando información…
    </div>
    <div v-else-if="visibleRows.length === 0" class="mt-5 rounded-2xl border border-dashed border-[var(--dh-border)] p-8 text-center text-sm opacity-55">
      No hay registros para mostrar.
    </div>
    <div v-else class="mt-5 grid gap-3 xl:grid-cols-2">
      <article v-for="row in visibleRows" :key="row.id" class="resource-card">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <strong class="truncate text-sm">{{ row.title }}</strong>
            <span v-if="row.status" class="status-chip" :class="statusClass(row.status)">{{ row.status }}</span>
          </div>
          <p v-if="row.subtitle" class="mt-1 truncate text-xs opacity-65">{{ row.subtitle }}</p>
          <p v-if="row.meta" class="mt-2 line-clamp-2 text-xs opacity-45">{{ row.meta }}</p>
        </div>
        <time v-if="row.date" class="shrink-0 text-right text-[11px] font-semibold opacity-45">{{ formatDate(row.date) }}</time>
      </article>
    </div>
  </section>
</template>

<style scoped>
.refresh-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border:1px solid var(--dh-border);border-radius:13px;padding:.65rem .85rem;font-size:.78rem;font-weight:800;transition:150ms}.refresh-button:hover:not(:disabled){border-color:var(--dh-primary);color:var(--dh-primary)}.refresh-button:disabled{cursor:not-allowed;opacity:.45}.resource-card{display:flex;min-width:0;align-items:flex-start;justify-content:space-between;gap:1rem;border:1px solid var(--dh-border);border-radius:18px;padding:1rem;background:color-mix(in srgb,var(--dh-surface) 88%,transparent)}.status-chip{border-radius:999px;padding:.18rem .48rem;font-size:.62rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em}.status-ok{background:rgb(16 185 129 / .12);color:rgb(5 150 105)}.status-warn{background:rgb(245 158 11 / .13);color:rgb(217 119 6)}.status-muted{background:rgb(100 116 139 / .12);color:rgb(100 116 139)}.status-default{background:color-mix(in srgb,var(--dh-primary) 10%,transparent);color:var(--dh-primary)}
</style>
