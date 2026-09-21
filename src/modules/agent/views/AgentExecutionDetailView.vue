<script setup lang="ts">
import { Activity } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
const route = useRoute()
</script>
<template><div class="grid gap-6"><DhPageHeader :title="`Ejecución ${String(route.params.id)}`" subtitle="Detalle de ejecución de DholeAgentService." :icon="Activity" /><AgentEmptyState title="Preparando detalle" /></div></template>
