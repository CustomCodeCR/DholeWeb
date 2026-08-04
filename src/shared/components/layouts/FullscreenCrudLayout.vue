<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'

defineProps<{
  title: string
  subtitle?: string
}>()

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="min-h-screen p-2 sm:p-6">
    <section class="mx-auto max-w-7xl space-y-3 sm:space-y-6">
      <header class="dh-glass flex flex-col gap-3 rounded-[24px] p-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-[var(--dh-radius-xl)] sm:p-4">
        <div class="flex min-w-0 items-center gap-3">
          <DhIconButton
            :icon="ArrowLeft"
            :label="t('common.back')"
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

        <div v-if="$slots.actions" class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <slot name="actions" />
        </div>
      </header>

      <section class="dh-glass dh-liquid rounded-[24px] p-3 sm:rounded-[var(--dh-radius-xl)] sm:p-6">
        <slot />
      </section>
    </section>
  </main>
</template>
