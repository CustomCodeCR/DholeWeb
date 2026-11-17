<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BadgeCheck, Building2, ChevronLeft, ChevronRight, ContactRound, CreditCard, Eye, FileCheck2, FolderOpen, Landmark, Pencil, Plus, RefreshCw, Search, ShieldAlert, Trash2, AlertTriangle } from 'lucide-vue-next'
import { ApiError } from '@/core/api/apiErrorHandler'
import { useAuthStore } from '@/core/stores/authStore'
import { useToastStore } from '@/core/stores/toastStore'
import { DhDrawer, DhModal } from '@/shared/components/organisms'
import { DhMultiSelect, DhSelect } from '@/shared/components/atoms'
import CrmCatalogPicker from '@/modules/crm/components/CrmCatalogPicker.vue'
import CrmCreditCoveragePicker from '@/modules/crm/components/CrmCreditCoveragePicker.vue'
import CrmPhoneInput from '@/modules/crm/components/CrmPhoneInput.vue'
import { creditCoverageLabel } from '@/modules/crm/model/crmCreditCoverage'
import { SrmApi, type SrmLegacyPartner, type SrmBankAccount, type SrmHaciendaResult } from '../services/srmApi'
import { supplierSaveIssue, supplierBankSaveIssue, supplierPersistedCreditMatches, type SupplierSaveSection } from '../utils/srmSupplierSave'
import { srmCountryIbanFormat, srmIbanInput, srmIbanValidationError, type SrmIbanFormat } from '../utils/srmIban'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { isSrmCostaRicaCountry, isSrmHaciendaMatch, normalizeSrmTaxId, srmHaciendaFields, srmHaciendaErrorMessage } from '../utils/srmHacienda'
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
const canArchiveSuppliers = computed(() => auth.hasScope('srm.supplier.archive'))
const canReadBanks = computed(() => auth.hasScope('srm.supplier.bank.read'))
const canManageBanks = computed(() => canReadBanks.value && auth.hasScope('srm.supplier.bank.manage'))
const loading = ref(false)
const saving = ref(false)
const deleteTarget = ref<Supplier | null>(null)
const deleteBusy = ref(false)
const deleteError = ref('')
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
const companyPhone = ref('')
const taxId = ref('')
const address = ref('')
const economicActivityCode = ref('')
const observations = ref('')
const financeContactId = ref('')
const bankAccounts = ref<SrmBankAccount[]>([])
const bankAccountsLoaded = ref(false)
const originalBankCount = ref(0)
const bankAccountsLoading = ref(false)
const bankError = ref('')
const revealBankNumbers = ref(false)
const haciendaLoading = ref(false)
const haciendaError = ref('')
const haciendaResult = ref<SrmHaciendaResult | null>(null)
const haciendaVerifiedAt = ref('')
const haciendaIdentificationType = ref('')
const haciendaRegime = ref('')
const supplierFormTab = ref<'identity' | 'contacts' | 'banks' | 'credit'>('identity')
const supplierFormTabs = computed(() => [
  { value: 'identity' as const, label: en.value ? 'Identity & Hacienda' : 'Identidad y Hacienda', icon: Building2 },
  { value: 'contacts' as const, label: en.value ? 'Contacts' : 'Contactos', icon: ContactRound },
  ...(canReadBanks.value ? [{ value: 'banks' as const, label: en.value ? 'Banking' : 'Bancos', icon: Landmark }] : []),
  { value: 'credit' as const, label: en.value ? 'Credit & terms' : 'Crédito y condiciones', icon: CreditCard },
])
let haciendaLookupVersion = 0
let haciendaDebounce: ReturnType<typeof setTimeout> | null = null
let pendingHaciendaRequest: { identification: string; countryId: string; promise: Promise<boolean> } | null = null
let bankLoadRequest = 0
const upper = (value: string) => value.trim().toUpperCase()
function onSupplierNameInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  supplierName.value = upper(target?.value || '')
}
const maskedAccount = (value: string) => value.length <= 4 ? '••••' : '•••• ' + value.slice(-4)
function supplierFinanceContact(item: Supplier): string {
  const id = String(metadata(item).financeContactId || '')
  return supplierContacts(item).find(contact => contact.id === id)?.name || '—'
}
function bankIbanFormat(countryId: string): SrmIbanFormat | null {
  return srmCountryIbanFormat(countries.value.find(item => item.id === countryId))
}
/** Avoid alarming users while they type; explain failed check digits once length is complete. */
function bankIbanError(account: SrmBankAccount): string {
  const format = bankIbanFormat(account.bankCountryId)
  if (!format || account.accountNumber.length < format.length) return ''
  return srmIbanValidationError(account.accountNumber, format, en.value) || ''
}
function onBankCountryChange(account: SrmBankAccount, countryId: string) {
  if (account.bankCountryId === countryId) return
  account.bankCountryId = countryId
  // Never carry a previous country's account number into a different bank country.
  account.accountNumber = bankIbanFormat(countryId)?.code || ''
}
function onBankNumberInput(account: SrmBankAccount, event: Event) {
  const input = event.target as HTMLInputElement
  account.accountNumber = srmIbanInput(input.value, bankIbanFormat(account.bankCountryId))
  input.value = account.accountNumber
}
function newBankAccount(): SrmBankAccount {
  const countryId = countryIds.value[0] || ''
  return { id: crypto.randomUUID(), bankName: '', accountHolder: '', registration: 'LOCAL',
    accountNumber: bankIbanFormat(countryId)?.code || '', swiftBic: '', currency: 'USD',
    bankCountryId: countryId, intermediaryBank: '', isPrimary: bankAccounts.value.length === 0 }
}
function setBankPrimary(index: number) {
  bankAccounts.value.forEach((account, i) => { account.isPrimary = i === index })
}
function removeBankAccount(index: number) {
  const removedPrimary = bankAccounts.value[index]?.isPrimary
  bankAccounts.value.splice(index, 1)
  if (removedPrimary && bankAccounts.value.length) setBankPrimary(0)
}
async function loadBankAccounts(id: string) {
  const request = ++bankLoadRequest
  bankAccounts.value = []
  bankError.value = ''
  bankAccountsLoaded.value = false
  bankAccountsLoading.value = canReadBanks.value
  if (!canReadBanks.value) {
    bankAccountsLoaded.value = true
    bankAccountsLoading.value = false
    return
  }
  try {
    const records = await SrmApi.listBankAccounts(id)
    if (request !== bankLoadRequest) return
    originalBankCount.value = records.length
    bankAccounts.value = records.map(account => ({
      ...account, swiftBic: account.swiftBic || '',
      intermediaryBank: account.intermediaryBank || '',
    }))
    bankAccountsLoaded.value = true
  } catch (cause) {
    if (request !== bankLoadRequest) return
    bankError.value = cause instanceof Error ? cause.message : 'No se pudieron cargar las cuentas.'
  } finally { if (request === bankLoadRequest) bankAccountsLoading.value = false }
}
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
type SupplierContact = { id: string; name: string; email: string; phone: string; role: string; countryId: string }
const contacts = ref<SupplierContact[]>([])
function newContact(): SupplierContact {
  return { id: crypto.randomUUID(), name: '', email: '', phone: '', role: '', countryId: countryIds.value[0] || '' }
}
function supplierContacts(item: Supplier): SupplierContact[] {
  const info = metadata(item)
  const saved = Array.isArray(info.contacts) ? info.contacts : []
  const primaryCountryId = String(
    (Array.isArray(info.countryIds) ? info.countryIds[0] : null) || info.countryId || '',
  )
  const mapped = saved.filter((row): row is Record<string, unknown> =>
    !!row && typeof row === 'object' && !Array.isArray(row))
    .map((row, index) => ({
      id: String(row.id || 'LEGACY-' + index),
      name: String(row.name || ''), email: String(row.email || ''),
      phone: String(row.phone || ''), role: String(row.role || ''),
      countryId: String(row.countryId || primaryCountryId),
    })).filter(row => row.name.trim())
  if (mapped.length) return mapped
  if (info.contactName) return [{
    id: 'LEGACY-0', name: String(info.contactName), email: String(info.contactEmail || ''),
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
const financeContactOptions = computed(() => contacts.value
  .filter(contact => contact.name.trim())
  .map(contact => ({ value: contact.id, label: upper(contact.name) +
    (contact.role ? ' · ' + upper(contact.role) : '') })))
const costaRicaCountryId = computed(() => countryIds.value.find(id => {
  const entry = countries.value.find(row => row.id === id)
  return entry && [entry.label, entry.value, entry.code, entry.slug].some(isSrmCostaRicaCountry)
}) || '')
const currentTaxId = computed(() => normalizeSrmTaxId(taxId.value))
const canLookupHacienda = computed(() => !!costaRicaCountryId.value &&
  /^\d{9,12}$/.test(currentTaxId.value))
const haciendaApplied = computed(() => !!haciendaResult.value &&
  isSrmHaciendaMatch(haciendaResult.value, currentTaxId.value, currentTaxId.value))

/** Same application contract as CRM: the response immediately updates the supplier. */
function applyHaciendaResult(result: SrmHaciendaResult, requestedId: string, countryId: string): boolean {
  if (!formVisible.value || !costaRicaCountryId.value ||
    countryId !== costaRicaCountryId.value ||
    !isSrmHaciendaMatch(result, currentTaxId.value, requestedId)) return false
  const fields = srmHaciendaFields(result)
  supplierName.value = fields.name
  if (fields.economicActivityCode) economicActivityCode.value = fields.economicActivityCode
  haciendaIdentificationType.value = fields.identificationType
  haciendaRegime.value = fields.regime
  haciendaVerifiedAt.value = result.verifiedAt
  haciendaResult.value = result
  return true
}

/** Awaitable both by the debounced lookup and by Save, so no save races verification. */
async function lookupHacienda(force = false): Promise<boolean> {
  if (!canLookupHacienda.value || !formVisible.value) return false
  const countryId = costaRicaCountryId.value
  const identification = currentTaxId.value
  if (!force && haciendaResult.value &&
    isSrmHaciendaMatch(haciendaResult.value, identification, identification)) {
    return true
  }
  if (pendingHaciendaRequest?.identification === identification &&
      pendingHaciendaRequest.countryId === countryId && haciendaLoading.value) {
    return pendingHaciendaRequest.promise
  }
  const version = ++haciendaLookupVersion
  haciendaResult.value = null
  haciendaError.value = ''
  haciendaLoading.value = true
  const task = (async (): Promise<boolean> => {
    try {
      const response = await SrmApi.lookupHacienda(identification, countryId)
      if (version !== haciendaLookupVersion) return false
      if (!response || typeof response.identification !== 'string' ||
          typeof response.name !== 'string' || !response.name.trim() ||
          !Array.isArray(response.activities)) {
        throw new Error('Invalid Hacienda response')
      }
      if (!applyHaciendaResult(response, identification, countryId)) return false
      return true
    } catch (cause) {
      if (version === haciendaLookupVersion) {
        haciendaError.value = srmHaciendaErrorMessage(cause, en.value)
      }
      return false
    } finally {
      if (version === haciendaLookupVersion) {
        haciendaLoading.value = false
        pendingHaciendaRequest = null
      }
    }
  })()
  pendingHaciendaRequest = { identification, countryId, promise: task }
  return task
}

/** Revalidate after changing ID or country; discard any in-flight response for old IDs. */
watch([taxId, costaRicaCountryId, formVisible], (_values, _previous, onCleanup) => {
  ++haciendaLookupVersion
  if (haciendaDebounce !== null) clearTimeout(haciendaDebounce)
  pendingHaciendaRequest = null
  haciendaResult.value = null
  haciendaError.value = ''
  haciendaLoading.value = false
  haciendaVerifiedAt.value = ''
  haciendaIdentificationType.value = ''
  haciendaRegime.value = ''
  if (formVisible.value && canLookupHacienda.value) {
    haciendaDebounce = setTimeout(() => {
      haciendaDebounce = null
      void lookupHacienda()
    }, 700)
  }
  onCleanup(() => {
    if (haciendaDebounce !== null) {
      clearTimeout(haciendaDebounce)
      haciendaDebounce = null
    }
  })
})

const countryOptions = computed(() => countries.value.map(row => ({
  value: row.id, label: row.label || row.value || row.id,
})))
watch(countries, () => {
  for (const account of bankAccounts.value) {
    if (!account.accountNumber) account.accountNumber = bankIbanFormat(account.bankCountryId)?.code || ''
  }
})
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
  companyPhone.value = ''
  taxId.value = ''
  address.value = ''
  economicActivityCode.value = ''
  observations.value = ''
  financeContactId.value = ''
  bankAccounts.value = []
  bankAccountsLoading.value = false
  bankAccountsLoaded.value = false
  originalBankCount.value = 0
  bankError.value = ''
  revealBankNumbers.value = false
  ++bankLoadRequest
  haciendaResult.value = null
  haciendaError.value = ''
  haciendaLoading.value = false
  haciendaVerifiedAt.value = ''
  haciendaIdentificationType.value = ''
  haciendaRegime.value = ''
  supplierFormTab.value = 'identity'
  ++haciendaLookupVersion
  if (haciendaDebounce !== null) clearTimeout(haciendaDebounce)
  pendingHaciendaRequest = null
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
function openCreate() {
  resetForm()
  bankAccountsLoaded.value = true
  detailsVisible.value = false
  formVisible.value = true
  error.value = ''
  success.value = ''
}
function openEdit(item: Supplier) {
  if (!canEditSuppliers.value) return
  resetForm()
  editing.value = item
  supplierName.value = item.name
  supplierType.value = supplierCategories(item)
  supplierDescription.value = item.description || ''
  const info = metadata(item)
  companyPhone.value = String(info.companyPhone || '')
  taxId.value = String(info.taxId || '')
  address.value = String(info.address || '')
  economicActivityCode.value = String(info.economicActivityCode || '')
  observations.value = String(info.observations || '')
  financeContactId.value = String(info.financeContactId || '')
  haciendaIdentificationType.value = String(info.haciendaIdentificationType || '')
  haciendaRegime.value = String(info.haciendaRegime || '')
  haciendaVerifiedAt.value = String(info.haciendaVerifiedAt || '')
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
  void loadBankAccounts(item.id)
}
function openSupplierDelete(item: Supplier) {
  if (!canArchiveSuppliers.value || item.isSystem || deleteBusy.value) return
  deleteError.value = ''
  deleteTarget.value = item
}
function closeSupplierDelete() {
  if (deleteBusy.value) return
  deleteTarget.value = null
  deleteError.value = ''
}
async function deleteSupplier() {
  const supplier = deleteTarget.value
  if (!supplier || !canArchiveSuppliers.value || supplier.isSystem || deleteBusy.value) return
  deleteBusy.value = true
  deleteError.value = ''
  try {
    await SrmApi.deleteSupplier(supplier.id)
    suppliers.value = suppliers.value.filter(item => item.id !== supplier.id)
    if (selected.value?.id === supplier.id) {
      closeDetails()
      selected.value = null
    }
    if (editing.value?.id === supplier.id) closeForm()
    deleteTarget.value = null
    currentPage.value = Math.min(currentPage.value, totalPages.value)
    toastStore.success(en.value ? 'Supplier removed' : 'Proveedor eliminado', supplier.name)
    void load()
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : ''
    const code = cause instanceof ApiError ? cause.code : null
    deleteError.value = code === 'srm_supplier_has_dependencies'
      ? (en.value ? 'This supplier has linked agreements or reviews and cannot be removed.' : 'Este proveedor tiene acuerdos o evaluaciones vinculadas y no se puede eliminar.')
      : code === 'srm_supplier_not_found'
        ? (en.value ? 'This supplier is no longer in the directory. Refresh the list.' : 'Este proveedor ya no está en el directorio. Actualizá la lista.')
        : code === 'srm_system_supplier_cannot_be_deleted'
          ? (en.value ? 'System suppliers cannot be deleted.' : 'No se pueden eliminar proveedores del sistema.')
          : detail || (en.value ? 'Could not remove supplier.' : 'No se pudo eliminar el proveedor.')
  } finally {
    deleteBusy.value = false
  }
}

function openDetails(item: Supplier) {
  selected.value = item
  detailsVisible.value = true
  formVisible.value = false
  revealBankNumbers.value = false
  void loadBankAccounts(item.id)
}
function closeDetails() {
  detailsVisible.value = false
  ++bankLoadRequest
  bankAccounts.value = []
  revealBankNumbers.value = false
}
function closeForm() { formVisible.value = false; resetForm() }
async function reportSupplierSaveIssue(message: string, section: SupplierSaveSection | 'general' | 'server' = 'general') {
  error.value = message
  saveErrorSection.value = section
  if (section === 'contacts') supplierFormTab.value = 'contacts'
  else if (section === 'bank') supplierFormTab.value = 'banks'
  else if (section === 'credit') supplierFormTab.value = 'credit'
  else supplierFormTab.value = 'identity'
  toastStore.warning(en.value ? 'Supplier not saved' : 'Proveedor sin guardar', message)
  await nextTick()
  const anchor = document.querySelector(`[data-srm-save-section="${section}"]`)
    || document.querySelector('[data-srm-save-error]')
  anchor?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
/** Catch unexpected form errors as well as API errors, including failures before any request. */
async function submitSupplierSafely() {
  try {
    await saveSupplier()
  } catch (cause) {
    saving.value = false
    const message = cause instanceof Error ? cause.message :
      (en.value ? 'Unexpected error preparing the supplier form.' : 'Error inesperado al preparar el formulario del proveedor.')
    await reportSupplierSaveIssue(message, 'server')
  }
}
async function saveSupplier() {
  if (saving.value) return
  error.value = ''
  success.value = ''
  if (!(editing.value ? canEditSuppliers.value : canCreateSuppliers.value)) {
    await reportSupplierSaveIssue(en.value ? 'You cannot save suppliers.' : 'No tenés permiso para guardar proveedores.')
    return
  }
  // CRM behavior: resolve a valid Costa Rican tax ID and apply the official name
  // before validating and persisting. A pending automatic lookup is awaited.
  if (canLookupHacienda.value) {
    if (haciendaDebounce !== null) { clearTimeout(haciendaDebounce); haciendaDebounce = null }
    if (pendingHaciendaRequest?.identification === currentTaxId.value) {
      await pendingHaciendaRequest.promise
    } else if (!haciendaResult.value && !haciendaError.value) {
      await lookupHacienda()
    }
    if (haciendaResult.value && haciendaApplied.value) {
      applyHaciendaResult(haciendaResult.value, currentTaxId.value, costaRicaCountryId.value)
    }
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
  if (companyPhone.value.length > 40 || taxId.value.length > 80 ||
      address.value.length > 500 || economicActivityCode.value.length > 40 ||
      observations.value.length > 4000) {
    await reportSupplierSaveIssue(en.value ? 'Some company fields exceed their maximum length.'
      : 'Revisá la longitud de los datos de la empresa.', 'general')
    return
  }
  if (canManageBanks.value && !bankAccountsLoaded.value) {
    await reportSupplierSaveIssue(en.value ? 'Load bank accounts before saving.'
      : 'Cargá las cuentas bancarias antes de guardar.', 'bank')
    return
  }
  if (canManageBanks.value) {
    const ibanFormats = new Map<string, SrmIbanFormat>()
    for (const country of countries.value) {
      const format = srmCountryIbanFormat(country)
      if (format) ibanFormats.set(country.id, format)
    }
    const bankIssue = supplierBankSaveIssue(bankAccounts.value, en.value, ibanFormats)
    if (bankIssue) {
      await reportSupplierSaveIssue(bankIssue.message, 'bank')
      return
    }
  }
  const filledContacts = contacts.value.map(contact => ({
    id: contact.id,
    name: upper(contact.name), email: contact.email.trim(),
    phone: contact.phone.trim(), role: upper(contact.role),
    countryId: countryIds.value.includes(contact.countryId)
      ? contact.countryId : countryIds.value[0] || '',
  })).filter(contact => contact.name || contact.email || contact.phone || contact.role)
  if (financeContactId.value && !filledContacts.some(contact => contact.id === financeContactId.value)) {
    await reportSupplierSaveIssue(en.value ? 'Select a registered finance contact.'
      : 'Seleccioná un contacto de Finanzas que esté registrado.', 'contacts')
    return
  }
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
      companyPhone: companyPhone.value.trim(),
      taxId: upper(taxId.value),
      address: upper(address.value),
      economicActivityCode: upper(economicActivityCode.value),
      observations: upper(observations.value),
      financeContactId: financeContactId.value || null,
      haciendaIdentificationType: haciendaApplied.value ? haciendaIdentificationType.value : null,
      haciendaRegime: haciendaApplied.value ? haciendaRegime.value : null,
      haciendaVerifiedAt: haciendaApplied.value ? haciendaVerifiedAt.value : null,
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
        name: upper(supplierName.value), description: upper(supplierDescription.value) || null,
        value: upper(supplierName.value), metadataJson, sortOrder: editing.value.sortOrder,
      })
    } else {
      createdId = await SrmApi.create('suppliers', {
        name: upper(supplierName.value), description: upper(supplierDescription.value) || null,
        value: upper(supplierName.value), metadataJson, sortOrder: suppliers.value.length + 1,
      })
    }
    mutationAccepted = true
    // A positive HTTP status does not prove the credit values were persisted.
    // Read them back before closing, so incomplete updates never look successful.
    const confirmed = await SrmApi.list('suppliers')
    const editingId = editing.value?.id
    const saved = confirmed.find(item => editingId ? item.id === editingId
      : (createdId && item.id === createdId) || item.name === upper(supplierName.value))
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
    // Bank data is written separately and only by finance-authorized users.
    // If this second write fails after creating the supplier, switch to edit mode
    // to avoid a duplicate supplier when the user retries.
    if (canManageBanks.value && (bankAccounts.value.length > 0 || originalBankCount.value > 0)) {
      try {
        await SrmApi.saveBankAccounts(saved.id, bankAccounts.value.map(account => ({
          ...account,
          bankName: upper(account.bankName), accountHolder: upper(account.accountHolder),
          registration: account.registration,
          accountNumber: upper(account.accountNumber).replace(/\s/g, ''),
          swiftBic: upper(account.swiftBic), currency: upper(account.currency),
          intermediaryBank: upper(account.intermediaryBank),
        })))
        const persistedBanks = await SrmApi.listBankAccounts(saved.id)
        if (persistedBanks.length !== bankAccounts.value.length ||
            persistedBanks.some((record, index) => record.id !== bankAccounts.value[index]?.id ||
              record.isPrimary !== bankAccounts.value[index]?.isPrimary)) {
          throw new Error(en.value ? 'Bank accounts did not persist as expected.'
            : 'Las cuentas bancarias no se guardaron correctamente.')
        }
      } catch (bankCause) {
        editing.value = saved as Supplier
        await reportSupplierSaveIssue(bankCause instanceof Error ? bankCause.message :
          'No se pudieron guardar las cuentas bancarias.', 'bank')
        return
      }
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
      if (detailsVisible.value) void loadBankAccounts(editingId)
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
                    <button v-if="canArchiveSuppliers && !item.isSystem" type="button"
                      class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/25 text-red-500 hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50"
                      :disabled="deleteBusy" :aria-label="(en ? 'Delete ' : 'Eliminar ') + item.name"
                      :title="en ? 'Delete supplier' : 'Eliminar proveedor'" @click="openSupplierDelete(item)">
                      <Trash2 class="h-4 w-4" />
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
            <button v-if="canArchiveSuppliers && !selected.isSystem" type="button"
              class="inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/30 px-3 text-sm font-bold text-red-500 hover:bg-red-500/10"
              @click="openSupplierDelete(selected)">
              <Trash2 class="h-4 w-4" />{{ en ? 'Delete supplier' : 'Eliminar proveedor' }}
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
          <section class="space-y-3 border-t border-[var(--dh-border)] pt-4">
            <h3 class="text-sm font-bold">{{ en ? 'Company and tax details' : 'Datos de la empresa y fiscales' }}</h3>
            <dl class="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt class="text-xs text-[var(--dh-text-muted)]">RUC / NIT</dt>
                <dd class="font-semibold">{{ String(metadata(selected).taxId || '—') }}</dd></div>
              <div><dt class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Company phone' : 'Teléfono de empresa' }}</dt>
                <dd class="font-semibold">{{ String(metadata(selected).companyPhone || '—') }}</dd></div>
              <div><dt class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Economic activity' : 'Actividad económica' }}</dt>
                <dd class="font-semibold">{{ String(metadata(selected).economicActivityCode || '—') }}</dd></div>
              <div><dt class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Finance contact' : 'Contacto principal de Finanzas' }}</dt>
                <dd class="font-semibold">{{ supplierFinanceContact(selected) }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Address' : 'Dirección' }}</dt>
                <dd class="whitespace-pre-wrap font-semibold">{{ String(metadata(selected).address || '—') }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Notes' : 'Observaciones generales' }}</dt>
                <dd class="whitespace-pre-wrap">{{ String(metadata(selected).observations || '—') }}</dd></div>
            </dl>
          </section>
          <section v-if="canReadBanks" class="space-y-3 border-t border-[var(--dh-border)] pt-4" data-srm-private-bank-accounts>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-bold">{{ en ? 'Payment bank accounts' : 'Cuentas bancarias para pagos' }}</h3>
              <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
                @click="revealBankNumbers = !revealBankNumbers">
                {{ revealBankNumbers ? (en ? 'Hide numbers' : 'Ocultar números') : (en ? 'Show numbers' : 'Mostrar números') }}
              </button>
            </div>
            <p class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Restricted financial data.' : 'Información financiera de acceso restringido.' }}</p>
            <p v-if="bankAccountsLoading" class="text-xs">{{ t('common.loading') }}</p>
            <p v-else-if="bankError" role="alert" class="text-xs text-red-400">{{ bankError }}</p>
            <p v-else-if="bankAccountsLoaded && !bankAccounts.length" class="text-xs text-[var(--dh-text-muted)]">
              {{ en ? 'No bank accounts registered.' : 'Sin cuentas bancarias registradas.' }}
            </p>
            <div v-for="account in bankAccounts" :key="account.id"
              class="space-y-1 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-3 text-xs">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <strong>{{ account.bankName }}</strong>
                <span v-if="account.isPrimary" class="font-bold text-[var(--dh-primary)]">
                  {{ en ? 'Primary for payments' : 'Principal para pagos' }}</span>
              </div>
              <p>{{ account.accountHolder }} · {{ account.currency }} · {{ account.registration }}</p>
              <p class="font-mono">{{ revealBankNumbers ? account.accountNumber : maskedAccount(account.accountNumber) }}</p>
              <p v-if="account.swiftBic">{{ en ? 'SWIFT / BIC' : 'SWIFT / BIC' }}: {{ account.swiftBic }}</p>
              <p>{{ countryLabel(account.bankCountryId) }}</p>
              <p v-if="account.intermediaryBank">{{ en ? 'Intermediary bank' : 'Banco intermediario' }}: {{ account.intermediaryBank }}</p>
            </div>
          </section>
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
        <form id="srm-supplier-form" class="grid gap-4 md:grid-cols-2" novalidate @submit.prevent="submitSupplierSafely">
          <div class="md:col-span-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
                <Building2 class="h-5 w-5" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-base font-extrabold">{{ editing ? (en ? 'Supplier profile' : 'Ficha del proveedor') : (en ? 'Register supplier' : 'Registrar proveedor') }}</h3>
                <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Complete the profile by section. Required fields are marked *.' : 'Completá la ficha por secciones. Los campos obligatorios se identifican con *.' }}</p>
              </div>
            </div>
          </div>
          <nav role="tablist" :aria-label="en ? 'Supplier form sections' : 'Secciones del proveedor'"
            class="sticky top-0 z-20 md:col-span-2 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 shadow-sm sm:flex sm:overflow-x-auto">
            <button v-for="tab in supplierFormTabs" :key="tab.value" type="button" role="tab"
              :data-srm-form-tab="tab.value" :aria-selected="supplierFormTab === tab.value"
              :class="supplierFormTab === tab.value
                ? 'bg-[var(--dh-primary)] text-white shadow-sm'
                : 'text-[var(--dh-text-muted)] hover:bg-[var(--dh-input)] hover:text-[var(--dh-text)]'"
              class="inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition sm:flex-1 sm:whitespace-nowrap"
              @click="supplierFormTab = tab.value">
              <component :is="tab.icon" class="h-4 w-4 shrink-0" />{{ tab.label }}
            </button>
          </nav>
          <section v-show="supplierFormTab === 'identity'" id="srm-form-identity" data-srm-save-section="general"
            class="md:col-span-2 grid gap-4 md:grid-cols-2" role="tabpanel">
          <label class="text-sm font-semibold">{{ en ? 'Company name *' : 'Nombre de empresa *' }}
            <input :value="supplierName" @input="onSupplierNameInput"
              required maxlength="220" placeholder="Ej. TRANSPORTES ROMO"
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 uppercase outline-none focus:border-[var(--dh-primary)]" />
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
          <section class="md:col-span-2 space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5" data-srm-company-fields>
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dh-input)] text-[var(--dh-primary)]">
                <FileCheck2 class="h-4 w-4" />
              </div>
              <div>
                <h3 class="text-sm font-extrabold">{{ en ? 'Company & fiscal information' : 'Información fiscal y de la empresa' }}</h3>
                <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">{{ en ? 'Hacienda fills available official details. The rest are editable.' : 'Hacienda completa los datos oficiales disponibles; el resto se puede editar.' }}</p>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="min-w-0">
                <CrmPhoneInput v-model="companyPhone" :country-id="countryIds[0] || ''"
                  :label="en ? 'Company phone (optional)' : 'Teléfono de la empresa (opcional)'" />
              </div>
              <label class="text-xs font-semibold">RUC / NIT <span class="text-[var(--dh-text-muted)]">({{ en ? 'optional' : 'opcional' }})</span>
                <input v-model="taxId" type="text" maxlength="80" autocomplete="off"
                  class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
              </label>
              <label class="text-xs font-semibold">{{ en ? 'Economic activity code (optional)' : 'Código de actividad económica (opcional)' }}
                <input v-model="economicActivityCode" type="text" maxlength="40"
                  class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
              </label>
              <label class="text-xs font-semibold">{{ en ? 'Primary Finance contact (optional)' : 'Contacto principal de Finanzas (opcional)' }}
                <select v-model="financeContactId" class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
                  <option value="">{{ en ? 'No finance contact selected' : 'Sin contacto financiero asignado' }}</option>
                  <option v-for="option in financeContactOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label class="text-xs font-semibold md:col-span-2">{{ en ? 'Physical or fiscal address (optional)' : 'Dirección física o fiscal (opcional)' }}
                <textarea v-model="address" rows="2" maxlength="500"
                  class="mt-2 w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase"></textarea>
              </label>
              <label class="text-xs font-semibold md:col-span-2">{{ en ? 'General notes (optional)' : 'Observaciones generales (opcional)' }}
                <textarea v-model="observations" rows="3" maxlength="4000"
                  :placeholder="en ? 'Payment instructions, commercial or operational requirements' : 'Instrucciones especiales, condiciones comerciales o particularidades operativas'"
                  class="mt-2 w-full resize-y rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase"></textarea>
              </label>
            </div>
            <div v-if="costaRicaCountryId" class="space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-4" data-srm-hacienda>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--dh-primary-rgb)/0.12)] text-[var(--dh-primary)]">
                    <FileCheck2 class="h-5 w-5" />
                  </div>
                  <div>
                    <h4 class="text-sm font-extrabold">{{ en ? 'Official Hacienda verification' : 'Verificación oficial de Hacienda' }}</h4>
                    <p class="mt-0.5 text-xs text-[var(--dh-text-muted)]">
                      {{ en ? 'A valid Costa Rican tax ID automatically fills the name and primary activity, as in CRM.'
                        : 'Al ingresar una cédula válida, se completa automáticamente la razón social y actividad principal, igual que en CRM.' }}
                    </p>
                  </div>
                </div>
                <button type="button" :disabled="!canLookupHacienda || haciendaLoading"
                  class="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-2 text-xs font-bold hover:border-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                  @click="lookupHacienda(true)">
                  <Search class="h-4 w-4" />
                  {{ haciendaLoading ? (en ? 'Checking...' : 'Consultando...') : (en ? 'Check again' : 'Volver a consultar') }}
                </button>
              </div>
              <p v-if="!canLookupHacienda" class="text-xs text-[var(--dh-text-muted)]">
                {{ en ? 'Enter a 9–12 digit tax ID to automatically verify it.' : 'Ingresá una cédula de 9 a 12 dígitos para consultar automáticamente.' }}
              </p>
              <p v-else-if="haciendaLoading" role="status" class="text-xs font-semibold text-[var(--dh-text-muted)]">
                {{ en ? 'Verifying taxpayer data with Hacienda...' : 'Verificando datos del contribuyente en Hacienda...' }}
              </p>
              <p v-else-if="haciendaError" role="alert" class="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
                {{ haciendaError }}
                <span class="mt-1 block">{{ en ? 'You can continue entering the details manually.' : 'Podés continuar ingresando los datos manualmente.' }}</span>
              </p>
              <div v-if="haciendaApplied && haciendaResult" role="status" class="space-y-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                <div class="flex items-center gap-2 text-sm font-bold">
                  <BadgeCheck class="h-4 w-4 shrink-0 text-emerald-500" />
                  <span class="min-w-0 break-words">{{ haciendaResult.name }}</span>
                </div>
                <p class="text-xs text-[var(--dh-text-muted)]">
                  {{ en ? 'Official values applied to this supplier automatically.' : 'Datos oficiales aplicados automáticamente a este proveedor.' }}
                </p>
                <div v-if="haciendaIdentificationType || haciendaRegime" class="flex flex-wrap gap-2 text-xs text-[var(--dh-text-muted)]">
                  <span v-if="haciendaIdentificationType" class="rounded-lg border border-[var(--dh-border)] px-2 py-1">
                    {{ en ? 'ID type' : 'Tipo de identificación' }}: {{ haciendaIdentificationType }}
                  </span>
                  <span v-if="haciendaRegime" class="rounded-lg border border-[var(--dh-border)] px-2 py-1">
                    {{ en ? 'Tax regime' : 'Régimen' }}: {{ haciendaRegime }}
                  </span>
                </div>
                <div v-if="haciendaResult.activities.length" class="space-y-2">
                  <p class="text-xs font-bold">{{ en ? 'Economic activities' : 'Actividades económicas' }} ({{ haciendaResult.activities.length }})</p>
                  <div class="grid gap-2 sm:grid-cols-2">
                    <div v-for="activity in haciendaResult.activities" :key="activity.code"
                      class="rounded-xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2.5 text-xs">
                      <span class="font-bold text-[var(--dh-primary)]">{{ activity.code }}</span>
                      <span class="ml-2 break-words">{{ activity.description }}</span>
                    </div>
                  </div>
                </div>
                <p v-else class="text-xs text-[var(--dh-text-muted)]">
                  {{ en ? 'Hacienda returned no economic activity; you may enter one manually.' : 'Hacienda no devolvió actividades económicas; podés ingresar el código manualmente.' }}
                </p>
              </div>
            </div>
          </section>
          <label class="md:col-span-2 text-sm font-semibold">{{ en ? 'Description (optional)' : 'Descripción (opcional)' }}
            <input v-model="supplierDescription" maxlength="300"
              class="mt-2 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 uppercase" />
          </label>
          </section>
          <section v-if="canReadBanks" v-show="supplierFormTab === 'banks'"
            class="md:col-span-2 space-y-3 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5"
            data-srm-save-section="bank" role="tabpanel">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div><h3 class="text-sm font-bold">{{ en ? 'Supplier bank accounts' : 'Cuentas bancarias del proveedor' }}
                <span class="font-normal text-[var(--dh-text-muted)]">({{ en ? 'optional' : 'opcional' }})</span></h3>
                <p class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Restricted financial data; not included in supplier catalog responses.' : 'Datos financieros restringidos; no se incluyen en el catálogo general.' }}</p>
              </div>
              <button v-if="canManageBanks" type="button" :disabled="!bankAccountsLoaded || bankAccounts.length >= 20"
                class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-bold disabled:opacity-40"
                @click="bankAccounts.push(newBankAccount())">{{ en ? '+ Add account' : '+ Agregar cuenta' }}</button>
            </div>
            <p v-if="bankAccountsLoading" class="text-xs">{{ t('common.loading') }}</p>
            <p v-if="bankError" role="alert" class="text-xs text-red-400">{{ bankError }}</p>
            <p v-if="error && saveErrorSection === 'bank'" role="alert" class="text-xs text-red-400">{{ error }}</p>
            <div v-for="(account, index) in bankAccounts" :key="account.id" class="space-y-3 border-t border-[var(--dh-border)] pt-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <label class="flex items-center gap-2 text-xs font-bold">
                  <input type="radio" name="srm-primary-bank" :checked="account.isPrimary" :disabled="!canManageBanks"
                    @change="setBankPrimary(index)" />
                  {{ en ? 'Primary payment account' : 'Cuenta principal para pagos' }}
                </label>
                <button v-if="canManageBanks" type="button" class="text-xs font-bold text-red-500"
                  @click="removeBankAccount(index)">{{ en ? 'Remove account' : 'Eliminar cuenta' }}</button>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <label class="text-xs font-semibold">{{ en ? 'Beneficiary bank *' : 'Banco beneficiario *' }}
                  <input v-model="account.bankName" :readonly="!canManageBanks" required maxlength="160"
                    class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
                </label>
                <label class="text-xs font-semibold">{{ en ? 'Account holder *' : 'Titular de cuenta *' }}
                  <input v-model="account.accountHolder" :readonly="!canManageBanks" required maxlength="180"
                    class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
                </label>
                <label class="text-xs font-semibold">{{ en ? 'Registration *' : 'Registro *' }}
                  <select v-model="account.registration" :disabled="!canManageBanks"
                    class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3">
                    <option value="LOCAL">{{ en ? 'Local' : 'Local' }}</option>
                    <option value="INTERNACIONAL">{{ en ? 'International' : 'Internacional' }}</option>
                  </select>
                </label>
                <label class="text-xs font-semibold">
                  {{ bankIbanFormat(account.bankCountryId) ? 'IBAN *' : (en ? 'Account number *' : 'Número de cuenta *') }}
                  <input :value="account.accountNumber" :type="revealBankNumbers ? 'text' : 'password'"
                    :readonly="!canManageBanks" required
                    :maxlength="bankIbanFormat(account.bankCountryId)?.length ?? 44"
                    :aria-invalid="Boolean(bankIbanError(account))"
                    autocomplete="off" @input="onBankNumberInput(account, $event)"
                    class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 font-mono uppercase" />
                  <span v-if="bankIbanFormat(account.bankCountryId)" class="mt-1 block text-[11px] font-normal text-[var(--dh-text-muted)]">
                    {{ en ? 'Prefix' : 'Prefijo' }} {{ bankIbanFormat(account.bankCountryId)?.code }}
                    · {{ account.accountNumber.length }}/{{ bankIbanFormat(account.bankCountryId)?.length }}
                    {{ en ? 'characters' : 'caracteres' }}
                  </span>
                  <span v-if="bankIbanError(account)" role="alert" class="mt-1 block text-xs font-medium text-red-400">
                    {{ bankIbanError(account) }}
                  </span>
                  <span v-else class="mt-1 block text-[11px] font-normal text-[var(--dh-text-muted)]">
                    {{ en ? 'National account (country without registered IBAN format)' : 'Cuenta nacional (país sin formato IBAN registrado)' }}
                    · {{ account.accountNumber.length }}/44
                  </span>
                </label>
                <label class="text-xs font-semibold">SWIFT / BIC {{ account.registration === 'INTERNACIONAL' ? '*' : '(' + (en ? 'optional' : 'opcional') + ')' }}
                  <input v-model="account.swiftBic" :readonly="!canManageBanks"
                    maxlength="11" class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
                </label>
                <CrmCatalogPicker v-model="account.currency" :label="en ? 'Currency *' : 'Moneda *'"
                  catalog-group-slug="currencies" value-kind="value" />
                <div class="min-w-0">
                  <DhSelect :model-value="account.bankCountryId" :options="countryOptions"
                    @update:model-value="onBankCountryChange(account, String($event))"
                    :label="en ? 'Bank country *' : 'País del banco *'" />
                </div>
                <label class="text-xs font-semibold">{{ en ? 'Intermediary bank (optional)' : 'Banco intermediario (opcional)' }}
                  <input v-model="account.intermediaryBank" :readonly="!canManageBanks" maxlength="180"
                    class="mt-1 w-full rounded-xl border border-[var(--dh-border)] bg-[var(--dh-shell)] p-3 uppercase" />
                </label>
              </div>
            </div>
            <button type="button" class="rounded-lg border border-[var(--dh-border)] px-3 py-2 text-xs font-semibold"
              @click="revealBankNumbers = !revealBankNumbers">
              {{ revealBankNumbers ? (en ? 'Hide account numbers' : 'Ocultar números de cuenta') : (en ? 'Reveal account numbers' : 'Mostrar números de cuenta') }}
            </button>
          </section>
          <section v-show="supplierFormTab === 'contacts'" data-srm-save-section="contacts"
            class="md:col-span-2 space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5" role="tabpanel">
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
          <section v-show="supplierFormTab === 'credit'" data-srm-save-section="credit"
            class="md:col-span-2 space-y-4 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 sm:p-5" role="tabpanel">
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
        </form>
        <template #footer>
          <div class="space-y-3" data-srm-form-footer>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'Changes are saved for the whole supplier profile.' : 'Los cambios se guardan para toda la ficha del proveedor.' }}</p>
              <button type="button" class="rounded-xl border border-[var(--dh-border)] px-4 py-2 text-xs font-semibold" @click="closeForm">
                {{ en ? 'Cancel' : 'Cancelar' }}
              </button>
            </div>
            <p v-if="error" role="alert" data-srm-save-error
              class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error }}</p>
            <button type="submit" form="srm-supplier-form" :disabled="saving || !(editing ? canEditSuppliers : canCreateSuppliers)"
              data-srm-save-button
              class="rounded-xl bg-[var(--dh-primary)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
              {{ saving ? t('common.loading') : (editing ? (en ? 'Update supplier' : 'Actualizar proveedor') : (en ? 'Save supplier' : 'Guardar proveedor')) }}
            </button>
          </div>
        </template>
      </DhDrawer>
      <DhModal :open="Boolean(deleteTarget)" :title="en ? 'Delete supplier' : 'Eliminar proveedor'"
        size="md" surface="solid" @close="closeSupplierDelete">
        <div v-if="deleteTarget" class="space-y-4" data-srm-delete-confirmation>
          <div class="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div class="space-y-1">
              <p class="text-sm font-bold">{{ en ? 'Remove this supplier from the directory?' : '¿Eliminar este proveedor del directorio?' }}</p>
              <p class="break-words text-sm font-semibold">{{ deleteTarget.name }}</p>
              <p class="text-xs text-[var(--dh-text-muted)]">{{ en ? 'The record will be archived, not physically destroyed. Suppliers with linked agreements or reviews cannot be removed.' : 'El registro se archivará, no se destruirá físicamente. No se pueden eliminar proveedores con acuerdos o evaluaciones vinculadas.' }}</p>
            </div>
          </div>
          <p v-if="deleteError" role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">{{ deleteError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <button type="button" :disabled="deleteBusy" class="min-h-10 rounded-xl border border-[var(--dh-border)] px-4 text-sm font-semibold disabled:opacity-50" @click="closeSupplierDelete">
              {{ en ? 'Cancel' : 'Cancelar' }}
            </button>
            <button type="button" :disabled="deleteBusy" data-srm-delete-confirm
              class="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              @click="deleteSupplier">
              <Trash2 class="h-4 w-4" />{{ deleteBusy ? (en ? 'Deleting...' : 'Eliminando...') : (en ? 'Delete supplier' : 'Eliminar proveedor') }}
            </button>
          </div>
        </div>
      </DhModal>
    </template>
  </main>
</template>
