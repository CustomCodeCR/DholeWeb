<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
  error?: string
  required?: boolean
}>()
</script>

<template>
  <div class="space-y-1.5">
    <div v-if="label || description">
      <label v-if="label" class="block text-xs font-semibold text-[var(--dh-text-soft)]">
        {{ label }}
        <span v-if="required" class="text-[var(--dh-primary)]">*</span>
      </label>

      <p v-if="description" class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
        {{ description }}
      </p>
    </div>

    <slot />

    <p v-if="error" class="text-xs text-red-500">
      {{ error }}
    </p>
  </div>
</template>
