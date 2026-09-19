<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Eye, RefreshCw, UserRoundPlus } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { PricingService } from '@/core/services/pricingService'
import { useModalStore } from '@/core/stores/modalStore'
import { useToastStore } from '@/core/stores/toastStore'
import type { RateDto } from '@/core/interfaces/pricing'
import PricingApplyTariffModal from '@/modules/pricing/components/PricingApplyTariffModal.vue'
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat'

const router = useRouter()
const modalStore = useModalStore()
const toastStore = useToastStore()

const masters = ref<RateDto[]>([])
const derivedRates = ref<RateDto[]>([])
const selectedMasterId = ref('')
const search = ref('')
const loadingMasters = ref(false)
const loadingDerived = ref(false)

const selectedMaster = computed(
  () => masters.value.find((rate) => rate.id === selectedMasterId.value) ?? null,
)

const filteredMasters = computed(() => {
  const value = search.value.trim().toLowerCase()
  if (!value) return masters.value

  return masters.value.filter((rate) =>
    [
      rate.quoNumber,
      rate.rateCode,
      rate.rateName,
      rate.carrierName,
      rate.polName,
      rate.poeName,
      rate.podName,
      rate.clientName,
    ].some((item) => String(item ?? '').toLowerCase().includes(value)),
  )
})

const acceptedDerived = computed(
  () => derivedRates.value.filter((rate) => rate.status === 'AcceptedByClient').length,
)
const activeDerived = computed(
  () => derivedRates.value.filter((rate) => ['Open', 'Sent', 'RequestedByClient'].includes(rate.status)).length,
)

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PendingApproval: 'Pendiente de aprobación',
    ApprovedByManagement: 'Aprobada por gerencia',
    RejectedByManagement: 'Rechazada por gerencia',
    Open: 'Abierta',
    Sent: 'Enviada',
    RequestedByClient: 'Solicitada por cliente',
    AcceptedByClient: 'Aceptada',
    RejectedByClient: 'No aceptada',
    Closed: 'Cerrada',
    Expired: 'Vencida',
  }
  return labels[status] ?? status
}

function routeLabel(rate: RateDto) {
  return [rate.polName, rate.poeName, rate.podName].filter(Boolean).join(' → ')
}

function equipmentLabel(rate: RateDto) {
  const containers = rate.containers?.filter((item) => Number(item.quantity) > 0) ?? []
  if (containers.length) {
    return containers.map((item) => `${item.quantity} × ${item.containerTypeName}`).join(' + ')
  }
  return `${rate.containerQuantity || 1} × ${rate.containerTypeName || rate.shipmentMode}`
}

async function loadMasters() {
  try {
    loadingMasters.value = true
    const result = await PricingService.browseRates({
      pageNumber: 1,
      pageSize: 200,
      rateType: 'Tariff',
      tariffMasterOnly: true,
    })
    masters.value = result.items

    const stillExists = masters.value.some((rate) => rate.id === selectedMasterId.value)
    if (!stillExists) {
      selectedMasterId.value = masters.value[0]?.id ?? ''
      if (!selectedMasterId.value) derivedRates.value = []
    } else {
      await loadDerived()
    }
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los tarifarios.')
  } finally {
    loadingMasters.value = false
  }
}

async function loadDerived() {
  if (!selectedMasterId.value) {
    derivedRates.value = []
    return
  }

  try {
    loadingDerived.value = true
    const result = await PricingService.browseRates({
      pageNumber: 1,
      pageSize: 200,
      sourceTariffRateId: selectedMasterId.value,
    })
    derivedRates.value = result.items
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar las QUO derivadas del tarifario.')
  } finally {
    loadingDerived.value = false
  }
}

function openRate(rate: RateDto) {
  router.push({
    name: 'pricing-rate-wizard',
    params: { rateId: rate.id },
    query: { mode: 'view' },
  })
}

function applyTariff(rate: RateDto) {
  modalStore.open({
    title: 'Aplicar tarifario a cliente',
    component: PricingApplyTariffModal,
    size: 'md',
    props: {
      rate,
      onApplied: async () => {
        await loadDerived()
      },
    },
  })
}

watch(selectedMasterId, loadDerived)
onMounted(loadMasters)
</script>

<template>
  <section class="space-y-5">
    <DhPageHeader
      title="Tarifarios"
      subtitle="Tarifarios maestros reutilizables y trazabilidad de las QUO generadas para clientes."
      :icon="BookOpen"
    >
      <template #actions>
        <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" size="sm" @click="loadMasters" />
      </template>
    </DhPageHeader>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Tarifarios maestros</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ masters.length }}</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">QUO generadas</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ derivedRates.length }}</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
        <p class="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]">Activas / aceptadas</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">{{ activeDerived }} / {{ acceptedDerived }}</p>
      </div>
    </div>

    <div class="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section class="rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-black text-[var(--dh-text)]">Tarifarios maestros</h2>
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">Seleccione uno para ver todas las QUO que nacieron de él.</p>
          </div>
        </div>

        <DhInput v-model="search" placeholder="Buscar QUO, ruta o naviera..." />

        <div class="mt-4 max-h-[650px] space-y-2 overflow-y-auto pr-1">
          <div v-if="loadingMasters" class="rounded-2xl border border-[var(--dh-border)] p-6 text-center text-sm font-bold text-[var(--dh-text-muted)]">
            Cargando tarifarios...
          </div>

          <div v-else-if="filteredMasters.length === 0" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-6 text-center text-sm font-bold text-[var(--dh-text-muted)]">
            No hay tarifarios maestros.
          </div>

          <button
            v-for="rate in filteredMasters"
            v-else
            :key="rate.id"
            type="button"
            class="w-full rounded-2xl border p-3 text-left transition"
            :class="selectedMasterId === rate.id
              ? 'border-[rgb(var(--dh-primary-rgb)/0.5)] bg-[rgb(var(--dh-primary-rgb)/0.08)]'
              : 'border-[var(--dh-border)] hover:bg-[var(--dh-card-hover)]'"
            @click="selectedMasterId = rate.id"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</span>
                  <DhBadge label="TARIFARIO · MAESTRO" variant="primary" />
                </div>
                <p class="mt-2 text-xs font-bold text-[var(--dh-text-soft)]">{{ routeLabel(rate) }}</p>
                <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ rate.carrierName || 'Sin naviera' }} · {{ equipmentLabel(rate) }}
                </p>
                <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
                  {{ formatDate(rate.validFrom) }} → {{ formatDate(rate.validTo) }}
                </p>
              </div>
              <DhBadge :label="statusLabel(rate.status)" :variant="statusTone(rate.status)" />
            </div>
          </button>
        </div>
      </section>

      <section class="min-w-0 rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)]">
        <div v-if="!selectedMaster" class="grid min-h-[320px] place-items-center text-center">
          <div>
            <BookOpen class="mx-auto h-8 w-8 text-[var(--dh-text-muted)]" />
            <p class="mt-3 font-black text-[var(--dh-text)]">Seleccione un tarifario</p>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Aquí aparecerán las QUO creadas desde ese maestro.</p>
          </div>
        </div>

        <template v-else>
          <div class="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--dh-border)] pb-5">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-xl font-black text-[var(--dh-text)]">{{ selectedMaster.quoNumber || selectedMaster.rateCode }}</h2>
                <DhBadge label="TARIFARIO · MAESTRO" variant="primary" />
              </div>
              <p class="mt-2 font-bold text-[var(--dh-text-soft)]">{{ routeLabel(selectedMaster) }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ selectedMaster.carrierName || 'Sin naviera' }} · {{ equipmentLabel(selectedMaster) }} ·
                {{ formatDate(selectedMaster.validFrom) }} → {{ formatDate(selectedMaster.validTo) }}
              </p>
              <p class="mt-2 text-sm font-black text-[var(--dh-primary)]">
                Venta maestra: {{ formatMoney(selectedMaster.totalSaleUsd, 'USD') }}
              </p>
            </div>

            <div class="flex gap-2">
              <DhButton label="Ver maestro" :icon="Eye" variant="secondary" size="sm" @click="openRate(selectedMaster)" />
              <DhButton label="Aplicar a cliente" :icon="UserRoundPlus" size="sm" @click="applyTariff(selectedMaster)" />
            </div>
          </div>

          <div class="mt-5">
            <div class="mb-3 flex items-end justify-between gap-3">
              <div>
                <h3 class="font-black text-[var(--dh-text)]">QUO generadas desde este tarifario</h3>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">
                  Cada fila es una cotización independiente para un cliente. El tarifario maestro permanece reutilizable.
                </p>
              </div>
              <DhBadge :label="`${derivedRates.length} QUO`" variant="neutral" />
            </div>

            <div v-if="loadingDerived" class="rounded-2xl border border-[var(--dh-border)] p-10 text-center text-sm font-bold text-[var(--dh-text-muted)]">
              Cargando QUO derivadas...
            </div>

            <div v-else-if="derivedRates.length === 0" class="rounded-2xl border border-dashed border-[var(--dh-border)] p-10 text-center">
              <p class="font-black text-[var(--dh-text)]">Todavía no hay QUO creadas desde este tarifario.</p>
              <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Use “Aplicar a cliente” para generar la primera.</p>
            </div>

            <div v-else class="overflow-x-auto rounded-2xl border border-[var(--dh-border)]">
              <table class="w-full min-w-[850px] border-collapse text-left text-sm">
                <thead class="bg-black/[0.035] text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)] dark:bg-white/[0.05]">
                  <tr>
                    <th class="px-4 py-3">QUO cliente</th>
                    <th class="px-4 py-3">Cliente / ejecutivo</th>
                    <th class="px-4 py-3">Estado</th>
                    <th class="px-4 py-3">Vigencia</th>
                    <th class="px-4 py-3 text-right">Venta</th>
                    <th class="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="rate in derivedRates"
                    :key="rate.id"
                    class="border-t border-[var(--dh-border)] transition hover:bg-[var(--dh-card-hover)]"
                  >
                    <td class="px-4 py-4">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-black text-[var(--dh-text)]">{{ rate.quoNumber || rate.rateCode }}</span>
                        <DhBadge label="TARIFARIO · CLIENTE" variant="success" />
                      </div>
                      <p class="mt-1 text-[11px] font-semibold text-[var(--dh-text-muted)]">
                        REV origen {{ rate.sourceTariffRevisionNumber || 1 }}
                      </p>
                    </td>
                    <td class="px-4 py-4">
                      <p class="font-black text-[var(--dh-text)]">{{ rate.clientName || 'Sin cliente' }}</p>
                      <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ rate.executiveName || 'Sin ejecutivo' }}</p>
                    </td>
                    <td class="px-4 py-4">
                      <DhBadge :label="statusLabel(rate.status)" :variant="statusTone(rate.status)" />
                    </td>
                    <td class="px-4 py-4 text-xs font-bold text-[var(--dh-text-soft)]">
                      {{ formatDate(rate.validFrom) }} → {{ formatDate(rate.validTo) }}
                    </td>
                    <td class="px-4 py-4 text-right font-black text-[var(--dh-primary)]">
                      {{ formatMoney(rate.totalSaleUsd, 'USD') }}
                    </td>
                    <td class="px-4 py-4 text-right">
                      <button
                        type="button"
                        class="rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                        title="Ver QUO"
                        @click="openRate(rate)"
                      >
                        <Eye class="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </section>
    </div>
  </section>
</template>
