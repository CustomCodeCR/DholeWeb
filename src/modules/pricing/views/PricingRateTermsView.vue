<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ListChecks, Pencil, Power, PowerOff, Save, Trash2, X } from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput } from '@/shared/components/atoms'
import { DhCrudToolbar, DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { PRICING_SCOPES } from '@/core/auth/scopes'
import { PricingService } from '@/core/services/pricingService'
import type { RateTermItemDto } from '@/core/interfaces/pricing'

const authStore = useAuthStore()
const toastStore = useToastStore()
const rows = ref<RateTermItemDto[]>([])
const loading = ref(false)
const editorOpen = ref(false)
const search = ref('')
const form = reactive({ id: '', text: '', sortOrder: '0', isActive: true })

const canCreate = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.create))
const canUpdate = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.update))
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.delete))
const canSetActive = computed(() => authStore.hasScope(PRICING_SCOPES.rateTerms.setActive))
const isEditing = computed(() => Boolean(form.id))

const columns: DhTableColumn<RateTermItemDto>[] = [
  { key: 'sortOrder', label: 'Orden', width: '100px' },
  { key: 'text', label: 'Ítem compartido' },
  { key: 'isActive', label: 'Estado', align: 'center', width: '130px' },
  { key: 'actions', label: '', align: 'right', width: '180px' },
]

const visibleRows = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  if (!term) return rows.value
  return rows.value.filter((item) => item.text.toLocaleLowerCase().includes(term))
})

function clearForm() {
  Object.assign(form, { id: '', text: '', sortOrder: '0', isActive: true })
  editorOpen.value = false
}

function openCreate() {
  Object.assign(form, { id: '', text: '', sortOrder: '0', isActive: true })
  editorOpen.value = true
}

function edit(item: RateTermItemDto) {
  Object.assign(form, {
    id: item.id,
    text: item.text,
    sortOrder: String(item.sortOrder),
    isActive: item.isActive,
  })
  editorOpen.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function load() {
  try {
    loading.value = true
    rows.value = await PricingService.browseRateTermItems()
  } catch (error) {
    toastStore.backendError(error, 'No se pudieron cargar los ítems de tarifa.')
  } finally {
    loading.value = false
  }
}

async function save() {
  const text = form.text.trim()
  if (!text) {
    toastStore.warning('Texto requerido', 'Indique el ítem que se utilizará en las tarifas.')
    return
  }

  const sortOrder = Math.max(0, Number(form.sortOrder || 0))
  try {
    if (form.id) {
      await PricingService.updateRateTermItem(form.id, {
        text,
        sortOrder,
        isActive: form.isActive,
      })
      toastStore.success('Ítem actualizado')
    } else {
      await PricingService.createRateTermItem({ text, sortOrder })
      toastStore.success('Ítem creado')
    }
    clearForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo guardar el ítem de tarifa.')
  }
}

async function toggleActive(item: RateTermItemDto) {
  try {
    await PricingService.setRateTermItemActive(item.id, { isActive: !item.isActive })
    toastStore.success(item.isActive ? 'Ítem inactivado' : 'Ítem activado')
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo cambiar el estado del ítem.')
  }
}

async function remove(item: RateTermItemDto) {
  if (!window.confirm(`¿Eliminar “${item.text}”?`)) return
  try {
    await PricingService.deleteRateTermItem(item.id)
    toastStore.success('Ítem eliminado')
    if (form.id === item.id) clearForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, 'No se pudo eliminar el ítem de tarifa.')
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Ítems de tarifa"
      subtitle="Catálogo único reutilizable para Tarifa incluye, Sujeto a y Tarifa no incluye. La categoría se elige al crear cada tarifa."
      :icon="ListChecks"
    />

    <section class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhCrudToolbar
        v-model:search="search"
        title="Catálogo de ítems"
        create-label="Nuevo ítem"
        :show-create="canCreate"
        @create="openCreate"
        @refresh="load"
      >
        <template #description>
          <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">
            {{ rows.length }} ítems registrados. Cada ítem existe una sola vez y puede asignarse a una sola categoría dentro de cada tarifa.
          </p>
        </template>
      </DhCrudToolbar>

      <div
        v-if="editorOpen"
        class="mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-black text-[var(--dh-text)]">{{ isEditing ? 'Editar ítem' : 'Nuevo ítem' }}</h2>
            <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">
              No se define Incluye/Sujeto a/No incluye aquí; esa asignación se hace al crear la tarifa.
            </p>
          </div>
          <DhButton label="Cerrar" variant="ghost" size="sm" :icon="X" @click="clearForm" />
        </div>
        <div class="grid gap-4 lg:grid-cols-[1fr_140px_auto] lg:items-end">
          <DhInput v-model="form.text" label="Ítem" placeholder="Ej.: 14 días libres en destino" @keyup.enter="save" />
          <DhInput v-model="form.sortOrder" type="number" min="0" step="1" label="Orden" />
          <DhButton :label="isEditing ? 'Guardar cambios' : 'Agregar ítem'" :icon="Save" @click="save" />
        </div>
      </div>

      <div class="mt-5">
        <DhDataTable
          :columns="columns"
          :rows="visibleRows"
          :loading="loading"
          empty-text="No hay ítems que coincidan con la búsqueda."
          @row-click="(row) => canUpdate && edit(row)"
        >
          <template #cell-sortOrder="{ value }">
            <span class="font-black text-[var(--dh-text-muted)]">{{ value }}</span>
          </template>
          <template #cell-text="{ value }">
            <div>
              <p class="font-bold text-[var(--dh-text)]">{{ value }}</p>
              <p class="mt-0.5 text-xs font-semibold text-[var(--dh-text-muted)]">
                Disponible para Incluye, Sujeto a o No incluye
              </p>
            </div>
          </template>
          <template #cell-isActive="{ value }">
            <DhBadge :label="value ? 'Activo' : 'Inactivo'" :variant="value ? 'success' : 'neutral'" />
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-1">
              <button
                v-if="canUpdate"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                title="Editar"
                @click.stop="edit(row)"
              >
                <Pencil class="h-4 w-4" />
              </button>
              <button
                v-if="canSetActive"
                type="button"
                class="rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10"
                :title="row.isActive ? 'Inactivar' : 'Activar'"
                @click.stop="toggleActive(row)"
              >
                <PowerOff v-if="row.isActive" class="h-4 w-4 text-amber-600" />
                <Power v-else class="h-4 w-4 text-emerald-600" />
              </button>
              <button
                v-if="canDelete"
                type="button"
                class="rounded-2xl p-2 text-red-500 hover:bg-red-500/10"
                title="Eliminar"
                @click.stop="remove(row)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </div>
          </template>
        </DhDataTable>
      </div>
    </section>
  </section>
</template>
