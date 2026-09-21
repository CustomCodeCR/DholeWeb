<script setup lang="ts">
import { FileCode2 } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Definiciones" subtitle="Definiciones y acciones disponibles para los agentes." :icon="FileCode2" /><AgentEmptyState title="Preparando definiciones" /></div></template>
