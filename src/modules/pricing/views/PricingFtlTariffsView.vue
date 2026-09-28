<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Edit3, Plus, RefreshCcw, Truck } from 'lucide-vue-next'
import { DhBadge, DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useDrawerStore } from '@/core/stores/drawerStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { FtlTariffService, type FtlTariffDto } from '@/core/services/ftlTariffService'
import PricingFtlTariffFormDrawer from '@/modules/pricing/components/PricingFtlTariffFormDrawer.vue'
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs'

const authStore = useAuthStore()
const drawerStore = useDrawerStore()
const toastStore = useToastStore()
const catalogs = usePricingCatalogs()

const rows = ref<FtlTariffDto[]>([])
const loading = ref(false)
const search = ref('')

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

function money(row: FtlTariffDto) {
  const currency = String(row.currencyCode || row.currencyName || 'USD').trim()
  return `${currency} ${Number(row.priceAmount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function equipmentLabels(row: FtlTariffDto) {
  const values = row.applicableEquipmentClasses?.length
    ? row.applicableEquipmentClasses
    : row.equipmentClass ? [row.equipmentClass] : []

  return values.map((value) => {
    const target = normalize(value)
    const item = catalogs.landEquipmentSizes.value.find((candidate) =>
      [candidate.code, candidate.value, candidate.slug, candidate.id].some((key) => normalize(key) === target),
    )
    return item?.name || value
  }).join(', ')
}

const filteredRows = computed(() => {
  const q = normalize(search.value)
  if (!q) return rows.value
  return rows.value.filter((row) =>
    [
      row.originName,
      row.destinationName,
      row.originCode,
      row.destinationCode,
      equipmentLabels(row),
      row.source,
      row.notes,
    ].some((value) => normalize(value).includes(q)),
  )
})

async function load() {
  loading.value = true
  try {
    await catalogs.loadAll()
    rows.value = await FtlTariffService.browse('Ftl', 'General')
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar el tarifario FTL.')
  } finally {
    loading.value = false
  }
}

function openForm(tariff?: FtlTariffDto) {
  if (!canUpdate.value) return
  drawerStore.open({
    title: tariff ? 'Editar tarifa FTL' : 'Nueva tarifa FTL',
    component: PricingFtlTariffFormDrawer,
    size: 'lg',
    props: {
      tariff,
      lockedMode: 'Ftl',
      onSaved: load,
    },
  })
}

function date(value: string | null) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas terrestres FTL"
      subtitle="Movimientos terrestres completos. LTL ahora se administra desde Consolidados propios → LTL."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <DhButton label="Actualizar" :icon="RefreshCcw" variant="secondary" :loading="loading" @click="load" />
          <DhButton v-if="canUpdate" label="Nueva tarifa FTL" :icon="Plus" @click="openForm()" />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">FTL · completos</p>
          <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">Tarifario por ruta y equipo</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ filteredRows.length }} tarifas FTL. Origen y destino provienen de los catálogos terrestres editables.
          </p>
        </div>
        <div class="w-full lg:max-w-md">
          <input
            v-model="search"
            type="search"
            placeholder="Buscar ruta, equipo o proveedor..."
            class="w-full rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3 text-sm font-semibold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)]"
          />
        </div>
      </div>

      <div v-if="loading" class="py-16 text-center text-sm font-bold text-[var(--dh-text-muted)]">
        Cargando tarifas FTL...
      </div>

      <div v-else-if="filteredRows.length" class="mt-5 overflow-x-auto dh-scrollbar">
        <table class="min-w-[1050px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr class="text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]">
              <th class="border-b border-[var(--dh-border)] px-3 py-3">Ruta</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3">Equipos aplicables</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-right">Tarifa</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-center">Tránsito</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3">Vigencia</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3 text-center">Estado</th>
              <th class="border-b border-[var(--dh-border)] px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRows" :key="row.id">
              <td class="border-b border-[var(--dh-border)] px-3 py-4">
                <p class="font-black text-[var(--dh-text)]">{{ row.originName }} → {{ row.destinationName }}</p>
                <p v-if="row.source" class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ row.source }}</p>
              </td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 font-bold">{{ equipmentLabels(row) || row.equipmentLabel }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-right text-base font-black">{{ money(row) }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-center font-bold">{{ row.transitDays == null ? '—' : row.transitDays + ' días' }}</td>
              <td class="border-b border-[var(--dh-border)] px-3 py-4 text-xs font-bold text-[var(--dh-text-muted)]">{{ date(row.validFrom) }} → {{ date(row.validTo) }}</td>
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
        <p class="font-black text-[var(--dh-text)]">No hay tarifas FTL activas para mostrar.</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">Cree una tarifa completa y seleccione uno o varios equipos aplicables.</p>
      </div>
    </section>
  </section>
</template>
