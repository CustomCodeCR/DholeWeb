<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Database, RefreshCcw, Settings2 } from 'lucide-vue-next'
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { useToastStore } from '@/core/stores/toastStore'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'

type SelectCatalogConfig = {
  slug: string
  name: string
  description: string
  requiredIn: string
}

type SelectOption = { label: string; value: string }

const router = useRouter()
const toastStore = useToastStore()
const loading = ref(false)
const selectedSlug = ref('ports')
const items = ref<CatalogItemDto[]>([])

const catalogs: SelectCatalogConfig[] = [
  { slug: 'ports', name: 'Puertos', description: 'Origen, puerto de salida y destino para decisiones y tarifas FCL.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
  { slug: 'container-types', name: 'Tipos de contenedor', description: '20DV, 40DV, 40HC, 45HC u otros contenedores usados en pricing.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
  { slug: 'carriers', name: 'Navieras', description: 'Maersk, MSC, CMA CGM, Hapag-Lloyd y otras navieras.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
  { slug: 'agents', name: 'Agentes', description: 'Agentes o proveedores asociados a una tarifa.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
  { slug: 'commodities', name: 'Commodities', description: 'FAK, carga general, textiles, electrónicos u otras categorías.', requiredIn: 'Tarifas FCL / Decisión tarifaria' },
  { slug: 'incoterms', name: 'Incoterms', description: 'EXW, FOB, CIF, DAP, DDP y demás términos comerciales.', requiredIn: 'Decisión tarifaria' },
  { slug: 'currencies', name: 'Monedas', description: 'Moneda de costos, venta y margen.', requiredIn: 'Tarifas FCL' },
  { slug: 'pricing-import-profiles', name: 'Perfiles de extracción', description: 'Perfil que usa DataExtraction al leer PDF, Excel o CSV.', requiredIn: 'Importar tarifario' },
]

const catalogOptions = computed<SelectOption[]>(() => catalogs.map((catalog) => ({ label: catalog.name, value: catalog.slug })))
const selectedCatalog = computed<SelectCatalogConfig>(() => catalogs.find((catalog) => catalog.slug === selectedSlug.value) ?? catalogs[0]!)

const columns: DhTableColumn<CatalogItemDto>[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código', width: '140px' },
  { key: 'slug', label: 'Slug', width: '180px' },
  { key: 'value', label: 'Valor enviado a Pricing', width: '190px' },
  { key: 'sortOrder', label: 'Orden', align: 'right', width: '90px' },
  { key: 'isActive', label: 'Activo', align: 'center', width: '100px' },
]

async function loadItems() {
  loading.value = true

  try {
    items.value = await CatalogItemsService.getByGroupSlug(selectedSlug.value)
  } catch (error) {
    items.value = []
    toastStore.backendWarning(error, 'No se pudieron cargar los valores del catálogo seleccionado.')
  } finally {
    loading.value = false
  }
}

function openCatalogAdmin() {
  router.push('/config/catalogs')
}

watch(selectedSlug, loadItems)

onMounted(loadItems)
</script>

<template>
  <section class="space-y-6">
    <DhPageHeader
      title="Selects de Pricing"
      subtitle="Estos combos se alimentan desde ConfigService. Pricing valida los valores antes de crear tarifas o decisiones."
      :icon="Settings2"
    >
      <template #actions>
        <DhButton :icon="RefreshCcw" variant="secondary" label="Actualizar" :loading="loading" @click="loadItems" />
        <DhButton :icon="Database" label="Administrar catálogos" @click="openCatalogAdmin" />
      </template>
    </DhPageHeader>

    <article class="dh-glass dh-liquid rounded-[32px] p-5">
      <div class="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-end">
        <DhSelect v-model="selectedSlug" label="Catálogo para selects" :options="catalogOptions" />
        <div class="rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-black text-[var(--dh-text)]">{{ selectedCatalog.name }}</h2>
            <DhBadge label="ConfigService" variant="primary" />
            <DhBadge :label="selectedCatalog.slug" variant="neutral" />
          </div>
          <p class="mt-2 text-sm font-semibold leading-6 text-[var(--dh-text-muted)]">
            {{ selectedCatalog.description }} Se usa en: {{ selectedCatalog.requiredIn }}.
          </p>
        </div>
      </div>
    </article>

    <article class="dh-glass dh-liquid rounded-[32px] p-5">
      <DhDataTable
        :columns="columns"
        :rows="items"
        :loading="loading"
        empty-text="No hay valores para este catálogo. Créelos desde ConfigService para que aparezcan en Pricing."
      >
        <template #cell-value="{ row, value }">
          <span class="font-mono text-xs font-black text-[var(--dh-text)]">{{ value || row.code || row.slug }}</span>
        </template>
        <template #cell-isActive="{ value }">
          <DhBadge :label="value ? 'Sí' : 'No'" :variant="value ? 'success' : 'danger'" />
        </template>
      </DhDataTable>
    </article>
  </section>
</template>
