<script setup lang="ts">
import { computed } from 'vue'
import DhBlockCard, { type DhBlockCardItem } from '@/shared/components/molecules/DhBlockCard.vue'
import { useLocale } from '@/core/stores/locale'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  select: [value: string]
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const presets = computed<DhBlockCardItem[]>(() => [
  {
    id: 'services-3-cards',
    title: tr('3 Cards', '3 Cards'),
    description: tr('Tres servicios destacados en una fila.', 'Three featured services in one row.'),
    disabled: props.disabled,
  },
  {
    id: 'services-4-cards',
    title: tr('4 Cards', '4 Cards'),
    description: tr('Cuatro servicios compactos en una cuadrícula.', 'Four compact services in a grid.'),
    disabled: props.disabled,
  },
  {
    id: 'services-image-cards',
    title: tr('Cards con imagen', 'Cards with image'),
    description: tr('Cada servicio se presenta con una imagen destacada.', 'Each service is presented with a featured image.'),
    disabled: props.disabled,
  },
  {
    id: 'services-icon-cards',
    title: tr('Cards con iconos', 'Cards with icons'),
    description: tr('Servicios resumidos con iconos fáciles de reconocer.', 'Services summarized with easy-to-recognize icons.'),
    disabled: props.disabled,
  },
  {
    id: 'services-slider',
    title: tr('Slider', 'Slider'),
    description: tr('Servicios navegables en una secuencia horizontal.', 'Services browsed in a horizontal sequence.'),
    disabled: props.disabled,
  },
  {
    id: 'services-alternating-list',
    title: tr('Lista alternada', 'Alternating list'),
    description: tr('Servicios en filas alternadas para una lectura más editorial.', 'Services in alternating rows for a more editorial layout.'),
    disabled: props.disabled,
  },
])

function choose(item: DhBlockCardItem) {
  if (!item.disabled) emit('select', item.id)
}
</script>

<template>
  <div class="grid gap-2">
    <DhBlockCard
      v-for="preset in presets"
      :key="preset.id"
      :item="preset"
      :selected="modelValue === preset.id"
      @select="choose"
    >
      <template #icon="{ item }">
        <div class="grid h-full w-full place-items-center" aria-hidden="true">
          <div v-if="item.id === 'services-3-cards'" class="grid h-7 w-8 grid-cols-3 gap-0.5">
            <span v-for="n in 3" :key="n" class="rounded-sm border border-current opacity-50" />
          </div>

          <div v-else-if="item.id === 'services-4-cards'" class="grid h-7 w-8 grid-cols-2 gap-0.5">
            <span v-for="n in 4" :key="n" class="rounded-sm border border-current opacity-50" />
          </div>

          <div v-else-if="item.id === 'services-image-cards'" class="grid h-7 w-8 grid-cols-2 gap-0.5">
            <span v-for="n in 2" :key="n" class="flex flex-col overflow-hidden rounded-sm border border-current opacity-60">
              <i class="h-3 bg-current opacity-30" />
              <i class="m-0.5 h-1 rounded-full bg-current opacity-60" />
            </span>
          </div>

          <div v-else-if="item.id === 'services-icon-cards'" class="grid h-7 w-8 grid-cols-3 gap-0.5">
            <span v-for="n in 3" :key="n" class="flex flex-col items-center justify-center gap-0.5 rounded-sm border border-current opacity-60">
              <i class="h-2 w-2 rounded-full bg-current opacity-50" />
              <i class="h-0.5 w-2 rounded-full bg-current opacity-60" />
            </span>
          </div>

          <div v-else-if="item.id === 'services-slider'" class="flex h-7 w-8 items-center gap-0.5">
            <span class="h-5 w-2 rounded-sm border border-current opacity-25" />
            <span class="h-7 w-3 rounded-sm border border-current opacity-70" />
            <span class="h-5 w-2 rounded-sm border border-current opacity-25" />
          </div>

          <div v-else class="flex h-7 w-8 flex-col justify-center gap-1">
            <span class="h-1.5 w-6 self-start rounded-full bg-current opacity-65" />
            <span class="h-1.5 w-6 self-end rounded-full bg-current opacity-35" />
            <span class="h-1.5 w-6 self-start rounded-full bg-current opacity-65" />
          </div>
        </div>
      </template>
    </DhBlockCard>
  </div>
</template>
