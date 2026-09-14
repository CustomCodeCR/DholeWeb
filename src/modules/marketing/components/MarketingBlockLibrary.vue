<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CircleHelp,
  Columns3,
  FileText,
  GalleryHorizontal,
  Handshake,
  Heading2,
  Image,
  Images,
  LayoutDashboard,
  Megaphone,
  MessageSquareQuote,
  Minus,
  MousePointerClick,
  Newspaper,
  PanelTop,
  PanelsTopLeft,
  Rows3,
  Target,
  Type,
  Users,
  Video,
} from 'lucide-vue-next'
import { DhEmptyState } from '@/shared/components/atoms'
import { DhBlockCard, DhSearchInput, type DhBlockCardItem } from '@/shared/components/molecules'
import { useLocale } from '@/core/stores/locale'
import {
  MARKETING_BLOCK_GROUPS,
  localizeMarketingBlock,
  type MarketingBlockIcon,
} from '@/modules/marketing/config/marketingBlockCatalog'
import { MARKETING_BLOCK_DRAG_MIME } from '@/modules/marketing/config/marketingPageBuilder'

const props = withDefaults(defineProps<{ selectedId?: string | null }>(), { selectedId: null })
const emit = defineEmits<{
  select: [blockId: string]
  dragstart: [event: DragEvent, blockId: string]
}>()

const localeStore = useLocale()
const search = ref('')

const iconMap: Record<MarketingBlockIcon, Component> = {
  heading: Heading2,
  text: Type,
  image: Image,
  video: Video,
  button: MousePointerClick,
  divider: Minus,
  hero: LayoutDashboard,
  columns: Columns3,
  'image-text': PanelsTopLeft,
  gallery: Images,
  slider: GalleryHorizontal,
  tabs: PanelTop,
  services: Briefcase,
  team: Users,
  clients: Handshake,
  stats: BarChart3,
  testimonials: MessageSquareQuote,
  cta: MousePointerClick,
  banner: Megaphone,
  form: FileText,
  meeting: CalendarClock,
  campaign: Target,
  news: Newspaper,
  faq: CircleHelp,
  'related-posts': Rows3,
}

const groups = computed(() => {
  const locale = localeStore.locale
  const query = search.value.trim().toLocaleLowerCase(locale === 'en' ? 'en-US' : 'es-CR')

  return MARKETING_BLOCK_GROUPS
    .map((group) => {
      const blocks: DhBlockCardItem[] = group.blocks
        .map((block) => ({
          id: block.id,
          title: localizeMarketingBlock(block.title, locale),
          description: localizeMarketingBlock(block.description, locale),
          category: localizeMarketingBlock(group.title, locale),
          icon: iconMap[block.icon],
        }))
        .filter((block) => {
          if (!query) return true
          return `${block.title} ${block.description} ${block.category}`.toLocaleLowerCase(locale === 'en' ? 'en-US' : 'es-CR').includes(query)
        })

      return {
        id: group.id,
        title: localizeMarketingBlock(group.title, locale),
        blocks,
      }
    })
    .filter((group) => group.blocks.length > 0)
})

function selectBlock(block: DhBlockCardItem) {
  emit('select', block.id)
}

function startBlockDrag(event: DragEvent, block: DhBlockCardItem) {
  if (event.dataTransfer) {
    event.dataTransfer.setData(MARKETING_BLOCK_DRAG_MIME, block.id)
    event.dataTransfer.effectAllowed = 'copy'
  }
  emit('select', block.id)
  emit('dragstart', event, block.id)
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col">
    <div class="border-b border-[var(--dh-border)] p-3">
      <DhSearchInput v-model="search" :placeholder="localeStore.locale === 'en' ? 'Find a block…' : 'Buscar un bloque…'" />
      <p class="mt-2 text-[11px] leading-5 text-[var(--dh-text-muted)]">
        {{ localeStore.locale === 'en' ? 'Select a block or drag it into the page.' : 'Seleccione un bloque o arrástrelo dentro de la página.' }}
      </p>
    </div>

    <div class="dh-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="groups.length" class="space-y-5">
        <section v-for="group in groups" :key="group.id" class="space-y-2">
          <h3 class="px-1 text-[10px] font-black uppercase tracking-[.14em] text-[var(--dh-text-muted)]">
            {{ group.title }}
          </h3>
          <div class="space-y-2">
            <DhBlockCard
              v-for="block in group.blocks"
              :key="block.id"
              :item="block"
              :selected="block.id === props.selectedId"
              :draggable="true"
              @select="selectBlock"
              @dragstart="startBlockDrag"
            />
          </div>
        </section>
      </div>

      <DhEmptyState
        v-else
        :icon="CircleHelp"
        :title="localeStore.locale === 'en' ? 'No blocks found' : 'No se encontraron bloques'"
        :description="localeStore.locale === 'en' ? 'Try another search.' : 'Pruebe con otra búsqueda.'"
      />
    </div>
  </div>
</template>
