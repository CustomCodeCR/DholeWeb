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
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

type SelectCatalogConfig = {
  slug: string
  name: string
  description: string
  requiredIn: string
}

type SelectOption = { label: string; value: string }

type WarehouseContact = {
  name?: string
  role?: string
  email?: string
  phone?: string
  isPrimary?: boolean
  isActive?: boolean
  shipmentModes?: string[]
  modalities?: string[]
  routes?: string[]
}

type WarehouseMetadata = {
  address?: string
  countryCode?: string
  schedule?: string
  contacts?: string
  email?: string
  phone?: string
  latitude?: number | string
  longitude?: number | string
  contactDirectory?: WarehouseContact[]
}

const router = useRouter()
const toastStore = useToastStore()
const loading = ref(false)
const selectedSlug = ref('pricing-warehouses')
const items = ref<CatalogItemDto[]>([])

const catalogs: SelectCatalogConfig[] = [
  {
    slug: 'pricing-warehouses',
    name: 'WHS globales',
    description: 'Oficinas y warehouses de origen administrables desde Config. Incluyen dirección, fotos, coordenadas y múltiples contactos por modalidad o ruta.',
    requiredIn: 'Wizard de Pricing / FOB, FCA y EXW / QR de oficina en origen',
  },
  {
    slug: 'pricing-clients',
    name: 'Clientes de Pricing (temporal)',
    description: 'Clientes usados por Pricing mientras el módulo Comercial no sea la fuente de verdad.',
    requiredIn: 'Wizard de Pricing / Datos comerciales',
  },
  {
    slug: 'pricing-sales-executives',
    name: 'Ejecutivos comerciales (temporal)',
    description: 'Ejecutivos usados por Pricing mientras el módulo Comercial no sea la fuente de verdad.',
    requiredIn: 'Wizard de Pricing / Datos comerciales',
  },
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

const columns = computed<DhTableColumn<CatalogItemDto>[]>(() => {
  const base: DhTableColumn<CatalogItemDto>[] = [
    { key: 'name', label: 'Nombre' },
    { key: 'code', label: 'Código', width: '150px' },
    { key: 'slug', label: 'Slug', width: '180px' },
    { key: 'value', label: 'Valor enviado a Pricing', width: '190px' },
  ]

  if (selectedSlug.value === 'pricing-warehouses') {
    base.push({ key: 'metadataJson', label: 'Datos del WHS', width: '520px' })
  }

  base.push(
    { key: 'sortOrder', label: 'Orden', align: 'right', width: '90px' },
    { key: 'isActive', label: 'Activo', align: 'center', width: '100px' },
  )

  return base
})

function warehouseMetadata(row: CatalogItemDto): WarehouseMetadata {
  if (!row.metadataJson) return {}

  try {
    return JSON.parse(row.metadataJson) as WarehouseMetadata
  } catch {
    return {}
  }
}

function warehouseCoordinates(row: CatalogItemDto) {
  const metadata = warehouseMetadata(row)
  if (metadata.latitude == null || metadata.longitude == null) return ''
  return `${metadata.latitude}, ${metadata.longitude}`
}

function warehouseContacts(row: CatalogItemDto): WarehouseContact[] {
  const metadata = warehouseMetadata(row)
  if (Array.isArray(metadata.contactDirectory) && metadata.contactDirectory.length) {
    return metadata.contactDirectory.filter((contact) => contact.isActive !== false)
  }

  if (!metadata.contacts && !metadata.email && !metadata.phone) return []
  return [{
    name: metadata.contacts,
    email: metadata.email,
    phone: metadata.phone,
    isPrimary: true,
    isActive: true,
  }]
}

function contactRules(contact: WarehouseContact) {
  const modes = contact.shipmentModes?.length ? contact.shipmentModes : contact.modalities ?? []
  const routeRules = contact.routes ?? []
  return [...modes, ...routeRules].filter(Boolean).join(' · ')
}

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
  router.push({ path: '/config/catalogs', query: { search: selectedSlug.value } })
}

watch(selectedSlug, loadItems)

useViewShortcuts({ save: loadItems, refresh: loadItems })

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

        <template #cell-metadataJson="{ row }">
          <div v-if="selectedSlug === 'pricing-warehouses'" class="space-y-1.5 text-xs leading-5 text-[var(--dh-text)]">
            <p v-if="warehouseMetadata(row).address"><strong>Dirección:</strong> {{ warehouseMetadata(row).address }}</p>
            <p v-if="warehouseMetadata(row).schedule"><strong>Horario:</strong> {{ warehouseMetadata(row).schedule }}</p>
            <div v-if="warehouseContacts(row).length" class="space-y-1">
              <p class="font-black">Contactos:</p>
              <p v-for="(contact, index) in warehouseContacts(row)" :key="`${row.id}-${index}`">
                <strong>{{ contact.name || `Contacto ${index + 1}` }}</strong>
                <span v-if="contact.role"> · {{ contact.role }}</span>
                <span v-if="contact.email"> · {{ contact.email }}</span>
                <span v-if="contact.phone"> · {{ contact.phone }}</span>
                <span v-if="contactRules(contact)" class="text-[var(--dh-primary)]"> · {{ contactRules(contact) }}</span>
                <span v-if="contact.isPrimary"> · principal</span>
              </p>
            </div>
            <p v-if="warehouseCoordinates(row)"><strong>Coordenadas:</strong> {{ warehouseCoordinates(row) }}</p>
          </div>
        </template>

        <template #cell-isActive="{ value }">
          <DhBadge :label="value ? 'Sí' : 'No'" :variant="value ? 'success' : 'danger'" />
        </template>
      </DhDataTable>
    </article>
  </section>
</template>
