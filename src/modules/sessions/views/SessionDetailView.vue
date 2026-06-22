<script setup lang="ts">
import { MonitorCheck } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { DhEntityDetailPage } from '@/shared/components/organisms'
const route = useRoute()
</script>
<template><DhEntityDetailPage title="Detalle de sesión" :subtitle="String(route.params.id)" :icon="MonitorCheck"><p class="text-sm font-semibold text-[var(--dh-text-muted)]">La administración de sesiones se realiza desde la vista de sesiones.</p></DhEntityDetailPage></template>
