<script setup lang="ts">
import { Ship } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Proveedores" subtitle="Administración de providers de DholeAgentService." :icon="Ship" /><AgentEmptyState title="Preparando proveedores" description="La administración se habilita en la siguiente fase." /></div></template>
