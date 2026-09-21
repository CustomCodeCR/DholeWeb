<script setup lang="ts">
import { Globe2 } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Perfiles de navegador" subtitle="Sesiones de navegador administradas por DholeAgentService." :icon="Globe2" /><AgentEmptyState title="Preparando perfiles" /></div></template>
