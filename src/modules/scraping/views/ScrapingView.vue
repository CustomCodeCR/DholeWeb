<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Activity,
  CheckCircle2,
  Database,
  Eye,
  FileJson,
  Globe2,
  KeyRound,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Route,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-vue-next'
import { DhBadge, DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms'
import { DhDataTable, type DhTableColumn } from '@/shared/components/molecules'
import { DhPageHeader } from '@/shared/components/organisms'
import { CatalogItemsService } from '@/core/services/catalogItemsService'
import { ScrapingService } from '@/core/services/scrapingService'
import { useToastStore } from '@/core/stores/toastStore'
import type { CatalogItemSelectDto } from '@/core/interfaces/catalogs'
import type {
  ExtractionMappingRuleDto,
  ScrapedEvidenceDto,
  ScrapedRateCandidateDto,
  ScrapingCredentialDto,
  ScrapingJobDto,
  ScrapingRunDto,
  ScrapingSourceDto,
} from '@/core/interfaces/scraping'
import { useViewShortcuts } from '@/core/composables/useViewShortcuts'

type ScrapingModule = 'sources' | 'credentials' | 'jobs' | 'runs' | 'rules' | 'evidences' | 'candidates'
type SelectOption = { label: string; value: string | number; disabled?: boolean }
type AnyRecord = Record<string, unknown>

const { t } = useI18n()
const toastStore = useToastStore()

const loading = ref(false)
const saving = ref(false)
const catalogLoading = ref(false)
const activeModule = ref<ScrapingModule>('jobs')
const selectedRecord = ref<AnyRecord | null>(null)
const showCatalogSettings = ref(false)
const showAdvancedModules = ref(false)
const showAdvancedJobFields = ref(false)

const sources = ref<ScrapingSourceDto[]>([])
const credentials = ref<ScrapingCredentialDto[]>([])
const jobs = ref<ScrapingJobDto[]>([])
const runs = ref<ScrapingRunDto[]>([])
const evidences = ref<ScrapedEvidenceDto[]>([])
const candidates = ref<ScrapedRateCandidateDto[]>([])
const rules = ref<ExtractionMappingRuleDto[]>([])

const carriers = ref<CatalogItemSelectDto[]>([])
const ports = ref<CatalogItemSelectDto[]>([])
const containerTypes = ref<CatalogItemSelectDto[]>([])
const currencies = ref<CatalogItemSelectDto[]>([])

const catalogSlugs = reactive({
  carriers: localStorage.getItem('dhole.scraping.slug.carriers') || 'carriers',
  ports: localStorage.getItem('dhole.scraping.slug.ports') || 'ports',
  containerTypes: localStorage.getItem('dhole.scraping.slug.containerTypes') || 'container-types',
  currencies: localStorage.getItem('dhole.scraping.slug.currencies') || 'currencies',
})

const sourceForm = reactive({
  id: '',
  code: '',
  name: '',
  carrierCatalogItemId: '',
  carrierCode: '',
  carrierName: '',
  baseUrl: '',
  sourceType: '1',
  requiresLogin: false,
  navigationUrl: '',
  waitForSelector: '',
  navigationStepsJson: '[\n  { "action": "waitForSelector", "selector": ".rate-table" }\n]',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const credentialForm = reactive({
  id: '',
  scrapingSourceId: '',
  authenticationMode: '1',
  username: '',
  secretReference: '',
  expiresAt: '',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const jobForm = reactive({
  scrapingSourceId: '',
  carrierCatalogItemId: '',
  carrierCode: '',
  carrierName: '',
  portOfLoadingCatalogItemId: '',
  portOfLoadingCode: '',
  portOfLoadingName: '',
  portOfEntryCatalogItemId: '',
  portOfEntryCode: '',
  portOfEntryName: '',
  portOfDischargeCatalogItemId: '',
  portOfDischargeCode: '',
  portOfDischargeName: '',
  containerTypeCatalogItemId: '',
  containerTypeCode: '',
  containerTypeName: '',
  readyDate: nextReadyDate(),
  weightKg: '',
  commodity: '',
  triggerType: '1',
  scheduledAtUtc: '',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const runForm = reactive({
  scrapingJobId: '',
  scrapingSourceId: '',
  scrapingCredentialId: '',
  correlationId: '',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const ruleForm = reactive({
  id: '',
  scrapingSourceId: '',
  fieldName: 'rateAmount',
  displayName: 'Monto de tarifa',
  ruleType: '1',
  expression: '.rate, [data-rate]',
  minimumConfidenceScore: '70',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const evidenceForm = reactive({
  scrapingRunId: '',
  scrapingSourceId: '',
  evidenceType: '1',
  storageObjectKey: '',
  fileName: '',
  contentType: 'text/html',
  contentHash: '',
  sizeBytes: '',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const candidateForm = reactive({
  scrapingRunId: '',
  scrapingSourceId: '',
  scrapedEvidenceId: '',
  carrierCatalogItemId: '',
  carrierCode: '',
  carrierName: '',
  portOfLoadingCatalogItemId: '',
  portOfLoadingCode: '',
  portOfLoadingName: '',
  portOfEntryCatalogItemId: '',
  portOfEntryCode: '',
  portOfEntryName: '',
  portOfDischargeCatalogItemId: '',
  portOfDischargeCode: '',
  portOfDischargeName: '',
  containerTypeCatalogItemId: '',
  containerTypeCode: '',
  containerTypeName: '',
  currencyCatalogItemId: '',
  currencyCode: '',
  currencyName: '',
  validFrom: '',
  validTo: '',
  confidenceScore: '75',
  rawJson: '{"source":"manual","amount":0}',
  metadataJson: '{"createdFrom":"DholeWeb"}',
})

const sourceTypeOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('scraping.types.source.webPage') },
  { value: 2, label: t('scraping.types.source.portal') },
  { value: 3, label: t('scraping.types.source.fileDownload') },
  { value: 4, label: t('scraping.types.source.api') },
])

const authenticationModeOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('scraping.types.auth.none') },
  { value: 2, label: t('scraping.types.auth.basic') },
  { value: 3, label: t('scraping.types.auth.formLogin') },
  { value: 4, label: t('scraping.types.auth.token') },
  { value: 5, label: t('scraping.types.auth.cookie') },
])

const triggerTypeOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('scraping.types.trigger.manual') },
  { value: 2, label: t('scraping.types.trigger.scheduled') },
  { value: 3, label: t('scraping.types.trigger.retry') },
  { value: 4, label: t('scraping.types.trigger.system') },
])

const evidenceTypeOptions = computed<SelectOption[]>(() => [
  { value: 1, label: 'HTML' },
  { value: 2, label: t('scraping.types.evidence.screenshot') },
  { value: 3, label: 'PDF' },
  { value: 4, label: 'Excel' },
  { value: 5, label: 'JSON' },
  { value: 6, label: t('scraping.types.evidence.text') },
])

const ruleTypeOptions = computed<SelectOption[]>(() => [
  { value: 1, label: 'CSS selector' },
  { value: 2, label: 'XPath' },
  { value: 3, label: 'Regex' },
  { value: 4, label: 'JSONPath' },
  { value: 5, label: t('scraping.types.rule.tableColumn') },
  { value: 6, label: t('scraping.types.rule.aiSuggested') },
])

const runFailureOptions = computed<SelectOption[]>(() => [
  { value: 1, label: t('scraping.types.failure.loginFailed') },
  { value: 2, label: t('scraping.types.failure.captchaDetected') },
  { value: 3, label: t('scraping.types.failure.timeout') },
  { value: 4, label: t('scraping.types.failure.htmlChanged') },
  { value: 5, label: t('scraping.types.failure.downloadFailed') },
  { value: 6, label: t('scraping.types.failure.noRatesFound') },
  { value: 7, label: t('scraping.types.failure.normalizationFailed') },
  { value: 99, label: t('scraping.types.failure.unexpectedError') },
])

const moduleItems = computed(() => [
  { key: 'jobs' as const, label: t('scraping.jobs'), hint: t('scraping.jobsHint'), count: jobs.value.length, icon: Route },
  { key: 'runs' as const, label: t('scraping.runs'), hint: t('scraping.runsHint'), count: runs.value.length, icon: Activity },
  { key: 'sources' as const, label: t('scraping.sources'), hint: t('scraping.sourcesHint'), count: sources.value.length, icon: Globe2 },
  { key: 'credentials' as const, label: t('scraping.credentials'), hint: t('scraping.credentialsHint'), count: credentials.value.length, icon: KeyRound },
  { key: 'rules' as const, label: t('scraping.extractionRules'), hint: t('scraping.rulesHint'), count: rules.value.length, icon: ShieldCheck },
  { key: 'evidences' as const, label: t('scraping.evidences'), hint: t('scraping.evidencesHint'), count: evidences.value.length, icon: FileJson },
  { key: 'candidates' as const, label: t('scraping.rateCandidates'), hint: t('scraping.candidatesHint'), count: candidates.value.length, icon: Database },
])

const displayedModuleItems = computed(() => {
  if (showAdvancedModules.value) {
    return moduleItems.value
  }

  return moduleItems.value.filter((item) => ['jobs', 'runs', 'sources', 'credentials'].includes(item.key))
})

const sourceColumns = computed<DhTableColumn<ScrapingSourceDto>[]>(() => [
  { key: 'name', label: t('common.name') },
  { key: 'carrierName', label: t('scraping.carrier') },
  { key: 'baseUrl', label: t('scraping.baseUrl') },
  { key: 'sourceTypeName', label: t('scraping.sourceType') },
  { key: 'healthStatusName', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const credentialColumns = computed<DhTableColumn<ScrapingCredentialDto>[]>(() => [
  { key: 'scrapingSourceName', label: t('scraping.source') },
  { key: 'authenticationModeName', label: t('scraping.authMode') },
  { key: 'username', label: t('scraping.username') },
  { key: 'statusName', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const jobColumns = computed<DhTableColumn<ScrapingJobDto>[]>(() => [
  { key: 'carrierName', label: t('scraping.carrier') },
  { key: 'route', label: t('scraping.route') },
  { key: 'containerTypeName', label: t('scraping.container') },
  { key: 'readyDate', label: t('scraping.readyDate') },
  { key: 'scheduledAtUtc', label: t('scraping.scheduledAt') },
  { key: 'statusName', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const runColumns = computed<DhTableColumn<ScrapingRunDto>[]>(() => [
  { key: 'scrapingSourceName', label: t('scraping.source') },
  { key: 'attemptNumber', label: t('scraping.attempt') },
  { key: 'statusName', label: t('common.status') },
  { key: 'extractedRateCount', label: t('scraping.extractedRates'), align: 'center' },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const ruleColumns = computed<DhTableColumn<ExtractionMappingRuleDto>[]>(() => [
  { key: 'scrapingSourceName', label: t('scraping.source') },
  { key: 'fieldName', label: t('scraping.fieldName') },
  { key: 'ruleTypeName', label: t('scraping.ruleType') },
  { key: 'minimumConfidenceScore', label: t('scraping.minimumConfidence'), align: 'center' },
  { key: 'statusName', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const evidenceColumns = computed<DhTableColumn<ScrapedEvidenceDto>[]>(() => [
  { key: 'scrapingSourceName', label: t('scraping.source') },
  { key: 'evidenceTypeName', label: t('scraping.evidenceType') },
  { key: 'fileName', label: t('scraping.fileName') },
  { key: 'storageObjectKey', label: t('scraping.storageKey') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const candidateColumns = computed<DhTableColumn<ScrapedRateCandidateDto>[]>(() => [
  { key: 'carrierName', label: t('scraping.carrier') },
  { key: 'route', label: t('scraping.route') },
  { key: 'currencyName', label: t('scraping.currency') },
  { key: 'confidenceScore', label: t('scraping.confidence'), align: 'center' },
  { key: 'statusName', label: t('common.status') },
  { key: 'actions', label: t('common.actions'), align: 'right' },
])

const catalogOption = (item: CatalogItemSelectDto): SelectOption => ({
  label: `${item.label} (${item.code})`,
  value: item.id,
})

const carrierOptions = computed<SelectOption[]>(() => carriers.value.map(catalogOption))
const portOptions = computed<SelectOption[]>(() => ports.value.map(catalogOption))
const containerOptions = computed<SelectOption[]>(() => containerTypes.value.map(catalogOption))
const currencyOptions = computed<SelectOption[]>(() => currencies.value.map(catalogOption))
const dynamicReadyDate = computed(() => nextReadyDate())
const jobsWithDynamicReadyDate = computed<ScrapingJobDto[]>(() =>
  jobs.value.map((job) => ({ ...job, readyDate: dynamicReadyDate.value })),
)

const sourceOptions = computed<SelectOption[]>(() => sources.value.map((source) => ({
  label: `${source.name} (${source.code})`,
  value: source.id,
})))

const credentialOptions = computed<SelectOption[]>(() => credentials.value.map((credential) => ({
  label: `${credential.scrapingSourceName ?? credential.scrapingSourceId} · ${credential.username ?? credential.authenticationModeName}`,
  value: credential.id,
})))

const jobOptions = computed<SelectOption[]>(() => jobs.value.map((job) => ({
  label: `${job.carrierName ?? job.scrapingSourceName ?? job.id} · ${routeLabel(job)}`,
  value: job.id,
})))

const runOptions = computed<SelectOption[]>(() => runs.value.map((run) => ({
  label: `${run.scrapingSourceName ?? run.scrapingSourceId} · #${run.attemptNumber} · ${run.statusName}`,
  value: run.id,
})))

const evidenceOptions = computed<SelectOption[]>(() => evidences.value.map((evidence) => ({
  label: `${evidence.fileName ?? evidence.storageObjectKey} · ${evidence.evidenceTypeName}`,
  value: evidence.id,
})))

const activeSources = computed(() => sources.value.filter((source) => source.isActive).length)
const runningJobs = computed(() => jobs.value.filter((job) => /running|processing|started/i.test(job.statusName)).length)
const failedRuns = computed(() => runs.value.filter((run) => /fail|error/i.test(run.statusName)).length)
const pendingCandidates = computed(() => candidates.value.filter((candidate) => /pending|review|extracted/i.test(candidate.statusName)).length)

watch(() => jobForm.scrapingSourceId, (sourceId) => {
  const source = sources.value.find((item) => item.id === sourceId)
  if (!source) return

  jobForm.carrierCatalogItemId = source.carrierCatalogItemId ?? ''
  jobForm.carrierCode = source.carrierCode ?? source.code
  jobForm.carrierName = source.carrierName ?? source.name
})

watch(() => runForm.scrapingJobId, (jobId) => {
  const job = jobs.value.find((item) => item.id === jobId)
  if (!job) return

  runForm.scrapingSourceId = job.scrapingSourceId ?? ''
})

watch(() => evidenceForm.scrapingRunId, (runId) => {
  const run = runs.value.find((item) => item.id === runId)
  if (!run) return

  evidenceForm.scrapingSourceId = run.scrapingSourceId
})

watch(() => candidateForm.scrapingRunId, (runId) => {
  const run = runs.value.find((item) => item.id === runId)
  if (!run) return

  candidateForm.scrapingSourceId = run.scrapingSourceId

  const job = jobs.value.find((item) => item.id === run.scrapingJobId)
  if (!job) return

  candidateForm.carrierCatalogItemId = job.carrierCatalogItemId ?? ''
  candidateForm.carrierCode = job.carrierCode ?? ''
  candidateForm.carrierName = job.carrierName ?? ''
  candidateForm.portOfLoadingCatalogItemId = job.portOfLoadingCatalogItemId ?? ''
  candidateForm.portOfLoadingCode = job.portOfLoadingCode ?? ''
  candidateForm.portOfLoadingName = job.portOfLoadingName ?? ''
  candidateForm.portOfEntryCatalogItemId = job.portOfEntryCatalogItemId ?? ''
  candidateForm.portOfEntryCode = job.portOfEntryCode ?? ''
  candidateForm.portOfEntryName = job.portOfEntryName ?? ''
  candidateForm.portOfDischargeCatalogItemId = job.portOfDischargeCatalogItemId ?? ''
  candidateForm.portOfDischargeCode = job.portOfDischargeCode ?? ''
  candidateForm.portOfDischargeName = job.portOfDischargeName ?? ''
  candidateForm.containerTypeCatalogItemId = job.containerTypeCatalogItemId ?? ''
  candidateForm.containerTypeCode = job.containerTypeCode ?? ''
  candidateForm.containerTypeName = job.containerTypeName ?? ''
})

function nextReadyDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function routeLabel(row: ScrapingJobDto | ScrapedRateCandidateDto) {
  const origin = row.portOfLoadingName || row.portOfLoadingCode || '—'
  const entry = row.portOfEntryName || row.portOfEntryCode
  const destination = row.portOfDischargeName || row.portOfDischargeCode || '—'
  return entry ? `${origin} → ${entry} → ${destination}` : `${origin} → ${destination}`
}

function statusVariant(value: string | null | undefined) {
  const status = String(value ?? '').toLowerCase()
  if (status.includes('fail') || status.includes('error') || status.includes('reject') || status.includes('broken')) return 'danger'
  if (status.includes('active') || status.includes('complete') || status.includes('approved') || status.includes('healthy')) return 'success'
  if (status.includes('review') || status.includes('pending') || status.includes('rotation')) return 'warning'
  return 'neutral'
}

function emptyToNull(value: string): string | null {
  return value.trim() || null
}

function numberOrNull(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function dateTimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function confirmAction(message: string) {
  return window.confirm(message)
}

function parseJson(value: string): unknown {
  if (!value.trim()) return null
  return JSON.parse(value)
}

function safeMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = parseJson(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function composeSourceMetadata() {
  const metadata = safeMetadata(sourceForm.metadataJson)

  if (sourceForm.navigationUrl.trim()) {
    metadata.targetUrl = sourceForm.navigationUrl.trim()
  }

  if (sourceForm.waitForSelector.trim()) {
    metadata.readySelector = sourceForm.waitForSelector.trim()
  }

  try {
    if (sourceForm.navigationStepsJson.trim()) {
      metadata.navigationSteps = parseJson(sourceForm.navigationStepsJson)
    }
  } catch {
    metadata.navigationStepsRaw = sourceForm.navigationStepsJson.trim()
  }

  metadata.reuseSession = metadata.reuseSession ?? true
  metadata.storageStateEnabled = metadata.storageStateEnabled ?? true
  metadata.updatedFrom = 'DholeWeb'

  return JSON.stringify(metadata, null, 2)
}

function findItem(items: CatalogItemSelectDto[], id: string) {
  return items.find((item) => item.id === id) ?? null
}

function applyCarrierToSource(id: string | number | null) {
  const item = findItem(carriers.value, String(id ?? ''))
  if (!item) return

  sourceForm.carrierCatalogItemId = item.id
  sourceForm.carrierCode = item.code
  sourceForm.carrierName = item.label
}

function applyCatalogToObject(
  target: any,
  item: CatalogItemSelectDto | null,
  idKey: string,
  codeKey: string,
  nameKey: string,
) {
  if (!item) return
  target[idKey] = item.id
  target[codeKey] = item.code
  target[nameKey] = item.label
}

function applyJobCarrier(id: string | number | null) {
  applyCatalogToObject(jobForm, findItem(carriers.value, String(id ?? '')), 'carrierCatalogItemId', 'carrierCode', 'carrierName')
}

function applyPol(id: string | number | null) {
  applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfLoadingCatalogItemId', 'portOfLoadingCode', 'portOfLoadingName')
}

function applyPoe(id: string | number | null) {
  applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfEntryCatalogItemId', 'portOfEntryCode', 'portOfEntryName')
}

function applyPod(id: string | number | null) {
  applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfDischargeCatalogItemId', 'portOfDischargeCode', 'portOfDischargeName')
}

function applyContainer(id: string | number | null) {
  applyCatalogToObject(jobForm, findItem(containerTypes.value, String(id ?? '')), 'containerTypeCatalogItemId', 'containerTypeCode', 'containerTypeName')
}

function applyCurrency(id: string | number | null) {
  applyCatalogToObject(candidateForm, findItem(currencies.value, String(id ?? '')), 'currencyCatalogItemId', 'currencyCode', 'currencyName')
}

async function loadCatalogs() {
  try {
    catalogLoading.value = true

    localStorage.setItem('dhole.scraping.slug.carriers', catalogSlugs.carriers)
    localStorage.setItem('dhole.scraping.slug.ports', catalogSlugs.ports)
    localStorage.setItem('dhole.scraping.slug.containerTypes', catalogSlugs.containerTypes)
    localStorage.setItem('dhole.scraping.slug.currencies', catalogSlugs.currencies)

    const [carrierItems, portItems, containerItems, currencyItems] = await Promise.all([
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.carriers }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.ports }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.containerTypes }),
      CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.currencies }),
    ])

    carriers.value = carrierItems
    ports.value = portItems
    containerTypes.value = containerItems
    currencies.value = currencyItems
  } catch (error) {
    toastStore.backendError(error, t('scraping.catalogLoadError'))
  } finally {
    catalogLoading.value = false
  }
}

async function load() {
  try {
    loading.value = true
    const [sourcesResult, credentialsResult, jobsResult, runsResult, evidencesResult, candidatesResult, rulesResult] = await Promise.all([
      ScrapingService.browseSources({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseCredentials({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseJobs({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseRuns({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseEvidences({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseRateCandidates({ pageNumber: 1, pageSize: 50 }),
      ScrapingService.browseExtractionRules({ pageNumber: 1, pageSize: 50 }),
    ])

    sources.value = sourcesResult.items
    credentials.value = credentialsResult.items
    jobs.value = jobsResult.items
    runs.value = runsResult.items
    evidences.value = evidencesResult.items
    candidates.value = candidatesResult.items
    rules.value = rulesResult.items
  } catch (error) {
    toastStore.backendError(error, t('scraping.loadError'))
  } finally {
    loading.value = false
  }
}

function inspect(row: AnyRecord) {
  selectedRecord.value = row
}

function resetSourceForm() {
  Object.assign(sourceForm, {
    id: '', code: '', name: '', carrierCatalogItemId: '', carrierCode: '', carrierName: '', baseUrl: '', sourceType: '1', requiresLogin: false,
    navigationUrl: '', waitForSelector: '', navigationStepsJson: '[\n  { "action": "waitForSelector", "selector": ".rate-table" }\n]', metadataJson: '{"createdFrom":"DholeWeb"}',
  })
}

function editSource(row: ScrapingSourceDto) {
  activeModule.value = 'sources'
  const metadata = safeMetadata(row.metadataJson ?? '{}')
  const navigation = metadata.navigation && typeof metadata.navigation === 'object'
    ? metadata.navigation as Record<string, unknown>
    : {}

  Object.assign(sourceForm, {
    id: row.id,
    code: row.code,
    name: row.name,
    carrierCatalogItemId: row.carrierCatalogItemId ?? '',
    carrierCode: row.carrierCode ?? '',
    carrierName: row.carrierName ?? '',
    baseUrl: row.baseUrl,
    sourceType: String(row.sourceType),
    requiresLogin: row.requiresLogin,
    navigationUrl: typeof metadata.targetUrl === 'string' ? metadata.targetUrl : (typeof navigation.url === 'string' ? navigation.url : ''),
    waitForSelector: typeof metadata.readySelector === 'string' ? metadata.readySelector : (typeof navigation.waitForSelector === 'string' ? navigation.waitForSelector : ''),
    navigationStepsJson: metadata.navigationSteps
      ? JSON.stringify(metadata.navigationSteps, null, 2)
      : navigation.steps
        ? JSON.stringify(navigation.steps, null, 2)
      : '[\n  { "action": "waitForSelector", "selector": ".rate-table" }\n]',
    metadataJson: row.metadataJson ?? '{}',
  })
  inspect(row)
}

async function saveSource() {
  if (!sourceForm.code.trim() || !sourceForm.name.trim() || !sourceForm.baseUrl.trim()) {
    toastStore.error(t('common.error'), t('scraping.requiredSourceFields'))
    return
  }

  try {
    saving.value = true
    const payload = {
      name: sourceForm.name.trim(),
      carrierCatalogItemId: emptyToNull(sourceForm.carrierCatalogItemId),
      carrierCode: emptyToNull(sourceForm.carrierCode),
      carrierName: emptyToNull(sourceForm.carrierName),
      baseUrl: sourceForm.baseUrl.trim(),
      sourceType: Number(sourceForm.sourceType) || 1,
      requiresLogin: sourceForm.requiresLogin,
      metadataJson: composeSourceMetadata(),
    }

    if (sourceForm.id) {
      await ScrapingService.updateSource(sourceForm.id, payload)
      toastStore.success(t('scraping.sourceUpdated'))
    } else {
      await ScrapingService.createSource({ code: sourceForm.code.trim(), ...payload })
      toastStore.success(t('scraping.sourceCreated'))
    }

    resetSourceForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.sourceCreateError'))
  } finally {
    saving.value = false
  }
}

async function deleteSource(row: ScrapingSourceDto) {
  if (!confirmAction(t('scraping.confirmDelete'))) return
  try {
    await ScrapingService.deleteSource(row.id)
    toastStore.success(t('scraping.deleted'))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.deleteError'))
  }
}

async function toggleSource(row: ScrapingSourceDto) {
  try {
    await ScrapingService.setSourceActive(row.id, !row.isActive)
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.updateError'))
  }
}

function resetCredentialForm() {
  Object.assign(credentialForm, { id: '', scrapingSourceId: '', authenticationMode: '1', username: '', secretReference: '', expiresAt: '', metadataJson: '{"createdFrom":"DholeWeb"}' })
}

function editCredential(row: ScrapingCredentialDto) {
  activeModule.value = 'credentials'
  Object.assign(credentialForm, {
    id: row.id,
    scrapingSourceId: row.scrapingSourceId,
    authenticationMode: String(row.authenticationMode),
    username: row.username ?? '',
    secretReference: '',
    expiresAt: row.expiresAt ?? '',
    metadataJson: row.metadataJson ?? '{}',
  })
  inspect(row)
}

async function saveCredential() {
  if (!credentialForm.scrapingSourceId || (!credentialForm.id && !credentialForm.secretReference.trim())) {
    toastStore.error(t('common.error'), t('scraping.requiredCredentialFields'))
    return
  }

  try {
    saving.value = true
    const payload = {
      authenticationMode: Number(credentialForm.authenticationMode) || 1,
      username: emptyToNull(credentialForm.username),
      expiresAt: emptyToNull(credentialForm.expiresAt),
      metadataJson: emptyToNull(credentialForm.metadataJson),
    }

    if (credentialForm.id) {
      await ScrapingService.updateCredential(credentialForm.id, payload)
      toastStore.success(t('scraping.credentialUpdated'))
    } else {
      await ScrapingService.createCredential({ scrapingSourceId: credentialForm.scrapingSourceId, secretReference: credentialForm.secretReference.trim(), ...payload })
      toastStore.success(t('scraping.credentialCreated'))
    }

    resetCredentialForm()
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.credentialCreateError'))
  } finally {
    saving.value = false
  }
}

async function deleteCredential(row: ScrapingCredentialDto) {
  if (!confirmAction(t('scraping.confirmDelete'))) return
  try {
    await ScrapingService.deleteCredential(row.id)
    toastStore.success(t('scraping.deleted'))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.deleteError'))
  }
}

async function rotateCredential(row: ScrapingCredentialDto) {
  const secretReference = window.prompt(t('scraping.newSecretReference'))
  if (!secretReference) return

  try {
    await ScrapingService.rotateCredentialSecret(row.id, { secretReference })
    toastStore.success(t('scraping.credentialRotated'))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.updateError'))
  }
}

async function toggleCredential(row: ScrapingCredentialDto) {
  try {
    await ScrapingService.setCredentialActive(row.id, !/active/i.test(row.statusName))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.updateError'))
  }
}

async function createJob() {
  if (!jobForm.portOfLoadingCatalogItemId || !jobForm.portOfDischargeCatalogItemId || !jobForm.containerTypeCatalogItemId) {
    toastStore.error(t('common.error'), t('scraping.requiredJobFields'))
    return
  }

  jobForm.readyDate = nextReadyDate()

  try {
    saving.value = true
    await ScrapingService.createJob({
      scrapingSourceId: emptyToNull(jobForm.scrapingSourceId),
      carrierCatalogItemId: emptyToNull(jobForm.carrierCatalogItemId),
      carrierCode: emptyToNull(jobForm.carrierCode),
      carrierName: emptyToNull(jobForm.carrierName),
      portOfLoadingCatalogItemId: jobForm.portOfLoadingCatalogItemId,
      portOfLoadingCode: jobForm.portOfLoadingCode,
      portOfLoadingName: jobForm.portOfLoadingName,
      portOfEntryCatalogItemId: emptyToNull(jobForm.portOfEntryCatalogItemId),
      portOfEntryCode: emptyToNull(jobForm.portOfEntryCode),
      portOfEntryName: emptyToNull(jobForm.portOfEntryName),
      portOfDischargeCatalogItemId: jobForm.portOfDischargeCatalogItemId,
      portOfDischargeCode: jobForm.portOfDischargeCode,
      portOfDischargeName: jobForm.portOfDischargeName,
      containerTypeCatalogItemId: jobForm.containerTypeCatalogItemId,
      containerTypeCode: jobForm.containerTypeCode,
      containerTypeName: jobForm.containerTypeName,
      readyDate: nextReadyDate(),
      weightKg: numberOrNull(jobForm.weightKg),
      commodity: emptyToNull(jobForm.commodity),
      triggerType: Number(jobForm.triggerType) || 1,
      scheduledAtUtc: dateTimeLocalToIso(jobForm.scheduledAtUtc),
      metadataJson: emptyToNull(jobForm.metadataJson),
    })
    toastStore.success(t('scraping.jobCreated'))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.jobCreateError'))
  } finally {
    saving.value = false
  }
}

async function startJob(jobId: string) { try { await ScrapingService.startJob(jobId); toastStore.success(t('scraping.jobStarted')); await load() } catch (error) { toastStore.backendError(error, t('scraping.jobStartError')) } }
async function completeJob(jobId: string) { try { await ScrapingService.completeJob(jobId); toastStore.success(t('scraping.jobCompleted')); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }
async function cancelJob(jobId: string) { try { await ScrapingService.cancelJob(jobId, { reason: t('scraping.cancelledFromWeb') }); toastStore.success(t('scraping.jobCancelled')); await load() } catch (error) { toastStore.backendError(error, t('scraping.jobCancelError')) } }
async function failJob(jobId: string) {
  const failureMessage = window.prompt(t('scraping.failureMessage'))
  if (!failureMessage) return
  try { await ScrapingService.failJob(jobId, { failureReason: 'ManualFailure', failureMessage }); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) }
}

async function createRun() {
  if (!runForm.scrapingJobId || !runForm.scrapingSourceId) {
    toastStore.error(t('common.error'), t('scraping.requiredRunFields'))
    return
  }

  try {
    saving.value = true
    await ScrapingService.createRun({
      scrapingJobId: runForm.scrapingJobId,
      scrapingSourceId: runForm.scrapingSourceId,
      scrapingCredentialId: emptyToNull(runForm.scrapingCredentialId),
      correlationId: emptyToNull(runForm.correlationId),
      metadataJson: emptyToNull(runForm.metadataJson),
    })
    toastStore.success(t('scraping.runCreated'))
    await load()
  } catch (error) {
    toastStore.backendError(error, t('scraping.runCreateError'))
  } finally {
    saving.value = false
  }
}

async function startRun(runId: string) { try { await ScrapingService.startRun(runId); toastStore.success(t('scraping.runStarted')); await load() } catch (error) { toastStore.backendError(error, t('scraping.runStartError')) } }
async function completeRun(runId: string) { try { await ScrapingService.completeRun(runId, { extractedRateCount: 0, evidenceCount: 0, outputSummaryJson: null, metadataJson: null }); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }
async function retryRun(runId: string) { try { await ScrapingService.retryRun(runId, t('scraping.retryFromWeb')); toastStore.success(t('scraping.runRetried')); await load() } catch (error) { toastStore.backendError(error, t('scraping.runRetryError')) } }
async function failRun(row: ScrapingRunDto) {
  const reason = window.prompt(`${t('scraping.failureReason')} (${runFailureOptions.value.map(x => `${x.value}: ${x.label}`).join(', ')})`, '99')
  const message = window.prompt(t('scraping.failureMessage'), 'Manual failure')
  if (!reason || !message) return
  try { await ScrapingService.failRun(row.id, { failureReason: Number(reason) || 99, failureMessage: message, metadataJson: null }); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) }
}

function resetRuleForm() { Object.assign(ruleForm, { id: '', scrapingSourceId: '', fieldName: 'rateAmount', displayName: 'Monto de tarifa', ruleType: '1', expression: '.rate, [data-rate]', minimumConfidenceScore: '70', metadataJson: '{"createdFrom":"DholeWeb"}' }) }
function editRule(row: ExtractionMappingRuleDto) { activeModule.value = 'rules'; Object.assign(ruleForm, { id: row.id, scrapingSourceId: row.scrapingSourceId, fieldName: row.fieldName, displayName: row.displayName, ruleType: String(row.ruleType), expression: row.expression, minimumConfidenceScore: String(row.minimumConfidenceScore), metadataJson: row.metadataJson ?? '{}' }); inspect(row) }
async function saveRule() {
  if (!ruleForm.scrapingSourceId || !ruleForm.fieldName.trim() || !ruleForm.expression.trim()) { toastStore.error(t('common.error'), t('scraping.requiredRuleFields')); return }
  try {
    saving.value = true
    const payload = { displayName: ruleForm.displayName.trim() || ruleForm.fieldName.trim(), ruleType: Number(ruleForm.ruleType) || 1, expression: ruleForm.expression.trim(), minimumConfidenceScore: Number(ruleForm.minimumConfidenceScore) || 70, metadataJson: emptyToNull(ruleForm.metadataJson) }
    if (ruleForm.id) { await ScrapingService.updateExtractionRule(ruleForm.id, payload); toastStore.success(t('scraping.ruleUpdated')) }
    else { await ScrapingService.createExtractionRule({ scrapingSourceId: ruleForm.scrapingSourceId, fieldName: ruleForm.fieldName.trim(), ...payload }); toastStore.success(t('scraping.ruleCreated')) }
    resetRuleForm(); await load()
  } catch (error) { toastStore.backendError(error, t('scraping.ruleCreateError')) }
  finally { saving.value = false }
}
async function deleteRule(row: ExtractionMappingRuleDto) { if (!confirmAction(t('scraping.confirmDelete'))) return; try { await ScrapingService.deleteExtractionRule(row.id); await load() } catch (error) { toastStore.backendError(error, t('scraping.deleteError')) } }
async function toggleRule(row: ExtractionMappingRuleDto) { try { await ScrapingService.setExtractionRuleActive(row.id, !/active/i.test(row.statusName)); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }
async function approveRule(row: ExtractionMappingRuleDto) { try { await ScrapingService.approveExtractionRule(row.id, t('scraping.approvedFromWeb')); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }
async function rejectRule(row: ExtractionMappingRuleDto) { const reason = window.prompt(t('scraping.rejectionReason')); if (!reason) return; try { await ScrapingService.rejectExtractionRule(row.id, reason); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }

async function createEvidence() {
  if (!evidenceForm.scrapingRunId || !evidenceForm.scrapingSourceId || !evidenceForm.storageObjectKey.trim()) { toastStore.error(t('common.error'), t('scraping.requiredEvidenceFields')); return }
  try {
    saving.value = true
    await ScrapingService.createEvidence({ scrapingRunId: evidenceForm.scrapingRunId, scrapingSourceId: evidenceForm.scrapingSourceId, evidenceType: Number(evidenceForm.evidenceType) || 1, storageObjectKey: evidenceForm.storageObjectKey.trim(), fileName: emptyToNull(evidenceForm.fileName), contentType: emptyToNull(evidenceForm.contentType), contentHash: emptyToNull(evidenceForm.contentHash), sizeBytes: numberOrNull(evidenceForm.sizeBytes), metadataJson: emptyToNull(evidenceForm.metadataJson) })
    toastStore.success(t('scraping.evidenceCreated')); await load()
  } catch (error) { toastStore.backendError(error, t('scraping.evidenceCreateError')) }
  finally { saving.value = false }
}
async function deleteEvidence(row: ScrapedEvidenceDto) { if (!confirmAction(t('scraping.confirmDelete'))) return; try { await ScrapingService.deleteEvidence(row.id); await load() } catch (error) { toastStore.backendError(error, t('scraping.deleteError')) } }

async function createCandidate() {
  if (!candidateForm.scrapingRunId || !candidateForm.scrapingSourceId || !candidateForm.rawJson.trim()) { toastStore.error(t('common.error'), t('scraping.requiredCandidateFields')); return }
  try {
    saving.value = true
    await ScrapingService.createRateCandidate({
      scrapingRunId: candidateForm.scrapingRunId,
      scrapingSourceId: candidateForm.scrapingSourceId,
      scrapedEvidenceId: emptyToNull(candidateForm.scrapedEvidenceId),
      carrierCatalogItemId: emptyToNull(candidateForm.carrierCatalogItemId),
      carrierCode: emptyToNull(candidateForm.carrierCode),
      carrierName: emptyToNull(candidateForm.carrierName),
      portOfLoadingCatalogItemId: emptyToNull(candidateForm.portOfLoadingCatalogItemId),
      portOfLoadingCode: emptyToNull(candidateForm.portOfLoadingCode),
      portOfLoadingName: emptyToNull(candidateForm.portOfLoadingName),
      portOfEntryCatalogItemId: emptyToNull(candidateForm.portOfEntryCatalogItemId),
      portOfEntryCode: emptyToNull(candidateForm.portOfEntryCode),
      portOfEntryName: emptyToNull(candidateForm.portOfEntryName),
      portOfDischargeCatalogItemId: emptyToNull(candidateForm.portOfDischargeCatalogItemId),
      portOfDischargeCode: emptyToNull(candidateForm.portOfDischargeCode),
      portOfDischargeName: emptyToNull(candidateForm.portOfDischargeName),
      containerTypeCatalogItemId: emptyToNull(candidateForm.containerTypeCatalogItemId),
      containerTypeCode: emptyToNull(candidateForm.containerTypeCode),
      containerTypeName: emptyToNull(candidateForm.containerTypeName),
      currencyCatalogItemId: emptyToNull(candidateForm.currencyCatalogItemId),
      currencyCode: emptyToNull(candidateForm.currencyCode),
      currencyName: emptyToNull(candidateForm.currencyName),
      validFrom: emptyToNull(candidateForm.validFrom),
      validTo: emptyToNull(candidateForm.validTo),
      confidenceScore: Number(candidateForm.confidenceScore) || 0,
      rawJson: candidateForm.rawJson.trim(),
      metadataJson: emptyToNull(candidateForm.metadataJson),
    })
    toastStore.success(t('scraping.candidateCreated')); await load()
  } catch (error) { toastStore.backendError(error, t('scraping.candidateCreateError')) }
  finally { saving.value = false }
}
async function normalizeCandidate(row: ScrapedRateCandidateDto) { const normalizedJson = window.prompt(t('scraping.normalizedJson'), row.normalizedJson || row.rawJson || '{}'); if (!normalizedJson) return; try { await ScrapingService.normalizeRateCandidate(row.id, { normalizedJson, confidenceScore: row.confidenceScore ?? 80, validFrom: row.validFrom ?? null, validTo: row.validTo ?? null }); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }
async function approveCandidate(candidateId: string) { try { await ScrapingService.approveRateCandidate(candidateId, t('scraping.approvedFromWeb')); toastStore.success(t('scraping.candidateApproved')); await load() } catch (error) { toastStore.backendError(error, t('scraping.candidateApproveError')) } }
async function rejectCandidate(candidateId: string) { const reason = window.prompt(t('scraping.rejectionReason'), t('scraping.rejectedFromWeb')); if (!reason) return; try { await ScrapingService.rejectRateCandidate(candidateId, reason); toastStore.success(t('scraping.candidateRejected')); await load() } catch (error) { toastStore.backendError(error, t('scraping.candidateRejectError')) } }
async function sendCandidateToPricing(row: ScrapedRateCandidateDto) { const pricingRateId = window.prompt(t('scraping.pricingRateId')); if (!pricingRateId) return; try { await ScrapingService.sendRateCandidateToPricing(row.id, { pricingRateId }); await load() } catch (error) { toastStore.backendError(error, t('scraping.updateError')) } }

function toggleAdvancedModules() {
  showAdvancedModules.value = !showAdvancedModules.value

  if (!showAdvancedModules.value && !['jobs', 'runs', 'sources', 'credentials'].includes(activeModule.value)) {
    activeModule.value = 'jobs'
    selectedRecord.value = null
  }
}

async function reloadScrapingView() {
  await Promise.all([load(), loadCatalogs()])
}

useViewShortcuts({
  create: () => {
    selectedRecord.value = null
  },
  save: reloadScrapingView,
  refresh: reloadScrapingView,
})

onMounted(reloadScrapingView)
</script>

<template>
  <section class="space-y-5">
    <DhPageHeader :title="t('scraping.title')" :subtitle="t('scraping.subtitle')" :icon="Globe2">
      <template #actions>
        <DhButton :icon="RefreshCcw" :label="t('common.refresh')" variant="secondary" @click="load" />
        <DhButton :label="showCatalogSettings ? t('scraping.hideCatalogs') : t('scraping.configureCatalogs')" variant="secondary" @click="showCatalogSettings = !showCatalogSettings" />
        <DhButton :label="showAdvancedModules ? t('scraping.hideAdvancedModules') : t('scraping.showAdvancedModules')" variant="secondary" @click="toggleAdvancedModules" />
        <RouterLink to="/scraping/manual"><DhButton :icon="Search" :label="t('scraping.manualTitle')" /></RouterLink>
      </template>
    </DhPageHeader>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="dh-glass dh-liquid rounded-[30px] p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ t('scraping.activeSources') }}</p><h3 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ activeSources }}</h3></article>
      <article class="dh-glass dh-liquid rounded-[30px] p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ t('scraping.runningJobs') }}</p><h3 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ runningJobs }}</h3></article>
      <article class="dh-glass dh-liquid rounded-[30px] p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ t('scraping.failedRuns') }}</p><h3 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ failedRuns }}</h3></article>
      <article class="dh-glass dh-liquid rounded-[30px] p-5"><p class="text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]">{{ t('scraping.pendingCandidates') }}</p><h3 class="mt-2 text-3xl font-black text-[var(--dh-text)]">{{ pendingCandidates }}</h3></article>
    </section>

    <section v-if="showCatalogSettings" class="dh-glass dh-liquid rounded-[28px] p-4">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.catalogConnection') }}</h2>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.catalogConnectionHint') }}</p>
        </div>
        <DhButton :icon="RefreshCcw" :label="t('scraping.reloadCatalogs')" :loading="catalogLoading" size="sm" variant="secondary" @click="loadCatalogs" />
      </div>
      <div class="grid gap-3 md:grid-cols-4">
        <DhInput v-model="catalogSlugs.carriers" :label="t('scraping.slugCarriers')" />
        <DhInput v-model="catalogSlugs.ports" :label="t('scraping.slugPorts')" />
        <DhInput v-model="catalogSlugs.containerTypes" :label="t('scraping.slugContainers')" />
        <DhInput v-model="catalogSlugs.currencies" :label="t('scraping.slugCurrencies')" />
      </div>
    </section>

    <nav class="dh-scrollbar flex gap-2 overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-[var(--dh-shadow-sm)]">
      <button
        v-for="item in displayedModuleItems"
        :key="item.key"
        type="button"
        class="flex min-w-[12rem] items-center gap-3 rounded-[22px] px-4 py-3 text-left transition"
        :class="activeModule === item.key ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]' : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]'"
        @click="activeModule = item.key; selectedRecord = null"
      >
        <component :is="item.icon" class="h-5 w-5 shrink-0" />
        <span class="min-w-0">
          <span class="block truncate text-sm font-black">{{ item.label }}</span>
          <span class="block truncate text-xs font-semibold opacity-80">{{ item.count }} · {{ item.hint }}</span>
        </span>
      </button>
    </nav>

    <div class="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section class="dh-glass dh-liquid rounded-[32px] p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-black text-[var(--dh-text)]">{{ moduleItems.find((x) => x.key === activeModule)?.label }}</h2>
            <p class="mt-1 text-sm font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.listHint') }}</p>
          </div>
          <DhButton :icon="Plus" :label="t('common.create')" size="sm" @click="selectedRecord = null" />
        </div>

        <DhDataTable v-if="activeModule === 'sources'" :columns="sourceColumns" :rows="sources" :loading="loading" :empty-text="t('scraping.emptySources')" @row-click="inspect">
          <template #cell-baseUrl="{ value }"><span class="line-clamp-1 max-w-[16rem]">{{ value }}</span></template>
          <template #cell-healthStatusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Eye" size="sm" variant="ghost" @click="inspect(row)" /><DhButton :icon="Pencil" size="sm" variant="ghost" @click="editSource(row)" /><DhButton :label="row.isActive ? t('common.inactivate') : t('common.activate')" size="sm" variant="secondary" @click="toggleSource(row)" /><DhButton :icon="Trash2" size="sm" variant="danger" @click="deleteSource(row)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'credentials'" :columns="credentialColumns" :rows="credentials" :loading="loading" :empty-text="t('scraping.emptyCredentials')" @row-click="inspect">
          <template #cell-statusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Eye" size="sm" variant="ghost" @click="inspect(row)" /><DhButton :icon="Pencil" size="sm" variant="ghost" @click="editCredential(row)" /><DhButton :icon="RotateCcw" size="sm" variant="ghost" @click="rotateCredential(row)" /><DhButton :label="/active/i.test(row.statusName) ? t('common.inactivate') : t('common.activate')" size="sm" variant="secondary" @click="toggleCredential(row)" /><DhButton :icon="Trash2" size="sm" variant="danger" @click="deleteCredential(row)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'jobs'" :columns="jobColumns" :rows="jobsWithDynamicReadyDate" :loading="loading" :empty-text="t('scraping.emptyJobs')" @row-click="inspect">
          <template #cell-route="{ row }">{{ routeLabel(row) }}</template>
          <template #cell-statusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Play" :label="t('scraping.start')" size="sm" variant="secondary" @click="startJob(row.id)" /><DhButton :icon="CheckCircle2" size="sm" variant="ghost" @click="completeJob(row.id)" /><DhButton :icon="XCircle" size="sm" variant="ghost" @click="failJob(row.id)" /><DhButton :label="t('common.cancel')" size="sm" variant="ghost" @click="cancelJob(row.id)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'runs'" :columns="runColumns" :rows="runs" :loading="loading" :empty-text="t('scraping.emptyRuns')" @row-click="inspect">
          <template #cell-statusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Play" :label="t('scraping.start')" size="sm" variant="secondary" @click="startRun(row.id)" /><DhButton :label="t('scraping.retry')" size="sm" variant="ghost" @click="retryRun(row.id)" /><DhButton :icon="CheckCircle2" size="sm" variant="ghost" @click="completeRun(row.id)" /><DhButton :icon="XCircle" size="sm" variant="ghost" @click="failRun(row)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'rules'" :columns="ruleColumns" :rows="rules" :loading="loading" :empty-text="t('scraping.emptyRules')" @row-click="inspect">
          <template #cell-statusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-minimumConfidenceScore="{ value }">{{ value ?? 0 }}%</template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Eye" size="sm" variant="ghost" @click="inspect(row)" /><DhButton :icon="Pencil" size="sm" variant="ghost" @click="editRule(row)" /><DhButton :label="t('scraping.approve')" size="sm" variant="secondary" @click="approveRule(row)" /><DhButton :label="t('scraping.reject')" size="sm" variant="ghost" @click="rejectRule(row)" /><DhButton :icon="Trash2" size="sm" variant="danger" @click="deleteRule(row)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'evidences'" :columns="evidenceColumns" :rows="evidences" :loading="loading" :empty-text="t('scraping.emptyEvidences')" @row-click="inspect">
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :icon="Eye" size="sm" variant="ghost" @click="inspect(row)" /><DhButton :icon="Trash2" size="sm" variant="danger" @click="deleteEvidence(row)" /></div></template>
        </DhDataTable>

        <DhDataTable v-if="activeModule === 'candidates'" :columns="candidateColumns" :rows="candidates" :loading="loading" :empty-text="t('scraping.emptyCandidates')" @row-click="inspect">
          <template #cell-route="{ row }">{{ routeLabel(row) }}</template>
          <template #cell-confidenceScore="{ value }">{{ value ?? 0 }}%</template>
          <template #cell-statusName="{ value }"><DhBadge :label="String(value ?? '—')" :variant="statusVariant(String(value))" /></template>
          <template #cell-actions="{ row }"><div class="flex justify-end gap-1" @click.stop><DhButton :label="t('scraping.normalize')" size="sm" variant="secondary" @click="normalizeCandidate(row)" /><DhButton :label="t('scraping.approve')" size="sm" variant="secondary" @click="approveCandidate(row.id)" /><DhButton :label="t('scraping.reject')" size="sm" variant="ghost" @click="rejectCandidate(row.id)" /><DhButton :label="t('scraping.sendToPricing')" size="sm" variant="ghost" @click="sendCandidateToPricing(row)" /></div></template>
        </DhDataTable>
      </section>

      <aside class="space-y-4">
        <section class="dh-glass dh-liquid rounded-[32px] p-5">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div><h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.editor') }}</h2><p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.editorHint') }}</p></div>
            <DhButton :icon="RefreshCcw" :label="t('common.clear')" size="sm" variant="ghost" @click="resetSourceForm(); resetCredentialForm(); resetRuleForm(); selectedRecord = null" />
          </div>

          <div v-if="activeModule === 'sources'" class="grid gap-3 md:grid-cols-2">
            <DhInput v-model="sourceForm.code" :disabled="Boolean(sourceForm.id)" :label="t('scraping.sourceCode')" placeholder="MAERSK" />
            <DhInput v-model="sourceForm.name" :label="t('scraping.sourceName')" placeholder="Maersk Spot" />
            <DhSelect v-model="sourceForm.carrierCatalogItemId" class="md:col-span-2" :label="t('scraping.carrier')" :placeholder="t('scraping.selectFromConfig')" :options="carrierOptions" @update:model-value="applyCarrierToSource" />
            <DhInput v-model="sourceForm.baseUrl" class="md:col-span-2" :label="t('scraping.baseUrl')" placeholder="https://www.maersk.com" />
            <DhSelect v-model="sourceForm.sourceType" :label="t('scraping.sourceType')" :options="sourceTypeOptions" />
            <DhSwitch v-model="sourceForm.requiresLogin" :label="t('scraping.requiresLogin')" />
            <DhInput v-model="sourceForm.navigationUrl" class="md:col-span-2" :label="t('scraping.navigationUrl')" placeholder="https://www.maersk.com/spot/search" />
            <DhInput v-model="sourceForm.waitForSelector" class="md:col-span-2" :label="t('scraping.waitForSelector')" placeholder=".rate-table" />
            <DhTextarea v-model="sourceForm.navigationStepsJson" class="md:col-span-2" :label="t('scraping.navigationSteps')" :rows="5" />
            <DhTextarea v-model="sourceForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Save" :label="sourceForm.id ? t('common.save') : t('scraping.saveSource')" :loading="saving" @click="saveSource" /></div>
          </div>

          <div v-if="activeModule === 'credentials'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="credentialForm.scrapingSourceId" class="md:col-span-2" :label="t('scraping.source')" :placeholder="t('scraping.selectSource')" :options="sourceOptions" />
            <DhSelect v-model="credentialForm.authenticationMode" :label="t('scraping.authMode')" :options="authenticationModeOptions" />
            <DhInput v-model="credentialForm.username" :label="t('scraping.username')" />
            <DhInput v-if="!credentialForm.id" v-model="credentialForm.secretReference" class="md:col-span-2" :label="t('scraping.secretReference')" />
            <DhInput v-model="credentialForm.expiresAt" :label="t('scraping.expiresAt')" placeholder="2026-12-31T00:00:00Z" />
            <DhTextarea v-model="credentialForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Save" :label="credentialForm.id ? t('common.save') : t('scraping.saveCredential')" :loading="saving" @click="saveCredential" /></div>
          </div>

          <div v-if="activeModule === 'jobs'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="jobForm.scrapingSourceId" class="md:col-span-2" :label="t('scraping.source')" :placeholder="t('scraping.selectSource')" :options="sourceOptions" />
            <DhSelect v-model="jobForm.carrierCatalogItemId" class="md:col-span-2" :label="t('scraping.carrier')" :placeholder="t('scraping.selectFromConfig')" :options="carrierOptions" @update:model-value="applyJobCarrier" />
            <DhSelect v-model="jobForm.portOfLoadingCatalogItemId" :label="t('scraping.originPort')" :options="portOptions" @update:model-value="applyPol" />
            <DhSelect v-model="jobForm.portOfDischargeCatalogItemId" :label="t('scraping.destinationPort')" :options="portOptions" @update:model-value="applyPod" />
            <DhSelect v-model="jobForm.containerTypeCatalogItemId" :label="t('scraping.container')" :options="containerOptions" @update:model-value="applyContainer" />
            <DhInput v-model="jobForm.scheduledAtUtc" :label="t('scraping.scheduledAt')" type="datetime-local" />
            <div class="md:col-span-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4">
              <p class="text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]">{{ t('scraping.readyDate') }}</p>
              <p class="mt-1 text-lg font-black text-[var(--dh-text)]">{{ dynamicReadyDate }}</p>
              <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.readyDateDynamicHint') }}</p>
            </div>

            <div class="md:col-span-2">
              <DhButton
                :label="showAdvancedJobFields ? t('scraping.hideJobAdvancedFields') : t('scraping.showJobAdvancedFields')"
                size="sm"
                variant="secondary"
                @click="showAdvancedJobFields = !showAdvancedJobFields"
              />
            </div>

            <template v-if="showAdvancedJobFields">
              <DhSelect v-model="jobForm.portOfEntryCatalogItemId" :label="t('scraping.entryPort')" :placeholder="t('scraping.optional')" :options="portOptions" @update:model-value="applyPoe" />
              <DhInput v-model="jobForm.weightKg" :label="t('scraping.weightKg')" type="number" />
              <DhInput v-model="jobForm.commodity" class="md:col-span-2" :label="t('scraping.commodity')" />
              <DhSelect v-model="jobForm.triggerType" :label="t('scraping.triggerType')" :options="triggerTypeOptions" />
              <DhTextarea v-model="jobForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            </template>

            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Route" :label="t('scraping.saveJob')" :loading="saving" @click="createJob" /></div>
          </div>

          <div v-if="activeModule === 'runs'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="runForm.scrapingJobId" class="md:col-span-2" :label="t('scraping.job')" :options="jobOptions" />
            <DhSelect v-model="runForm.scrapingSourceId" :label="t('scraping.source')" :options="sourceOptions" />
            <DhSelect v-model="runForm.scrapingCredentialId" :label="t('scraping.credential')" :placeholder="t('scraping.noCredential')" :options="credentialOptions" />
            <DhInput v-model="runForm.correlationId" class="md:col-span-2" :label="t('scraping.correlationId')" />
            <DhTextarea v-model="runForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Activity" :label="t('scraping.saveRun')" :loading="saving" @click="createRun" /></div>
          </div>

          <div v-if="activeModule === 'rules'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="ruleForm.scrapingSourceId" class="md:col-span-2" :label="t('scraping.source')" :options="sourceOptions" />
            <DhInput v-model="ruleForm.fieldName" :disabled="Boolean(ruleForm.id)" :label="t('scraping.fieldName')" />
            <DhInput v-model="ruleForm.displayName" :label="t('scraping.displayName')" />
            <DhSelect v-model="ruleForm.ruleType" :label="t('scraping.ruleType')" :options="ruleTypeOptions" />
            <DhInput v-model="ruleForm.minimumConfidenceScore" :label="t('scraping.minimumConfidence')" type="number" />
            <DhTextarea v-model="ruleForm.expression" class="md:col-span-2" :label="t('scraping.expression')" :rows="3" />
            <DhTextarea v-model="ruleForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Save" :label="ruleForm.id ? t('common.save') : t('scraping.saveRule')" :loading="saving" @click="saveRule" /></div>
          </div>

          <div v-if="activeModule === 'evidences'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="evidenceForm.scrapingRunId" class="md:col-span-2" :label="t('scraping.run')" :options="runOptions" />
            <DhSelect v-model="evidenceForm.scrapingSourceId" :label="t('scraping.source')" :options="sourceOptions" />
            <DhSelect v-model="evidenceForm.evidenceType" :label="t('scraping.evidenceType')" :options="evidenceTypeOptions" />
            <DhInput v-model="evidenceForm.storageObjectKey" class="md:col-span-2" :label="t('scraping.storageKey')" />
            <DhInput v-model="evidenceForm.fileName" :label="t('scraping.fileName')" />
            <DhInput v-model="evidenceForm.contentType" :label="t('scraping.contentType')" />
            <DhTextarea v-model="evidenceForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="FileJson" :label="t('scraping.saveEvidence')" :loading="saving" @click="createEvidence" /></div>
          </div>

          <div v-if="activeModule === 'candidates'" class="grid gap-3 md:grid-cols-2">
            <DhSelect v-model="candidateForm.scrapingRunId" :label="t('scraping.run')" :options="runOptions" />
            <DhSelect v-model="candidateForm.scrapingSourceId" :label="t('scraping.source')" :options="sourceOptions" />
            <DhSelect v-model="candidateForm.scrapedEvidenceId" :label="t('scraping.evidence')" :placeholder="t('scraping.noEvidence')" :options="evidenceOptions" />
            <DhSelect v-model="candidateForm.currencyCatalogItemId" :label="t('scraping.currency')" :options="currencyOptions" @update:model-value="applyCurrency" />
            <DhInput v-model="candidateForm.confidenceScore" :label="t('scraping.confidence')" type="number" />
            <DhInput v-model="candidateForm.validFrom" :label="t('scraping.validFrom')" />
            <DhInput v-model="candidateForm.validTo" :label="t('scraping.validTo')" />
            <DhTextarea v-model="candidateForm.rawJson" class="md:col-span-2" :label="t('scraping.rawJson')" :rows="5" />
            <DhTextarea v-model="candidateForm.metadataJson" class="md:col-span-2" :label="t('scraping.metadataJson')" :rows="3" />
            <div class="md:col-span-2 flex justify-end"><DhButton :icon="Database" :label="t('scraping.saveCandidate')" :loading="saving" @click="createCandidate" /></div>
          </div>
        </section>

        <section class="dh-glass dh-liquid rounded-[32px] p-5">
          <h2 class="text-lg font-black text-[var(--dh-text)]">{{ t('scraping.detail') }}</h2>
          <p class="mt-1 text-xs font-semibold text-[var(--dh-text-muted)]">{{ t('scraping.detailHint') }}</p>
          <pre class="dh-scrollbar mt-4 max-h-[26rem] overflow-auto rounded-[24px] border border-[var(--dh-border)] bg-black/[0.04] p-4 text-xs font-semibold text-[var(--dh-text-soft)] dark:bg-white/[0.04]">{{ selectedRecord ? JSON.stringify(selectedRecord, null, 2) : t('scraping.noSelection') }}</pre>
        </section>
      </aside>
    </div>
  </section>
</template>
