<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import dholeLogo from '../../../assets/dhole-logo.svg?raw'
const { t } = useI18n()
</script>

<template>
  <main class="grid min-h-[100dvh] min-w-0 place-items-center px-3 py-[max(0.75rem,env(safe-area-inset-top))] sm:p-6">
    <section class="dh-glass dh-liquid w-full min-w-0 max-w-md rounded-[26px] p-4 shadow-[var(--dh-shadow-lg)] sm:rounded-[38px] sm:p-8">
      <div class="mb-6 text-center sm:mb-8">
        <!-- Static, bundled SVG. Never insert runtime user HTML here. -->
        <div class="dhole-brand-lockup mx-auto mb-4 w-full max-w-[280px]" :title="[t('app.subtitle'), t('app.meaning')].join(' · ')" v-html="dholeLogo.replace(/<title[^>]*>.*?<\/title>/, '')" />
        <h1 class="sr-only">{{ t('app.name') }}</h1>
      </div>
      <RouterView />
    </section>
  </main>
</template>
