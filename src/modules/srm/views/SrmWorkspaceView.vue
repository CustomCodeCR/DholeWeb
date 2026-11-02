<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ArrowRight, Building2, CheckCircle2, ClipboardCheck, FileSignature,
  FolderOpen, Pencil, Plus, RefreshCw, Search, ShieldAlert, Truck, X,
} from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { CONFIG_SCOPES } from '@/core/auth/scopes'
import { DhDrawer } from '@/shared/components/organisms'
import { DhMultiSelect } from '@/shared/components/atoms'
import { SrmApi, type SrmLegacyPartner } from '../services/srmApi'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'

type SrmSection = 'dashboard' | 'suppliers' | 'performance' | 'contracts'
type Supplier = CatalogItemDto & { category: string }
type SrmRecord = CatalogItemDto & { supplierId: string; score?: number; expiresAt?: string }
const route = useRoute()
const auth = useAuthStore()
const { t, locale } = useI18n()
const section = computed(() => String(route.meta.srmSection || 'dashboard') as SrmSection)
const en = computed(() => locale.value === 'en')
const heading = computed(() => t('srm.suppliers'))
const canReadSuppliers = computed(() => auth.hasScope('srm.supplier.read'))
const canCreateSuppliers = computed(() => auth.hasScope('srm.supplier.create'))
const canEditSuppliers = computed(() => auth.hasScope('srm.supplier.update'))
const canReadSection = computed(() => {
  if (!canReadSuppliers.value) return false
  if (section.value === 'performance') return auth.hasScope('srm.performance.read')
  if (section.value === 'contracts') return auth.hasScope('srm.contract.read')
  return true
})
const canWriteSection = computed(() => section.value === 'performance'
  ? auth.hasScope('srm.performance.manage')
  : section.value === 'contracts'
    ? auth.hasScope('srm.contract.manage') : canCreateSuppliers.value)

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const formVisible = ref(false)
const suppliers = ref<Supplier[]>([])
const evaluations = ref<SrmRecord[]>([])
const contracts = ref<SrmRecord[]>([])
const selected = ref<Supplier | null>(null)
const supplierTab = ref<'profile' | 'terms' | 'performance'>('profile')
const supplierTabs = [
  { key: 'profile', label: 'Ficha proveedor' },
  { key: 'terms', label: 'Condiciones comerciales' },
  { key: 'performance', label: 'Evaluaciones' },
] as const
const query = ref('')
const category = ref('all')
const supplierId = ref('')
const supplierName = ref('')
const supplierType = ref<string[]>([])
const customSupplierType = ref('')
const supplierTypes = ref<CatalogItemDto[]>([])
const fallbackTypes = [
  { value: 'carrier', label: 'Naviera' },
  { value: 'agent', label: 'Agente de carga' },
  { value: 'road', label: 'Transportista terrestre' },
  { value: 'airline', label: 'Aerolínea' },
  { value: 'customs-foreign', label: 'Agencia aduanal extranjera' },
  { value: 'bonded-warehouse-foreign', label: 'Almacén fiscal extranjero' },
  { value: 'sister-company', label: 'Empresa hermana' },
  { value: 'coloader', label: 'Coloader / consolidador' },
  { value: 'warehouse', label: 'Almacenaje' },
  { value: 'insurance', label: 'Seguros' },
  { value: 'other', label: 'Otros servicios' },
]
const typeOptions = computed(() => {
  const values = new Map(fallbackTypes.map(item => [item.value, item.label]))
  for (const item of supplierTypes.value) if (item.isActive) values.set(item.slug, item.name)
  for (const item of suppliers.value)
    for (const type of supplierCategories(item))
      if (!values.has(type)) values.set(type, type)
  return [...values].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
})
const typeLabel = (value: string) =>
  typeOptions.value.find(item => item.value === value)?.label || value
const categoryOptions = computed(() => [
  ...typeOptions.value,
  { value: '__custom__', label: en.value ? 'Other supplier category…' : 'Otra categoría de proveedor…' },
])
const resolvedSupplierTypes = computed(() => [...new Set([
  ...supplierType.value.filter(value => value !== '__custom__'),
  ...(supplierType.value.includes('__custom__') ? [customSupplierType.value] : []),
].map(value => value.trim().toLowerCase()).filter(Boolean))])
const validSupplierType = computed(() =>
  resolvedSupplierTypes.value.length > 0 &&
  resolvedSupplierTypes.value.every(value => value.length <= 60) &&
  (!supplierType.value.includes('__custom__') || !!customSupplierType.value.trim()))
const supplierDescription = ref('')
type SupplierContact = { name: string; email: string; phone: string; role: string }
const contacts = ref<SupplierContact[]>([])
const shipmentModes = ref<string[]>([])
const modeOptions = [
  { value: 'Fcl', label: 'Marítimo FCL' }, { value: 'Lcl', label: 'Marítimo LCL' },
  { value: 'Ftl', label: 'Terrestre FTL' }, { value: 'Ltl', label: 'Terrestre LTL' },
  { value: 'Air', label: 'Aéreo' }, { value: 'AirConsol', label: 'Aéreo consolidado' },
]
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
const score = ref(5)
const note = ref('')
const reference = ref('')
const expiresAt = ref('')
const legacyPartners = ref<SrmLegacyPartner[]>([])
const legacyQuery = ref('')
const legacyGroup = ref<'all' | 'carriers' | 'agents'>('all')
const currencies = ref<CatalogItemSelectDto[]>([])
const importBusy = ref('')
const countryIds = ref<string[]>([])
const taxId = ref('')
const website = ref('')
const paymentDays = ref('30')
const contractCurrency = ref('USD')
const rateReference = ref('')
const serviceCoverage = ref('')
const countries = ref<CatalogItemSelectDto[]>([])
const countryOptions = computed(() => countries.value.map(row => ({ value: row.id, label: row.label || row.value || row.id })))

function metadata(row: CatalogItemDto): Record<string, unknown> {
  try {
    const obj = row.metadataJson ? JSON.parse(row.metadataJson) as unknown : {}
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : {}
  } catch { return {} }
}
function supplierCategories(row: CatalogItemDto): string[] {
  const info = metadata(row)
  if (Array.isArray(info.supplierTypes)) {
    const types = info.supplierTypes.filter((type): type is string =>
      typeof type === 'string' && !!type.trim())
    if (types.length) return [...new Set(types)]
  }
  return typeof info.supplierType === 'string' && info.supplierType.trim()
    ? [info.supplierType] : ['other']
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
function supplierLabel(id: string) {
  return suppliers.value.find(item => item.id === id)?.name || (en.value ? 'Unknown supplier' : 'Proveedor no disponible')
}
const pendingLegacy = computed(() => legacyPartners.value.filter(x => !x.imported))
const filteredLegacy = computed(() => pendingLegacy.value.filter(x =>
  (legacyGroup.value === 'all' || legacyGroup.value === x.sourceGroup) &&
  [x.name, x.code].some(value => value.toLocaleLowerCase().includes(legacyQuery.value.trim().toLocaleLowerCase()))))
const importedLegacy = computed(() => legacyPartners.value.filter(x => x.imported).length)
const categories = computed(() => [...new Set(suppliers.value.flatMap(supplierCategories))]
  .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), 'es')))
const filteredSuppliers = computed(() => suppliers.value.filter(item =>
  (category.value === 'all' || supplierCategories(item).includes(category.value)) &&
  [item.name, item.code, item.description || ''].some(text => text.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
const activeCount = computed(() => suppliers.value.filter(row => row.isActive).length)
const selectedRecords = computed(() => section.value === 'contracts' ? contracts.value : evaluations.value)
const supplierContracts = computed(() => selected.value && auth.hasScope('srm.contract.read') ? contracts.value.filter(x => x.supplierId === selected.value?.id) : [])
const supplierEvaluations = computed(() => selected.value && auth.hasScope('srm.performance.read') ? evaluations.value.filter(x => x.supplierId === selected.value?.id) : [])
function countryLabel(value: unknown) { return countries.value.find(x => x.id === value)?.label || '—' }
function supplierCountries(row: CatalogItemDto) {
  const info = metadata(row)
  const ids = Array.isArray(info.countryIds) && info.countryIds.length
    ? info.countryIds : info.countryId ? [info.countryId] : []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id.trim()))]
    .map(countryLabel).join(', ') || '—'
}
const recordCount = computed(() => evaluations.value.length + contracts.value.length)
const overdueCount = computed(() => contracts.value.filter(row => row.expiresAt && row.expiresAt < new Date().toISOString().slice(0, 10)).length)
const averageScore = computed(() => evaluations.value.length
  ? (evaluations.value.reduce((total, row) => total + (row.score ?? 0), 0) / evaluations.value.length).toFixed(1)
  : '—')
const pageIntro = computed(() => section.value === 'contracts'
  ? (en.value ? 'Supplier agreements and expiry tracking' : 'Acuerdos con proveedores y control de vigencia')
  : section.value === 'performance'
    ? (en.value ? 'Assess and compare supplier quality' : 'Evalúe la calidad y el cumplimiento de proveedores')
    : (en.value ? 'Your logistics partner directory' : 'Administración de empresas y aliados logísticos'))

async function load() {
  if (!canReadSection.value) return
  loading.value = true
  error.value = ''
  try {
    const promises: Promise<CatalogItemDto[]>[] = [
      SrmApi.list('suppliers'),
    ]
    if (auth.hasScope('srm.performance.read') || auth.hasScope('srm.performance.manage'))
      promises.push(SrmApi.list('evaluations'))
    if (auth.hasScope('srm.contract.read') || auth.hasScope('srm.contract.manage'))
      promises.push(SrmApi.list('contracts'))
    const results = await Promise.allSettled(promises)
    const supplierResult = results[0]
    if (!supplierResult) throw new Error('SRM supplier result is missing')
    if (supplierResult.status === 'rejected') throw supplierResult.reason
    suppliers.value = supplierResult.value.map(item => ({ ...item, category: supplierCategory(item) }))
    try {
      legacyPartners.value = await SrmApi.legacyPartners()
    } catch { legacyPartners.value = [] }
    try { supplierTypes.value = await SrmApi.listTypes() }
    catch { supplierTypes.value = [] }
    // These catalogs are optional until the first record is created by a Config administrator.
    let index = 1
    if (auth.hasScope('srm.performance.read') || auth.hasScope('srm.performance.manage')) {
      const result = results[index++]
      evaluations.value = result?.status === 'fulfilled' ? mapRecords(result.value) : []
    }
    if (auth.hasScope('srm.contract.read') || auth.hasScope('srm.contract.manage')) {
      const result = results[index]
      contracts.value = result?.status === 'fulfilled' ? mapRecords(result.value) : []
    }
  } catch {
    error.value = t('srm.loadError')
  } finally { loading.value = false }
}
function resetForm() {
  editing.value = null
  supplierId.value = ''
  supplierName.value = ''
  supplierType.value = []
  customSupplierType.value = ''
  supplierDescription.value = ''
  contacts.value = []
  shipmentModes.value = []
  score.value = 5
  note.value = ''
  reference.value = ''
  expiresAt.value = ''
  countryIds.value = []
  taxId.value = ''
  website.value = ''
  paymentDays.value = '30'
  contractCurrency.value = 'USD'
  rateReference.value = ''
  serviceCoverage.value = ''
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
  shipmentModes.value = Array.isArray(info.shipmentModes) ?
    info.shipmentModes.filter((mode): mode is string =>
      typeof mode === 'string' && modeOptions.some(option => option.value === mode)) : []
  countryIds.value = Array.isArray(info.countryIds) && info.countryIds.length
    ? info.countryIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
    : typeof info.countryId === 'string' && info.countryId ? [info.countryId] : []
  taxId.value = String(info.taxId || '')
  website.value = String(info.website || '')
  formVisible.value = true
}
function openDetails(item: Supplier) { selected.value = item; supplierTab.value = 'profile'; formVisible.value = false }
function closeForm() { formVisible.value = false; resetForm() }
async function saveSupplier() {
  if (saving.value || !supplierName.value.trim() || !validSupplierType.value ||
      !(editing.value ? canEditSuppliers.value : canCreateSuppliers.value)) return
  if (!shipmentModes.value.length || !countryIds.value.length || !contacts.value.length ||
      contacts.value.some(contact => !contact.name.trim())) {
    error.value = en.value
      ? 'Select at least one category, mode, country and a contact with a name.'
      : 'Seleccioná al menos una categoría, una modalidad, un país y un contacto con nombre.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const retained = editing.value ? metadata(editing.value) : {}
    const selectedTypes = resolvedSupplierTypes.value
    const selectedCountries = [...new Set(countryIds.value)]
    const metadataJson = JSON.stringify({
      ...retained,
      supplierType: selectedTypes[0] || null,
      supplierTypes: selectedTypes,
      shipmentModes: [...new Set(shipmentModes.value)],
      contacts: contacts.value.map(contact => ({
        name: contact.name.trim(), email: contact.email.trim(),
        phone: contact.phone.trim(), role: contact.role.trim(),
      })),
      contactName: contacts.value[0]?.name.trim() || '',
      contactEmail: contacts.value[0]?.email.trim() || '',
      contactPhone: contacts.value[0]?.phone.trim() || '',
      countryId: selectedCountries[0] || null,
      countryIds: selectedCountries,
      taxId: taxId.value.trim() || null,
      website: website.value.trim() || null,
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
    closeForm()
    success.value = t('crm.saved')
    await load()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('srm.loadError') }
  finally { saving.value = false }
}
async function saveRecord() {
  if (saving.value || !supplierId.value || !canWriteSection.value) return
  saving.value = true
  error.value = ''
  try {
    const contract = section.value === 'contracts'
    const collection = contract ? 'contracts' : 'evaluations'
    const name = (contract ? (reference.value.trim() || 'Contrato') : 'Evaluación') +
      ' · ' + supplierLabel(supplierId.value) + ' · ' + new Date().toISOString().slice(0, 10) +
      ' · ' + Date.now()
    await SrmApi.create(collection, {
      name, description: note.value.trim() || null, value: reference.value.trim() || null,
      metadataJson: JSON.stringify({
        supplierId: supplierId.value,
        ...(contract ? {
          reference: reference.value.trim(), expiresAt: expiresAt.value,
          paymentDays: Number(paymentDays.value), currencyCode: contractCurrency.value,
          rateReference: rateReference.value.trim() || null,
          serviceCoverage: serviceCoverage.value.trim() || null,
        } : { score: score.value }),
        createdAt: new Date().toISOString(),
      }),
      sortOrder: selectedRecords.value.length + 1,
    })
    closeForm()
    success.value = t('crm.saved')
    await load()
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
watch([section, canReadSection], () => { closeForm(); void load() })
onMounted(() => {
  void load()
  void CatalogItemsService.select({catalogGroupSlug: 'countries'})
    .then(rows => { countries.value = rows.filter(row => row.isActive !== false) })
    .catch(() => { countries.value = [] })
  void CatalogItemsService.select({catalogGroupSlug: 'currencies'})
    .then(rows => { currencies.value = rows.filter(row => row.isActive !== false) })
    .catch(() => { currencies.value = [] })
})
</script>

<template>
  <main class="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 text-[var(--dh-text)] sm:px-7 lg:py-8" data-srm-workspace>
    <header class="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--dh-border)] pb-5">
      <div>
        <div class="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--dh-text-muted)]">
          <span class="h-2 w-2 rounded-full bg-[var(--dh-primary)]" aria-hidden="true"></span>
          SRM / {{ heading }}
        </div>
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">{{ heading }}</h1>
        <p class="mt-2 text-sm text-[var(--dh-text-muted)]">{{ pageIntro }}</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--dh-card)]"
          :disabled="loading || !canReadSection" @click="load"><RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />{{ t('srm.refresh') }}</button>
        <button v-if="canWriteSection" type="button" class="inline-flex items-center gap-2 rounded-xl bg-[var(--dh-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90" @click="openCreate">
          <Plus class="h-4 w-4" />{{ en ? 'New supplier' : 'Nuevo proveedor' }}
        </button>
      </div>
    </header>


    <div v-if="!canReadSection" role="alert" class="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <ShieldAlert class="h-5 w-5 shrink-0 text-amber-500" />
      <div><h2 class="font-bold">{{ en ? 'Restricted module' : 'Módulo restringido' }}</h2>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ en ? 'An administrator must assign the corresponding srm.* permission to your user.' : 'Un administrador debe asignar el permiso srm.* correspondiente desde Auth → Usuarios.' }}</p>
      </div>
    </div>
    <template v-else>
      <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{{ error }}</p>
      <p v-if="success" role="status" class="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-500">{{ success }}</p>

      <div v-if="section === 'dashboard' || section === 'suppliers'" class="flex flex-wrap gap-2">
        <article v-for="stat in [
          { label: t('srm.count'), value: suppliers.length, icon: Building2 },
          { label: t('srm.active'), value: activeCount, icon: CheckCircle2 },
          { label: t('srm.type'), value: categories.length, icon: Truck },
        ]" :key="stat.label" class="flex min-w-[180px] flex-1 items-center gap-3 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2.5">
          <div class="rounded-lg bg-[var(--dh-primary)]/10 p-2 text-[var(--dh-primary)]"><component :is="stat.icon" class="h-5 w-5" /></div>
          <div><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ stat.label }}</p><p class="mt-0.5 text-lg font-extrabold">{{ stat.value }}</p></div>
        </article>
      </div>
      <div v-else class="grid gap-3 sm:grid-cols-3">
        <article v-for="stat in [
          { label: t('srm.count'), value: suppliers.length },
          { label: en ? 'Records' : 'Registros', value: selectedRecords.length },
          { label: section === 'contracts' ? (en ? 'Expired' : 'Vencidos') : (en ? 'Average rating' : 'Nota promedio'), value: section === 'contracts' ? overdueCount : averageScore },
        ]" :key="stat.label" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ stat.label }}</p><p class="mt-2 text-2xl font-extrabold">{{ stat.value }}</p>
        </article>
      </div>

      <details v-if="section === 'dashboard' || section === 'suppliers'"
        class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
        aria-label="Transición de navieras y agentes a SRM">
        <summary class="flex cursor-pointer flex-wrap items-center justify-between gap-2">
          <div><h2 class="text-sm font-extrabold">{{ en ? 'Carriers and agents · transition to SRM' : 'Navieras y agentes · incorporación a SRM' }}</h2>
            <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
              {{ en ? 'Original Config records remain active in Pricing until references are reconciled.' :
                'Los códigos originales de Config siguen activos en Pricing hasta completar la conciliación de referencias.' }}
            </p>
          </div>
          <span class="rounded-full border border-[var(--dh-border)] px-3 py-1 text-xs font-bold">{{ importedLegacy }} / {{ legacyPartners.length }}</span>
        </summary>
        <p v-if="!legacyPartners.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">
          {{ en ? 'No legacy carriers or agents returned by the service.' : 'No hay navieras o agentes heredados disponibles para incorporar.' }}
        </p>
        <div v-if="legacyPartners.length" class="mt-4 flex flex-wrap gap-2">
          <input v-model="legacyQuery" type="search" aria-label="Buscar naviera o agente"
            placeholder="Buscar naviera o agente" class="min-w-0 flex-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-sm" />
          <select v-model="legacyGroup" aria-label="Tipo de socio"
            class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-sm">
            <option value="all">Todos</option><option value="carriers">Navieras</option><option value="agents">Agentes</option>
          </select>
        </div>
        <div v-if="legacyPartners.length && !filteredLegacy.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">
          No hay socios pendientes que coincidan con el filtro.
        </div>
        <div v-else-if="filteredLegacy.length" class="mt-3 grid max-h-[380px] gap-2 overflow-y-auto md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in filteredLegacy" :key="item.sourceGroup + item.id"
            class="flex items-center justify-between gap-3 rounded-xl border border-[var(--dh-border)] p-3">
            <div class="min-w-0"><p class="truncate text-sm font-bold">{{ item.name }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ item.sourceGroup === 'carriers' ? 'Naviera' : 'Agente' }} · {{ item.code }}</p>
            </div>
            <button v-if="canCreateSuppliers" type="button" :disabled="Boolean(importBusy)"
              class="shrink-0 rounded-lg border border-[var(--dh-primary)] px-2.5 py-2 text-xs font-bold text-[var(--dh-primary)] disabled:opacity-50"
              @click="importLegacy(item)">{{ importBusy === item.id ? '…' : (en ? 'Add' : 'Incorporar') }}</button>
          </div>
        </div>
        <p v-if="filteredLegacy.length" class="mt-3 text-xs text-[var(--dh-text-muted)]">Mostrando {{ filteredLegacy.length }} socios pendientes.</p>
        <p v-if="legacyPartners.length && !pendingLegacy.length" class="mt-3 text-sm text-emerald-500">
          {{ en ? 'All listed partners have an SRM directory link.' : 'Todos los socios listados tienen vínculo en el directorio SRM.' }}
        </p>
      </details>
            <div class="grid items-start gap-3" :class="section === 'dashboard' || section === 'suppliers' ? 'xl:grid-cols-[minmax(330px,.9fr)_minmax(0,1.6fr)]' : 'xl:grid-cols-[minmax(0,1fr)_320px]'">
        <section class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] px-5 py-4">
            <div><h2 class="font-bold">{{ section === 'performance' ? t('srm.performance') : section === 'contracts' ? t('srm.contracts') : t('srm.suppliers') }}</h2>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ section === 'performance' || section === 'contracts' ? selectedRecords.length : filteredSuppliers.length }} {{ en ? 'records' : 'registros' }}</p>
            </div>
            <div v-if="section === 'dashboard' || section === 'suppliers'" class="flex w-full flex-wrap gap-2 sm:w-auto">
              <div class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 sm:flex-initial">
                <Search class="h-4 w-4 text-[var(--dh-text-muted)]" /><input v-model="query" type="search" :placeholder="t('srm.search')" :aria-label="t('srm.search')" class="min-w-0 bg-transparent py-2.5 text-sm outline-none" />
              </div>
              <select v-model="category" :aria-label="t('srm.type')" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] px-3 py-2 text-xs font-semibold">
                <option value="all">{{ t('srm.all') }}</option>
                <option v-for="type in categories" :key="type" :value="type">{{ typeLabel(type) }}</option>
              </select>
            </div>
          </div>

          <div v-if="loading" class="p-10 text-center text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</div>
          <template v-else-if="section === 'dashboard' || section === 'suppliers'">
            <div v-if="!filteredSuppliers.length" class="flex flex-col items-center px-6 py-14 text-center">
              <FolderOpen class="h-10 w-10 text-[var(--dh-text-muted)]" />
              <p class="mt-3 font-bold">{{ t('srm.noRecords') }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Try another filter or register a supplier.' : 'Pruebe otro filtro o registre un proveedor.' }}</p>
            </div>
            <div v-else class="divide-y divide-[var(--dh-border)]">
              <button v-for="row in filteredSuppliers" :key="row.id" type="button"
                class="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[var(--dh-card-hover)]" @click="openDetails(row)">
                <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-shell)]"><Building2 class="h-5 w-5 text-[var(--dh-primary)]" /></div>
                <div class="min-w-0 flex-1"><p class="truncate text-sm font-bold">{{ row.name }}</p>
                  <p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ supplierCategories(row).map(typeLabel).join(', ') }} · {{ row.code }}</p></div>
                <span class="hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex" :class="row.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-[var(--dh-text-muted)]'">{{ t(row.isActive ? 'srm.active' : 'srm.inactive') }}</span>
                <ArrowRight class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
              </button>
            </div>
          </template>
          <template v-else>
            <div v-if="!selectedRecords.length" class="flex flex-col items-center px-6 py-14 text-center">
              <ClipboardCheck v-if="section === 'performance'" class="h-10 w-10 text-[var(--dh-text-muted)]" />
              <FileSignature v-else class="h-10 w-10 text-[var(--dh-text-muted)]" />
              <p class="mt-3 font-bold">{{ en ? 'No records yet' : 'No hay registros todavía' }}</p>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Records are saved in the independent SRM catalogs in Config.' : 'Los registros se guardan en catálogos SRM independientes dentro de Config.' }}</p>
            </div>
            <div v-else class="divide-y divide-[var(--dh-border)]">
              <div v-for="item in selectedRecords" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div class="min-w-0"><p class="text-sm font-bold">{{ supplierLabel(item.supplierId) }}</p>
                  <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ item.value || item.description || item.name }}</p></div>
                <div class="text-right text-sm font-bold">{{ section === 'performance' ? (item.score ?? '—') + ' / 5' : (item.expiresAt || '—') }}</div>
              </div>
            </div>
          </template>
        </section>

        <aside class="space-y-4">
          <section v-if="section === 'dashboard' || section === 'suppliers'" class="overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
            <template v-if="selected">
              <div class="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dh-border)] px-4 py-4 sm:px-5">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-primary)]/10 font-extrabold text-[var(--dh-primary)]">{{ selected.name.slice(0, 2).toUpperCase() }}</div>
                  <div class="min-w-0"><p class="text-[10px] font-extrabold uppercase tracking-widest text-[var(--dh-text-muted)]">SRM · Ficha del proveedor</p>
                    <h2 class="mt-1 truncate text-lg font-extrabold">{{ selected.name }}</h2>
                    <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ supplierCategories(selected).map(typeLabel).join(', ') }} · {{ selected.code }}</p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button v-if="canEditSuppliers" type="button" class="inline-flex items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 py-2 text-xs font-bold hover:border-[var(--dh-primary)]" @click="openEdit(selected)"><Pencil class="h-3.5 w-3.5" />Editar</button>
                  <button type="button" :aria-label="t('common.close')" class="rounded-lg border border-[var(--dh-border)] p-2" @click="selected=null"><X class="h-4 w-4" /></button>
                </div>
              </div>
              <nav class="flex gap-1 overflow-x-auto border-b border-[var(--dh-border)] px-3" aria-label="Ficha del proveedor" role="tablist">
                <button v-for="item in supplierTabs" :key="item.key" type="button" role="tab" :aria-selected="supplierTab === item.key"
                  class="shrink-0 border-b-2 px-3 py-3 text-xs font-bold transition"
                  :class="supplierTab === item.key ? 'border-[var(--dh-primary)] text-[var(--dh-primary)]' : 'border-transparent text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'"
                  @click="supplierTab = item.key">{{ item.label }}</button>
              </nav>
              <div v-if="supplierTab === 'profile'" class="grid gap-4 p-4 lg:grid-cols-2">
                <section class="rounded-xl border border-[var(--dh-border)] p-4">
                  <h3 class="mb-2 text-xs font-extrabold uppercase tracking-wider">Información del proveedor</h3>
                  <dl class="divide-y divide-[var(--dh-border)]">
                    <div v-for="field in [
                      {label: 'Razón social', value: selected.name},
                      {label: 'Categorías', value: supplierCategories(selected).map(typeLabel).join(', ')},
                      {label: 'Modalidades', value: Array.isArray(metadata(selected).shipmentModes)
                        ? (metadata(selected).shipmentModes as string[])
                            .map(mode => modeOptions.find(x => x.value === mode)?.label || mode).join(', ') : 'No indicadas'},
                      {label: 'Código', value: selected.code},
                      {label: 'Países', value: supplierCountries(selected)},
                      {label: 'Identificación fiscal', value: metadata(selected).taxId},
                      {label: 'Sitio web', value: metadata(selected).website},
                      {label: 'Estado', value: selected.isActive ? 'Activo' : 'Inactivo'},
                    ]" :key="field.label" class="grid grid-cols-[42%_minmax(0,1fr)] gap-3 py-2.5 text-xs">
                      <dt class="font-semibold text-[var(--dh-text-muted)]">{{ field.label }}</dt>
                      <dd class="break-words font-semibold">{{ field.value || '—' }}</dd>
                    </div>
                  </dl>
                </section>
                <div class="space-y-3">
                  <section class="rounded-xl border border-[var(--dh-border)] p-4">
                    <h3 class="mb-3 text-xs font-extrabold uppercase tracking-wider">Contactos ({{ supplierContacts(selected).length }})</h3>
                    <p v-if="!supplierContacts(selected).length" class="text-xs text-[var(--dh-text-muted)]">Sin contactos registrados.</p>
                    <div v-for="(contact, index) in supplierContacts(selected)" :key="index" class="space-y-1 border-b border-[var(--dh-border)] py-3 text-xs last:border-0">
                      <p class="font-bold">{{ contact.name }}<span v-if="contact.role"> · {{ contact.role }}</span></p>
                      <p v-if="contact.email">{{ contact.email }}</p>
                      <p v-if="contact.phone">{{ contact.phone }}</p>
                    </div>
                  </section>
                  <section class="rounded-xl border border-[var(--dh-border)] p-4">
                    <h3 class="mb-2 text-xs font-extrabold uppercase tracking-wider">Relación comercial</h3>
                    <p class="text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ selected.description || 'Sin descripción de servicios.' }}</p>
                    <p v-if="metadata(selected).legacyCode" class="mt-2 text-xs">Código original Config: <strong>{{ metadata(selected).legacyCode }}</strong></p>
                  </section>
                </div>
              </div>
              <div v-else-if="supplierTab === 'terms'" class="p-4">
                <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 class="text-xs font-extrabold uppercase tracking-wider">Contratos y condiciones con el proveedor</h3>
                  <span class="text-xs text-[var(--dh-text-muted)]">Historial vinculado al proveedor</span>
                </div>
                <p v-if="!supplierContracts.length" class="py-5 text-center text-xs text-[var(--dh-text-muted)]">No hay acuerdos registrados o no tiene permisos para consultarlos.</p>
                <article v-for="contract in supplierContracts" :key="contract.id" class="mb-3 rounded-xl border border-[var(--dh-border)] p-4">
                  <div class="flex flex-wrap justify-between gap-2"><h4 class="text-sm font-bold">{{ contract.name }}</h4><span class="text-xs font-semibold text-[var(--dh-primary)]">Vence: {{ contract.expiresAt || '—' }}</span></div>
                  <dl class="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt class="text-[var(--dh-text-muted)]">Días de pago</dt><dd class="font-semibold">{{ metadata(contract).paymentDays ?? '—' }}</dd></div>
                    <div><dt class="text-[var(--dh-text-muted)]">Moneda</dt><dd class="font-semibold">{{ metadata(contract).currencyCode || '—' }}</dd></div>
                    <div><dt class="text-[var(--dh-text-muted)]">Referencia tarifaria</dt><dd class="font-semibold">{{ metadata(contract).rateReference || '—' }}</dd></div>
                    <div><dt class="text-[var(--dh-text-muted)]">Servicios incluidos</dt><dd class="font-semibold">{{ metadata(contract).serviceCoverage || '—' }}</dd></div>
                  </dl>
                </article>
              </div>
              <div v-else class="p-4">
                <div class="mb-3 flex items-center justify-between"><h3 class="text-xs font-extrabold uppercase tracking-wider">Evaluación y cumplimiento</h3>
                  <span class="text-xs text-[var(--dh-text-muted)]">Historial vinculado al proveedor</span></div>
                <p v-if="!supplierEvaluations.length" class="py-5 text-center text-xs text-[var(--dh-text-muted)]">Todavía no hay evaluaciones registradas o autorizadas.</p>
                <div v-for="evaluation in supplierEvaluations" :key="evaluation.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dh-border)] py-3 text-xs last:border-0">
                  <span>{{ evaluation.name }}</span><strong>{{ evaluation.score ?? '—' }} / 5</strong>
                </div>
              </div>
            </template>
            <div v-else class="flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
              <Building2 class="h-10 w-10 text-[var(--dh-text-muted)]" />
              <h2 class="mt-4 text-sm font-extrabold">Seleccione un proveedor</h2>
              <p class="mt-2 max-w-xs text-xs leading-relaxed text-[var(--dh-text-muted)]">La ficha mostrará los contactos, país, condiciones comerciales y evaluaciones, sin salir del directorio.</p>
            </div>
          </section>
          <section class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <div class="flex items-center gap-2"><CheckCircle2 class="h-5 w-5 text-[var(--dh-primary)]" /><h2 class="font-bold">{{ en ? 'Data ownership' : 'Origen de la información' }}</h2></div>
            <p class="mt-3 text-xs leading-relaxed text-[var(--dh-text-muted)]">{{ t('srm.source') }}</p>
            <p class="mt-2 text-xs text-[var(--dh-text-muted)]">{{ en ? 'CRM customers are never mixed with suppliers.' : 'Los clientes CRM no se mezclan con proveedores SRM.' }}</p>
            <RouterLink v-if="auth.hasScope(CONFIG_SCOPES.catalogGroups.view)" to="/config/catalogs" class="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[var(--dh-primary)]">{{ t('srm.configLink') }}<ArrowRight class="h-3.5 w-3.5" /></RouterLink>
          </section>
          <section v-if="section === 'dashboard'" class="rounded-2xl border border-[var(--dh-border)] p-5">
            <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ en ? 'Related records' : 'Gestiones asociadas' }}</p>
            <p class="mt-2 text-2xl font-extrabold">{{ recordCount }}</p>
            <div class="mt-4 space-y-3 text-xs">
              <RouterLink to="/srm/performance" class="flex justify-between hover:text-[var(--dh-primary)]">{{ t('srm.performance') }}<span>{{ evaluations.length }}</span></RouterLink>
              <RouterLink to="/srm/contracts" class="flex justify-between hover:text-[var(--dh-primary)]">{{ t('srm.contracts') }}<span>{{ contracts.length }}</span></RouterLink>
            </div>
          </section>
        </aside>
      </div>

      <DhDrawer :open="formVisible" :title="editing ? 'Editar proveedor' : section === 'performance' ? 'Nueva evaluación' : section === 'contracts' ? 'Nuevo contrato' : 'Nuevo proveedor'" size="xl" @close="closeForm">
        <form v-if="section === 'performance' || section === 'contracts'" class="grid gap-4 md:grid-cols-2" @submit.prevent="saveRecord">
          <label class="text-sm font-semibold">{{ t('srm.provider') }}
            <select v-model="supplierId" required class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <option value="" disabled>{{ en ? 'Select supplier' : 'Seleccione proveedor' }}</option>
              <option v-for="s in suppliers" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label v-if="section === 'performance'" class="text-sm font-semibold">{{ en ? 'Score (1–5)' : 'Calificación (1–5)' }}
            <select v-model.number="score" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
              <option v-for="n in [1, 2, 3, 4, 5]" :key="n" :value="n">{{ n }} / 5</option>
            </select>
          </label>
          <template v-else>
            <label class="text-sm font-semibold">{{ en ? 'Contract reference' : 'Referencia del contrato' }}
              <input v-model="reference" required maxlength="160" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            </label>
            <label class="text-sm font-semibold">{{ en ? 'Expiry date' : 'Fecha de vencimiento' }}
              <input v-model="expiresAt" type="date" required class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            </label>
            <label class="text-sm font-semibold">{{ en ? 'Payment days' : 'Días de pago' }}
              <input v-model="paymentDays" type="number" min="0" max="365" required class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            </label>
            <label class="text-sm font-semibold">{{ en ? 'Currency' : 'Moneda' }}
              <select v-model="contractCurrency" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
                <option v-for="currency in currencies" :key="currency.id"
                  :value="String(currency.value || currency.code).toUpperCase()">
                  {{ currency.label || currency.value || currency.code }}
                </option>
                <option v-if="!currencies.length" value="USD">USD</option>
              </select>
            </label>
            <label class="text-sm font-semibold">{{ en ? 'Rate agreement reference' : 'Referencia de acuerdo tarifario' }}
              <input v-model="rateReference" maxlength="160" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            </label>
            <label class="text-sm font-semibold">{{ en ? 'Services covered' : 'Servicios incluidos' }}
              <input v-model="serviceCoverage" maxlength="180" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            </label>
          </template>
          <label class="text-sm font-semibold md:col-span-2">{{ en ? 'Observations' : 'Observaciones' }}
            <textarea v-model="note" rows="3" maxlength="300" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3"></textarea>
          </label>
          <div class="md:col-span-2"><button type="submit" :disabled="saving || !supplierId" class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{{ saving ? t('common.loading') : (en ? 'Save in Config' : 'Guardar en Config') }}</button></div>
        </form>
        <form v-else class="grid gap-4 md:grid-cols-2" @submit.prevent="saveSupplier">
          <label class="text-sm font-semibold">{{ en ? 'Company name' : 'Nombre de empresa' }}
            <input v-model="supplierName" required maxlength="220" placeholder="Ej. Transportes Romo" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="min-w-0">
            <DhMultiSelect v-model="supplierType" :options="categoryOptions"
              :label="en ? 'Categories *' : 'Categorías *'"
              :placeholder="en ? 'Select categories' : 'Seleccionar categorías'"
              :search-placeholder="en ? 'Search categories...' : 'Buscar categorías...'" />
          </div>
          <label v-if="supplierType.includes('__custom__')" class="text-sm font-semibold">{{ en ? 'Specify another category' : 'Especificar otra categoría' }}
            <input v-model="customSupplierType" required maxlength="60" placeholder="Ej. Empresa de inspección de carga"
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            <span class="mt-1 block text-xs text-[var(--dh-text-muted)]">Se guardará con el proveedor en el catálogo SRM y podrás reutilizarlo con otros proveedores.</span>
          </label>
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
          <label class="text-sm font-semibold">{{ en ? 'Fiscal identification' : 'Identificación fiscal' }}
            <input v-model="taxId" maxlength="80" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <label class="text-sm font-semibold">Sitio web
            <input v-model="website" type="url" maxlength="200" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
                    <section class="md:col-span-2 space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold">Contactos del proveedor *</h3>
              <button type="button" :disabled="contacts.length >= 30"
                class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold"
                @click="contacts.push(newContact())">+ Agregar contacto</button>
            </div>
            <div v-for="(contact, index) in contacts" :key="index" class="grid gap-3 border-t border-[var(--dh-border)] pt-3 md:grid-cols-2">
              <label class="text-xs font-semibold">Nombre *
                <input v-model="contact.name" required maxlength="140" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
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
          <div class="md:col-span-2"><button type="submit" :disabled="saving || !supplierName.trim() || !validSupplierType || !shipmentModes.length || !countryIds.length || !contacts.length || contacts.some(c => !c.name.trim())" class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{{ saving ? t('common.loading') : (en ? 'Save supplier in Config' : 'Guardar proveedor en Config') }}</button></div>
        </form>
      </DhDrawer>
    </template>
  </main>
</template>
