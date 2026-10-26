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
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { CatalogGroupsService } from '@/core/services/catalogGroupsService'
import type { CatalogItemDto } from '@/core/interfaces/catalogs'

type SrmSection = 'dashboard' | 'suppliers' | 'performance' | 'contracts'
type Supplier = CatalogItemDto & { category: string }
type SrmRecord = CatalogItemDto & { supplierId: string; score?: number; expiresAt?: string }
const route = useRoute()
const auth = useAuthStore()
const { t, locale } = useI18n()
const section = computed(() => String(route.meta.srmSection || 'dashboard') as SrmSection)
const en = computed(() => locale.value === 'en')
const heading = computed(() => section.value === 'performance' ? t('srm.performance')
  : section.value === 'contracts' ? t('srm.contracts')
  : section.value === 'suppliers' ? t('srm.suppliers') : t('srm.dashboard'))
const hasConfigRead = computed(() => auth.hasScope(CONFIG_SCOPES.catalogItems.view) ||
  auth.hasScope(CONFIG_SCOPES.catalogSelects.view) || auth.hasScope(CONFIG_SCOPES.catalogSelects.select))
const hasConfigWrite = computed(() => auth.hasScope(CONFIG_SCOPES.catalogItems.create) &&
  (auth.hasScope(CONFIG_SCOPES.catalogSelects.view) || auth.hasScope(CONFIG_SCOPES.catalogSelects.select)))
const canReadSuppliers = computed(() => auth.hasScope('srm.supplier.read'))
const canCreateSuppliers = computed(() => auth.hasScope('srm.supplier.create') && hasConfigWrite.value)
const canEditSuppliers = computed(() => auth.hasScope('srm.supplier.update') && auth.hasScope(CONFIG_SCOPES.catalogItems.update))
const canReadSection = computed(() => {
  if (section.value === 'performance') return auth.hasScope('srm.performance.read') || auth.hasScope('srm.performance.manage')
  if (section.value === 'contracts') return auth.hasScope('srm.contract.read') || auth.hasScope('srm.contract.manage')
  return canReadSuppliers.value
})
const canWriteSection = computed(() => section.value === 'performance'
  ? auth.hasScope('srm.performance.manage') && hasConfigWrite.value
  : section.value === 'contracts'
    ? auth.hasScope('srm.contract.manage') && hasConfigWrite.value : canCreateSuppliers.value)
const sections = [
  { path: '/srm', value: 'dashboard', label: 'srm.dashboard', icon: Building2 },
  { path: '/srm/suppliers', value: 'suppliers', label: 'srm.suppliers', icon: Truck },
  { path: '/srm/performance', value: 'performance', label: 'srm.performance', icon: ClipboardCheck },
  { path: '/srm/contracts', value: 'contracts', label: 'srm.contracts', icon: FileSignature },
] as const

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
const supplierId = ref('')
const supplierName = ref('')
const supplierType = ref('road')
const supplierDescription = ref('')
const contactName = ref('')
const contactEmail = ref('')
const contactPhone = ref('')
const editing = ref<Supplier | null>(null)
const score = ref(5)
const note = ref('')
const reference = ref('')
const expiresAt = ref('')

function metadata(row: CatalogItemDto): Record<string, unknown> {
  try {
    const obj = row.metadataJson ? JSON.parse(row.metadataJson) as unknown : {}
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : {}
  } catch { return {} }
}
function supplierCategory(row: CatalogItemDto) {
  const value = metadata(row).supplierType
  return typeof value === 'string' && value.trim() ? value : 'other'
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
const categories = computed(() => [...new Set(suppliers.value.map(item => item.category))].sort())
const filteredSuppliers = computed(() => suppliers.value.filter(item =>
  (category.value === 'all' || item.category === category.value) &&
  [item.name, item.code, item.description || ''].some(text => text.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
const activeCount = computed(() => suppliers.value.filter(row => row.isActive).length)
const selectedRecords = computed(() => section.value === 'contracts' ? contracts.value : evaluations.value)
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
  if (!canReadSection.value || !hasConfigRead.value) return
  loading.value = true
  error.value = ''
  try {
    const promises: Promise<CatalogItemDto[]>[] = [
      CatalogItemsService.getByGroupSlug('srm-suppliers'),
    ]
    if (auth.hasScope('srm.performance.read') || auth.hasScope('srm.performance.manage'))
      promises.push(CatalogItemsService.getByGroupSlug('srm-evaluations'))
    if (auth.hasScope('srm.contract.read') || auth.hasScope('srm.contract.manage'))
      promises.push(CatalogItemsService.getByGroupSlug('srm-contracts'))
    const results = await Promise.allSettled(promises)
    const supplierResult = results[0]
    if (!supplierResult) throw new Error('SRM supplier result is missing')
    if (supplierResult.status === 'rejected') throw supplierResult.reason
    suppliers.value = supplierResult.value.map(item => ({ ...item, category: supplierCategory(item) }))
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
async function groupId(slug: string, name: string) {
  let groups = await CatalogGroupsService.select()
  let group = groups.find(item => item.slug === slug)
  if (!group && auth.hasScope(CONFIG_SCOPES.catalogGroups.create)) {
    await CatalogGroupsService.create({
      name, slug, isSystem: false,
      description: 'Registro del módulo SRM; no mezclar con clientes CRM ni con agentes/navieras.',
    })
    groups = await CatalogGroupsService.select()
    group = groups.find(item => item.slug === slug)
  }
  if (!group) throw new Error(en.value ? 'Create this SRM catalog in Config before saving.' : 'Se requiere crear el catálogo ' + slug + ' en Config.')
  return group.id
}
function resetForm() {
  editing.value = null
  supplierId.value = ''
  supplierName.value = ''
  supplierType.value = 'road'
  supplierDescription.value = ''
  contactName.value = ''
  contactEmail.value = ''
  contactPhone.value = ''
  score.value = 5
  note.value = ''
  reference.value = ''
  expiresAt.value = ''
}
function openCreate() { resetForm(); formVisible.value = true; error.value = ''; success.value = '' }
function openEdit(item: Supplier) {
  if (!canEditSuppliers.value) return
  resetForm()
  editing.value = item
  supplierName.value = item.name
  supplierType.value = item.category
  supplierDescription.value = item.description || ''
  const info = metadata(item)
  contactName.value = String(info.contactName || '')
  contactEmail.value = String(info.contactEmail || '')
  contactPhone.value = String(info.contactPhone || '')
  formVisible.value = true
}
function openDetails(item: Supplier) { selected.value = item; formVisible.value = false }
function closeForm() { formVisible.value = false; resetForm() }
async function saveSupplier() {
  if (saving.value || !supplierName.value.trim() || (!canCreateSuppliers.value && !canEditSuppliers.value)) return
  saving.value = true
  error.value = ''
  try {
    const metadataJson = JSON.stringify({
      supplierType: supplierType.value.trim().toLowerCase() || 'other',
      contactName: contactName.value.trim(), contactEmail: contactEmail.value.trim(),
      contactPhone: contactPhone.value.trim(),
    })
    if (editing.value) {
      await CatalogItemsService.update(editing.value.id, {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: editing.value.sortOrder,
      })
    } else {
      const id = await groupId('srm-suppliers', 'Proveedores SRM')
      await CatalogItemsService.createForGroup(id, {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: suppliers.value.length + 1, isSystem: false,
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
    const slug = contract ? 'srm-contracts' : 'srm-evaluations'
    const id = await groupId(slug, contract ? 'Contratos SRM' : 'Evaluaciones SRM')
    const name = (contract ? (reference.value.trim() || 'Contrato') : 'Evaluación') +
      ' · ' + supplierLabel(supplierId.value) + ' · ' + new Date().toISOString().slice(0, 10) +
      ' · ' + Date.now()
    await CatalogItemsService.createForGroup(id, {
      name, description: note.value.trim() || null, value: reference.value.trim() || null,
      metadataJson: JSON.stringify({
        supplierId: supplierId.value,
        ...(contract ? { reference: reference.value.trim(), expiresAt: expiresAt.value } : { score: score.value }),
        createdAt: new Date().toISOString(),
      }),
      sortOrder: selectedRecords.value.length + 1, isSystem: false,
    })
    closeForm()
    success.value = t('crm.saved')
    await load()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('srm.loadError') }
  finally { saving.value = false }
}
watch([section, canReadSection, hasConfigRead], () => { closeForm(); void load() })
onMounted(() => { void load() })
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
          <Plus class="h-4 w-4" />{{ section === 'performance' ? (en ? 'New evaluation' : 'Nueva evaluación') : section === 'contracts' ? (en ? 'New contract' : 'Nuevo contrato') : (en ? 'New supplier' : 'Nuevo proveedor') }}
        </button>
      </div>
    </header>

    <nav class="flex gap-2 overflow-x-auto pb-1" :aria-label="t('srm.title')">
      <RouterLink v-for="item in sections" :key="item.path" :to="item.path"
        class="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition"
        :class="section === item.value ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]' : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]'">
        <component :is="item.icon" class="h-4 w-4" />{{ t(item.label) }}
      </RouterLink>
    </nav>

    <div v-if="!canReadSection" role="alert" class="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <ShieldAlert class="h-5 w-5 shrink-0 text-amber-500" />
      <div><h2 class="font-bold">{{ en ? 'Restricted module' : 'Módulo restringido' }}</h2>
        <p class="mt-1 text-sm text-[var(--dh-text-muted)]">{{ en ? 'An administrator must assign the corresponding srm.* permission to your user.' : 'Un administrador debe asignar el permiso srm.* correspondiente desde Auth → Usuarios.' }}</p>
      </div>
    </div>
    <div v-else-if="!hasConfigRead" role="alert" class="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-sm">
      {{ en ? 'SRM permissions are present, but Config catalog read access is also required until the dedicated Config SRM API is deployed.' : 'Tiene permiso de SRM, pero la API actual de Config también exige permiso de consulta de catálogos. Asigne el permiso de Config desde Auth.' }}
    </div>
    <template v-else>
      <p v-if="error" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{{ error }}</p>
      <p v-if="success" role="status" class="rounded-xl border border-emerald-500/30 p-3 text-sm text-emerald-500">{{ success }}</p>

      <div v-if="section === 'dashboard' || section === 'suppliers'" class="grid gap-3 sm:grid-cols-3">
        <article v-for="stat in [
          { label: t('srm.count'), value: suppliers.length, icon: Building2 },
          { label: t('srm.active'), value: activeCount, icon: CheckCircle2 },
          { label: t('srm.type'), value: categories.length, icon: Truck },
        ]" :key="stat.label" class="flex items-center gap-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
          <div class="rounded-xl bg-[var(--dh-primary)]/10 p-3 text-[var(--dh-primary)]"><component :is="stat.icon" class="h-5 w-5" /></div>
          <div><p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ stat.label }}</p><p class="mt-1 text-2xl font-extrabold">{{ stat.value }}</p></div>
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

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
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
                <option v-for="type in categories" :key="type" :value="type">{{ type }}</option>
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
                  <p class="mt-1 truncate text-xs text-[var(--dh-text-muted)]">{{ row.category }} · {{ row.code }}</p></div>
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
          <section v-if="selected && (section === 'dashboard' || section === 'suppliers')" class="rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-5">
            <div class="flex justify-between gap-2"><h2 class="font-bold">{{ t('srm.details') }}</h2>
              <button type="button" :aria-label="t('common.close')" @click="selected = null"><X class="h-4 w-4" /></button>
            </div>
            <p class="mt-4 text-lg font-extrabold">{{ selected.name }}</p>
            <p class="mt-2 text-sm text-[var(--dh-text-muted)]">{{ selected.description || selected.category }}</p>
            <dl class="mt-4 space-y-3 text-xs">
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('srm.type') }}</dt><dd class="mt-1 font-semibold">{{ selected.category }}</dd></div>
              <div><dt class="text-[var(--dh-text-muted)]">{{ t('srm.code') }}</dt><dd class="mt-1 font-semibold">{{ selected.code }}</dd></div>
              <div v-if="metadata(selected).contactName"><dt class="text-[var(--dh-text-muted)]">{{ en ? 'Contact' : 'Contacto' }}</dt><dd class="mt-1 font-semibold">{{ metadata(selected).contactName }}</dd></div>
              <div v-if="metadata(selected).contactEmail"><dt class="text-[var(--dh-text-muted)]">Email</dt><dd class="mt-1 break-all font-semibold">{{ metadata(selected).contactEmail }}</dd></div>
              <div v-if="metadata(selected).contactPhone"><dt class="text-[var(--dh-text-muted)]">{{ en ? 'Phone' : 'Teléfono' }}</dt><dd class="mt-1 font-semibold">{{ metadata(selected).contactPhone }}</dd></div>
            </dl>
            <button v-if="canEditSuppliers" type="button" class="mt-5 flex items-center gap-2 text-sm font-bold text-[var(--dh-primary)]" @click="openEdit(selected)"><Pencil class="h-4 w-4" />{{ t('common.edit') }}</button>
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

      <section v-if="formVisible" class="rounded-2xl border border-[var(--dh-primary)]/40 bg-[var(--dh-card)] p-5 sm:p-6" aria-label="SRM form">
        <div class="mb-5 flex items-center justify-between gap-2"><h2 class="text-lg font-bold">{{ editing ? (en ? 'Edit supplier' : 'Editar proveedor') : section === 'performance' ? (en ? 'New evaluation' : 'Nueva evaluación') : section === 'contracts' ? (en ? 'New contract' : 'Nuevo contrato') : (en ? 'New supplier' : 'Nuevo proveedor') }}</h2>
          <button type="button" :aria-label="t('common.close')" @click="closeForm"><X class="h-5 w-5" /></button></div>
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
          <label class="text-sm font-semibold">{{ t('srm.type') }}
            <input v-model="supplierType" required maxlength="60" list="srm-types" placeholder="road, warehouse, agent..." class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
            <datalist id="srm-types"><option value="road" /><option value="carrier" /><option value="agent" /><option value="warehouse" /><option value="coloader" /><option value="insurance" /><option value="customs" /><option value="other" /></datalist>
          </label>
          <label class="text-sm font-semibold">{{ en ? 'Contact name' : 'Nombre de contacto' }}
            <input v-model="contactName" maxlength="140" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <label class="text-sm font-semibold">Email
            <input v-model="contactEmail" type="email" maxlength="180" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <label class="text-sm font-semibold">{{ en ? 'Phone' : 'Teléfono' }}
            <input v-model="contactPhone" maxlength="40" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <label class="text-sm font-semibold">{{ en ? 'Description' : 'Descripción' }}
            <input v-model="supplierDescription" maxlength="300" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="md:col-span-2"><button type="submit" :disabled="saving || !supplierName.trim()" class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{{ saving ? t('common.loading') : (en ? 'Save supplier in Config' : 'Guardar proveedor en Config') }}</button></div>
        </form>
      </section>
    </template>
  </main>
</template>
