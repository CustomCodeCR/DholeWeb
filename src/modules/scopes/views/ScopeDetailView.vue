<script setup lang="ts">
import { KeyRound } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { DhEntityDetailPage } from '@/shared/components/organisms'
const route = useRoute()
</script>
<template><DhEntityDetailPage title="Detalle de permiso" :subtitle="String(route.params.id)" :icon="KeyRound"><p class="text-sm font-semibold text-[var(--dh-text-muted)]">Los scopes son de solo lectura desde Auth.</p></DhEntityDetailPage></template>
