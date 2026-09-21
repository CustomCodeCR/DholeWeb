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

    <p class="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
      Feature blocked by backend contract: el editor puede preparar el contenido, pero DholeAgentService todavía no expone el CRUD principal de AgentExtractionProfile para persistir el prompt.
    </p>
  </section>
</template>
