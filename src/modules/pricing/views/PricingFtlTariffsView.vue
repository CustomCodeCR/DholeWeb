<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw, Save, Truck } from 'lucide-vue-next'
import { DhButton } from '@/shared/components/atoms'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import {
  FtlTariffService,
  type FtlTariffDto,
  type UpdateFtlTariffItem,
} from '@/core/services/ftlTariffService'

interface EditableFtlTariff extends FtlTariffDto {
  priceInput: string
  transitInput: string
}

const authStore = useAuthStore()
const toastStore = useToastStore()
const loading = ref(false)
const saving = ref(false)
const selectedEquipmentClass = ref('48_53')
const rows = ref<EditableFtlTariff[]>([])
const originalValues = ref(new Map<string, { priceAmount: number; transitDays: number | null }>())

const preferredLocationOrder = [
  'Costa Rica',
  'Nicaragua',
  'Tegucigalpa',
  'San Pedro Sula',
  'El Salvador',
  'Guatemala',
  'Panamá',
  'Ciudad Hidalgo',
]

const equipmentOptions = [
  { value: '48_53', label: 'Equipo 48/53 pies' },
  { value: '5_7_TON', label: 'Equipo 5 a 7 toneladas' },
]

const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.costs.update))
const visibleRows = computed(() =>
  rows.value.filter((row) => row.equipmentClass.toUpperCase() === selectedEquipmentClass.value),
)

const locations = computed(() => {
  const names = new Set<string>()
  visibleRows.value.forEach((row) => {
    names.add(row.originName)
    names.add(row.destinationName)
  })
  const result = [...names]
  return result.sort((left, right) => {
    const leftIndex = preferredLocationOrder.indexOf(left)
    const rightIndex = preferredLocationOrder.indexOf(right)
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1
      if (rightIndex < 0) return -1
      return leftIndex - rightIndex
    }
    return left.localeCompare(right, 'es')
  })
})

function findRate(originName: string, destinationName: string) {
  return visibleRows.value.find(
    (row) => row.originName === originName && row.destinationName === destinationName,
  )
}

function parsedPrice(row: EditableFtlTariff) {
  return Number(row.priceInput)
}

function parsedTransit(row: EditableFtlTariff) {
  if (!row.transitInput.trim()) return null
  return Number(row.transitInput)
}

function isDirty(row: EditableFtlTariff) {
  const original = originalValues.value.get(row.id)
  if (!original) return false
  return parsedPrice(row) !== original.priceAmount || parsedTransit(row) !== original.transitDays
}

const dirtyRows = computed(() => rows.value.filter(isDirty))

function validateDirtyRows() {
  for (const row of dirtyRows.value) {
    const price = parsedPrice(row)
    const transit = parsedTransit(row)
    if (!Number.isFinite(price) || price < 0) {
      toastStore.error('Precio inválido', `${row.originName} → ${row.destinationName} tiene un precio inválido.`)
      return false
    }
    if (transit != null && (!Number.isInteger(transit) || transit < 0)) {
      toastStore.error(
        'Tránsito inválido',
        `${row.originName} → ${row.destinationName} debe tener días de tránsito enteros o quedar vacío.`,
      )
      return false
    }
  }
  return true
}

async function load() {
  loading.value = true
  try {
    const data = await FtlTariffService.browse()
    rows.value = data.map((row) => ({
      ...row,
      priceInput: String(row.priceAmount),
      transitInput: row.transitDays == null ? '' : String(row.transitDays),
    }))
    originalValues.value = new Map(
      data.map((row) => [row.id, { priceAmount: row.priceAmount, transitDays: row.transitDays }]),
    )
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cargar la matriz maestra de tarifas FTL.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!canUpdate.value || !dirtyRows.value.length || saving.value || !validateDirtyRows()) return

  const items: UpdateFtlTariffItem[] = dirtyRows.value.map((row) => ({
    id: row.id,
    priceAmount: parsedPrice(row),
    transitDays: parsedTransit(row),
    isActive: row.isActive,
  }))

  saving.value = true
  try {
    await FtlTariffService.updateBatch(items)
    toastStore.success(
      'Tarifas FTL actualizadas',
      `${items.length} ${items.length === 1 ? 'tarifa fue actualizada' : 'tarifas fueron actualizadas'} correctamente.`,
    )
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron guardar los cambios de la matriz FTL.')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Tarifas FTL"
      subtitle="Matriz maestra de fletes terrestres. Los precios y tiempos de tránsito se administran aquí, separados de Costos y recargos."
      :icon="Truck"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <DhButton label="Actualizar" :icon="RefreshCw" variant="secondary" :disabled="loading || saving" @click="load" />
          <DhButton
            v-if="canUpdate"
            :label="dirtyRows.length ? `Guardar ${dirtyRows.length} cambios` : 'Guardar cambios'"
            :icon="Save"
            :loading="saving"
            :disabled="!dirtyRows.length || loading"
            @click="save"
          />
        </div>
      </template>
    </DhPageHeader>

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-primary)]">Matriz de precios</p>
          <h2 class="mt-1 text-xl font-black text-[var(--dh-text)]">Seleccione el tipo de equipo</h2>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            Cada celda representa una ruta. Edite el precio y, cuando aplique, los días de tránsito.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in equipmentOptions"
            :key="option.value"
            type="button"
            class="rounded-2xl border px-4 py-3 text-sm font-black transition"
            :class="
              selectedEquipmentClass === option.value
                ? 'border-[var(--dh-primary)] bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-soft)] hover:border-[rgb(var(--dh-primary-rgb)/0.4)]'
            "
            @click="selectedEquipmentClass = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div
        v-if="loading"
        class="mt-5 rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-14 text-center font-bold text-[var(--dh-text-muted)]"
      >
        Cargando tarifas FTL…
      </div>

      <div v-else-if="!visibleRows.length" class="mt-5 rounded-[24px] border border-dashed border-[var(--dh-border)] px-5 py-14 text-center">
        <p class="font-black text-[var(--dh-text)]">No hay tarifas configuradas para este equipo.</p>
        <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">La matriz se completa automáticamente desde Pricing cuando existen las rutas terrestres en Config.</p>
      </div>

      <div v-else class="mt-5 overflow-x-auto rounded-[24px] border border-[var(--dh-border)]">
        <table class="min-w-[1280px] w-full border-collapse text-sm">
          <thead>
            <tr class="bg-black/[0.035] dark:bg-white/[0.045]">
              <th class="sticky left-0 z-20 min-w-[170px] border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-left text-xs font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
                Origen ↓ / Destino →
              </th>
              <th
                v-for="destination in locations"
                :key="destination"
                class="min-w-[150px] border-b border-r border-[var(--dh-border)] px-3 py-3 text-center font-black text-[var(--dh-text)] last:border-r-0"
              >
                {{ destination }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="origin in locations" :key="origin">
              <th class="sticky left-0 z-10 border-b border-r border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-left font-black text-[var(--dh-text)]">
                {{ origin }}
              </th>
              <td
                v-for="destination in locations"
                :key="`${origin}:${destination}`"
                class="border-b border-r border-[var(--dh-border)] p-2 align-top last:border-r-0"
              >
                <template v-for="rate in [findRate(origin, destination)]" :key="rate?.id || `${origin}:${destination}:empty`">
                  <div
                    v-if="rate"
                    class="rounded-xl border p-2 transition"
                    :class="isDirty(rate) ? 'border-amber-400/60 bg-amber-500/10' : 'border-transparent bg-black/[0.025] dark:bg-white/[0.035]'"
                  >
                    <label class="block text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Precio {{ rate.currencyCode }}</label>
                    <input
                      v-model="rate.priceInput"
                      type="number"
                      min="0"
                      step="0.01"
                      :disabled="!canUpdate || saving"
                      class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-black text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)] disabled:opacity-70"
                    />
                    <label class="mt-2 block text-[10px] font-black uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">Tránsito · días</label>
                    <input
                      v-model="rate.transitInput"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="—"
                      :disabled="!canUpdate || saving"
                      class="mt-1 w-full rounded-lg border border-[var(--dh-border)] bg-[var(--dh-card)] px-2 py-1.5 text-right font-bold text-[var(--dh-text)] outline-none focus:border-[var(--dh-primary)] disabled:opacity-70"
                    />
                  </div>
                  <div v-else class="flex min-h-[104px] items-center justify-center text-lg font-black text-[var(--dh-text-muted)]/40">—</div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[var(--dh-text-muted)]">
        <span>{{ visibleRows.length }} rutas configuradas · Fuente maestra: {{ visibleRows[0]?.source || 'Pricing' }}</span>
        <span v-if="dirtyRows.length" class="font-black text-amber-600 dark:text-amber-300">{{ dirtyRows.length }} cambios sin guardar</span>
      </div>
    </section>
  </section>
</template>
