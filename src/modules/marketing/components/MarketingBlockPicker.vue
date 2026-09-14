<script setup lang="ts">
import { computed, type Component } from 'vue'
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
import { DhBlockPicker, type DhBlockPickerItem } from '@/shared/components/organisms'
import { useLocale } from '@/core/stores/locale'
import {
  MARKETING_BLOCK_GROUPS,
  localizeMarketingBlock,
  type MarketingBlockIcon,
} from '@/modules/marketing/config/marketingBlockCatalog'

const props = withDefaults(defineProps<{ modelValue?: string | null }>(), { modelValue: null })
const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [blockId: string]
}>()

const localeStore = useLocale()

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

const categories = computed(() => MARKETING_BLOCK_GROUPS.map((group) => ({
  key: group.id,
  label: localizeMarketingBlock(group.title, localeStore.locale),
})))

const items = computed<DhBlockPickerItem[]>(() => MARKETING_BLOCK_GROUPS.flatMap((group) =>
  group.blocks.map((block) => ({
    id: block.id,
    title: localizeMarketingBlock(block.title, localeStore.locale),
    description: localizeMarketingBlock(block.description, localeStore.locale),
    category: group.id,
    icon: iconMap[block.icon],
    keywords: [
      localizeMarketingBlock(group.title, localeStore.locale),
      block.id.replaceAll('-', ' '),
    ],
  })),
))

function selectBlock(item: DhBlockPickerItem) {
  emit('update:modelValue', item.id)
  emit('select', item.id)
}
</script>

<template>
  <DhBlockPicker
    :model-value="props.modelValue"
    :categories="categories"
    :items="items"
    :search-placeholder="localeStore.locale === 'en' ? 'Search section...' : 'Buscar sección...'"
    :empty-title="localeStore.locale === 'en' ? 'No sections found' : 'No se encontraron secciones'"
    :empty-description="localeStore.locale === 'en' ? 'Try another search.' : 'Pruebe con otra búsqueda.'"
    @update:model-value="emit('update:modelValue', $event)"
    @select="selectBlock"
  />
</template>
