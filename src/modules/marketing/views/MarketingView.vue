<script setup lang="ts">
import { ref } from 'vue'
import { FileImage, FileText, FolderTree, Megaphone, Menu, Settings2 } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import MarketingContentTab from '@/modules/marketing/components/MarketingContentTab.vue'
import MarketingMediaTab from '@/modules/marketing/components/MarketingMediaTab.vue'
import MarketingTaxonomiesTab from '@/modules/marketing/components/MarketingTaxonomiesTab.vue'
import MarketingMenusTab from '@/modules/marketing/components/MarketingMenusTab.vue'
import MarketingSettingsTab from '@/modules/marketing/components/MarketingSettingsTab.vue'

const tabs = [
  { key: 'content', label: 'Contenido', icon: FileText },
  { key: 'media', label: 'Medios', icon: FileImage },
  { key: 'taxonomies', label: 'Taxonomías', icon: FolderTree },
  { key: 'menus', label: 'Menús', icon: Menu },
  { key: 'settings', label: 'Ajustes del sitio', icon: Settings2 },
] as const

type TabKey = (typeof tabs)[number]['key']
const activeTab = ref<TabKey>('content')
const siteKey = ref('main')
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Mercadeo y contenido"
      subtitle="Administre páginas, noticias, banners, medios, taxonomías, menús, SEO y configuración pública desde ContentService."
      :icon="Megaphone"
    >
      <template #actions>
        <label class="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] opacity-60">
          Site
          <input v-model="siteKey" class="site-field w-32 normal-case tracking-normal" placeholder="main" />
        </label>
      </template>
    </DhPageHeader>

    <div class="dh-glass dh-liquid rounded-[28px] p-2">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition"
          :class="activeTab === tab.key ? 'bg-[var(--dh-primary)] text-white shadow-lg' : 'hover:bg-black/5 dark:hover:bg-white/10'"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <MarketingContentTab v-if="activeTab === 'content'" :site-key="siteKey || 'main'" />
    <MarketingMediaTab v-else-if="activeTab === 'media'" />
    <MarketingTaxonomiesTab v-else-if="activeTab === 'taxonomies'" :site-key="siteKey || 'main'" />
    <MarketingMenusTab v-else-if="activeTab === 'menus'" :site-key="siteKey || 'main'" />
    <MarketingSettingsTab v-else :site-key="siteKey || 'main'" />
  </section>
</template>

<style scoped>
.site-field {
  border: 1px solid var(--dh-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--dh-surface) 86%, transparent);
  padding: .65rem .8rem;
  color: inherit;
  outline: none;
}
.site-field:focus {
  border-color: var(--dh-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dh-primary) 14%, transparent);
}
</style>
