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
    id: 'hero-centered-text',
    title: tr('Texto centrado', 'Centered text'),
    description: tr('Mensaje principal centrado y limpio.', 'Centered, focused main message.'),
    disabled: props.disabled,
  },
  {
    id: 'hero-text-image',
    title: tr('Texto | Imagen', 'Text | Image'),
    description: tr('Texto a la izquierda e imagen a la derecha.', 'Text on the left and image on the right.'),
    disabled: props.disabled,
  },
  {
    id: 'hero-image-text',
    title: tr('Imagen | Texto', 'Image | Text'),
    description: tr('Imagen a la izquierda y texto a la derecha.', 'Image on the left and text on the right.'),
    disabled: props.disabled,
  },
  {
    id: 'hero-full-video',
    title: tr('Video completo', 'Full video'),
    description: tr('Hero enfocado en un video de ancho completo.', 'Hero focused on a full-width video.'),
    disabled: props.disabled,
  },
  {
    id: 'hero-slider',
    title: tr('Slider', 'Slider'),
    description: tr('Hero con varias piezas visuales en secuencia.', 'Hero with several visual slides in sequence.'),
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
          <div v-if="item.id === 'hero-centered-text'" class="flex w-8 flex-col items-center gap-1">
            <span class="h-1 w-6 rounded-full bg-current opacity-80" />
            <span class="h-1 w-8 rounded-full bg-current opacity-50" />
            <span class="h-1 w-4 rounded-full bg-current opacity-30" />
          </div>

          <div v-else-if="item.id === 'hero-text-image'" class="grid h-7 w-8 grid-cols-2 gap-1">
            <span class="flex flex-col justify-center gap-1">
              <i class="h-1 w-full rounded-full bg-current opacity-70" />
              <i class="h-1 w-3/4 rounded-full bg-current opacity-35" />
            </span>
            <span class="rounded-md bg-current opacity-25" />
          </div>

          <div v-else-if="item.id === 'hero-image-text'" class="grid h-7 w-8 grid-cols-2 gap-1">
            <span class="rounded-md bg-current opacity-25" />
            <span class="flex flex-col justify-center gap-1">
              <i class="h-1 w-full rounded-full bg-current opacity-70" />
              <i class="h-1 w-3/4 rounded-full bg-current opacity-35" />
            </span>
          </div>

          <div v-else-if="item.id === 'hero-full-video'" class="relative h-7 w-8 rounded-md border border-current opacity-70">
            <span class="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent border-l-current" />
          </div>

          <div v-else class="flex h-7 w-8 items-center gap-0.5">
            <span class="h-5 w-2 rounded-sm bg-current opacity-20" />
            <span class="h-7 w-3 rounded-sm bg-current opacity-65" />
            <span class="h-5 w-2 rounded-sm bg-current opacity-20" />
          </div>
        </div>
      </template>
    </DhBlockCard>
  </div>
</template>
