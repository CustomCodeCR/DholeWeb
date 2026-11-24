<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import dholeLogo from '../../../assets/dhole-logo.svg?raw'
const { t } = useI18n()
</script>

<template>
  <main class="grid min-h-screen place-items-center p-3 sm:p-6">
    <section class="dh-glass dh-liquid w-full max-w-md rounded-[30px] p-5 sm:rounded-[38px] sm:p-8 shadow-[var(--dh-shadow-lg)]">
      <div class="mb-8 text-center">
        <!-- Static, bundled SVG. Never insert runtime user HTML here. -->
        <div class="dhole-brand-lockup mx-auto mb-4 w-full max-w-[280px]" v-html="dholeLogo" />
        <h1 class="sr-only">{{ t('app.name') }}</h1>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('app.subtitle') }}</p>
      </div>
      <RouterView />
    </section>
  </main>
</template>
