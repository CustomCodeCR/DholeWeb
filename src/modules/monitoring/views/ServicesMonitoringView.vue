<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Activity, RefreshCcw, ServerCog } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { MonitoringService } from '@/core/services/monitoringService'
import type { ServiceMonitorResult } from '@/core/interfaces/monitoring'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

const { t } = useI18n()

const loading = ref(false)
const services = ref<ServiceMonitorResult[]>([])

const columns = computed<DhTableColumn<ServiceMonitorResult>[]>(() => [
  { key: 'name', label: t('monitoring.service') },
  { key: 'status', label: t('common.status'), align: 'center' },
  { key: 'latencyMs', label: t('monitoring.latency'), align: 'center' },
  { key: 'statusCode', label: t('monitoring.statusCode'), align: 'center' },
  { key: 'checkedAt', label: t('monitoring.checkedAt') },
  { key: 'url', label: 'URL' },
])

const onlineCount = computed(() => services.value.filter((service) => service.status === 'online').length)
const offlineCount = computed(() => services.value.filter((service) => service.status === 'offline').length)
const averageLatency = computed(() => {
  const latencies = services.value
    .map((service) => service.latencyMs ?? 0)
    .filter((latency) => latency > 0)

  if (!latencies.length) return 0

  return Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
})

function statusVariant(status: ServiceMonitorResult['status']) {
  if (status === 'online') return 'success'
  if (status === 'offline') return 'danger'
  return 'neutral'
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
}

async function load() {
  loading.value = true

  try {
    services.value = await MonitoringService.checkAll()
  } finally {
    loading.value = false
  }
}

useViewShortcuts({ save: load, refresh: load })

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader :title="t('monitoring.title')" :subtitle="t('monitoring.subtitle')" :icon="ServerCog">
      <template #actions>
        <DhButton :icon="RefreshCcw" :label="t('common.refresh')" variant="secondary" :loading="loading" @click="load" />
      </template>
    </DhPageHeader>

    <div class="grid gap-4 md:grid-cols-3">
      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('monitoring.online') }}</p>
          <Activity class="h-5 w-5 text-green-500" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ onlineCount }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('monitoring.onlineHint') }}</p>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('monitoring.offline') }}</p>
          <Activity class="h-5 w-5 text-red-500" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ offlineCount }}</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('monitoring.offlineHint') }}</p>
      </article>

      <article class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm font-black text-[var(--dh-text-muted)]">{{ t('monitoring.averageLatency') }}</p>
          <ServerCog class="h-5 w-5 text-[var(--dh-primary)]" />
        </div>
        <h2 class="mt-3 text-3xl font-black text-[var(--dh-text)]">{{ averageLatency }} ms</h2>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('monitoring.averageLatencyHint') }}</p>
      </article>
    </div>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhDataTable :columns="columns" :rows="services" :loading="loading" :empty-text="t('monitoring.empty')">
        <template #cell-name="{ row }">
          <div>
            <p class="font-black text-[var(--dh-text)]">{{ row.nameKey ? t(row.nameKey) : row.name }}</p>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.descriptionKey ? t(row.descriptionKey) : row.description }}</p>
          </div>
        </template>

        <template #cell-status="{ value }">
          <DhBadge :label="t(`monitoring.statuses.${String(value)}`)" :variant="statusVariant(String(value) as ServiceMonitorResult['status'])" />
        </template>

        <template #cell-latencyMs="{ value }">{{ value ?? '—' }} ms</template>
        <template #cell-statusCode="{ value }">{{ value ?? '—' }}</template>
        <template #cell-checkedAt="{ value }">{{ formatDate(String(value)) }}</template>
        <template #cell-url="{ value }"><span class="line-clamp-1 max-w-sm">{{ value }}</span></template>
      </DhDataTable>
    </section>
  </section>
</template>
