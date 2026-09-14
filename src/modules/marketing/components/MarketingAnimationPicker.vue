<script setup lang="ts">
import { computed } from 'vue'
import { Ban, MoveLeft, MoveRight, MoveUp, Sparkles, ZoomIn } from 'lucide-vue-next'
import type { CmsMotionPreset } from '@/core/interfaces/pageBuilder'
import { useLocale } from '@/core/stores/locale'
import DhBlockCard, { type DhBlockCardItem } from '@/shared/components/molecules/DhBlockCard.vue'

type MarketingAnimationPreset = 'none' | 'fade' | 'slide-up' | 'slide-left' | 'slide-right' | 'zoom-in'

interface MarketingAnimationOption extends DhBlockCardItem {
  preset: MarketingAnimationPreset
  previewClass: string
}

const props = withDefaults(defineProps<{
  modelValue?: CmsMotionPreset | null
  disabled?: boolean
}>(), {
  modelValue: 'none',
  disabled: false,
})

const emit = defineEmits<{
  select: [preset: CmsMotionPreset]
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const options = computed<MarketingAnimationOption[]>(() => [
  {
    id: 'none',
    preset: 'none',
    title: tr('Sin animación', 'No animation'),
    description: tr('La sección aparece sin movimiento.', 'The section appears without movement.'),
    icon: Ban,
    previewClass: 'preview-none',
    disabled: props.disabled,
  },
  {
    id: 'fade',
    preset: 'fade',
    title: tr('Aparecer suavemente', 'Fade in softly'),
    description: tr('La sección aparece de forma gradual.', 'The section appears gradually.'),
    icon: Sparkles,
    previewClass: 'preview-fade',
    disabled: props.disabled,
  },
  {
    id: 'slide-up',
    preset: 'slide-up',
    title: tr('Subir suavemente', 'Slide up softly'),
    description: tr('La sección entra suavemente desde abajo.', 'The section slides softly upward.'),
    icon: MoveUp,
    previewClass: 'preview-slide-up',
    disabled: props.disabled,
  },
  {
    id: 'slide-right',
    preset: 'slide-right',
    title: tr('Entrar desde izquierda', 'Enter from left'),
    description: tr('La sección entra suavemente desde la izquierda.', 'The section enters softly from the left.'),
    icon: MoveRight,
    previewClass: 'preview-slide-right',
    disabled: props.disabled,
  },
  {
    id: 'slide-left',
    preset: 'slide-left',
    title: tr('Entrar desde derecha', 'Enter from right'),
    description: tr('La sección entra suavemente desde la derecha.', 'The section enters softly from the right.'),
    icon: MoveLeft,
    previewClass: 'preview-slide-left',
    disabled: props.disabled,
  },
  {
    id: 'zoom-in',
    preset: 'zoom-in',
    title: tr('Zoom suave', 'Soft zoom'),
    description: tr('La sección aparece con un acercamiento suave.', 'The section appears with a soft zoom.'),
    icon: ZoomIn,
    previewClass: 'preview-zoom',
    disabled: props.disabled,
  },
])

function selectOption(option: MarketingAnimationOption) {
  if (props.disabled || option.preset === props.modelValue) return
  emit('select', option.preset)
}
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2">
    <div
      v-for="option in options"
      :key="option.id"
      class="animation-option"
      :class="option.previewClass"
    >
      <DhBlockCard
        :item="option"
        :selected="modelValue === option.preset"
        @select="selectOption(option)"
      >
        <template #end>
          <span class="preview-stage" aria-hidden="true">
            <span class="preview-shape">
              <span class="preview-line preview-line-wide" />
              <span class="preview-line" />
            </span>
          </span>
        </template>
      </DhBlockCard>
    </div>
  </div>
</template>

<style scoped>
.preview-stage{display:grid;height:42px;width:54px;flex:none;place-items:center;overflow:hidden;border-radius:12px;background:color-mix(in srgb,var(--dh-primary) 7%,transparent)}
.preview-shape{display:flex;width:34px;flex-direction:column;gap:4px;border-radius:8px;border:1px solid color-mix(in srgb,var(--dh-primary) 28%,var(--dh-border));background:var(--dh-surface);padding:7px;box-shadow:var(--dh-shadow-sm)}
.preview-line{display:block;height:3px;width:65%;border-radius:999px;background:color-mix(in srgb,var(--dh-primary) 45%,var(--dh-text-muted))}.preview-line-wide{width:100%}
.animation-option:hover .preview-shape,.animation-option:focus-within .preview-shape{animation-duration:.75s;animation-timing-function:cubic-bezier(.2,.8,.2,1);animation-fill-mode:both}
.preview-fade:hover .preview-shape,.preview-fade:focus-within .preview-shape{animation-name:preview-fade}
.preview-slide-up:hover .preview-shape,.preview-slide-up:focus-within .preview-shape{animation-name:preview-slide-up}
.preview-slide-left:hover .preview-shape,.preview-slide-left:focus-within .preview-shape{animation-name:preview-slide-left}
.preview-slide-right:hover .preview-shape,.preview-slide-right:focus-within .preview-shape{animation-name:preview-slide-right}
.preview-zoom:hover .preview-shape,.preview-zoom:focus-within .preview-shape{animation-name:preview-zoom}
@keyframes preview-fade{0%{opacity:.15}100%{opacity:1}}
@keyframes preview-slide-up{0%{opacity:.2;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
@keyframes preview-slide-left{0%{opacity:.2;transform:translateX(12px)}100%{opacity:1;transform:translateX(0)}}
@keyframes preview-slide-right{0%{opacity:.2;transform:translateX(-12px)}100%{opacity:1;transform:translateX(0)}}
@keyframes preview-zoom{0%{opacity:.2;transform:scale(.72)}100%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.animation-option:hover .preview-shape,.animation-option:focus-within .preview-shape{animation:none}}
</style>
