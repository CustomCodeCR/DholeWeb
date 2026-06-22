<script setup lang="ts">
import { Filter, Plus, RefreshCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import DhButton from '@/shared/components/atoms/DhButton.vue'
import DhIconButton from '@/shared/components/atoms/DhIconButton.vue'
import DhSearchInput from './DhSearchInput.vue'

withDefaults(
  defineProps<{
    search: string
    title?: string
    createLabel?: string
    showCreate?: boolean
  }>(),
  { showCreate: true },
)

const emit = defineEmits<{ 'update:search': [value: string]; create: []; refresh: []; filter: []; search: [] }>()
const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
    <div>
      <h2 v-if="title" class="text-xl font-black tracking-tight text-[var(--dh-text)]">{{ title }}</h2>
      <slot name="description" />
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <DhSearchInput class="w-full md:w-80" :model-value="search" @update:model-value="emit('update:search', $event)" @search="emit('search')" />
      <DhIconButton :icon="Filter" :label="t('common.filters')" variant="secondary" @click="emit('filter')" />
      <DhIconButton :icon="RefreshCcw" :label="t('common.refresh')" variant="secondary" @click="emit('refresh')" />
      <DhButton v-if="showCreate" :icon="Plus" :label="createLabel ?? t('common.create')" @click="emit('create')" />
    </div>
  </div>
</template>
