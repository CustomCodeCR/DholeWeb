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
  <main class="min-h-screen min-w-0 p-2 sm:p-4 lg:p-6">
    <section class="mx-auto min-w-0 max-w-7xl space-y-3 sm:space-y-5 lg:space-y-6">
      <header class="dh-glass flex min-w-0 flex-col gap-3 rounded-[24px] p-3 sm:flex-row sm:items-center sm:justify-between sm:rounded-[var(--dh-radius-xl)] sm:p-4">
        <div class="flex min-w-0 items-start gap-3 sm:items-center">
          <DhIconButton
            :icon="ArrowLeft"
            :label="t('common.back')"
            variant="secondary"
            class="shrink-0"
            @click="router.back()"
          />

          <div class="min-w-0 flex-1">
            <h1 class="break-words text-xl font-black text-[var(--dh-text)] sm:text-2xl">
              {{ title }}
            </h1>

            <p v-if="subtitle" class="mt-1 break-words text-sm text-[var(--dh-text-muted)]">
              {{ subtitle }}
            </p>
          </div>
        </div>

        <div v-if="$slots.actions" class="dh-responsive-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <slot name="actions" />
        </div>
      </header>

      <section class="dh-glass dh-liquid min-w-0 overflow-hidden rounded-[24px] p-3 sm:rounded-[var(--dh-radius-xl)] sm:p-5 lg:p-6">
        <slot />
      </section>
    </section>
  </main>
</template>
