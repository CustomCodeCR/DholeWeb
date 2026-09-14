<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label?: string
    presets?: string[]
    disabled?: boolean
    showValue?: boolean
  }>(),
  {
    presets: () => [],
    disabled: false,
    showValue: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const nativeValue = computed(() => (/^#[0-9a-fA-F]{6}$/.test(props.modelValue) ? props.modelValue : '#000000'))

function update(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <fieldset class="min-w-0" :disabled="disabled">
    <legend
      v-if="label"
      class="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]"
    >
      {{ label }}
    </legend>

    <div
      class="flex min-h-11 min-w-0 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-2 shadow-[var(--dh-shadow-sm)] backdrop-blur-xl"
    >
      <input
        :value="nativeValue"
        type="color"
        class="h-8 w-10 shrink-0 cursor-pointer rounded-xl border-0 bg-transparent p-0 disabled:cursor-not-allowed"
        @input="update(($event.target as HTMLInputElement).value)"
      />
      <input
        v-if="showValue"
        :value="modelValue"
        type="text"
        class="h-8 min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold text-[var(--dh-text)] outline-none disabled:cursor-not-allowed"
        @input="update(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div v-if="presets.length" class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="color in presets"
        :key="color"
        type="button"
        :disabled="disabled"
        class="h-8 w-8 rounded-xl border border-[var(--dh-border)] shadow-[var(--dh-shadow-sm)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
        :class="modelValue.toLowerCase() === color.toLowerCase() && 'ring-2 ring-[var(--dh-primary)] ring-offset-2 ring-offset-[var(--dh-bg)]'"
        :style="{ backgroundColor: color }"
        :aria-label="color"
        :title="color"
        @click="update(color)"
      />
    </div>
  </fieldset>
</template>
