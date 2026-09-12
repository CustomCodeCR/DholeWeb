<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CalendarClock,
  FileImage,
  FileText,
  Image,
  LayoutDashboard,
  Megaphone,
  Menu,
  Newspaper,
  Plus,
  Search,
  Settings2,
  Users,
  X,
} from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { MarketingService } from '@/core/services/marketingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { ContentType, EditorDashboardDto } from '@/core/interfaces/content'
import type { MarketingResourceKind } from '@/core/interfaces/marketing'
import { MARKETING_GROUPS, isMarketingSection, type MarketingSectionKey } from '@/modules/marketing/config/marketingNavigation'
import MarketingContentTab from '@/modules/marketing/components/MarketingContentTab.vue'
import MarketingMediaTab from '@/modules/marketing/components/MarketingMediaTab.vue'
import MarketingMenusTab from '@/modules/marketing/components/MarketingMenusTab.vue'
import MarketingResourceTab from '@/modules/marketing/components/MarketingResourceTab.vue'
import MarketingSettingsTab from '@/modules/marketing/components/MarketingSettingsTab.vue'

const siteKey = 'main'
const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()

const iconMap: Record<string, Component> = {
  dashboard: LayoutDashboard,
  file: FileText,
  news: Newspaper,
  media: FileImage,
  image: Image,
  blocks: LayoutDashboard,
  menu: Menu,
  search: Search,
  link: Search,
  settings: Settings2,
  form: FileText,
  inbox: FileText,
  users: Users,
  calendar: CalendarClock,
  campaign: Megaphone,
}

const activeSection = ref<MarketingSectionKey>('dashboard')
const addMenuOpen = ref(false)
const createNonce = ref(0)
const dashboardLoading = ref(false)
const dashboard = ref<EditorDashboardDto>({
  pages: 0,
  news: 0,
  banners: 0,
  media: 0,
  drafts: 0,
  pendingReview: 0,
  scheduled: 0,
  published: 0,
})
const marketingCounts = ref({ leads: 0, forms: 0, meetings: 0, campaigns: 0 })

watch(
  () => route.query.section,
  (value) => {
    activeSection.value = isMarketingSection(value) ? value : 'dashboard'
  },
  { immediate: true },
)

const currentLabel = computed(() => {
  for (const group of MARKETING_GROUPS) {
    const item = group.items.find((entry) => entry.key === activeSection.value)
    if (item) return item.label
  }
  return 'Dashboard'
})

const contentSection = computed(() => {
  const definitions: Partial<Record<MarketingSectionKey, { type: ContentType; title: string; singular: string }>> = {
    'content-pages': { type: 'Page', title: 'Páginas', singular: 'Página' },
    'content-news': { type: 'News', title: 'Noticias', singular: 'Noticia' },
    'content-posts': { type: 'Post', title: 'Posts', singular: 'Post' },
    'content-videos': { type: 'Video', title: 'Videos', singular: 'Video' },
    'content-reusable': { type: 'ReusableBlock', title: 'Bloques reutilizables', singular: 'Bloque' },
    'design-banners': { type: 'Banner', title: 'Banners', singular: 'Banner' },
    'seo-pages': { type: 'Page', title: 'SEO de páginas', singular: 'Página' },
    'campaigns-landings': { type: 'Page', title: 'Landing Pages', singular: 'Landing page' },
  }
  return definitions[activeSection.value] ?? null
})

const resourceSection = computed(() => {
  const definitions: Partial<Record<MarketingSectionKey, { kind: MarketingResourceKind; title: string; subtitle: string }>> = {
    'design-placements': { kind: 'placements', title: 'Placements', subtitle: 'Ubicaciones configuradas para banners y contenido del sitio.' },
    'design-collections': { kind: 'collections', title: 'Collections', subtitle: 'Información repetitiva administrada con colecciones reutilizables.' },
    'seo-redirects': { kind: 'redirects', title: 'Redirects', subtitle: 'Redirecciones 301 y 302 configuradas para el sitio.' },
    'capture-forms': { kind: 'forms', title: 'Formularios', subtitle: 'Formularios de contacto, cotización, newsletter, reuniones y campañas.' },
    'capture-submissions': { kind: 'submissions', title: 'Submissions', subtitle: 'Envíos recibidos desde los formularios de Mercadeo.' },
    'capture-leads': { kind: 'leads', title: 'Leads', subtitle: 'Leads básicos capturados por el CMS.' },
    'meetings-types': { kind: 'meeting-types', title: 'Tipos de reunión', subtitle: 'Configuración disponible para solicitudes de reunión.' },
    'meetings-requests': { kind: 'meeting-requests', title: 'Solicitudes', subtitle: 'Solicitudes de reunión recibidas y su estado.' },
    'meetings-agenda': { kind: 'meeting-agenda', title: 'Agenda', subtitle: 'Vista cronológica de reuniones solicitadas y confirmadas.' },
    'campaigns-campaigns': { kind: 'campaigns', title: 'Campañas', subtitle: 'Campañas y atribución UTM del sitio.' },
    'publishing-calendar': { kind: 'content-calendar', title: 'Calendario', subtitle: 'Contenido con publicación programada.' },
    'publishing-pending': { kind: 'content-pending', title: 'Pendientes de aprobación', subtitle: 'Contenido actualmente en revisión.' },
    'publishing-scheduled': { kind: 'content-scheduled', title: 'Programados', subtitle: 'Contenido aprobado y programado para publicación.' },
    'publishing-history': { kind: 'content-history', title: 'Historial', subtitle: 'Contenido publicado o archivado recientemente.' },
    'settings-site': { kind: 'sites', title: 'Información del sitio', subtitle: 'Dominio, idioma, zona horaria y estado del sitio administrado.' },
  }
  return definitions[activeSection.value] ?? null
})

const isMediaSection = computed(() => activeSection.value.startsWith('media-'))
const isSettingsSection = computed(() => ['seo-global', 'settings-social', 'settings-contact'].includes(activeSection.value))

const dashboardCards = computed(() => [
  { section: 'publishing-history' as MarketingSectionKey, label: 'Contenido publicado', value: dashboard.value.published, icon: FileText },
  { section: 'content-pages' as MarketingSectionKey, label: 'Drafts', value: dashboard.value.drafts, icon: FileText },
  { section: 'publishing-pending' as MarketingSectionKey, label: 'Pendientes', value: dashboard.value.pendingReview, icon: FileText },
  { section: 'publishing-scheduled' as MarketingSectionKey, label: 'Programados', value: dashboard.value.scheduled, icon: CalendarClock },
  { section: 'capture-leads' as MarketingSectionKey, label: 'Leads', value: marketingCounts.value.leads, icon: Users },
  { section: 'capture-forms' as MarketingSectionKey, label: 'Formularios', value: marketingCounts.value.forms, icon: FileText },
  { section: 'meetings-requests' as MarketingSectionKey, label: 'Reuniones', value: marketingCounts.value.meetings, icon: CalendarClock },
  { section: 'campaigns-campaigns' as MarketingSectionKey, label: 'Campañas', value: marketingCounts.value.campaigns, icon: Megaphone },
])

async function loadDashboard() {
  dashboardLoading.value = true
  try {
    const [editor, leads, forms, meetings, campaigns] = await Promise.all([
      ContentService.getEditorDashboard(siteKey),
      MarketingService.getLeads(siteKey),
      MarketingService.getForms(siteKey),
      MarketingService.getMeetingRequests(),
      MarketingService.getCampaigns(siteKey),
    ])
    dashboard.value = editor
    marketingCounts.value = {
      leads: leads.length,
      forms: forms.length,
      meetings: meetings.length,
      campaigns: campaigns.length,
    }
  } catch (error) {
    toastStore.backendWarning(error, 'No se pudo actualizar el resumen completo de Mercadeo.')
  } finally {
    dashboardLoading.value = false
  }
}

async function openSection(section: MarketingSectionKey) {
  activeSection.value = section
  addMenuOpen.value = false
  await router.replace({ query: { ...route.query, section } })
}

async function createContent(section: 'content-pages' | 'content-news' | 'design-banners') {
  addMenuOpen.value = false
  await openSection(section)
  await nextTick()
  createNonce.value += 1
}

watch(activeSection, (section) => {
  if (section === 'dashboard') void loadDashboard()
})

onMounted(() => void loadDashboard())
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Mercadeo"
      :subtitle="`Administración del sitio · ${currentLabel}`"
      :icon="Megaphone"
    >
      <template #actions>
        <div class="relative">
          <button class="primary-action" @click="addMenuOpen = !addMenuOpen">
            <Plus class="h-4 w-4" /> Agregar nuevo
          </button>
          <div v-if="addMenuOpen" class="create-menu">
            <div class="flex items-center justify-between border-b border-[var(--dh-border)] px-4 py-3">
              <strong class="text-sm">¿Qué desea crear?</strong>
              <button class="rounded-lg p-1 opacity-55 hover:bg-black/5" @click="addMenuOpen = false"><X class="h-4 w-4" /></button>
            </div>
            <button @click="createContent('content-pages')"><FileText class="h-4 w-4" /> Página</button>
            <button @click="createContent('content-news')"><Newspaper class="h-4 w-4" /> Noticia</button>
            <button @click="createContent('design-banners')"><Image class="h-4 w-4" /> Banner</button>
          </div>
        </div>
      </template>
    </DhPageHeader>

    <div class="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="dh-glass dh-liquid max-h-[calc(100vh-9rem)] overflow-y-auto rounded-[28px] p-2 xl:sticky xl:top-4">
        <nav class="space-y-4">
          <section v-for="(group, groupIndex) in MARKETING_GROUPS" :key="group.label ?? `root-${groupIndex}`">
            <p v-if="group.label" class="px-3 pb-1 text-[10px] font-black uppercase tracking-[.16em] opacity-45">{{ group.label }}</p>
            <div class="space-y-1">
              <button
                v-for="item in group.items"
                :key="item.key"
                class="nav-item"
                :class="{ 'nav-item-active': activeSection === item.key }"
                @click="openSection(item.key)"
              >
                <component :is="iconMap[item.icon]" class="h-4 w-4 shrink-0" />
                <span>{{ item.label }}</span>
              </button>
            </div>
          </section>
        </nav>
      </aside>

      <main class="min-w-0">
        <div v-if="activeSection === 'dashboard'" class="space-y-5">
          <section class="dh-glass dh-liquid rounded-[30px] p-6">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">Dashboard</p>
                <h2 class="mt-1 text-2xl font-black">Resumen de Mercadeo</h2>
                <p class="mt-1 text-sm opacity-60">Contenido, captación, reuniones y campañas en un solo lugar.</p>
              </div>
              <span v-if="dashboardLoading" class="text-xs opacity-50">Actualizando…</span>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                v-for="card in dashboardCards"
                :key="card.label"
                class="dashboard-card"
                @click="openSection(card.section)"
              >
                <component :is="card.icon" class="h-5 w-5 text-[var(--dh-primary)]" />
                <strong class="mt-4 text-3xl">{{ card.value }}</strong>
                <span class="mt-1 text-sm opacity-60">{{ card.label }}</span>
              </button>
            </div>
          </section>

          <section class="grid gap-5 lg:grid-cols-[1fr_.9fr]">
            <div class="dh-glass dh-liquid rounded-[30px] p-6">
              <h3 class="text-lg font-black">Crear contenido</h3>
              <p class="mt-1 text-sm opacity-60">Accesos rápidos para las publicaciones más frecuentes.</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <button class="quick-create" @click="createContent('content-pages')"><FileText class="h-6 w-6" /><span>Página</span></button>
                <button class="quick-create" @click="createContent('content-news')"><Newspaper class="h-6 w-6" /><span>Noticia</span></button>
                <button class="quick-create" @click="createContent('design-banners')"><Image class="h-6 w-6" /><span>Banner</span></button>
              </div>
            </div>

            <div class="dh-glass dh-liquid rounded-[30px] p-6">
              <h3 class="text-lg font-black">Flujo editorial</h3>
              <div class="mt-5 space-y-3">
                <div class="status-row"><span>Drafts</span><strong>{{ dashboard.drafts }}</strong></div>
                <div class="status-row"><span>Pendientes de aprobación</span><strong>{{ dashboard.pendingReview }}</strong></div>
                <div class="status-row"><span>Programados</span><strong>{{ dashboard.scheduled }}</strong></div>
                <div class="status-row"><span>Publicados</span><strong>{{ dashboard.published }}</strong></div>
              </div>
            </div>
          </section>
        </div>

        <MarketingContentTab
          v-else-if="contentSection"
          :key="activeSection"
          :site-key="siteKey"
          :content-type="contentSection.type"
          :title="contentSection.title"
          :singular="contentSection.singular"
          :create-nonce="createNonce"
        />

        <MarketingMediaTab v-else-if="isMediaSection" :key="activeSection" />
        <MarketingMenusTab v-else-if="activeSection === 'design-menus'" :site-key="siteKey" />
        <MarketingSettingsTab v-else-if="isSettingsSection" :key="activeSection" :site-key="siteKey" />

        <section v-else-if="activeSection === 'seo-sitemap'" class="dh-glass dh-liquid rounded-[30px] p-6">
          <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">SEO</p>
          <h2 class="mt-1 text-2xl font-black">Sitemap</h2>
          <p class="mt-2 max-w-3xl text-sm opacity-60">
            El sitemap se deriva de las rutas, el estado de publicación y la configuración SEO del contenido. Esta fase no crea una segunda fuente de datos ni un editor paralelo.
          </p>
        </section>

        <MarketingResourceTab
          v-else-if="resourceSection"
          :key="activeSection"
          :kind="resourceSection.kind"
          :title="resourceSection.title"
          :subtitle="resourceSection.subtitle"
          :site-key="siteKey"
        />
      </main>
    </div>
  </section>
</template>

<style scoped>
.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:13px;background:var(--dh-primary);padding:.72rem 1rem;color:#fff;font-size:.82rem;font-weight:800;transition:160ms}.primary-action:hover{filter:brightness(1.05)}.create-menu{position:absolute;right:0;top:calc(100% + .55rem);z-index:40;width:220px;overflow:hidden;border:1px solid var(--dh-border);border-radius:16px;background:var(--dh-surface);box-shadow:0 18px 45px rgb(0 0 0 / .16)}.create-menu>button{display:flex;width:100%;align-items:center;gap:.65rem;padding:.75rem 1rem;text-align:left;font-size:.84rem;font-weight:700;transition:150ms}.create-menu>button:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent);color:var(--dh-primary)}.nav-item{display:flex;width:100%;align-items:center;gap:.7rem;border-radius:14px;padding:.67rem .8rem;text-align:left;font-size:.8rem;font-weight:750;transition:160ms}.nav-item:hover{background:color-mix(in srgb,var(--dh-primary) 7%,transparent)}.nav-item-active{background:color-mix(in srgb,var(--dh-primary) 12%,transparent);color:var(--dh-primary)}.dashboard-card{display:flex;min-height:132px;flex-direction:column;align-items:flex-start;border:1px solid var(--dh-border);border-radius:18px;padding:1rem;text-align:left;transition:170ms}.dashboard-card:hover{border-color:color-mix(in srgb,var(--dh-primary) 50%,var(--dh-border));transform:translateY(-1px);box-shadow:0 10px 25px rgb(0 0 0 / .06)}.quick-create{display:flex;min-height:110px;flex-direction:column;align-items:center;justify-content:center;gap:.65rem;border:1px dashed var(--dh-border);border-radius:18px;font-weight:800;transition:170ms}.quick-create:hover{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 7%,transparent);color:var(--dh-primary)}.status-row{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dh-border);padding:.7rem 0;font-size:.9rem}.status-row:last-child{border-bottom:0}.status-row strong{font-size:1.05rem}
</style>
