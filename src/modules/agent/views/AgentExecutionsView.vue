<script setup lang="ts">
import { History } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Ejecuciones" subtitle="Historial y estado de ejecuciones." :icon="History" /><AgentEmptyState title="Preparando ejecuciones" /></div></template>
