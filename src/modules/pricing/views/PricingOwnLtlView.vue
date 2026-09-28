<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Edit3, Plus, RefreshCcw, Truck } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type FtlTariffDto,
  type LandCommercialProfile,
} from '@/core/services/ftlTariffService'
import PricingFtlTariffFormDrawer from '@/modules/pricing/components/PricingFtlTariffFormDrawer.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<FtlTariffDto[]>([])
const loading = ref(false)
const search = ref('')
const selectedProfile = ref<LandCommercialProfile>('FinalClient')

const canUpdate = computed(() =>
  authStore.hasScope(PRICING_SCOPES.costs.update)
  || authStore.hasRole('Administrador')
  || authStore.hasRole('Admin')
  || authStore.hasRole('Administrator'),
)

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isPanamaOrigin(row: FtlTariffDto) {
  const value = normalize([row.originName, row.originCode].filter(Boolean).join(' '))
  return value.includes('panama') || value.includes('cfz') || value.includes('colon free zone')
}

function effectiveCostPerCbm(row: FtlTariffDto) {
  return Number(row.costPerCbm ?? 0)
    + (isPanamaOrigin(row) ? Number(row.panamaCostSurchargePerCbm ?? 9) : 0)
}

function money(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const filteredRows = computed(() => {
  const q = normalize(search.value)
  return rows.value.filter((row) => {
    if (row.commercialProfile !== selectedProfile.value) return false
    if (!q) return true
    return [
      row.originName,
      row.destinationName,
      row.source,
      row.warehouseName,
      row.notes,
    ].some((value) => normalize(value).includes(q))
  })
})

async function load() {
  loading.value = true
  try {
    await catalogs.loadAll()
    rows.value = await FtlTariffService.browse('Ltl')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la matriz LTL propia.')
  } finally {
    loading.value = false
  }
}

function openForm(tariff?: FtlTariffDto) {
  if (!canUpdate.value) return
  drawerStore.open({
    title: tariff ? 'Editar ruta LTL propia' : 'Nueva ruta LTL propia',
    component: PricingFtlTariffFormDrawer,
    size: 'lg',
    props: {
      tariff,
      lockedMode: 'Ltl',
      onSaved: load,
    },
  })
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Consolidado propio LTL"
      subtitle="Matriz terrestre consolidada propia. Los montos se digitan por ruta y perfil comercial."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton v-if="canUpdate" label="Nueva ruta LTL" :icon="Plus" @click="openForm()" />
        </div>
      </template>
    </DhPageHeader>

    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
        <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Peso volumétrico</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-text)]">330 kg / CBM</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">CBM por peso = kg ÷ 330. Se cobra el mayor contra el CBM dimensional.</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
        <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Documentos · costo</p>
        <p class="mt-2 text-xl font-black text-[var(--dh-text)]">DUA USD 50 · DUCA-T USD 30</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Valores iniciales editables por ruta LTL.</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
        <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Stuffing</p>
        <p class="mt-2 text-xl font-black text-[var(--dh-text)]">USD 550 ÷ 60 · venta 10/CBM</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">Misma base operativa usada por los consolidados LCL.</p>
      </div>
      <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]">
        <p class="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">Salida Panamá</p>
        <p class="mt-2 text-2xl font-black text-[var(--dh-primary)]">Costo / CBM + USD 9</p>
        <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">El recargo se suma al costo base/CBM cuando el origen de la ruta es Panamá.</p>
      </div>
    </section>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Consolidados propios · LTL</p>
          <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">Matriz de costos y ventas</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Venta/CBM y mínimo son editables. Costo/CBM, DUA, DUCA-T, Stuffing y factor de peso quedan guardados por ruta.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border px-4 py-2 text-xs font-black transition"
            :class="selectedProfile === 'FinalClient'
              ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text-soft)]'"
            @click="selectedProfile = 'FinalClient'"
          >
            Cliente final
          </button>
          <button
            type="button"
            class="rounded-xl border px-4 py-2 text-xs font-black transition"
            :class="selectedProfile === 'Nvocc'
              ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
              : 'border-[var(--dh-border)] bg-[var(--dh-input)] text-[var(--dh-text-soft)]'"
            @click="selectedProfile = 'Nvocc'"
          >
            NVOCC
          </button>
        </div>
      </div>

      <div class="mt-4">
        <input
          v-model="search"
          type="search"
          placeholder="Buscar origen, destino, almacén o fuente..."
          class="w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]"
        />
      </div>

      <div v-if="loading" class="py-16 text-center text-sm font-bold text-[var(--dh-text-muted)]">
        Cargando matriz LTL...
      </div>

      <div v-else-if="filteredRows.length" class="mt-5 overflow-x-auto dh-scrollbar">
        <table class="min-w-[1420px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
              <th class="border-b border-[var(--dh-border)] px-3 py-3">Ruta</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Costo/CBM</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Costo efectivo</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Venta/CBM</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Mínimo</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">DUA</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">DUCA-T</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Stuffing C/V</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Peso</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-center">Tránsito</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-center">Estado</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.id" class="group">
              <td class="border-b border-[var(--dh-border)] px-3 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ row.originName }} → {{ row.destinationName }}</p>
                <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
                  {{ row.warehouseName || 'Sin almacén' }}<span v-if="row.source"> · {{ row.source }}</span>
                </p>
              </td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right font-black">USD {{ money(row.costPerCbm) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right">
                <span class="font-black text-[var(--dh-primary)]">USD {{ money(effectiveCostPerCbm(row)) }}</span>
                <p v-if="isPanamaOrigin(row)" class="mt-1 text-[10px] font-bold text-[var(--dh-text-muted)]">incluye +{{ money(row.panamaCostSurchargePerCbm ?? 9) }}</p>
              </td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right font-black">USD {{ money(row.priceAmount) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right font-black">USD {{ money(row.minimumAmount) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right">USD {{ money(row.duaCost ?? 50) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right">USD {{ money(row.ducaTCost ?? 30) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right">
                <span class="font-bold">USD {{ money(row.stuffingCostPerCbm ?? (550 / 60)) }}</span>
                <span class="text-[var(--dh-text-muted)]"> / </span>
                <span class="font-black text-[var(--dh-primary)]">USD {{ money(row.stuffingSalePerCbm ?? 10) }}</span>
              </td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right font-bold">{{ money(row.weightKgPerCbm ?? 330) }} kg/CBM</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-center font-bold">{{ row.transitDays == null ? '—' : row.transitDays + ' días' }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-center">
                <DhBadge :variant="row.isActive ? 'success' : 'neutral'">{{ row.isActive ? 'Activa' : 'Inactiva' }}</DhBadge>
              </td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right">
                <DhButton v-if="canUpdate" label="Editar" :icon="Edit3" variant="secondary" size="sm" @click="openForm(row)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="mt-5 rounded-[24px] border border-dashed border-[var(--dh-border)] px-5 py-14 text-center">
        <p class="font-black text-[var(--dh-text)]">No hay rutas LTL para este perfil.</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Cree una ruta y digite sus montos operativos.</p>
      </div>
    </section>
  </section>
</template>
