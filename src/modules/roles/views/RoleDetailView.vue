<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { DhEntityDetailPage } from '@/shared/components/organisms'
const route = useRoute()
</script>
<template><DhEntityDetailPage title="Detalle de rol" :subtitle="String(route.params.id)" :icon="ShieldCheck"><p class="text-sm font-semibold text-[var(--dh-text-muted)]">El detalle completo se abre desde el drawer de roles.</p></DhEntityDetailPage></template>
