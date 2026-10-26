<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'

type Supplier = CatalogItemDto & { category: 'agents' | 'carriers' }
const auth = useAuthStore()
const route = useRoute()
const { t } = useI18n()
const allowed = computed(() => auth.hasScope(CONFIG_SCOPES.catalogItems.view) ||
  auth.hasScope(CONFIG_SCOPES.catalogSelects.view) || auth.hasScope(CONFIG_SCOPES.catalogSelects.select))
const section = computed(() => String(route.meta.srmSection || 'dashboard'))
const loading = ref(false)
const error = ref('')
const suppliers = ref<Supplier[]>([])
const query = ref('')
const category = ref('all')
const selected = ref<Supplier | null>(null)
const results = computed(() => suppliers.value.filter(row =>
  (category.value === 'all' || row.category === category.value) &&
  [row.name, row.code, row.slug].some(value => value.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
const activeCount = computed(() => suppliers.value.filter(item => item.isActive).length)
async function load() {
  if (!allowed.value) return
  loading.value = true
  error.value = ''
  selected.value = null
  try {
    const data = await Promise.allSettled([
      CatalogItemsService.getByGroupSlug('agents'),
      CatalogItemsService.getByGroupSlug('carriers'),
    ])
    suppliers.value = data.flatMap((result, index) =>
      result.status === 'fulfilled' ? result.value.map(row => ({
        ...row, category: (index === 0 ? 'agents' : 'carriers') as Supplier['category'],
      })) : [])
    if (data.some(item => item.status === 'rejected')) error.value = t('srm.loadError')
  } catch {
    suppliers.value = []
    error.value = t('srm.loadError')
  } finally { loading.value = false }
}
watch(allowed, yes => { if (yes) void load() })
onMounted(() => { if (allowed.value) void load() })
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-5 p-3 text-[var(--dh-text)] sm:p-6" data-srm-workspace>
    <header class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
      <p class="text-xs font-black uppercase tracking-widest text-[var(--dh-primary)]">SRM</p>
      <h1 class="mt-2 text-2xl font-black">{{ t('srm.title') }}</h1>
      <p class="mt-2 text-sm text-[var(--dh-text-muted)]">{{ t('srm.intro') }}</p>
    </header>
    <template v-if="section === 'performance' || section === 'contracts'">
      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">
        <h2 class="text-xl font-bold">{{ t('srm.' + section) }}</h2>
        <p class="mt-3 text-sm text-[var(--dh-text-muted)]">{{ t('srm.unavailable') }}</p>
      </div>
    </template>
    <template v-else-if="!allowed">
      <p role="status" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-6">{{ t('srm.restricted') }}</p>
    </template>
    <template v-else>
      <div class="grid gap-4 sm:grid-cols-3" aria-label="Supplier overview">
        <div v-for="metric in [
          { label: t('srm.count'), value: suppliers.length },
          { label: t('srm.agents'), value: suppliers.filter(row => row.category === 'agents').length },
          { label: t('srm.carriers'), value: suppliers.filter(row => row.category === 'carriers').length },
        ]" :key="metric.label" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="text-xs font-bold text-[var(--dh-text-muted)]">{{ metric.label }}</div>
          <div class="mt-2 text-3xl font-black">{{ metric.value }}</div>
        </div>
      </div>
      <div class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-bold">{{ t('srm.suppliers') }}</h2>
          <button type="button" class="rounded-xl border border-[var(--dh-border)] px-4 py-2 text-sm font-semibold" :disabled="loading" @click="load">
            {{ t('srm.refresh') }}
          </button>
        </div>
        <div class="mb-4 flex flex-wrap gap-3">
          <input v-model="query" type="search" :placeholder="t('srm.search')" :aria-label="t('srm.search')"
            class="min-w-0 flex-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-2" />
          <select v-model="category" :aria-label="t('srm.type')"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-4 py-2">
            <option value="all">{{ t('srm.all') }}</option>
            <option value="agents">{{ t('srm.agents') }}</option>
            <option value="carriers">{{ t('srm.carriers') }}</option>
          </select>
        </div>
        <p v-if="error" role="alert" class="mb-3 text-sm text-amber-500">{{ error }}</p>
        <p v-if="loading" role="status">{{ t('common.loading') }}</p>
        <p v-else-if="results.length === 0" class="py-6 text-sm text-[var(--dh-text-muted)]">{{ t('srm.noRecords') }}</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[540px] text-left text-sm">
            <thead class="border-b border-[var(--dh-border)] text-[var(--dh-text-muted)]"><tr>
              <th scope="col" class="p-3">{{ t('srm.provider') }}</th>
              <th scope="col" class="p-3">{{ t('srm.type') }}</th>
              <th scope="col" class="p-3">{{ t('srm.code') }}</th>
              <th scope="col" class="p-3">{{ t('srm.status') }}</th>
            </tr></thead>
            <tbody><tr v-for="row in results" :key="row.category + ':' + row.id"
              class="cursor-pointer border-b border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]"
              @click="selected = row">
              <td class="p-3 font-semibold">{{ row.name }}</td>
              <td class="p-3">{{ t('srm.' + row.category) }}</td>
              <td class="p-3">{{ row.code }}</td>
              <td class="p-3">{{ t(row.isActive ? 'srm.active' : 'srm.inactive') }}</td>
            </tr></tbody>
          </table>
        </div>
        <p class="mt-4 text-xs text-[var(--dh-text-muted)]">{{ t('srm.source') }}</p>
        <RouterLink v-if="auth.hasScope(CONFIG_SCOPES.catalogGroups.view)"
          to="/config/catalogs" class="mt-3 inline-block text-sm font-bold text-[var(--dh-primary)]">
          {{ t('srm.configLink') }}
        </RouterLink>
      </div>
      <div v-if="selected" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
        <h3 class="font-bold">{{ t('srm.details') }} · {{ selected.name }}</h3>
        <p class="mt-2 text-sm">{{ selected.description || selected.code }}</p>
        <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ selected.code }} · {{ selected.slug }}</p>
        <button type="button" class="mt-4 rounded-xl border border-[var(--dh-border)] px-4 py-2 text-sm" @click="selected = null">
          {{ t('common.close') }}
        </button>
      </div>
      <p class="text-sm text-[var(--dh-text-muted)]">{{ t('srm.pending') }}</p>
    </template>
  </section>
</template>
