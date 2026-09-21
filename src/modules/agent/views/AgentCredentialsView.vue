<script setup lang="ts">
import { KeyRound } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Credenciales" subtitle="Referencias seguras a secretos; nunca contraseñas reales." :icon="KeyRound" /><AgentEmptyState title="Preparando credenciales" /></div></template>
