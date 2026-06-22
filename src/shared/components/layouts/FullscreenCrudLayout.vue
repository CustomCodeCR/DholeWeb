<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'

defineProps<{
  title: string
  subtitle?: string
}>()

const router = useRouter()
</script>

<template>
  <main class="min-h-screen p-6">
    <section class="mx-auto max-w-7xl space-y-6">
      <header class="dh-glass flex items-center justify-between rounded-[var(--dh-radius-xl)] p-4">
        <div class="flex items-center gap-3">
          <DhIconButton
            :icon="ArrowLeft"
            label="Volver"
            variant="secondary"
            @click="router.back()"
          />

          <div>
            <h1 class="text-xl font-black text-[var(--dh-text)]">
              {{ title }}
            </h1>

            <p v-if="subtitle" class="text-sm text-[var(--dh-text-muted)]">
              {{ subtitle }}
            </p>
          </div>
        </div>

        <div v-if="$slots.actions" class="flex items-center gap-2">
          <slot name="actions" />
        </div>
      </header>

      <section class="dh-glass dh-liquid rounded-[var(--dh-radius-xl)] p-6">
        <slot />
      </section>
    </section>
  </main>
</template>
