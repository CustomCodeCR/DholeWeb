<script setup lang="ts">
import { CalendarClock } from 'lucide-vue-next'
import { DhPageHeader } from '@/shared/components/organisms'
import AgentEmptyState from '@/modules/agent/components/AgentEmptyState.vue'
</script>
<template><div class="grid gap-6"><DhPageHeader title="Programaciones" subtitle="Ejecuciones Once, Interval y Cron." :icon="CalendarClock" /><AgentEmptyState title="Preparando programaciones" /></div></template>
