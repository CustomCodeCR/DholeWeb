<script setup lang="ts">
import { User } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { DhEntityDetailPage } from '@/shared/components/organisms'
const route = useRoute()
</script>
<template><DhEntityDetailPage title="Detalle de usuario" :subtitle="String(route.params.id)" :icon="User"><p class="text-sm font-semibold text-[var(--dh-text-muted)]">El detalle completo se abre normalmente desde el drawer de usuarios para mantener el contexto de trabajo.</p></DhEntityDetailPage></template>
