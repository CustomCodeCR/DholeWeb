<script setup lang="ts">
import { DhTextarea } from '@/shared/components/atoms'

withDefaults(
  defineProps<{
    modelValue: string | null
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <section class="grid gap-3">
    <DhTextarea
      :model-value="modelValue"
      label="Prompt de Hermes"
      :rows="16"
      :disabled="disabled"
      placeholder="Defina las instrucciones que Hermes utilizará durante la extracción."
      @update:model-value="emit('update:modelValue', $event)"
    />

    <p class="rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-semibold text-[var(--dh-text-muted)]">
      El prompt se guarda dentro del perfil de extracción y puede usar las variables publicadas por DholeAgentService.
    </p>
  </section>
</template>
