<script setup lang="ts">
import { computed } from 'vue'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import { useLocale } from '@/core/stores/locale'

const props = withDefaults(defineProps<{
  distance?: number
  duration?: number
  disabled?: boolean
}>(), {
  distance: 32,
  duration: 600,
  disabled: false,
})

const emit = defineEmits<{
  'update-distance': [value: number]
  'update-duration': [value: number]
}>()

const localeStore = useLocale()
const tr = (es: string, en: string) => localeStore.locale === 'en' ? en : es

const movementOptions = computed(() => [
  { key: 'none', label: tr('Ninguno', 'None'), distance: 0 },
  { key: 'soft', label: tr('Suave', 'Soft'), distance: 16 },
  { key: 'normal', label: tr('Normal', 'Normal'), distance: 32 },
  { key: 'dynamic', label: tr('Dinámico', 'Dynamic'), distance: 64 },
])

const speedOptions = computed(() => [
  { key: 'slow', label: tr('Lenta', 'Slow'), duration: 900 },
  { key: 'normal', label: tr('Normal', 'Normal'), duration: 600 },
  { key: 'fast', label: tr('Rápida', 'Fast'), duration: 400 },
])

const movementLevel = computed(() => {
  if (props.distance <= 0) return 'none'
  if (props.distance <= 24) return 'soft'
  if (props.distance <= 48) return 'normal'
  return 'dynamic'
})

const speedLevel = computed(() => {
  if (props.duration >= 750) return 'slow'
  if (props.duration <= 500) return 'fast'
  return 'normal'
})

function setDistance(value: number) {
  if (props.disabled || value === props.distance) return
  emit('update-distance', value)
}

function setDuration(value: number) {
  if (props.disabled || value === props.duration) return
  emit('update-duration', value)
}
</script>

<template>
  <div class="space-y-4">
    <section class="space-y-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Movimiento', 'Movement') }}</p>
        <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">
          {{ tr('Elija cuánto movimiento tendrá la animación.', 'Choose how much movement the animation uses.') }}
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <DhButton
          v-for="option in movementOptions"
          :key="option.key"
          :label="option.label"
          :variant="movementLevel === option.key ? 'primary' : 'secondary'"
          size="sm"
          :disabled="disabled"
          @click="setDistance(option.distance)"
        />
      </div>
    </section>

    <section class="space-y-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-4">
      <div>
        <p class="text-xs font-black uppercase tracking-[.1em] text-[var(--dh-text)]">{{ tr('Velocidad', 'Speed') }}</p>
        <p class="mt-1 text-[11px] leading-5 text-[var(--dh-text-muted)]">
          {{ tr('Opcional: elija una velocidad simple sin configurar tiempos manualmente.', 'Optional: choose a simple speed without configuring timing manually.') }}
        </p>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <DhButton
          v-for="option in speedOptions"
          :key="option.key"
          :label="option.label"
          :variant="speedLevel === option.key ? 'primary' : 'secondary'"
          size="sm"
          :disabled="disabled"
          @click="setDuration(option.duration)"
        />
      </div>
    </section>
  </div>
</template>
