<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  FileImage,
  FileText,
  FolderTree,
  Image,
  LayoutDashboard,
  Megaphone,
  Menu,
  Newspaper,
  Plus,
  Settings2,
  X,
} from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import { ContentService } from '@/core/services/contentService'
import { useToastStore } from '@/core/stores/toastStore'
import type { ContentType, EditorDashboardDto } from '@/core/interfaces/content'
import MarketingContentTab from '@/modules/marketing/components/MarketingContentTab.vue'
import MarketingMediaTab from '@/modules/marketing/components/MarketingMediaTab.vue'
import MarketingTaxonomiesTab from '@/modules/marketing/components/MarketingTaxonomiesTab.vue'
import MarketingMenusTab from '@/modules/marketing/components/MarketingMenusTab.vue'
import MarketingSettingsTab from '@/modules/marketing/components/MarketingSettingsTab.vue'

const siteKey = 'main'
const toastStore = useToastStore()

const sections = [
  { key: 'dashboard', label: 'Escritorio', icon: LayoutDashboard },
  { key: 'pages', label: 'Páginas', icon: FileText },
  { key: 'news', label: 'Noticias', icon: Newspaper },
  { key: 'banners', label: 'Banners', icon: Image },
  { key: 'media', label: 'Multimedia', icon: FileImage },
  { key: 'taxonomies', label: 'Categorías y etiquetas', icon: FolderTree },
  { key: 'menus', label: 'Menús', icon: Menu },
  { key: 'settings', label: 'Ajustes', icon: Settings2 },
] as const

type SectionKey = (typeof sections)[number]['key']
const activeSection = ref<SectionKey>('dashboard')
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

const contentSection = computed(() => {
  if (activeSection.value === 'pages') return { type: 'Page' as ContentType, title: 'Páginas', singular: 'Página' }
  if (activeSection.value === 'news') return { type: 'News' as ContentType, title: 'Noticias', singular: 'Noticia' }
  if (activeSection.value === 'banners') return { type: 'Banner' as ContentType, title: 'Banners', singular: 'Banner' }
  return null
})

const dashboardCards = computed(() => [
  { section: 'pages' as SectionKey, label: 'Páginas', value: dashboard.value.pages, icon: FileText },
  { section: 'news' as SectionKey, label: 'Noticias', value: dashboard.value.news, icon: Newspaper },
  { section: 'banners' as SectionKey, label: 'Banners', value: dashboard.value.banners, icon: Image },
  { section: 'media' as SectionKey, label: 'Archivos', value: dashboard.value.media, icon: FileImage },
])

async function loadDashboard() {
  dashboardLoading.value = true
  try {
    dashboard.value = await ContentService.getEditorDashboard(siteKey)
  } catch (error) {
    toastStore.backendWarning(error, 'No se pudo actualizar el resumen de Mercadeo.')
  } finally {
    dashboardLoading.value = false
  }
}

async function createContent(section: 'pages' | 'news' | 'banners') {
  addMenuOpen.value = false
  activeSection.value = section
  await nextTick()
  createNonce.value += 1
}

function openSection(section: SectionKey) {
  activeSection.value = section
  addMenuOpen.value = false
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
      subtitle="Cree, edite y publique el contenido del sitio de forma sencilla."
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
            <button @click="createContent('pages')"><FileText class="h-4 w-4" /> Página</button>
            <button @click="createContent('news')"><Newspaper class="h-4 w-4" /> Noticia</button>
            <button @click="createContent('banners')"><Image class="h-4 w-4" /> Banner</button>
          </div>
        </div>
      </template>
    </DhPageHeader>

    <div class="grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
      <aside class="dh-glass dh-liquid h-fit rounded-[28px] p-2 xl:sticky xl:top-4">
        <nav class="space-y-1">
          <button
            v-for="section in sections"
            :key="section.key"
            class="nav-item"
            :class="{ 'nav-item-active': activeSection === section.key }"
            @click="openSection(section.key)"
          >
            <component :is="section.icon" class="h-4 w-4" />
            <span>{{ section.label }}</span>
          </button>
        </nav>
      </aside>

      <main class="min-w-0">
        <div v-if="activeSection === 'dashboard'" class="space-y-5">
          <section class="dh-glass dh-liquid rounded-[30px] p-6">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p class="text-xs font-black uppercase tracking-[.18em] text-[var(--dh-primary)]">Escritorio</p>
                <h2 class="mt-1 text-2xl font-black">Contenido del sitio</h2>
                <p class="mt-1 text-sm opacity-60">Todo lo importante de Mercadeo en un solo lugar.</p>
              </div>
              <span v-if="dashboardLoading" class="text-xs opacity-50">Actualizando…</span>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <p class="mt-1 text-sm opacity-60">Empiece con el tipo de publicación que necesita.</p>
              <div class="mt-5 grid gap-3 sm:grid-cols-3">
                <button class="quick-create" @click="createContent('pages')"><FileText class="h-6 w-6" /><span>Página</span></button>
                <button class="quick-create" @click="createContent('news')"><Newspaper class="h-6 w-6" /><span>Noticia</span></button>
                <button class="quick-create" @click="createContent('banners')"><Image class="h-6 w-6" /><span>Banner</span></button>
              </div>
            </div>

            <div class="dh-glass dh-liquid rounded-[30px] p-6">
              <h3 class="text-lg font-black">Estado editorial</h3>
              <div class="mt-5 space-y-3">
                <div class="status-row"><span>Borradores</span><strong>{{ dashboard.drafts }}</strong></div>
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
        <MarketingMediaTab v-else-if="activeSection === 'media'" />
        <MarketingTaxonomiesTab v-else-if="activeSection === 'taxonomies'" :site-key="siteKey" />
        <MarketingMenusTab v-else-if="activeSection === 'menus'" :site-key="siteKey" />
        <MarketingSettingsTab v-else :site-key="siteKey" />
      </main>
    </div>
  </section>
</template>

<style scoped>
.primary-action{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:13px;background:var(--dh-primary);padding:.72rem 1rem;color:#fff;font-size:.82rem;font-weight:800;transition:160ms}.primary-action:hover{filter:brightness(1.05)}.create-menu{position:absolute;right:0;top:calc(100% + .55rem);z-index:40;width:220px;overflow:hidden;border:1px solid var(--dh-border);border-radius:16px;background:var(--dh-surface);box-shadow:0 18px 45px rgb(0 0 0 / .16)}.create-menu>button{display:flex;width:100%;align-items:center;gap:.65rem;padding:.75rem 1rem;text-align:left;font-size:.84rem;font-weight:700;transition:150ms}.create-menu>button:hover{background:color-mix(in srgb,var(--dh-primary) 9%,transparent);color:var(--dh-primary)}.nav-item{display:flex;width:100%;align-items:center;gap:.7rem;border-radius:14px;padding:.72rem .8rem;text-align:left;font-size:.84rem;font-weight:750;transition:160ms}.nav-item:hover{background:color-mix(in srgb,var(--dh-primary) 7%,transparent)}.nav-item-active{background:color-mix(in srgb,var(--dh-primary) 12%,transparent);color:var(--dh-primary)}.dashboard-card{display:flex;min-height:140px;flex-direction:column;align-items:flex-start;border:1px solid var(--dh-border);border-radius:18px;padding:1rem;text-align:left;transition:170ms}.dashboard-card:hover{border-color:color-mix(in srgb,var(--dh-primary) 50%,var(--dh-border));transform:translateY(-1px);box-shadow:0 10px 25px rgb(0 0 0 / .06)}.quick-create{display:flex;min-height:110px;flex-direction:column;align-items:center;justify-content:center;gap:.65rem;border:1px dashed var(--dh-border);border-radius:18px;font-weight:800;transition:170ms}.quick-create:hover{border-color:var(--dh-primary);background:color-mix(in srgb,var(--dh-primary) 7%,transparent);color:var(--dh-primary)}.status-row{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dh-border);padding:.7rem 0;font-size:.9rem}.status-row:last-child{border-bottom:0}.status-row strong{font-size:1.05rem}
</style>
