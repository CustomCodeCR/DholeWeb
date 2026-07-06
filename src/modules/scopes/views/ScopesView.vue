<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { KeyRound } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { DhBadge } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, DhPagination, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { ScopesService } from '@/core/services/scopesService'
import type { ScopeSelectDto } from '@/core/interfaces/scopes'
import { useToastStore } from '@/core/stores/toastStore'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()
const toastStore = useToastStore()
const loading = ref(false)
const search = ref('')
const page = ref(1)
const pageSize = ref(25)
const scopes = ref<ScopeSelectDto[]>([])

const columns: DhTableColumn<ScopeSelectDto>[] = [
  { key: 'code', label: t('common.code') },
  { key: 'name', label: t('common.name') },
]

const filteredScopes = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return scopes.value
  return scopes.value.filter((x) => `${x.code} ${x.name}`.toLowerCase().includes(q))
})

async function loadScopes() {
  try {
    loading.value = true
    scopes.value = await ScopesService.select()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los permisos.')
  } finally {
    loading.value = false
  }
}

useViewShortcuts({ save: loadScopes, refresh: loadScopes })

onMounted(loadScopes)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('scopes.title')" :subtitle="t('scopes.subtitle')" :icon="KeyRound" />

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        :title="t('scopes.title')"
        :show-create="false"
        @refresh="loadScopes"
        @filter="loadScopes"
        @search="loadScopes"
      />

      <div class="mt-5">
        <DhDataTable :columns="columns" :rows="filteredScopes" :loading="loading" :empty-text="t('scopes.empty')">
          <template #cell-code="{ value }"><DhBadge :label="String(value)" variant="primary" /></template>
        </DhDataTable>
      </div>

      <div class="mt-5"><DhPagination v-model:page="page" v-model:page-size="pageSize" :total="filteredScopes.length" /></div>
    </section>
  </section>
</template>
