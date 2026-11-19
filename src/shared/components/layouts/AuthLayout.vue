<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <main class="grid min-h-[100dvh] min-w-0 place-items-center px-3 py-[max(0.75rem,env(safe-area-inset-top))] sm:p-6">
    <section class="dh-glass dh-liquid w-full min-w-0 max-w-md rounded-[26px] p-4 shadow-[var(--dh-shadow-lg)] sm:rounded-[38px] sm:p-8">
      <div class="mb-6 text-center sm:mb-8">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[22px] bg-[var(--dh-primary)] text-xl font-black text-white shadow-[var(--dh-glow)] sm:h-16 sm:w-16 sm:rounded-[26px] sm:text-2xl">D</div>
        <h1 class="break-words text-2xl font-black text-[var(--dh-text)] sm:text-3xl">{{ t('app.name') }}</h1>
        <p class="mt-1 break-words text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('app.subtitle') }}</p>
      </div>
      <RouterView />
    </section>
  </main>
</template>
