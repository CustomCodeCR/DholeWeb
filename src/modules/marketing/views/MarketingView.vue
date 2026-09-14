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
  Sparkles,
  Users,
} from 'lucide-vue-next'
import { DhButton, DhSkeleton } from '@/shared/components/atoms'
import { DhDropdownMenu, DhSearchInput, type DhDropdownItem } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { MarketingService } from '@/core/services/marketingService'
import { useToastStore } from '@/core/stores/toastStore'
import { useLocale } from '@/core/stores/locale'
import type { ContentType, EditorDashboardDto } from '@/core/interfaces/content'
import type { MarketingResourceKind } from '@/core/interfaces/marketing'
import {
  MARKETING_GROUPS,
  getMarketingSectionDefinition,
  isMarketingSection,
  localizeMarketing,
  type MarketingSectionKey,
} from '@/modules/marketing/config/marketingNavigation'
import MarketingAiTab from '@/modules/marketing/components/MarketingAiTab.vue'
import MarketingAnimationTab from '@/modules/marketing/components/MarketingAnimationTab.vue'
import MarketingContentWorkspace from '@/modules/marketing/components/MarketingContentWorkspace.vue'
import MarketingMediaTab from '@/modules/marketing/components/MarketingMediaTab.vue'
import MarketingMenusTab from '@/modules/marketing/components/MarketingMenusTab.vue'
import MarketingResourceTab from '@/modules/marketing/components/MarketingResourceTab.vue'
import MarketingSettingsTab from '@/modules/marketing/components/MarketingSettingsTab.vue'

const siteKey = 'main'
const route = useRoute()
const router = useRouter()
const toastStore = useToastStore()
const localeStore = useLocale()

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
  sparkles: Sparkles,
}

const activeSection = ref<MarketingSectionKey>('dashboard')
const navigationSearch = ref('')
const createNonce = ref(0)
const dashboardLoading = ref(false)
const dashboard = ref<EditorDashboardDto>({ pages: 0, news: 0, banners: 0, media: 0, drafts: 0, pendingReview: 0, scheduled: 0, published: 0 })
const marketingCounts = ref({ leads: 0, forms: 0, meetings: 0, campaigns: 0 })

const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

watch(
  () => route.query.section,
  (value) => { activeSection.value = isMarketingSection(value) ? value : 'dashboard' },
  { immediate: true },
)

const activeDefinition = computed(() => getMarketingSectionDefinition(activeSection.value))
const currentLabel = computed(() => activeDefinition.value
  ? localizeMarketing(activeDefinition.value.item.title, localeStore.locale)
  : tr('Inicio', 'Home'))
const currentDescription = computed(() => activeDefinition.value
  ? localizeMarketing(activeDefinition.value.item.description, localeStore.locale)
  : tr('Resumen de Mercadeo.', 'Marketing overview.'))

const navigationGroups = computed(() => {
  const query = navigationSearch.value.trim().toLowerCase()
  return MARKETING_GROUPS
    .map((group) => ({
      group,
      items: group.items.filter((item) => {
        if (!query) return true
        const title = localizeMarketing(item.title, localeStore.locale).toLowerCase()
        const description = localizeMarketing(item.description, localeStore.locale).toLowerCase()
        return `${title} ${description} ${item.label.toLowerCase()}`.includes(query)
      }),
    }))
    .filter((entry) => entry.items.length > 0)
})

const contentSection = computed(() => {
  const definitions: Partial<Record<MarketingSectionKey, { type: ContentType; title: string; singular: string }>> = {
    'content-pages': { type: 'Page', title: tr('Páginas', 'Pages'), singular: tr('Página', 'Page') },
    'content-news': { type: 'News', title: tr('Noticias', 'News'), singular: tr('Noticia', 'News item') },
    'content-posts': { type: 'Post', title: tr('Publicaciones', 'Posts'), singular: tr('Publicación', 'Post') },
    'content-videos': { type: 'Video', title: tr('Videos', 'Videos'), singular: tr('Video', 'Video') },
    'content-reusable': { type: 'ReusableBlock', title: tr('Secciones reutilizables', 'Reusable sections'), singular: tr('Sección', 'Section') },
    'design-banners': { type: 'Banner', title: tr('Banners', 'Banners'), singular: tr('Banner', 'Banner') },
    'seo-pages': { type: 'Page', title: tr('Apariencia en buscadores', 'Search appearance'), singular: tr('Página', 'Page') },
    'campaigns-landings': { type: 'Page', title: tr('Páginas de campaña', 'Campaign pages'), singular: tr('Página de campaña', 'Campaign page') },
  }
  return definitions[activeSection.value] ?? null
})

const resourceSection = computed(() => {
  const definitions: Partial<Record<MarketingSectionKey, { kind: MarketingResourceKind; title: string; subtitle: string }>> = {
    'design-placements': { kind: 'placements', title: tr('Ubicaciones del sitio', 'Website placements'), subtitle: tr('Zonas donde pueden mostrarse banners y contenido.', 'Areas where banners and content can appear.') },
    'design-collections': { kind: 'collections', title: tr('Colecciones de contenido', 'Content collections'), subtitle: tr('Información reutilizable organizada de forma simple.', 'Reusable information organized in a simple way.') },
    'seo-redirects': { kind: 'redirects', title: tr('Cambios de dirección', 'Address changes'), subtitle: tr('Enlaces anteriores que deben continuar llevando a la página correcta.', 'Old links that should continue taking visitors to the correct page.') },
    'capture-forms': { kind: 'forms', title: tr('Formularios', 'Forms'), subtitle: tr('Formularios disponibles para contacto, cotización, reuniones y campañas.', 'Forms available for contact, quotes, meetings and campaigns.') },
    'capture-submissions': { kind: 'submissions', title: tr('Respuestas recibidas', 'Received responses'), subtitle: tr('Información enviada por visitantes desde los formularios.', 'Information submitted by visitors through forms.') },
    'capture-leads': { kind: 'leads', title: tr('Contactos interesados', 'Interested contacts'), subtitle: tr('Personas y empresas que mostraron interés en los servicios.', 'People and companies that showed interest in the services.') },
    'meetings-types': { kind: 'meeting-types', title: tr('Opciones de reunión', 'Meeting options'), subtitle: tr('Reuniones que pueden solicitar los visitantes.', 'Meetings visitors can request.') },
    'meetings-requests': { kind: 'meeting-requests', title: tr('Solicitudes de reunión', 'Meeting requests'), subtitle: tr('Solicitudes recibidas y su estado actual.', 'Received requests and their current status.') },
    'meetings-agenda': { kind: 'meeting-agenda', title: tr('Agenda', 'Schedule'), subtitle: tr('Reuniones solicitadas y confirmadas en orden cronológico.', 'Requested and confirmed meetings in chronological order.') },
    'campaigns-campaigns': { kind: 'campaigns', title: tr('Campañas', 'Campaigns'), subtitle: tr('Iniciativas y acciones activas de Mercadeo.', 'Active marketing initiatives and actions.') },
    'publishing-calendar': { kind: 'content-calendar', title: tr('Calendario de publicaciones', 'Publishing calendar'), subtitle: tr('Contenido que tiene una fecha futura de publicación.', 'Content with a future publication date.') },
    'publishing-pending': { kind: 'content-pending', title: tr('Pendientes de aprobación', 'Pending approval'), subtitle: tr('Contenido que espera revisión antes de publicarse.', 'Content waiting for review before publication.') },
    'publishing-scheduled': { kind: 'content-scheduled', title: tr('Publicaciones programadas', 'Scheduled publications'), subtitle: tr('Contenido aprobado que se publicará automáticamente.', 'Approved content that will be published automatically.') },
    'publishing-history': { kind: 'content-history', title: tr('Publicados y archivo', 'Published and archive'), subtitle: tr('Contenido publicado anteriormente o guardado en archivo.', 'Previously published or archived content.') },
    'settings-site': { kind: 'sites', title: tr('Información general', 'General information'), subtitle: tr('Datos principales del sitio que administra Mercadeo.', 'Main information for the website managed by Marketing.') },
  }
  return definitions[activeSection.value] ?? null
})

const isMediaSection = computed(() => activeSection.value.startsWith('media-'))
const isSettingsSection = computed(() => ['seo-global', 'settings-social', 'settings-contact'].includes(activeSection.value))

const dashboardCards = computed(() => [
  { section: 'publishing-history' as MarketingSectionKey, label: 'Contenido publicado', displayLabel: tr('Contenido publicado', 'Published content'), value: dashboard.value.published, icon: FileText },
  { section: 'content-pages' as MarketingSectionKey, label: 'Drafts', displayLabel: tr('Borradores', 'Drafts'), value: dashboard.value.drafts, icon: FileText },
  { section: 'publishing-pending' as MarketingSectionKey, label: 'Pendientes', displayLabel: tr('Pendientes', 'Pending'), value: dashboard.value.pendingReview, icon: FileText },
  { section: 'publishing-scheduled' as MarketingSectionKey, label: 'Programados', displayLabel: tr('Programados', 'Scheduled'), value: dashboard.value.scheduled, icon: CalendarClock },
  { section: 'capture-leads' as MarketingSectionKey, label: 'Leads', displayLabel: tr('Contactos interesados', 'Interested contacts'), value: marketingCounts.value.leads, icon: Users },
  { section: 'capture-forms' as MarketingSectionKey, label: 'Formularios', displayLabel: tr('Formularios', 'Forms'), value: marketingCounts.value.forms, icon: FileText },
  { section: 'meetings-requests' as MarketingSectionKey, label: 'Reuniones', displayLabel: tr('Reuniones', 'Meetings'), value: marketingCounts.value.meetings, icon: CalendarClock },
  { section: 'campaigns-campaigns' as MarketingSectionKey, label: 'Campañas', displayLabel: tr('Campañas', 'Campaigns'), value: marketingCounts.value.campaigns, icon: Megaphone },
])

const createItems = computed<DhDropdownItem[]>(() => [
  { action: 'page', label: tr('Página', 'Page'), icon: FileText },
  { action: 'news', label: tr('Noticia', 'News item'), icon: Newspaper },
  { action: 'banner', label: tr('Banner', 'Banner'), icon: Image },
])

const quickActions = computed(() => [
  { key: 'page', title: tr('Crear una página', 'Create a page'), description: tr('Prepare una nueva página del sitio.', 'Prepare a new website page.'), icon: FileText },
  { key: 'news', title: tr('Publicar una noticia', 'Publish news'), description: tr('Comparta una novedad con sus visitantes.', 'Share an update with visitors.'), icon: Newspaper },
  { key: 'banner', title: tr('Crear un banner', 'Create a banner'), description: tr('Prepare un mensaje visual destacado.', 'Prepare a highlighted visual message.'), icon: Image },
  { key: 'review', title: tr('Revisar pendientes', 'Review pending items'), description: tr('Continúe con contenido que espera aprobación.', 'Continue with content waiting for approval.'), icon: CalendarClock },
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
    marketingCounts.value = { leads: leads.length, forms: forms.length, meetings: meetings.length, campaigns: campaigns.length }
  } catch (error) {
    toastStore.backendWarning(error, tr('No se pudo actualizar el resumen completo de Mercadeo.', 'The complete Marketing summary could not be refreshed.'))
  } finally {
    dashboardLoading.value = false
  }
}

async function openSection(section: MarketingSectionKey) {
  activeSection.value = section
  await router.replace({ query: { ...route.query, section } })
}

async function createContent(section: 'content-pages' | 'content-news' | 'design-banners') {
  await openSection(section)
  await nextTick()
  createNonce.value += 1
}

async function handleCreate(action: string) {
  if (action === 'page') await createContent('content-pages')
  if (action === 'news') await createContent('content-news')
  if (action === 'banner') await createContent('design-banners')
}

async function handleQuickAction(key: string) {
  if (key === 'review') return openSection('publishing-pending')
  return handleCreate(key)
}

watch(activeSection, (section) => { if (section === 'dashboard') void loadDashboard() })
onMounted(() => void loadDashboard())
</script>

<template>
  <section class="space-y-5">
    <DhPageHeader
      :title="tr('Mercadeo', 'Marketing')"
      :subtitle="currentDescription"
      :icon="Megaphone"
    >
      <template #actions>
        <DhDropdownMenu :items="createItems" @select="handleCreate">
          <DhButton :label="tr('Crear', 'Create')" :icon="Plus" size="sm" />
        </DhDropdownMenu>
      </template>
    </DhPageHeader>

    <div class="grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="dh-glass dh-liquid min-w-0 rounded-[28px] p-3 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-hidden">
        <div class="border-b border-[var(--dh-border)] px-1 pb-3">
          <p class="text-xs font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">{{ tr('Espacio de trabajo', 'Workspace') }}</p>
          <p class="mt-1 text-xs leading-5 text-[var(--dh-text-muted)]">{{ tr('Elija lo que desea administrar.', 'Choose what you want to manage.') }}</p>
          <DhSearchInput v-model="navigationSearch" class="mt-3" :placeholder="tr('Buscar una opción…', 'Find an option…')" />
        </div>

        <nav class="dh-scrollbar mt-3 min-h-0 space-y-4 xl:max-h-[calc(100dvh-11rem)] xl:overflow-y-auto xl:pr-1">
          <section v-for="entry in navigationGroups" :key="entry.group.label ?? 'home'">
            <p v-if="entry.group.label" class="px-2 pb-1 text-[10px] font-black uppercase tracking-[.14em] text-[var(--dh-text-muted)]">
              {{ localizeMarketing(entry.group.title, localeStore.locale) }}
            </p>
            <div class="space-y-1">
              <DhButton
                v-for="item in entry.items"
                :key="item.key"
                class="w-full !justify-start"
                :label="localizeMarketing(item.title, localeStore.locale)"
                :icon="iconMap[item.icon]"
                :variant="activeSection === item.key ? 'secondary' : 'ghost'"
                size="sm"
                @click="openSection(item.key)"
              />
            </div>
          </section>
        </nav>
      </aside>

      <main class="min-w-0">
        <div v-if="activeSection === 'dashboard'" class="space-y-5">
          <section class="marketing-hero">
            <div class="min-w-0">
              <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">{{ tr('Inicio', 'Home') }}</p>
              <h2 class="mt-2 max-w-3xl text-2xl font-black tracking-tight sm:text-3xl">
                {{ tr('Todo Mercadeo, en un espacio más simple', 'Everything Marketing needs, in one simpler workspace') }}
              </h2>
              <p class="mt-2 max-w-2xl text-sm leading-6 text-[var(--dh-text-muted)]">
                {{ tr('Cree contenido, atienda contactos y controle publicaciones sin trabajar con configuraciones técnicas.', 'Create content, follow up with contacts and control publishing without working with technical settings.') }}
              </p>
            </div>
            <div class="hero-orb"><Megaphone class="h-8 w-8" /></div>
          </section>

          <section>
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-black">{{ tr('Así va el sitio', 'Website at a glance') }}</h3>
                <p class="text-sm text-[var(--dh-text-muted)]">{{ tr('Los números principales para continuar trabajando.', 'The main numbers you need to keep working.') }}</p>
              </div>
              <span v-if="dashboardLoading" class="text-xs font-bold text-[var(--dh-text-muted)]">{{ tr('Actualizando…', 'Refreshing…') }}</span>
            </div>
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <template v-if="dashboardLoading">
                <DhSkeleton v-for="index in 8" :key="index" height="7.5rem" rounded="lg" />
              </template>
              <button v-for="card in dashboardCards" v-else :key="card.label" type="button" class="metric-card" @click="openSection(card.section)">
                <span class="metric-icon"><component :is="card.icon" class="h-5 w-5" /></span>
                <strong class="mt-4 block text-3xl font-black">{{ card.value }}</strong>
                <span class="mt-1 block text-sm font-semibold text-[var(--dh-text-muted)]">{{ card.displayLabel }}</span>
              </button>
            </div>
          </section>

          <section class="dh-glass dh-liquid rounded-[28px] p-5 sm:p-6">
            <div>
              <h3 class="text-lg font-black">{{ tr('¿Qué desea hacer?', 'What would you like to do?') }}</h3>
              <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ tr('Accesos directos a las tareas más frecuentes.', 'Shortcuts to the most common tasks.') }}</p>
            </div>
            <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article v-for="action in quickActions" :key="action.key" class="task-card">
                <span class="task-icon"><component :is="action.icon" class="h-5 w-5" /></span>
                <h4 class="mt-4 font-black">{{ action.title }}</h4>
                <p class="mt-1 min-h-10 text-xs leading-5 text-[var(--dh-text-muted)]">{{ action.description }}</p>
                <DhButton class="mt-4 w-full" :label="tr('Abrir', 'Open')" variant="secondary" size="sm" @click="handleQuickAction(action.key)" />
              </article>
            </div>
          </section>
        </div>

        <div v-else class="space-y-4">
          <section class="section-intro">
            <div class="section-intro-icon">
              <component :is="activeDefinition ? iconMap[activeDefinition.item.icon] : Megaphone" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-black uppercase tracking-[.16em] text-[var(--dh-primary)]">{{ tr('Mercadeo', 'Marketing') }}</p>
              <h2 class="mt-1 text-2xl font-black">{{ currentLabel }}</h2>
              <p class="mt-1 max-w-3xl text-sm leading-6 text-[var(--dh-text-muted)]">{{ currentDescription }}</p>
            </div>
            <DhButton :label="tr('Volver al inicio', 'Back home')" variant="ghost" size="sm" @click="openSection('dashboard')" />
          </section>

          <MarketingAnimationTab v-if="activeSection === 'design-animations'" :site-key="siteKey" />
          <MarketingContentWorkspace
            v-else-if="contentSection"
            :key="activeSection"
            :site-key="siteKey"
            :content-type="contentSection.type"
            :title="contentSection.title"
            :singular="contentSection.singular"
            :create-nonce="createNonce"
          />
          <MarketingAiTab v-else-if="activeSection === 'ai-assistant'" :site-key="siteKey" />
          <MarketingMediaTab v-else-if="isMediaSection" :key="activeSection" />
          <MarketingMenusTab v-else-if="activeSection === 'design-menus'" :site-key="siteKey" />
          <MarketingSettingsTab v-else-if="isSettingsSection" :key="activeSection" :site-key="siteKey" />
          <section v-else-if="activeSection === 'seo-sitemap'" class="dh-glass dh-liquid rounded-[28px] p-6">
            <h3 class="text-lg font-black">{{ tr('Mapa del sitio automático', 'Automatic site map') }}</h3>
            <p class="mt-2 max-w-3xl text-sm leading-6 text-[var(--dh-text-muted)]">
              {{ tr('Dhole mantiene este mapa a partir de las páginas publicadas. No necesita editar archivos ni configuraciones manuales.', 'Dhole keeps this map updated from published pages. You do not need to edit files or manual settings.') }}
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
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.marketing-hero{position:relative;display:flex;min-width:0;align-items:center;justify-content:space-between;gap:1.5rem;overflow:hidden;border:1px solid var(--dh-border);border-radius:30px;padding:1.5rem;background:linear-gradient(135deg,color-mix(in srgb,var(--dh-primary) 11%,var(--dh-surface)),var(--dh-surface));box-shadow:var(--dh-shadow-sm)}
.hero-orb{display:grid;height:84px;width:84px;flex:none;place-items:center;border-radius:30px;background:color-mix(in srgb,var(--dh-primary) 13%,transparent);color:var(--dh-primary);box-shadow:var(--dh-glow)}
.metric-card{min-width:0;border:1px solid var(--dh-border);border-radius:22px;padding:1rem;text-align:left;background:var(--dh-input);box-shadow:var(--dh-shadow-sm);transition:180ms}
.metric-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--dh-primary) 40%,var(--dh-border));background:var(--dh-card-hover)}
.metric-icon,.task-icon{display:grid;height:38px;width:38px;place-items:center;border-radius:15px;background:color-mix(in srgb,var(--dh-primary) 11%,transparent);color:var(--dh-primary)}
.task-card{min-width:0;border:1px solid var(--dh-border);border-radius:22px;padding:1rem;background:var(--dh-input)}
.section-intro{display:flex;min-width:0;flex-wrap:wrap;align-items:center;gap:1rem;border:1px solid var(--dh-border);border-radius:26px;padding:1rem 1.1rem;background:var(--dh-input);box-shadow:var(--dh-shadow-sm)}
.section-intro-icon{display:grid;height:48px;width:48px;flex:none;place-items:center;border-radius:18px;background:color-mix(in srgb,var(--dh-primary) 11%,transparent);color:var(--dh-primary)}
@media (max-width:640px){.marketing-hero{align-items:flex-start}.hero-orb{height:58px;width:58px;border-radius:20px}.section-intro{align-items:flex-start}}
</style>
