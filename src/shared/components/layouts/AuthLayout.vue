<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <main class="grid min-h-screen place-items-center p-3 sm:p-6">
    <section class="dh-glass dh-liquid w-full max-w-md rounded-[30px] p-5 sm:rounded-[38px] sm:p-8 shadow-[var(--dh-shadow-lg)]">
      <div class="mb-8 text-center">
        <img src="/dhole-mark.svg" alt="DHOLE ERP" class="mx-auto mb-4 h-16 w-16" />
        <h1 class="text-3xl font-black text-[var(--dh-text)]">{{ t('app.name') }}</h1>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('app.subtitle') }}</p>
      </div>
      <RouterView />
    </section>
  </main>
</template>
