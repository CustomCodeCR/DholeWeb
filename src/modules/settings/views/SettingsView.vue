<script setup lang="ts">
import { Keyboard, Palette, Settings } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { DhPageHeader } from '@/shared/components/organisms'
const router = useRouter(); const { t } = useI18n()
const cards = [
  { title: t('settings.appearance'), description: 'Tema claro/oscuro e idioma.', icon: Palette, path: '/settings/appearance' },
  { title: t('settings.shortcuts'), description: 'Atajos configurables en el navegador.', icon: Keyboard, path: '/settings/shortcuts' },
]
</script>
<template><section class="space-y-6"><DhPageHeader :title="t('settings.title')" :subtitle="t('settings.subtitle')" :icon="Settings" /><div class="grid gap-4 md:grid-cols-2"><button v-for="card in cards" :key="card.path" class="dh-glass dh-liquid dh-card-hover rounded-[32px] p-6 text-left" @click="router.push(card.path)"><div class="flex items-center gap-4"><div class="flex h-12 w-12 items-center justify-center rounded-[22px] bg-red-500/10 text-[var(--dh-primary)]"><component :is="card.icon" class="h-6 w-6" /></div><div><h3 class="text-lg font-black text-[var(--dh-text)]">{{ card.title }}</h3><p class="text-sm font-semibold text-[var(--dh-text-muted)]">{{ card.description }}</p></div></div></button></div></section></template>
