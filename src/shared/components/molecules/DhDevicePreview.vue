<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Smartphone, Tablet } from 'lucide-vue-next'
import DhButton from '@/shared/components/atoms/DhButton.vue'

export type DhDeviceKind = 'desktop' | 'tablet' | 'mobile'

const props = withDefaults(
  defineProps<{
    modelValue: DhDeviceKind
    labels: Record<DhDeviceKind, string>
    widths?: Partial<Record<DhDeviceKind, number>>
    showControls?: boolean
    framed?: boolean
  }>(),
  {
    widths: () => ({ desktop: 1280, tablet: 768, mobile: 390 }),
    showControls: true,
    framed: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: DhDeviceKind]
}>()

const devices = [
  { key: 'desktop' as const, icon: Monitor },
  { key: 'tablet' as const, icon: Tablet },
  { key: 'mobile' as const, icon: Smartphone },
]

const previewWidth = computed(() => props.widths?.[props.modelValue] ?? 1280)
</script>

<template>
  <section class="min-w-0">
    <div v-if="showControls" class="dh-scrollbar mb-3 flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
      <DhButton
        v-for="device in devices"
        :key="device.key"
        :label="labels[device.key]"
        :icon="device.icon"
        :variant="modelValue === device.key ? 'secondary' : 'ghost'"
        size="sm"
        @click="emit('update:modelValue', device.key)"
      />
    </div>

    <div class="dh-scrollbar max-w-full overflow-auto rounded-[var(--dh-radius-xl)] bg-black/[0.04] p-3 dark:bg-white/[0.04]">
      <div
        class="mx-auto min-h-48 min-w-0 overflow-hidden bg-[var(--dh-bg)] transition-[width,max-width] duration-200"
        :class="framed && 'rounded-[var(--dh-radius-xl)] border border-[var(--dh-border)] shadow-[var(--dh-shadow-lg)]'"
        :style="{ width: `${previewWidth}px`, maxWidth: '100%' }"
      >
        <slot :device="modelValue" :width="previewWidth" />
      </div>
    </div>
  </section>
</template>
