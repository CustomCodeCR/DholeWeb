<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Building2, ChevronLeft, ChevronRight, Eye, FolderOpen, Pencil, Plus, RefreshCw, Search, ShieldAlert } from 'lucide-vue-next'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhDrawer } from '@/shared/components/organisms'
import { DhMultiSelect, DhSelect } from '@/shared/components/atoms'
import CrmCatalogPicker from '@/modules/crm/components/CrmCatalogPicker.vue'
import CrmCreditCoveragePicker from '@/modules/crm/components/CrmCreditCoveragePicker.vue'
import CrmPhoneInput from '@/modules/crm/components/CrmPhoneInput.vue'
import { creditCoverageLabel } from '@/modules/crm/model/crmCreditCoverage'
import { SrmApi, type SrmLegacyPartner } from '../services/srmApi'
import { supplierSaveIssue, supplierPersistedCreditMatches, type SupplierSaveSection } from '../utils/srmSupplierSave'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import type { CatalogItemDto, CatalogItemSelectDto } from '@/core/interfaces/catalogs'

type Supplier = CatalogItemDto & { category: string }
type SrmRecord = CatalogItemDto & { supplierId: string; score?: number; expiresAt?: string }
const auth = useAuthStore()
const toastStore = useToastStore()
const { t, locale } = useI18n()
const en = computed(() => locale.value === 'en')
const canReadSection = computed(() => auth.hasScope('srm.supplier.read'))
const canCreateSuppliers = computed(() => auth.hasScope('srm.supplier.create'))
const canEditSuppliers = computed(() => auth.hasScope('srm.supplier.update'))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')
const saveErrorSection = ref<SupplierSaveSection | 'general' | 'server'>('general')
const formVisible = ref(false)
const detailsVisible = ref(false)
const suppliers = ref<Supplier[]>([])
const evaluations = ref<SrmRecord[]>([])
const contracts = ref<SrmRecord[]>([])
const selected = ref<Supplier | null>(null)
const query = ref('')
const category = ref('all')
const statusFilter = ref('all')
const currentPage = ref(1)
const pageSize = 15
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
type SupplierPaymentType = 'unspecified' | 'cash' | 'advance' | 'credit'
type SupplierCreditTerms = {
  paymentType: SupplierPaymentType
  days: number | null
  limit: number | null
  currency: string
  notes: string
  monthlyFinancingPct: number
  lateInterestMonthlyPct: number
  includedServices: string[]
  excludedServices: string[]
  reviewAt: string
}
const creditEnabled = ref(false)
const creditDays = ref('30')
const creditLimit = ref('')
const creditCurrency = ref('USD')
const monthlyFinancing = ref('0')
const lateInterest = ref('0')
const creditNotes = ref('')
const creditIncluded = ref<string[]>([])
const creditExcluded = ref<string[]>([])
const creditReviewAt = ref('')
// Exactly the same service coverage picker and catalog currency picker used by CRM.
const includedCreditModel = computed({
  get: () => creditIncluded.value,
  set: (items: string[]) => {
    creditIncluded.value = [...new Set(items)]
    creditExcluded.value = creditExcluded.value.filter(code => !items.includes(code))
  },
})
const excludedCreditModel = computed({
  get: () => creditExcluded.value,
  set: (items: string[]) => {
    creditExcluded.value = [...new Set(items)]
    creditIncluded.value = creditIncluded.value.filter(code => !items.includes(code))
  },
})
function paymentTypeLabel(type: SupplierPaymentType): string {
  const labels = en.value
    ? { unspecified: 'Not registered', cash: 'Cash', advance: 'Advance payment', credit: 'Credit' }
    : { unspecified: 'Sin registrar', cash: 'Contado', advance: 'Pago anticipado', credit: 'Crédito' }
  return labels[type]
}
function creditReviewDateInput(utcDate: string): string {
  if (!utcDate) return ''
  const parsed = new Date(utcDate)
  if (!Number.isFinite(parsed.getTime())) return ''
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16)
}
function creditReviewDateDisplay(utcDate: string): string {
  if (!utcDate) return '—'
  const parsed = new Date(utcDate)
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString(en.value ? 'en-US' : 'es-CR')
    : '—'
}
type SupplierContact = { name: string; email: string; phone: string; role: string; countryId: string }
const contacts = ref<SupplierContact[]>([])
function newContact(): SupplierContact {
  return { name: '', email: '', phone: '', role: '', countryId: countryIds.value[0] || '' }
}
function supplierContacts(item: Supplier): SupplierContact[] {
  const info = metadata(item)
  const saved = Array.isArray(info.contacts) ? info.contacts : []
  const primaryCountryId = String(
    (Array.isArray(info.countryIds) ? info.countryIds[0] : null) || info.countryId || '',
  )
  const mapped = saved.filter((row): row is Record<string, unknown> =>
    !!row && typeof row === 'object' && !Array.isArray(row))
    .map(row => ({
      name: String(row.name || ''), email: String(row.email || ''),
      phone: String(row.phone || ''), role: String(row.role || ''),
      countryId: String(row.countryId || primaryCountryId),
    })).filter(row => row.name.trim())
  if (mapped.length) return mapped
  if (info.contactName) return [{
    name: String(info.contactName), email: String(info.contactEmail || ''),
    phone: String(info.contactPhone || ''), role: '', countryId: primaryCountryId,
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
watch(countryIds, ids => {
  for (const contact of contacts.value) {
    if (!ids.includes(contact.countryId)) contact.countryId = ids[0] || ''
  }
}, { deep: true })

function metadata(row: CatalogItemDto): Record<string, unknown> {
  try {
    const obj = row.metadataJson ? JSON.parse(row.metadataJson) as unknown : {}
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj as Record<string, unknown> : {}
  } catch { return {} }
}
function supplierCreditTerms(row: CatalogItemDto): SupplierCreditTerms {
  const value = metadata(row).creditTerms
  const info = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
  const kind = info.paymentType
  const paymentType: SupplierPaymentType =
    kind === 'credit' || info.creditEnabled === true ? 'credit' :
    kind === 'cash' || kind === 'advance' ? kind : 'unspecified'
  const numeric = (value: unknown, allowZero: boolean): number | null =>
    typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
      ? value : null
  const days = numeric(info.creditDays ?? info.days, false)
  const limit = numeric(info.creditLimit ?? info.limit, true)
  const currency = String(info.currencyCode || info.currency || 'USD').toUpperCase()
  const codes = (value: unknown): string[] =>
    Array.isArray(value) ? [...new Set(value.filter(
      (code): code is string => typeof code === 'string' && !!code.trim()))] : []
  return {
    paymentType,
    days: days !== null && Number.isInteger(days) ? days : null,
    limit,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    notes: typeof info.paymentConditions === 'string' ? info.paymentConditions :
      typeof info.notes === 'string' ? info.notes : '',
    monthlyFinancingPct: numeric(info.monthlyFinancingPct, true) ?? 0,
    lateInterestMonthlyPct: numeric(info.lateInterestMonthlyPct, true) ?? 0,
    includedServices: codes(info.includedServices ?? info.creditIncluded),
    excludedServices: codes(info.excludedServices ?? info.creditExcluded),
    reviewAt: typeof info.reviewAt === 'string' ? info.reviewAt : '',
  }
}
function formatCreditLimit(terms: SupplierCreditTerms): string {
  if (terms.limit === null) return '—'
  return new Intl.NumberFormat(en.value ? 'en-US' : 'es-CR', {
    style: 'currency', currency: terms.currency, minimumFractionDigits: 2,
  }).format(terms.limit)
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
  (statusFilter.value === 'all' || (statusFilter.value === 'active' ? item.isActive : !item.isActive)) &&
  [item.name, item.description || '', supplierCountries(item), ...supplierCategories(item).map(typeLabel)]
    .some(value => value.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())))
  .sort((a, b) => a.name.localeCompare(b.name, 'es')))
const totalPages = computed(() => Math.max(1, Math.ceil(filteredSuppliers.value.length / pageSize)))
const pagedSuppliers = computed(() => filteredSuppliers.value.slice(
  (currentPage.value - 1) * pageSize, currentPage.value * pageSize))
const categoryFilterOptions = computed(() => [
  { value: 'all', label: en.value ? 'All categories' : 'Todas las categorías' },
  ...categoryOptions,
])
const statusOptions = computed(() => [
  { value: 'all', label: en.value ? 'All statuses' : 'Todos los estados' },
  { value: 'active', label: en.value ? 'Active' : 'Activos' },
  { value: 'inactive', label: en.value ? 'Inactive' : 'Inactivos' },
])
watch([query, category, statusFilter], () => { currentPage.value = 1 })
watch(totalPages, pageCount => { if (currentPage.value > pageCount) currentPage.value = pageCount })
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
  creditEnabled.value = false
  creditDays.value = '30'
  creditLimit.value = ''
  creditCurrency.value = 'USD'
  monthlyFinancing.value = '0'
  lateInterest.value = '0'
  creditNotes.value = ''
  creditIncluded.value = []
  creditExcluded.value = []
  creditReviewAt.value = ''
  contacts.value = []
  countryIds.value = []
}
function openCreate() { resetForm(); detailsVisible.value = false; formVisible.value = true; error.value = ''; success.value = '' }
function openEdit(item: Supplier) {
  if (!canEditSuppliers.value) return
  resetForm()
  editing.value = item
  supplierName.value = item.name
  supplierType.value = supplierCategories(item)
  supplierDescription.value = item.description || ''
  const info = metadata(item)
  const terms = supplierCreditTerms(item)
  creditEnabled.value = terms.paymentType === 'credit'
  creditDays.value = terms.days === null ? '30' : String(terms.days)
  creditLimit.value = terms.limit === null ? '' : String(terms.limit)
  creditCurrency.value = terms.currency
  monthlyFinancing.value = String(terms.monthlyFinancingPct)
  lateInterest.value = String(terms.lateInterestMonthlyPct)
  creditNotes.value = terms.notes
  creditIncluded.value = [...terms.includedServices]
  creditExcluded.value = [...terms.excludedServices]
  creditReviewAt.value = creditReviewDateInput(terms.reviewAt)
  contacts.value = supplierContacts(item)
  countryIds.value = Array.isArray(info.countryIds) && info.countryIds.length
    ? info.countryIds.filter((id): id is string => typeof id === 'string' && !!id.trim())
    : typeof info.countryId === 'string' && info.countryId ? [info.countryId] : []
  detailsVisible.value = false
  formVisible.value = true
  error.value = ''
  success.value = ''
}
function openDetails(item: Supplier) {
  selected.value = item
  detailsVisible.value = true
  formVisible.value = false
}
function closeDetails() { detailsVisible.value = false }
function closeForm() { formVisible.value = false; resetForm() }
async function reportSupplierSaveIssue(message: string, section: SupplierSaveSection | 'general' | 'server' = 'general') {
  error.value = message
  saveErrorSection.value = section
  toastStore.warning(en.value ? 'Supplier not saved' : 'Proveedor sin guardar', message)
  await nextTick()
  const anchor = document.querySelector(`[data-srm-save-section="${section}"]`)
    || document.querySelector('[data-srm-save-error]')
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
async function saveSupplier() {
  if (saving.value) return
  error.value = ''
  success.value = ''
  if (!(editing.value ? canEditSuppliers.value : canCreateSuppliers.value)) {
    await reportSupplierSaveIssue(en.value ? 'You cannot save suppliers.' : 'No tenés permiso para guardar proveedores.')
    return
  }
  if (!supplierName.value.trim()) {
    await reportSupplierSaveIssue(en.value ? 'Enter a company name.' : 'Ingresá el nombre de la empresa.')
    return
  }
  if (!validSupplierType.value) {
    await reportSupplierSaveIssue(en.value ? 'Select at least one category.' : 'Seleccioná al menos una categoría.')
    return
  }
  if (!countryIds.value.length) {
    await reportSupplierSaveIssue(en.value ? 'Select at least one country.' : 'Seleccioná al menos un país.')
    return
  }
  const filledContacts = contacts.value.map(contact => ({
    name: contact.name.trim(), email: contact.email.trim(),
    phone: contact.phone.trim(), role: contact.role.trim(),
    countryId: countryIds.value.includes(contact.countryId)
      ? contact.countryId : countryIds.value[0] || '',
  })).filter(contact => contact.name || contact.email || contact.phone || contact.role)
  const issue = supplierSaveIssue({
    contacts: filledContacts,
    creditEnabled: creditEnabled.value,
    creditDays: creditDays.value,
    creditLimit: creditLimit.value,
    creditCurrency: creditCurrency.value,
    monthlyFinancing: monthlyFinancing.value,
    lateInterest: lateInterest.value,
    creditIncluded: creditIncluded.value,
    creditExcluded: creditExcluded.value,
    creditReviewAt: creditReviewAt.value,
  }, en.value)
  if (issue) {
    await reportSupplierSaveIssue(issue.message, issue.section)
    return
  }
  saving.value = true
  error.value = ''
  let mutationAccepted = false
  try {
    const retained = editing.value ? metadata(editing.value) : {}
    const previousTypes = editing.value ? rawSupplierCategories(editing.value) : []
    const previousSpecificTypes = previousTypes.filter(type =>
      !categoryValues.has(type.trim().toLowerCase()))
    const selectedTypes = resolvedSupplierTypes.value
    const selectedCountries = [...new Set(countryIds.value)]
    const previousCredit = retained.creditTerms &&
      typeof retained.creditTerms === 'object' && !Array.isArray(retained.creditTerms)
      ? retained.creditTerms as Record<string, unknown> : {}
    // Retain old cash/advance records if the supplier has no credit enabled.
    const oldPaymentType = editing.value ? supplierCreditTerms(editing.value).paymentType : 'unspecified'
    const creditTerms = creditEnabled.value ? {
      ...previousCredit,
      paymentType: 'credit', creditEnabled: true,
      creditDays: Number(creditDays.value), days: Number(creditDays.value),
      creditLimit: Number(creditLimit.value), limit: Number(creditLimit.value),
      currencyCode: creditCurrency.value, currency: creditCurrency.value,
      monthlyFinancingPct: Number(monthlyFinancing.value),
      lateInterestMonthlyPct: Number(lateInterest.value),
      paymentConditions: creditNotes.value.trim(), notes: creditNotes.value.trim(),
      includedServices: [...new Set(creditIncluded.value)],
      excludedServices: [...new Set(creditExcluded.value)],
      reviewAt: creditReviewAt.value ? new Date(creditReviewAt.value).toISOString() : null,
    } : oldPaymentType === 'cash' || oldPaymentType === 'advance' ? previousCredit : null
    const metadataJson = JSON.stringify({
      ...retained,
      supplierType: selectedTypes[0] || null,
      supplierTypes: selectedTypes,
      // Keep the previous detailed classification for reference, never as a selectable category.
      ...(previousSpecificTypes.length ? { legacySupplierTypes:
        [...new Set([...(Array.isArray(retained.legacySupplierTypes)
          ? retained.legacySupplierTypes.filter((item): item is string => typeof item === 'string') : []),
          ...previousSpecificTypes])] } : {}),
      creditTerms,
      contacts: filledContacts,
      contactName: filledContacts[0]?.name || '',
      contactEmail: filledContacts[0]?.email || '',
      contactPhone: filledContacts[0]?.phone || '',
      countryId: selectedCountries[0] || null,
      countryIds: selectedCountries,
    })
    let createdId = ''
    if (editing.value) {
      await SrmApi.updateSupplier(editing.value.id, {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: editing.value.sortOrder,
      })
    } else {
      createdId = await SrmApi.create('suppliers', {
        name: supplierName.value.trim(), description: supplierDescription.value.trim() || null,
        value: supplierName.value.trim(), metadataJson, sortOrder: suppliers.value.length + 1,
      })
    }
    mutationAccepted = true
    // A positive HTTP status does not prove the credit values were persisted.
    // Read them back before closing, so incomplete updates never look successful.
    const confirmed = await SrmApi.list('suppliers')
    const editingId = editing.value?.id
    const saved = confirmed.find(item => editingId ? item.id === editingId
      : (createdId && item.id === createdId) || item.name === supplierName.value.trim())
    if (!saved) {
      await reportSupplierSaveIssue(en.value
        ? 'The service responded, but the supplier could not be found after saving. Refresh the directory before trying again.'
        : 'El servicio respondió, pero no se encontró el proveedor después de guardar. Actualizá el directorio antes de volver a intentar.',
        'server')
      return
    }
    if (creditEnabled.value && !supplierPersistedCreditMatches(saved.metadataJson, {
      days: Number(creditDays.value),
      limit: Number(creditLimit.value),
      currency: creditCurrency.value,
      monthlyFinancingPct: Number(monthlyFinancing.value),
      lateInterestMonthlyPct: Number(lateInterest.value),
      includedServices: creditIncluded.value,
      excludedServices: creditExcluded.value,
    })) {
      await reportSupplierSaveIssue(en.value
        ? 'The service responded, but the supplier credit terms were not saved. Your changes are still in the form; refresh the directory before retrying.'
        : 'El servicio respondió, pero no guardó las condiciones de crédito. Los datos siguen en el formulario; actualizá el directorio antes de reintentar.',
        'credit')
      return
    }
    // Check the saved contact data as well; credits and contacts share one metadata document.
    const persistedContacts = supplierContacts(saved as Supplier)
    if (filledContacts.length && (persistedContacts.length !== filledContacts.length ||
        filledContacts.some((contact, index) =>
          persistedContacts[index]?.name !== contact.name ||
          persistedContacts[index]?.email !== contact.email ||
          persistedContacts[index]?.phone !== contact.phone))) {
      await reportSupplierSaveIssue(en.value
        ? 'The service responded, but not all supplier contacts were saved. Check the directory before trying again.'
        : 'El servicio respondió, pero no guardó todos los contactos. Revisá el directorio antes de reintentar.',
        'contacts')
      return
    }
    suppliers.value = confirmed.map(item => ({ ...item, category: supplierCategory(item) }))
    if (selected.value) selected.value = suppliers.value.find(item => item.id === selected.value?.id) || null
    const savedAction = editing.value ? (en.value ? 'Supplier updated' : 'Proveedor actualizado')
      : (en.value ? 'Supplier created' : 'Proveedor creado')
    closeForm()
    toastStore.success(savedAction)
    success.value = t('crm.saved')
    if (editingId) {
      selected.value = suppliers.value.find(item => item.id === editingId) || selected.value
      detailsVisible.value = Boolean(selected.value)
    }
    // Secondary data are optional; failures must not mask successful persistence.
    void load()
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : t('srm.loadError')
    const message = mutationAccepted
      ? (en.value ? 'The request was accepted but verification failed. Refresh before retrying. ' :
        'La solicitud fue recibida, pero no se pudo verificar. Actualizá antes de reintentar. ') + detail
      : detail
    await reportSupplierSaveIssue(message, 'server')
  } finally { saving.value = false }
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

watch(canReadSection, () => { closeForm(); closeDetails(); selected.value = null; void load() })
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
      <section class="min-w-0 overflow-hidden rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)]">
        <div class="space-y-4 border-b border-[var(--dh-border)] p-4 sm:p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold">{{ en ? 'Suppliers' : 'Proveedores' }}</h2>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
                {{ en ? 'Select a supplier to view details in the side panel.' : 'Seleccioná un proveedor para ver sus datos en el panel lateral.' }}
              </p>
            </div>
            <span class="text-xs font-semibold text-[var(--dh-text-muted)]">
              {{ filteredSuppliers.length }} {{ en ? 'suppliers' : 'proveedores' }}
            </span>
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
            <label class="flex min-w-0 items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-3">
              <Search class="h-4 w-4 shrink-0 text-[var(--dh-text-muted)]" />
              <input v-model="query" type="search" :placeholder="en ? 'Search suppliers...' : 'Buscar proveedores...'"
                :aria-label="en ? 'Search suppliers' : 'Buscar proveedores'"
                class="h-11 min-w-0 w-full bg-transparent text-sm font-semibold text-[var(--dh-text)] outline-none placeholder:text-[var(--dh-text-muted)]" />
            </label>
            <DhSelect v-model="category" :options="categoryFilterOptions" placeholder=""
              :label="en ? 'Category' : 'Categoría'" />
            <DhSelect v-model="statusFilter" :options="statusOptions" placeholder=""
              :label="en ? 'Status' : 'Estado'" />
          </div>
        </div>

        <div v-if="loading" class="px-5 py-12 text-center text-sm text-[var(--dh-text-muted)]">{{ t('common.loading') }}</div>
        <div v-else-if="!filteredSuppliers.length" class="flex flex-col items-center px-5 py-14 text-center">
          <FolderOpen class="h-8 w-8 text-[var(--dh-text-muted)]" />
          <p class="mt-3 text-sm font-semibold">{{ en ? 'No suppliers found' : 'No se encontraron proveedores' }}</p>
          <p class="mt-1 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Try another search or register a supplier.' : 'Cambiá los filtros o registrá un proveedor.' }}</p>
        </div>
        <div v-else class="w-full overflow-x-auto">
          <table class="w-full min-w-[840px] text-left text-sm">
            <thead class="bg-[var(--dh-input)] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--dh-text-muted)]">
              <tr>
                <th scope="col" class="px-4 py-3 sm:px-5">{{ en ? 'Supplier' : 'Proveedor' }}</th>
                <th scope="col" class="px-4 py-3">{{ en ? 'Categories' : 'Categorías' }}</th>
                <th scope="col" class="px-4 py-3">{{ en ? 'Countries' : 'Países' }}</th>
                <th scope="col" class="px-4 py-3 text-center">{{ en ? 'Contacts' : 'Contactos' }}</th>
                <th scope="col" class="px-4 py-3">{{ en ? 'Status' : 'Estado' }}</th>
                <th scope="col" class="px-4 py-3 text-right">{{ en ? 'Actions' : 'Acciones' }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--dh-border)]">
              <tr v-for="item in pagedSuppliers" :key="item.id" class="transition hover:bg-[var(--dh-card-hover)]">
                <td class="px-4 py-3 sm:px-5">
                  <button type="button" class="flex min-w-0 items-center gap-3 text-left hover:text-[var(--dh-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dh-primary)]"
                    @click="openDetails(item)">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
                      <Building2 class="h-4 w-4" />
                    </span>
                    <span class="min-w-0 break-words font-bold">{{ item.name }}</span>
                  </button>
                </td>
                <td class="px-4 py-3">
                  <div class="flex max-w-[270px] flex-wrap gap-1">
                    <span v-for="cat in supplierCategories(item)" :key="cat" class="rounded-md bg-[var(--dh-input)] px-2 py-1 text-xs font-semibold">
                      {{ typeLabel(cat) }}
                    </span>
                  </div>
                </td>
                <td class="max-w-[220px] px-4 py-3 text-xs font-semibold text-[var(--dh-text-muted)]">{{ supplierCountries(item) }}</td>
                <td class="px-4 py-3 text-center tabular-nums">{{ supplierContacts(item).length }}</td>
                <td class="px-4 py-3">
                  <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    :class="item.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-[var(--dh-text-muted)]'">
                    {{ en ? (item.isActive ? 'Active' : 'Inactive') : (item.isActive ? 'Activo' : 'Inactivo') }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1.5">
                    <button type="button" class="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--dh-border)] px-3 text-xs font-bold hover:border-[var(--dh-primary)] hover:text-[var(--dh-primary)]"
                      :aria-label="(en ? 'Details of ' : 'Detalles de ') + item.name" @click="openDetails(item)">
                      <Eye class="h-4 w-4" />{{ en ? 'Details' : 'Detalles' }}
                    </button>
                    <button v-if="canEditSuppliers" type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] hover:border-[var(--dh-primary)] hover:text-[var(--dh-primary)]"
                      :aria-label="(en ? 'Edit ' : 'Editar ') + item.name" @click="openEdit(item)">
                      <Pencil class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="filteredSuppliers.length > pageSize && !loading" class="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--dh-border)] px-4 py-3 sm:px-5">
          <span class="text-xs text-[var(--dh-text-muted)]">
            {{ (currentPage - 1) * pageSize + 1 }}–{{ Math.min(currentPage * pageSize, filteredSuppliers.length) }}
            {{ en ? 'of' : 'de' }} {{ filteredSuppliers.length }}
          </span>
          <div class="flex items-center gap-2">
            <button type="button" :disabled="currentPage <= 1" :aria-label="en ? 'Previous page' : 'Página anterior'"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] disabled:opacity-40"
              @click="currentPage--"><ChevronLeft class="h-4 w-4" /></button>
            <span class="text-xs font-semibold">{{ currentPage }} / {{ totalPages }}</span>
            <button type="button" :disabled="currentPage >= totalPages" :aria-label="en ? 'Next page' : 'Página siguiente'"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dh-border)] disabled:opacity-40"
              @click="currentPage++"><ChevronRight class="h-4 w-4" /></button>
          </div>
        </div>

        <details v-if="canCreateSuppliers && pendingLegacy.length" class="border-t border-[var(--dh-border)] px-4 py-4 sm:px-5">
          <summary class="cursor-pointer text-xs font-semibold text-[var(--dh-text-muted)] hover:text-[var(--dh-text)]">
            {{ en ? 'Import existing suppliers' : 'Importar proveedores existentes' }} ({{ pendingLegacy.length }})
          </summary>
          <div class="mt-3 flex flex-wrap gap-2">
            <input v-model="legacyQuery" type="search" :aria-label="en ? 'Search imports' : 'Buscar importaciones'"
              :placeholder="en ? 'Search...' : 'Buscar...'"
              class="min-w-0 flex-1 rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-xs" />
            <select v-model="legacyGroup" class="rounded-lg border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-2 text-xs">
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

      <DhDrawer :open="detailsVisible && !!selected" :title="selected?.name || (en ? 'Supplier details' : 'Detalle del proveedor')"
        size="lg" @close="closeDetails">
        <div v-if="selected" class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--dh-border)] pb-4">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.1)] text-[var(--dh-primary)]">
                <Building2 class="h-5 w-5" />
              </span>
              <div>
                <p class="text-xs font-semibold text-[var(--dh-text-muted)]">{{ en ? 'Supplier' : 'Proveedor' }}</p>
                <p class="text-sm font-bold">{{ selected.name }}</p>
              </div>
            </div>
            <button v-if="canEditSuppliers" type="button"
              class="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--dh-border)] px-3 text-sm font-bold hover:border-[var(--dh-primary)]"
              @click="openEdit(selected)">
              <Pencil class="h-4 w-4" />{{ en ? 'Edit supplier' : 'Editar proveedor' }}
            </button>
          </div>
          <dl class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1">
              <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Categories' : 'Categorías' }}</dt>
              <dd class="flex flex-wrap gap-1.5">
                <span v-for="cat in supplierCategories(selected)" :key="cat"
                  class="rounded-full bg-[rgb(var(--dh-primary-rgb)/0.1)] px-2.5 py-1 text-xs font-semibold text-[var(--dh-primary)]">{{ typeLabel(cat) }}</span>
              </dd>
            </div>
            <div class="space-y-1">
              <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Status' : 'Estado' }}</dt>
              <dd class="text-sm font-semibold">{{ en ? (selected.isActive ? 'Active' : 'Inactive') : (selected.isActive ? 'Activo' : 'Inactivo') }}</dd>
            </div>
            <div class="space-y-1 sm:col-span-2">
              <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Countries' : 'Países' }}</dt>
              <dd class="text-sm font-semibold">{{ supplierCountries(selected) }}</dd>
            </div>
          </dl>
          <section class="border-t border-[var(--dh-border)] pt-4">
            <h3 class="mb-3 text-sm font-bold">{{ en ? 'Contacts' : 'Contactos' }}
              <span class="font-normal text-[var(--dh-text-muted)]">({{ supplierContacts(selected).length }})</span>
            </h3>
            <div v-if="supplierContacts(selected).length" class="grid gap-2 sm:grid-cols-2">
              <div v-for="(contact, index) in supplierContacts(selected)" :key="index" class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs">
                <p class="font-bold">{{ contact.name }}<span v-if="contact.role" class="font-normal text-[var(--dh-text-muted)]"> · {{ contact.role }}</span></p>
                <a v-if="contact.email" :href="'mailto:' + contact.email" class="mt-2 block break-all text-[var(--dh-primary)] hover:underline">{{ contact.email }}</a>
                <a v-if="contact.phone" :href="'tel:' + contact.phone" class="mt-1 block text-[var(--dh-text-muted)] hover:underline">{{ contact.phone }}</a>
              </div>
            </div>
            <p v-else class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'No contacts registered.' : 'No hay contactos registrados.' }}</p>
          </section>
          <section class="border-t border-[var(--dh-border)] pt-4">
            <h3 class="mb-3 text-sm font-bold">{{ en ? 'Supplier credit terms' : 'Condiciones de crédito del proveedor' }}</h3>
            <p v-if="supplierCreditTerms(selected).paymentType === 'unspecified'" class="text-xs text-[var(--dh-text-muted)]">
              {{ en ? 'No credit terms registered.' : 'Sin condiciones de crédito registradas.' }}
            </p>
            <p v-else-if="supplierCreditTerms(selected).paymentType !== 'credit'" class="text-sm font-semibold">
              {{ paymentTypeLabel(supplierCreditTerms(selected).paymentType) }}
            </p>
            <dl v-else class="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Credit days' : 'Días de crédito' }}</dt>
                <dd class="mt-1 font-semibold">{{ supplierCreditTerms(selected).days ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Credit limit' : 'Límite de crédito' }}</dt>
                <dd class="mt-1 font-semibold">{{ formatCreditLimit(supplierCreditTerms(selected)) }}</dd>
              </div>
              <div>
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Monthly financing' : 'Financiamiento mensual' }}</dt>
                <dd class="mt-1 font-semibold">{{ supplierCreditTerms(selected).monthlyFinancingPct }}%</dd>
              </div>
              <div>
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Monthly late interest' : 'Interés moratorio mensual' }}</dt>
                <dd class="mt-1 font-semibold">{{ supplierCreditTerms(selected).lateInterestMonthlyPct }}%</dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Credit includes' : 'Crédito incluye' }}</dt>
                <dd class="mt-1 flex flex-wrap gap-1">
                  <span v-for="code in supplierCreditTerms(selected).includedServices" :key="code"
                    class="rounded-lg bg-[var(--dh-shell)] px-2 py-1 text-xs font-semibold">{{ creditCoverageLabel(code) }}</span>
                  <span v-if="!supplierCreditTerms(selected).includedServices.length" class="text-[var(--dh-text-muted)]">—</span>
                </dd>
              </div>
              <div class="sm:col-span-2">
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Credit excludes' : 'Crédito NO incluye' }}</dt>
                <dd class="mt-1 flex flex-wrap gap-1">
                  <span v-for="code in supplierCreditTerms(selected).excludedServices" :key="code"
                    class="rounded-lg bg-[var(--dh-shell)] px-2 py-1 text-xs font-semibold">{{ creditCoverageLabel(code) }}</span>
                  <span v-if="!supplierCreditTerms(selected).excludedServices.length" class="text-[var(--dh-text-muted)]">—</span>
                </dd>
              </div>
              <div v-if="supplierCreditTerms(selected).reviewAt" class="sm:col-span-2">
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Next review' : 'Próxima revisión' }}</dt>
                <dd class="mt-1 font-semibold">{{ creditReviewDateDisplay(supplierCreditTerms(selected).reviewAt) }}</dd>
              </div>
              <div v-if="supplierCreditTerms(selected).notes" class="sm:col-span-2">
                <dt class="text-xs font-bold text-[var(--dh-text-muted)]">{{ en ? 'Payment conditions' : 'Condiciones generales de pago' }}</dt>
                <dd class="mt-1 whitespace-pre-wrap">{{ supplierCreditTerms(selected).notes }}</dd>
              </div>
            </dl>
          </section>
          <section v-if="selected.description" class="border-t border-[var(--dh-border)] pt-4">
            <h3 class="mb-2 text-sm font-bold">{{ en ? 'Description' : 'Descripción' }}</h3>
            <p class="whitespace-pre-wrap text-sm text-[var(--dh-text-muted)]">{{ selected.description }}</p>
          </section>
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
      </DhDrawer>
      <DhDrawer :open="formVisible" :title="editing ? (en ? 'Edit supplier' : 'Editar proveedor') : (en ? 'New supplier' : 'Nuevo proveedor')"
        size="xl" @close="closeForm">
        <form class="grid gap-4 md:grid-cols-2" novalidate @submit.prevent="saveSupplier">
          <label class="text-sm font-semibold">{{ en ? 'Company name' : 'Nombre de empresa' }}
            <input v-model="supplierName" required maxlength="220" placeholder="Ej. Transportes Romo" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="min-w-0">
            <DhMultiSelect v-model="supplierType" :options="categoryOptions"
              :label="en ? 'Categories *' : 'Categorías *'"
              :placeholder="en ? 'Select categories' : 'Seleccionar categorías'"
              :search-placeholder="en ? 'Search categories...' : 'Buscar categorías...'" />
          </div>
          <div class="min-w-0">
            <DhMultiSelect v-model="countryIds" :options="countryOptions"
              :label="en ? 'Countries *' : 'Países *'"
              :placeholder="en ? 'Select countries' : 'Seleccionar países'"
              :search-placeholder="en ? 'Search countries...' : 'Buscar países...'" />
          </div>
          <section data-srm-save-section="contacts" class="md:col-span-2 space-y-3 rounded-xl border border-[var(--dh-border)] p-4">
            <p v-if="error && saveErrorSection === 'contacts'" role="alert" class="text-sm font-semibold text-red-400">{{ error }}</p>
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
              <div class="min-w-0 space-y-2">
                <label v-if="countryIds.length > 1" class="block text-xs font-semibold">
                  {{ en ? 'Phone country' : 'País del teléfono' }}
                  <select v-model="contact.countryId" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
                    <option v-for="option in countryOptions.filter(row => countryIds.includes(row.value))"
                      :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </label>
                <CrmPhoneInput v-model="contact.phone"
                  :country-id="contact.countryId || countryIds[0] || ''"
                  :label="en ? 'Phone' : 'Teléfono'" />
              </div>
              <button type="button" class="justify-self-start text-xs font-bold text-red-500" @click="contacts.splice(index, 1)">Eliminar contacto</button>
            </div>
          </section>
          <section data-srm-save-section="credit" class="md:col-span-2 space-y-4 rounded-xl border border-[var(--dh-border)] p-4">
            <p v-if="error && saveErrorSection === 'credit'" role="alert" class="text-sm font-semibold text-red-400">{{ error }}</p>
            <div>
              <h3 class="text-sm font-bold">{{ en ? 'Supplier credit terms' : 'Condiciones de crédito del proveedor' }}
                <span class="font-medium text-[var(--dh-text-muted)]">({{ en ? 'optional' : 'opcional' }})</span>
              </h3>
              <p class="mt-1 text-xs text-[var(--dh-text-muted)]">
                {{ en ? 'Same terms and service coverage as CRM.' : 'Plazos, montos y conceptos incluidos o excluidos, como en CRM.' }}
              </p>
            </div>
            <label class="flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input v-model="creditEnabled" type="checkbox" class="h-4 w-4 accent-[var(--dh-primary)]" />
              {{ en ? 'Supplier offers credit' : 'Proveedor otorga crédito' }}
            </label>
            <div v-if="creditEnabled" class="space-y-4" data-srm-credit-terms>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Payment term (days) *' : 'Plazo de pago (días) *' }}
                  <input v-model="creditDays" required type="number" min="1" max="3650" step="1"
                    class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
                  <span class="block text-xs font-normal text-[var(--dh-text-muted)]">{{ en ? 'E.g. 30 days after invoicing.' : 'Ejemplo: 30 días después de la facturación.' }}</span>
                </label>
                <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Credit limit *' : 'Límite de crédito *' }}
                  <input v-model="creditLimit" required type="number" min="0.01" step="0.01" placeholder="Ej. 100000"
                    class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
                </label>
                <CrmCatalogPicker v-model="creditCurrency" :label="en ? 'Currency *' : 'Moneda *'"
                  catalog-group-slug="currencies" value-kind="value" />
                <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Monthly financing (%)' : 'Financiamiento mensual (%)' }}
                  <input v-model="monthlyFinancing" type="number" min="0" max="100" step="0.0001"
                    class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
                </label>
                <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Monthly late interest (%)' : 'Interés moratorio mensual (%)' }}
                  <input v-model="lateInterest" type="number" min="0" max="100" step="0.0001"
                    class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
                </label>
              </div>
              <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Additional conditions (optional)' : 'Condiciones generales de pago (opcional)' }}
                <textarea v-model="creditNotes" rows="3" maxlength="4000"
                  :placeholder="en ? 'e.g. Invoicing at month-end' : 'Ej. Se factura al cierre de cada mes.'"
                  class="w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm"></textarea>
              </label>
              <div class="grid gap-4 md:grid-cols-2">
                <CrmCreditCoveragePicker v-model="includedCreditModel"
                  :label="en ? 'Credit includes · multiple selection' : 'Crédito incluye · selección múltiple'" />
                <CrmCreditCoveragePicker v-model="excludedCreditModel"
                  :label="en ? 'Credit does NOT include · multiple selection' : 'Crédito NO incluye · selección múltiple'" />
              </div>
              <label class="block space-y-1.5 text-sm font-semibold">{{ en ? 'Next review (optional)' : 'Próxima revisión (opcional)' }}
                <input v-model="creditReviewAt" type="datetime-local"
                  class="w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] px-3 py-3 text-sm" />
              </label>
            </div>
          </section>
          <label class="text-sm font-semibold">{{ en ? 'Description' : 'Descripción' }}
            <input v-model="supplierDescription" maxlength="300" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3" />
          </label>
          <div class="md:col-span-2 space-y-3">
            <p v-if="error" role="alert" data-srm-save-error
              class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error }}</p>
            <button type="button" :disabled="saving || !(editing ? canEditSuppliers : canCreateSuppliers)"
              data-srm-save-button @click="saveSupplier"
              class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {{ saving ? t('common.loading') : (editing ? (en ? 'Update supplier' : 'Actualizar proveedor') : (en ? 'Save supplier' : 'Guardar proveedor')) }}
            </button>
          </div>
        </form>
      </DhDrawer>
    </template>
  </main>
</template>
