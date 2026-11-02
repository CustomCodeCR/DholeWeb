<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Building2, FolderOpen, Pencil, Plus, RefreshCw, Search, ShieldAlert, X } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { DhDrawer } from '@/shared/components/organisms'
import { DhMultiSelect } from '@/shared/components/atoms'
import { SrmApi, type SrmLegacyPartner } from '../services/srmApi'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto, CatalogItemSelectDto } from '@/core/interfaces/catalogs'

type Supplier = CatalogItemDto & { category: string }
type SrmRecord = CatalogItemDto & { supplierId: string; score?: number; expiresAt?: string }
const auth = useAuthStore()
const { t, locale } = useI18n()
const en = computed(() => locale.value === 'en')
const canReadSection = computed(() => auth.hasScope('srm.supplier.read'))
const canCreateSuppliers = computed(() => auth.hasScope('srm.supplier.create'))
const canEditSuppliers = computed(() => auth.hasScope('srm.supplier.update'))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const formVisible = ref(false)
const suppliers = ref<Supplier[]>([])
const evaluations = ref<SrmRecord[]>([])
const contracts = ref<SrmRecord[]>([])
const selected = ref<Supplier | null>(null)
const query = ref('')
const category = ref('all')
const supplierName = ref('')
const supplierType = ref<string[]>([])
const categoryOptions = [
  { value: 'agent', label: 'Agente' },
  { value: 'coloader', label: 'Coloader' },
  { value: 'road', label: 'Transportista' },
  { value: 'carrier', label: 'Naviera' },
  { value: 'airline', label: 'Aerolínea' },
  { value: 'sister-company', label: 'Empresa hermana' },
  { value: 'other', label: 'Otros' },
]
const categoryValues = new Set(categoryOptions.map(option => option.value))
const typeLabel = (value: string) =>
  categoryOptions.find(item => item.value === value)?.label || 'Otros'
const resolvedSupplierTypes = computed(() =>
  [...new Set(supplierType.value.filter(value => categoryValues.has(value)))])
const validSupplierType = computed(() => resolvedSupplierTypes.value.length > 0)

const supplierDescription = ref('')
type SupplierContact = { name: string; email: string; phone: string; role: string }
const contacts = ref<SupplierContact[]>([])
const shipmentModes = ref<string[]>([])
const modeOptions = [
  { value: 'Fcl', label: 'Marítimo FCL' }, { value: 'Lcl', label: 'Marítimo LCL' },
  { value: 'Ftl', label: 'Terrestre FTL' }, { value: 'Ltl', label: 'Terrestre LTL' },
  { value: 'Air', label: 'Aéreo' },
]
function normalizeSupplierModes(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((mode): mode is string => typeof mode === 'string')
    .map(mode => mode === 'AirConsol' ? 'Air' : mode)
    .filter(mode => modeOptions.some(option => option.value === mode)))]
}
function newContact(): SupplierContact { return { name: '', email: '', phone: '', role: '' } }
function supplierContacts(item: Supplier): SupplierContact[] {
  const info = metadata(item)
  const saved = Array.isArray(info.contacts) ? info.contacts : []
  const mapped = saved.filter((row): row is Record<string, unknown> =>
    !!row && typeof row === 'object' && !Array.isArray(row))
    .map(row => ({
      name: String(row.name || ''), email: String(row.email || ''),
      phone: String(row.phone || ''), role: String(row.role || ''),
    })).filter(row => row.name.trim())
  if (mapped.length) return mapped
  if (info.contactName) return [{
    name: String(info.contactName), email: String(info.contactEmail || ''),
    phone: String(info.contactPhone || ''), role: '',
  }]
  return []
}

const editing = ref<Supplier | null>(null)
const legacyPartners = ref<SrmLegacyPartner[]>([])
const legacyQuery = ref('')
const legacyGroup = ref<'all' | 'carriers' | 'agents'>('all')
const importBusy = ref('')
const countryIds = ref<string[]>([])
const countries = ref<CatalogItemSelectDto[]>([])
const countryOptions = computed(() => countries.value.map(row => ({
  value: row.id, label: row.label || row.value || row.id,
})))

function metadata(row: CatalogItemDto): Record<string, unknown> {
  try {
    const obj = row.metadataJson ? JSON.parse(row.metadataJson) as unknown : {}
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : {}
  } catch { return {} }
}
function normalizeSupplierCategory(value: string): string {
  const slug = value.trim().toLowerCase()
  // Preserve existing internal slugs for Pricing and map former specific types to "Otros".
  const aliases: Record<string, string> = {
    transportista: 'road',
    transporter: 'road',
    'road-carrier': 'road',
    'transportista-terrestre': 'road',
    naviera: 'carrier',
    agente: 'agent',
    'agente-de-carga': 'agent',
    aerolinea: 'airline',
    'aerolínea': 'airline',
    'empresa-hermana': 'sister-company',
    consolidador: 'coloader',
    otros: 'other',
  }
  const resolved = aliases[slug] || slug
  return categoryValues.has(resolved) ? resolved : 'other'
}
function rawSupplierCategories(row: CatalogItemDto): string[] {
  const info = metadata(row)
  if (Array.isArray(info.supplierTypes) && info.supplierTypes.length) {
    const types = info.supplierTypes.filter((type): type is string =>
      typeof type === 'string' && !!type.trim())
    if (types.length) return [...new Set(types)]
  }
  return typeof info.supplierType === 'string' && info.supplierType.trim()
    ? [info.supplierType] : ['other']
}
function supplierCategories(row: CatalogItemDto): string[] {
  return [...new Set(rawSupplierCategories(row).map(normalizeSupplierCategory))]
}
function supplierCategory(row: CatalogItemDto) {
  return supplierCategories(row)[0] || 'other'
}
function mapRecords(items: CatalogItemDto[]): SrmRecord[] {
  return items.map(item => {
    const info = metadata(item)
    return {
      ...item,
      supplierId: String(info.supplierId || ''),
      score: typeof info.score === 'number' ? info.score : undefined,
      expiresAt: typeof info.expiresAt === 'string' ? info.expiresAt : undefined,
    }
  })
}
const pendingLegacy = computed(() => legacyPartners.value.filter(item => !item.imported))
const filteredLegacy = computed(() => pendingLegacy.value.filter(item =>
  (legacyGroup.value === 'all' || legacyGroup.value === item.sourceGroup) &&
  [item.name, item.code].some(value => value.toLocaleLowerCase().includes(legacyQuery.value.trim().toLocaleLowerCase()))))
const filteredSuppliers = computed(() => suppliers.value.filter(item =>
  (category.value === 'all' || supplierCategories(item).includes(category.value)) &&
  [item.name, item.description || '', ...supplierCategories(item).map(typeLabel)]
    .some(value => value.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
const supplierContracts = computed(() => selected.value && auth.hasScope('srm.contract.read')
  ? contracts.value.filter(item => item.supplierId === selected.value?.id) : [])
const supplierEvaluations = computed(() => selected.value && auth.hasScope('srm.performance.read')
  ? evaluations.value.filter(item => item.supplierId === selected.value?.id) : [])
function countryLabel(value: unknown) { return countries.value.find(item => item.id === value)?.label || '—' }
function supplierCountries(row: CatalogItemDto) {
  const info = metadata(row)
  const ids = Array.isArray(info.countryIds) && info.countryIds.length
    ? info.countryIds : info.countryId ? [info.countryId] : []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id.trim()))]
    .map(countryLabel).join(', ') || '—'
}
async function load() {
  if (!canReadSection.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await SrmApi.list('suppliers')
    suppliers.value = result.map(item => ({ ...item, category: supplierCategory(item) }))
    if (selected.value) selected.value = suppliers.value.find(item => item.id === selected.value?.id) || null
    const optional = await Promise.allSettled([
      SrmApi.legacyPartners(),
      auth.hasScope('srm.contract.read') ? SrmApi.list('contracts') : Promise.resolve([]),
      auth.hasScope('srm.performance.read') ? SrmApi.list('evaluations') : Promise.resolve([]),
    ])
    legacyPartners.value = optional[0]?.status === 'fulfilled' ? optional[0].value : []
    contracts.value = optional[1]?.status === 'fulfilled' ? mapRecords(optional[1].value) : []
    evaluations.value = optional[2]?.status === 'fulfilled' ? mapRecords(optional[2].value) : []
  } catch {
    error.value = t('srm.loadError')
  } finally {
    loading.value = false
  }
}
function resetForm() {
  editing.value = null
  supplierName.value = ''
  supplierType.value = []
  supplierDescription.value = ''
  contacts.value = []
  shipmentModes.value = []
  countryIds.value = []
}
function openCreate() { resetForm(); formVisible.value = true; error.value = ''; success.value = '' }
function openEdit(item: Supplier) {
  if (!canEditSuppliers.value) return
  resetForm()
  editing.value = item
  supplierName.value = item.name
  supplierType.value = supplierCategories(item)
  supplierDescription.value = item.description || ''
  const info = metadata(item)
  contacts.value = supplierContacts(item)
  shipmentModes.value = normalizeSupplierModes(info.shipmentModes)
  countryIds.value = Array.isArray(info.countryIds) && info.countryIds.length
    ? info.countryIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
    : typeof info.countryId === 'string' && info.countryId ? [info.countryId] : []
  formVisible.value = true
}
function openDetails(item: Supplier) { selected.value = item; formVisible.value = false }
function closeForm() { formVisible.value = false; resetForm() }
async function saveSupplier() {
  if (saving.value || !supplierName.value.trim() || !validSupplierType.value ||
      !(editing.value ? canEditSuppliers.value : canCreateSuppliers.value)) return
  if (!shipmentModes.value.length || !countryIds.value.length) {
    error.value = en.value
      ? 'Select at least one shipment mode and country.'
      : 'Seleccioná al menos una modalidad y un país.'
    return
  }
  const filledContacts = contacts.value.map(contact => ({
    name: contact.name.trim(), email: contact.email.trim(),
    phone: contact.phone.trim(), role: contact.role.trim(),
  })).filter(contact => contact.name || contact.email || contact.phone || contact.role)
  if (filledContacts.some(contact => !contact.name)) {
    error.value = en.value
      ? 'Enter a name for every added contact, or remove the incomplete contact.'
      : 'Ingresá el nombre de cada contacto agregado o eliminá el contacto incompleto.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const retained = editing.value ? metadata(editing.value) : {}
    const previousTypes = editing.value ? rawSupplierCategories(editing.value) : []
    const previousSpecificTypes = previousTypes.filter(type =>
      !categoryValues.has(type.trim().toLowerCase()))
    const selectedTypes = resolvedSupplierTypes.value
    const selectedCountries = [...new Set(countryIds.value)]
    const metadataJson = JSON.stringify({
      ...retained,
      supplierType: selectedTypes[0] || null,
      supplierTypes: selectedTypes,
      // Keep the previous detailed classification for reference, never as a selectable category.
      ...(previousSpecificTypes.length ? { legacySupplierTypes:
        [...new Set([...(Array.isArray(retained.legacySupplierTypes)
          ? retained.legacySupplierTypes.filter((item): item is string => typeof item === 'string') : []),
          ...previousSpecificTypes])] } : {}),
      shipmentModes: [...new Set(shipmentModes.value)],
      contacts: filledContacts,
      contactName: filledContacts[0]?.name || '',
      contactEmail: filledContacts[0]?.email || '',
      contactPhone: filledContacts[0]?.phone || '',
      countryId: selectedCountries[0] || null,
      countryIds: selectedCountries,
    })
    if (editing.value) {
      await SrmApi.updateSupplier(editing.value.id, {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: editing.value.sortOrder,
      })
    } else {
      await SrmApi.create('suppliers', {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: suppliers.value.length + 1,
      })
    }
    const editingId = editing.value?.id
    closeForm()
    success.value = t('crm.saved')
    await load()
    if (editingId) selected.value = suppliers.value.find(item => item.id === editingId) || selected.value
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('srm.loadError') }
  finally { saving.value = false }
}

async function importLegacy(item: SrmLegacyPartner) {
  if (!canCreateSuppliers.value || item.imported || importBusy.value) return
  importBusy.value = item.id
  error.value = ''
  success.value = ''
  try {
    await SrmApi.importLegacyPartner(item.sourceGroup, item.id)
    success.value = (en.value ? 'Partner incorporated in SRM directory: ' : 'Socio incorporado al directorio SRM: ') + item.name
    await load()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('srm.loadError')
  } finally {importBusy.value = ''}
}

watch(canReadSection, () => { closeForm(); void load() })
onMounted(() => {
  void load()
  void CatalogItemsService.select({ catalogGroupSlug: 'countries' })
    .then(rows => { countries.value = rows.filter(row => row.isActive !== false) })
    .catch(() => { countries.value = [] })
})
</script>

<template>
  <main class="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 text-[var(--dh-text)] sm:px-7 lg:py-7" data-srm-workspace>
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[var(--dh-primary)]">SRM</p>
        <h1 class="text-2xl font-extrabold tracking-tight sm:text-3xl">{{ en ? 'Supplier directory' : 'Directorio de proveedores' }}</h1>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ en ? 'Manage suppliers and their contacts in one place.' : 'Proveedores y contactos en un solo lugar.' }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" :disabled="loading || !canReadSection" :aria-label="t('srm.refresh')"
          class="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 text-sm font-semibold hover:bg-[var(--dh-card)] disabled:opacity-50" @click="load">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" /><span class="hidden sm:inline">{{ t('srm.refresh') }}</span>
        </button>
        <button v-if="canCreateSuppliers" type="button"
          class="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 text-sm font-bold text-white hover:opacity-90" @click="openCreate">
          <Plus class="h-4 w-4" />{{ en ? 'New supplier' : 'Nuevo proveedor' }}
        </button>
      </div>
    </header>
    <div v-if="!canReadSection" role="alert" class="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <ShieldAlert class="h-5 w-5 shrink-0 text-amber-500" />
      <p class="text-sm font-semibold">{{ en ? 'You do not have permission to view suppliers.' : 'No tenés permisos para consultar proveedores.' }}</p>
    </div>
    <template v-else>
      <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{{ error }}</p>
      <p v-if="success" role="status" class="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-500">{{ success }}</p>
      <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <section class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
          <div class="space-y-3 border-b border-[var(--dh-border)] p-4 sm:p-5">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-bold">{{ en ? 'Suppliers' : 'Proveedores' }}</h2>
              <span class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ filteredSuppliers.length }} {{ en ? 'registered' : 'registrados' }}</span>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row">
              <label class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3">
                <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
                <input v-model="query" type="search" :placeholder="en ? 'Search suppliers...' : 'Buscar proveedores...'"
                  :aria-label="en ? 'Search suppliers' : 'Buscar proveedores'"
                  class="min-w-0 w-full bg-transparent py-2.5 text-sm outline-none" />
              </label>
              <select v-model="category" :aria-label="en ? 'Filter by category' : 'Filtrar por categoría'"
                class="min-h-10 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 text-sm font-semibold">
                <option value="all">{{ en ? 'All categories' : 'Todas las categorías' }}</option>
                <option v-for="option in categoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </div>
          </div>
          <div v-if="loading" class="px-5 py-12 text-center text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</div>
          <div v-else-if="!filteredSuppliers.length" class="flex flex-col items-center px-5 py-14 text-center">
            <FolderOpen class="h-8 w-8 text-[var(--dh-text-muted)]" />
            <p class="mt-3 text-sm font-semibold">{{ en ? 'No suppliers found' : 'No se encontraron proveedores' }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Adjust the filters or create a supplier.' : 'Cambiá los filtros o registrá un proveedor.' }}</p>
          </div>
          <div v-else class="divide-y divide-[var(--dh-border)]">
            <button v-for="item in filteredSuppliers" :key="item.id" type="button"
              :aria-pressed="selected?.id === item.id"
              class="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[var(--dh-card-hover)] sm:px-5"
              :class="selected?.id === item.id ? 'bg-[var(--dh-card-hover)]' : ''" @click="openDetails(item)">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
                <Building2 class="h-5 w-5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-extrabold">{{ item.name }}</p>
                <p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ supplierCategories(item).map(typeLabel).join(' · ') }}</p>
              </div>
              <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                :class="item.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-[var(--dh-text-muted)]'">
                {{ en ? (item.isActive ? 'Active' : 'Inactive') : (item.isActive ? 'Activo' : 'Inactivo') }}
              </span>
            </button>
          </div>
          <details v-if="canCreateSuppliers && pendingLegacy.length" class="border-t border-[var(--dh-border)] px-4 py-4 sm:px-5">
            <summary class="cursor-pointer text-xs font-semibold text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]">
              {{ en ? 'Import existing suppliers' : 'Importar proveedores existentes' }} ({{ pendingLegacy.length }})
            </summary>
            <div class="mt-3 flex flex-wrap gap-2">
              <input v-model="legacyQuery" type="search" :aria-label="en ? 'Search imports' : 'Buscar importaciones'"
                :placeholder="en ? 'Search...' : 'Buscar...'"
                class="min-w-0 flex-1 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-xs" />
              <select v-model="legacyGroup" class="rounded-lg border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-xs">
                <option value="all">{{ en ? 'All' : 'Todos' }}</option>
                <option value="carriers">{{ en ? 'Carriers' : 'Navieras' }}</option>
                <option value="agents">{{ en ? 'Agents' : 'Agentes' }}</option>
              </select>
            </div>
            <div class="mt-2 max-h-56 space-y-1 overflow-y-auto">
              <div v-for="item in filteredLegacy" :key="item.sourceGroup + item.id" class="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-[var(--dh-card-hover)]">
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold">{{ item.name }}</p>
                  <p class="text-[11px] text-[var(--dh-text-muted)]">{{ item.sourceGroup === 'carriers' ? 'Naviera' : 'Agente' }}</p>
                </div>
                <button type="button" :disabled="Boolean(importBusy)" @click="importLegacy(item)"
                  class="shrink-0 rounded-lg border border-[var(--dh-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--dh-primary)] disabled:opacity-50">
                  {{ importBusy === item.id ? '…' : (en ? 'Import' : 'Importar') }}
                </button>
              </div>
            </div>
          </details>
        </section>
        <aside class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
          <template v-if="selected">
            <div class="flex items-start justify-between gap-3 border-b border-[var(--dh-border)] px-5 py-5">
              <div class="min-w-0">
                <p class="text-[11px] font-bold uppercase tracking-widest text-[var(--dh-text-muted)]">{{ en ? 'Supplier' : 'Proveedor' }}</p>
                <h2 class="mt-1 break-words text-xl font-extrabold">{{ selected.name }}</h2>
              </div>
              <div class="flex shrink-0 gap-2">
                <button v-if="canEditSuppliers" type="button"
                  class="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--dh-border)] px-3 text-xs font-bold hover:border-[var(--dh-primary)]"
                  @click="openEdit(selected)"><Pencil class="h-3.5 w-3.5" />{{ en ? 'Edit' : 'Editar' }}</button>
                <button type="button" :aria-label="t('common.close')" @click="selected = null"
                  class="grid h-9 w-9 place-items-center rounded-lg border border-[var(--dh-border)]"><X class="h-4 w-4" /></button>
              </div>
            </div>
            <div class="space-y-5 p-5">
              <dl class="space-y-4">
                <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ en ? 'Categories' : 'Categorías' }}</dt>
                  <dd class="flex flex-wrap gap-1.5"><span v-for="cat in supplierCategories(selected)" :key="cat"
                    class="rounded-full bg-[rgb(var(--dh-primary-rgb)/0.1)] px-2.5 py-1 text-xs font-semibold text-[var(--dh-primary)]">{{ typeLabel(cat) }}</span></dd>
                </div>
                <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ en ? 'Shipment modes' : 'Modalidades' }}</dt>
                  <dd class="text-sm font-semibold">{{ normalizeSupplierModes(metadata(selected).shipmentModes)
                    .map(mode => modeOptions.find(option => option.value === mode)?.label || mode).join(' · ') || '—' }}</dd></div>
                <div><dt class="mb-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ en ? 'Countries' : 'Países' }}</dt>
                  <dd class="text-sm font-semibold">{{ supplierCountries(selected) }}</dd></div>
              </dl>
              <div v-if="supplierContacts(selected).length" class="border-t border-[var(--dh-border)] pt-4">
                <h3 class="mb-2 text-sm font-bold">{{ en ? 'Contacts' : 'Contactos' }}</h3>
                <div v-for="(contact, index) in supplierContacts(selected)" :key="index" class="py-2 text-xs">
                  <p class="font-semibold">{{ contact.name }}<span v-if="contact.role" class="text-[var(--dh-text-muted)]"> · {{ contact.role }}</span></p>
                  <p v-if="contact.email" class="mt-1 text-[var(--dh-text-muted)]">{{ contact.email }}</p>
                  <p v-if="contact.phone" class="mt-1 text-[var(--dh-text-muted)]">{{ contact.phone }}</p>
                </div>
              </div>
              <div v-if="selected.description" class="border-t border-[var(--dh-border)] pt-4">
                <h3 class="mb-1 text-sm font-bold">{{ en ? 'Description' : 'Descripción' }}</h3>
                <p class="whitespace-pre-wrap text-sm text-[var(--dh-text-muted)]">{{ selected.description }}</p>
              </div>
              <details v-if="supplierContracts.length || supplierEvaluations.length"
                class="border-t border-[var(--dh-border)] pt-4">
                <summary class="cursor-pointer text-sm font-semibold">{{ en ? 'Commercial history' : 'Historial comercial' }}</summary>
                <div v-if="supplierContracts.length" class="mt-3 space-y-2">
                  <h3 class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Agreements' : 'Acuerdos' }}</h3>
                  <div v-for="item in supplierContracts" :key="item.id" class="rounded-lg border border-[var(--dh-border)] p-3">
                    <p class="text-xs font-semibold">{{ item.name }}</p>
                    <p v-if="item.expiresAt" class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Expires' : 'Vence' }}: {{ item.expiresAt }}</p>
                  </div>
                </div>
                <div v-if="supplierEvaluations.length" class="mt-3 space-y-2">
                  <h3 class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Reviews' : 'Evaluaciones' }}</h3>
                  <div v-for="item in supplierEvaluations" :key="item.id"
                    class="flex items-center justify-between gap-3 rounded-lg border border-[var(--dh-border)] p-3 text-xs">
                    <span>{{ item.name }}</span><strong>{{ item.score ?? '—' }} / 5</strong>
                  </div>
                </div>
              </details>
            </div>
          </template>
          <div v-else class="flex min-h-[340px] flex-col items-center justify-center px-6 py-10 text-center">
            <Building2 class="h-9 w-9 text-[var(--dh-text-muted)]" />
            <p class="mt-3 text-sm font-bold">{{ en ? 'Select a supplier' : 'Seleccioná un proveedor' }}</p>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Choose a company to see its details.' : 'Elegí una empresa para ver sus datos.' }}</p>
          </div>
        </aside>
      </div>
      <DhDrawer :open="formVisible" :title="editing ? (en ? 'Edit supplier' : 'Editar proveedor') : (en ? 'New supplier' : 'Nuevo proveedor')"
        size="xl" @close="closeForm">
        <form class="grid gap-4 md:grid-cols-2" @submit.prevent="saveSupplier">
          <label class="text-sm font-semibold">{{ en ? 'Company name' : 'Nombre de empresa' }}
            <input v-model="supplierName" required maxlength="220" placeholder="Ej. Transportes Romo" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="min-w-0">
            <DhMultiSelect v-model="supplierType" :options="categoryOptions"
              :label="en ? 'Categories *' : 'Categorías *'"
              :placeholder="en ? 'Select categories' : 'Seleccionar categorías'"
              :search-placeholder="en ? 'Search categories...' : 'Buscar categorías...'" />
          </div>
          <div class="min-w-0 md:col-span-2">
            <DhMultiSelect v-model="shipmentModes" :options="modeOptions"
              :label="en ? 'Shipment modes *' : 'Modalidades *'"
              :placeholder="en ? 'Select shipment modes' : 'Seleccionar modalidades'"
              :search-placeholder="en ? 'Search modes...' : 'Buscar modalidades...'" />
          </div>
          <div class="min-w-0">
            <DhMultiSelect v-model="countryIds" :options="countryOptions"
              :label="en ? 'Countries *' : 'Países *'"
              :placeholder="en ? 'Select countries' : 'Seleccionar países'"
              :search-placeholder="en ? 'Search countries...' : 'Buscar países...'" />
          </div>
          <section class="md:col-span-2 space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold">Contactos del proveedor <span class="font-medium text-[var(--dh-text-muted)]">(opcional)</span></h3>
              <button type="button" :disabled="contacts.length >= 30"
                class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
                @click="contacts.push(newContact())">+ Agregar contacto</button>
            </div>
            <div v-for="(contact, index) in contacts" :key="index" class="grid gap-3 border-t border-[var(--dh-border)] pt-3 md:grid-cols-2">
              <label class="text-xs font-semibold">Nombre *
                <input v-model="contact.name" :required="Boolean(contact.email.trim() || contact.phone.trim() || contact.role.trim())" maxlength="140" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
              </label>
              <label class="text-xs font-semibold">Cargo
                <input v-model="contact.role" maxlength="100" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
              </label>
              <label class="text-xs font-semibold">Correo
                <input v-model="contact.email" type="email" maxlength="180" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
              </label>
              <label class="text-xs font-semibold">Teléfono
                <input v-model="contact.phone" maxlength="40" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
              </label>
              <button type="button" class="justify-self-start text-xs font-bold text-red-500" @click="contacts.splice(index, 1)">Eliminar contacto</button>
            </div>
          </section>
          <label class="text-sm font-semibold">{{ en ? 'Description' : 'Descripción' }}
            <input v-model="supplierDescription" maxlength="300" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="md:col-span-2"><button type="submit" :disabled="saving || !supplierName.trim() || !validSupplierType || !shipmentModes.length || !countryIds.length" class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{{ saving ? t('common.loading') : (en ? 'Save supplier' : 'Guardar proveedor') }}</button></div>
        </form>
      </DhDrawer>
    </template>
  </main>
</template>
