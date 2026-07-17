import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Activity, CheckCircle2, Database, Eye, FileJson, Globe2, KeyRound, Pencil, Play, Plus, RefreshCcw, RotateCcw, Route, Save, Search, ShieldCheck, Trash2, XCircle, } from 'lucide-vue-next';
import { DhBadge, DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms';
import { DhDataTable } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { CatalogItemsService } from '@/core/services/catalogItemsService';
import { ScrapingService } from '@/core/services/scrapingService';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const toastStore = useToastStore();
const loading = ref(false);
const saving = ref(false);
const catalogLoading = ref(false);
const activeModule = ref('jobs');
const selectedRecord = ref(null);
const showCatalogSettings = ref(false);
const showAdvancedModules = ref(false);
const showAdvancedJobFields = ref(false);
const sources = ref([]);
const credentials = ref([]);
const jobs = ref([]);
const runs = ref([]);
const evidences = ref([]);
const candidates = ref([]);
const rules = ref([]);
const carriers = ref([]);
const ports = ref([]);
const containerTypes = ref([]);
const currencies = ref([]);
const catalogSlugs = reactive({
    carriers: localStorage.getItem('dhole.scraping.slug.carriers') || 'carriers',
    ports: localStorage.getItem('dhole.scraping.slug.ports') || 'ports',
    containerTypes: localStorage.getItem('dhole.scraping.slug.containerTypes') || 'container-types',
    currencies: localStorage.getItem('dhole.scraping.slug.currencies') || 'currencies',
});
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
});
const credentialForm = reactive({
    id: '',
    scrapingSourceId: '',
    authenticationMode: '1',
    username: '',
    secretReference: '',
    expiresAt: '',
    metadataJson: '{"createdFrom":"DholeWeb"}',
});
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
});
const runForm = reactive({
    scrapingJobId: '',
    scrapingSourceId: '',
    scrapingCredentialId: '',
    correlationId: '',
    metadataJson: '{"createdFrom":"DholeWeb"}',
});
const ruleForm = reactive({
    id: '',
    scrapingSourceId: '',
    fieldName: 'rateAmount',
    displayName: 'Monto de tarifa',
    ruleType: '1',
    expression: '.rate, [data-rate]',
    minimumConfidenceScore: '70',
    metadataJson: '{"createdFrom":"DholeWeb"}',
});
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
});
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
});
const sourceTypeOptions = computed(() => [
    { value: 1, label: t('scraping.types.source.webPage') },
    { value: 2, label: t('scraping.types.source.portal') },
    { value: 3, label: t('scraping.types.source.fileDownload') },
    { value: 4, label: t('scraping.types.source.api') },
]);
const authenticationModeOptions = computed(() => [
    { value: 1, label: t('scraping.types.auth.none') },
    { value: 2, label: t('scraping.types.auth.basic') },
    { value: 3, label: t('scraping.types.auth.formLogin') },
    { value: 4, label: t('scraping.types.auth.token') },
    { value: 5, label: t('scraping.types.auth.cookie') },
]);
const triggerTypeOptions = computed(() => [
    { value: 1, label: t('scraping.types.trigger.manual') },
    { value: 2, label: t('scraping.types.trigger.scheduled') },
    { value: 3, label: t('scraping.types.trigger.retry') },
    { value: 4, label: t('scraping.types.trigger.system') },
]);
const evidenceTypeOptions = computed(() => [
    { value: 1, label: 'HTML' },
    { value: 2, label: t('scraping.types.evidence.screenshot') },
    { value: 3, label: 'PDF' },
    { value: 4, label: 'Excel' },
    { value: 5, label: 'JSON' },
    { value: 6, label: t('scraping.types.evidence.text') },
]);
const ruleTypeOptions = computed(() => [
    { value: 1, label: 'CSS selector' },
    { value: 2, label: 'XPath' },
    { value: 3, label: 'Regex' },
    { value: 4, label: 'JSONPath' },
    { value: 5, label: t('scraping.types.rule.tableColumn') },
    { value: 6, label: t('scraping.types.rule.aiSuggested') },
]);
const runFailureOptions = computed(() => [
    { value: 1, label: t('scraping.types.failure.loginFailed') },
    { value: 2, label: t('scraping.types.failure.captchaDetected') },
    { value: 3, label: t('scraping.types.failure.timeout') },
    { value: 4, label: t('scraping.types.failure.htmlChanged') },
    { value: 5, label: t('scraping.types.failure.downloadFailed') },
    { value: 6, label: t('scraping.types.failure.noRatesFound') },
    { value: 7, label: t('scraping.types.failure.normalizationFailed') },
    { value: 99, label: t('scraping.types.failure.unexpectedError') },
]);
const moduleItems = computed(() => [
    { key: 'jobs', label: t('scraping.jobs'), hint: t('scraping.jobsHint'), count: jobs.value.length, icon: Route },
    { key: 'runs', label: t('scraping.runs'), hint: t('scraping.runsHint'), count: runs.value.length, icon: Activity },
    { key: 'sources', label: t('scraping.sources'), hint: t('scraping.sourcesHint'), count: sources.value.length, icon: Globe2 },
    { key: 'credentials', label: t('scraping.credentials'), hint: t('scraping.credentialsHint'), count: credentials.value.length, icon: KeyRound },
    { key: 'rules', label: t('scraping.extractionRules'), hint: t('scraping.rulesHint'), count: rules.value.length, icon: ShieldCheck },
    { key: 'evidences', label: t('scraping.evidences'), hint: t('scraping.evidencesHint'), count: evidences.value.length, icon: FileJson },
    { key: 'candidates', label: t('scraping.rateCandidates'), hint: t('scraping.candidatesHint'), count: candidates.value.length, icon: Database },
]);
const displayedModuleItems = computed(() => {
    if (showAdvancedModules.value) {
        return moduleItems.value;
    }
    return moduleItems.value.filter((item) => ['jobs', 'runs', 'sources', 'credentials'].includes(item.key));
});
const sourceColumns = computed(() => [
    { key: 'name', label: t('common.name') },
    { key: 'carrierName', label: t('scraping.carrier') },
    { key: 'baseUrl', label: t('scraping.baseUrl') },
    { key: 'sourceTypeName', label: t('scraping.sourceType') },
    { key: 'healthStatusName', label: t('common.status') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const credentialColumns = computed(() => [
    { key: 'scrapingSourceName', label: t('scraping.source') },
    { key: 'authenticationModeName', label: t('scraping.authMode') },
    { key: 'username', label: t('scraping.username') },
    { key: 'statusName', label: t('common.status') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const jobColumns = computed(() => [
    { key: 'carrierName', label: t('scraping.carrier') },
    { key: 'route', label: t('scraping.route') },
    { key: 'containerTypeName', label: t('scraping.container') },
    { key: 'readyDate', label: t('scraping.readyDate') },
    { key: 'scheduledAtUtc', label: t('scraping.scheduledAt') },
    { key: 'statusName', label: t('common.status') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const runColumns = computed(() => [
    { key: 'scrapingSourceName', label: t('scraping.source') },
    { key: 'attemptNumber', label: t('scraping.attempt') },
    { key: 'statusName', label: t('common.status') },
    { key: 'extractedRateCount', label: t('scraping.extractedRates'), align: 'center' },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const ruleColumns = computed(() => [
    { key: 'scrapingSourceName', label: t('scraping.source') },
    { key: 'fieldName', label: t('scraping.fieldName') },
    { key: 'ruleTypeName', label: t('scraping.ruleType') },
    { key: 'minimumConfidenceScore', label: t('scraping.minimumConfidence'), align: 'center' },
    { key: 'statusName', label: t('common.status') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const evidenceColumns = computed(() => [
    { key: 'scrapingSourceName', label: t('scraping.source') },
    { key: 'evidenceTypeName', label: t('scraping.evidenceType') },
    { key: 'fileName', label: t('scraping.fileName') },
    { key: 'storageObjectKey', label: t('scraping.storageKey') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const candidateColumns = computed(() => [
    { key: 'carrierName', label: t('scraping.carrier') },
    { key: 'route', label: t('scraping.route') },
    { key: 'currencyName', label: t('scraping.currency') },
    { key: 'confidenceScore', label: t('scraping.confidence'), align: 'center' },
    { key: 'statusName', label: t('common.status') },
    { key: 'actions', label: t('common.actions'), align: 'right' },
]);
const catalogOption = (item) => ({
    label: `${item.label} (${item.code})`,
    value: item.id,
});
const carrierOptions = computed(() => carriers.value.map(catalogOption));
const portOptions = computed(() => ports.value.map(catalogOption));
const containerOptions = computed(() => containerTypes.value.map(catalogOption));
const currencyOptions = computed(() => currencies.value.map(catalogOption));
const dynamicReadyDate = computed(() => nextReadyDate());
const jobsWithDynamicReadyDate = computed(() => jobs.value.map((job) => ({ ...job, readyDate: dynamicReadyDate.value })));
const sourceOptions = computed(() => sources.value.map((source) => ({
    label: `${source.name} (${source.code})`,
    value: source.id,
})));
const credentialOptions = computed(() => credentials.value.map((credential) => ({
    label: `${credential.scrapingSourceName ?? credential.scrapingSourceId} · ${credential.username ?? credential.authenticationModeName}`,
    value: credential.id,
})));
const jobOptions = computed(() => jobs.value.map((job) => ({
    label: `${job.carrierName ?? job.scrapingSourceName ?? job.id} · ${routeLabel(job)}`,
    value: job.id,
})));
const runOptions = computed(() => runs.value.map((run) => ({
    label: `${run.scrapingSourceName ?? run.scrapingSourceId} · #${run.attemptNumber} · ${run.statusName}`,
    value: run.id,
})));
const evidenceOptions = computed(() => evidences.value.map((evidence) => ({
    label: `${evidence.fileName ?? evidence.storageObjectKey} · ${evidence.evidenceTypeName}`,
    value: evidence.id,
})));
const activeSources = computed(() => sources.value.filter((source) => source.isActive).length);
const runningJobs = computed(() => jobs.value.filter((job) => /running|processing|started/i.test(job.statusName)).length);
const failedRuns = computed(() => runs.value.filter((run) => /fail|error/i.test(run.statusName)).length);
const pendingCandidates = computed(() => candidates.value.filter((candidate) => /pending|review|extracted/i.test(candidate.statusName)).length);
watch(() => jobForm.scrapingSourceId, (sourceId) => {
    const source = sources.value.find((item) => item.id === sourceId);
    if (!source)
        return;
    jobForm.carrierCatalogItemId = source.carrierCatalogItemId ?? '';
    jobForm.carrierCode = source.carrierCode ?? source.code;
    jobForm.carrierName = source.carrierName ?? source.name;
});
watch(() => runForm.scrapingJobId, (jobId) => {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job)
        return;
    runForm.scrapingSourceId = job.scrapingSourceId ?? '';
});
watch(() => evidenceForm.scrapingRunId, (runId) => {
    const run = runs.value.find((item) => item.id === runId);
    if (!run)
        return;
    evidenceForm.scrapingSourceId = run.scrapingSourceId;
});
watch(() => candidateForm.scrapingRunId, (runId) => {
    const run = runs.value.find((item) => item.id === runId);
    if (!run)
        return;
    candidateForm.scrapingSourceId = run.scrapingSourceId;
    const job = jobs.value.find((item) => item.id === run.scrapingJobId);
    if (!job)
        return;
    candidateForm.carrierCatalogItemId = job.carrierCatalogItemId ?? '';
    candidateForm.carrierCode = job.carrierCode ?? '';
    candidateForm.carrierName = job.carrierName ?? '';
    candidateForm.portOfLoadingCatalogItemId = job.portOfLoadingCatalogItemId ?? '';
    candidateForm.portOfLoadingCode = job.portOfLoadingCode ?? '';
    candidateForm.portOfLoadingName = job.portOfLoadingName ?? '';
    candidateForm.portOfEntryCatalogItemId = job.portOfEntryCatalogItemId ?? '';
    candidateForm.portOfEntryCode = job.portOfEntryCode ?? '';
    candidateForm.portOfEntryName = job.portOfEntryName ?? '';
    candidateForm.portOfDischargeCatalogItemId = job.portOfDischargeCatalogItemId ?? '';
    candidateForm.portOfDischargeCode = job.portOfDischargeCode ?? '';
    candidateForm.portOfDischargeName = job.portOfDischargeName ?? '';
    candidateForm.containerTypeCatalogItemId = job.containerTypeCatalogItemId ?? '';
    candidateForm.containerTypeCode = job.containerTypeCode ?? '';
    candidateForm.containerTypeName = job.containerTypeName ?? '';
});
function nextReadyDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function routeLabel(row) {
    const origin = row.portOfLoadingName || row.portOfLoadingCode || '—';
    const entry = row.portOfEntryName || row.portOfEntryCode;
    const destination = row.portOfDischargeName || row.portOfDischargeCode || '—';
    return entry ? `${origin} → ${entry} → ${destination}` : `${origin} → ${destination}`;
}
function statusVariant(value) {
    const status = String(value ?? '').toLowerCase();
    if (status.includes('fail') || status.includes('error') || status.includes('reject') || status.includes('broken'))
        return 'danger';
    if (status.includes('active') || status.includes('complete') || status.includes('approved') || status.includes('healthy'))
        return 'success';
    if (status.includes('review') || status.includes('pending') || status.includes('rotation'))
        return 'warning';
    return 'neutral';
}
function emptyToNull(value) {
    return value.trim() || null;
}
function numberOrNull(value) {
    if (!value.trim())
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function dateTimeLocalToIso(value) {
    if (!value.trim())
        return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function confirmAction(message) {
    return window.confirm(message);
}
function parseJson(value) {
    if (!value.trim())
        return null;
    return JSON.parse(value);
}
function safeMetadata(value) {
    try {
        const parsed = parseJson(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch {
        return {};
    }
}
function composeSourceMetadata() {
    const metadata = safeMetadata(sourceForm.metadataJson);
    if (sourceForm.navigationUrl.trim()) {
        metadata.targetUrl = sourceForm.navigationUrl.trim();
    }
    if (sourceForm.waitForSelector.trim()) {
        metadata.readySelector = sourceForm.waitForSelector.trim();
    }
    try {
        if (sourceForm.navigationStepsJson.trim()) {
            metadata.navigationSteps = parseJson(sourceForm.navigationStepsJson);
        }
    }
    catch {
        metadata.navigationStepsRaw = sourceForm.navigationStepsJson.trim();
    }
    metadata.reuseSession = metadata.reuseSession ?? true;
    metadata.storageStateEnabled = metadata.storageStateEnabled ?? true;
    metadata.updatedFrom = 'DholeWeb';
    return JSON.stringify(metadata, null, 2);
}
function findItem(items, id) {
    return items.find((item) => item.id === id) ?? null;
}
function applyCarrierToSource(id) {
    const item = findItem(carriers.value, String(id ?? ''));
    if (!item)
        return;
    sourceForm.carrierCatalogItemId = item.id;
    sourceForm.carrierCode = item.code;
    sourceForm.carrierName = item.label;
}
function applyCatalogToObject(target, item, idKey, codeKey, nameKey) {
    if (!item)
        return;
    target[idKey] = item.id;
    target[codeKey] = item.code;
    target[nameKey] = item.label;
}
function applyJobCarrier(id) {
    applyCatalogToObject(jobForm, findItem(carriers.value, String(id ?? '')), 'carrierCatalogItemId', 'carrierCode', 'carrierName');
}
function applyPol(id) {
    applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfLoadingCatalogItemId', 'portOfLoadingCode', 'portOfLoadingName');
}
function applyPoe(id) {
    applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfEntryCatalogItemId', 'portOfEntryCode', 'portOfEntryName');
}
function applyPod(id) {
    applyCatalogToObject(jobForm, findItem(ports.value, String(id ?? '')), 'portOfDischargeCatalogItemId', 'portOfDischargeCode', 'portOfDischargeName');
}
function applyContainer(id) {
    applyCatalogToObject(jobForm, findItem(containerTypes.value, String(id ?? '')), 'containerTypeCatalogItemId', 'containerTypeCode', 'containerTypeName');
}
function applyCurrency(id) {
    applyCatalogToObject(candidateForm, findItem(currencies.value, String(id ?? '')), 'currencyCatalogItemId', 'currencyCode', 'currencyName');
}
async function loadCatalogs() {
    try {
        catalogLoading.value = true;
        localStorage.setItem('dhole.scraping.slug.carriers', catalogSlugs.carriers);
        localStorage.setItem('dhole.scraping.slug.ports', catalogSlugs.ports);
        localStorage.setItem('dhole.scraping.slug.containerTypes', catalogSlugs.containerTypes);
        localStorage.setItem('dhole.scraping.slug.currencies', catalogSlugs.currencies);
        const [carrierItems, portItems, containerItems, currencyItems] = await Promise.all([
            CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.carriers }),
            CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.ports }),
            CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.containerTypes }),
            CatalogItemsService.select({ catalogGroupSlug: catalogSlugs.currencies }),
        ]);
        carriers.value = carrierItems;
        ports.value = portItems;
        containerTypes.value = containerItems;
        currencies.value = currencyItems;
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.catalogLoadError'));
    }
    finally {
        catalogLoading.value = false;
    }
}
async function load() {
    try {
        loading.value = true;
        const [sourcesResult, credentialsResult, jobsResult, runsResult, evidencesResult, candidatesResult, rulesResult] = await Promise.all([
            ScrapingService.browseSources({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseCredentials({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseJobs({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseRuns({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseEvidences({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseRateCandidates({ pageNumber: 1, pageSize: 50 }),
            ScrapingService.browseExtractionRules({ pageNumber: 1, pageSize: 50 }),
        ]);
        sources.value = sourcesResult.items;
        credentials.value = credentialsResult.items;
        jobs.value = jobsResult.items;
        runs.value = runsResult.items;
        evidences.value = evidencesResult.items;
        candidates.value = candidatesResult.items;
        rules.value = rulesResult.items;
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.loadError'));
    }
    finally {
        loading.value = false;
    }
}
function inspect(row) {
    selectedRecord.value = row;
}
function resetSourceForm() {
    Object.assign(sourceForm, {
        id: '', code: '', name: '', carrierCatalogItemId: '', carrierCode: '', carrierName: '', baseUrl: '', sourceType: '1', requiresLogin: false,
        navigationUrl: '', waitForSelector: '', navigationStepsJson: '[\n  { "action": "waitForSelector", "selector": ".rate-table" }\n]', metadataJson: '{"createdFrom":"DholeWeb"}',
    });
}
function editSource(row) {
    activeModule.value = 'sources';
    const metadata = safeMetadata(row.metadataJson ?? '{}');
    const navigation = metadata.navigation && typeof metadata.navigation === 'object'
        ? metadata.navigation
        : {};
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
    });
    inspect(row);
}
async function saveSource() {
    if (!sourceForm.code.trim() || !sourceForm.name.trim() || !sourceForm.baseUrl.trim()) {
        toastStore.error(t('common.error'), t('scraping.requiredSourceFields'));
        return;
    }
    try {
        saving.value = true;
        const payload = {
            name: sourceForm.name.trim(),
            carrierCatalogItemId: emptyToNull(sourceForm.carrierCatalogItemId),
            carrierCode: emptyToNull(sourceForm.carrierCode),
            carrierName: emptyToNull(sourceForm.carrierName),
            baseUrl: sourceForm.baseUrl.trim(),
            sourceType: Number(sourceForm.sourceType) || 1,
            requiresLogin: sourceForm.requiresLogin,
            metadataJson: composeSourceMetadata(),
        };
        if (sourceForm.id) {
            await ScrapingService.updateSource(sourceForm.id, payload);
            toastStore.success(t('scraping.sourceUpdated'));
        }
        else {
            await ScrapingService.createSource({ code: sourceForm.code.trim(), ...payload });
            toastStore.success(t('scraping.sourceCreated'));
        }
        resetSourceForm();
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.sourceCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function deleteSource(row) {
    if (!confirmAction(t('scraping.confirmDelete')))
        return;
    try {
        await ScrapingService.deleteSource(row.id);
        toastStore.success(t('scraping.deleted'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.deleteError'));
    }
}
async function toggleSource(row) {
    try {
        await ScrapingService.setSourceActive(row.id, !row.isActive);
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.updateError'));
    }
}
function resetCredentialForm() {
    Object.assign(credentialForm, { id: '', scrapingSourceId: '', authenticationMode: '1', username: '', secretReference: '', expiresAt: '', metadataJson: '{"createdFrom":"DholeWeb"}' });
}
function editCredential(row) {
    activeModule.value = 'credentials';
    Object.assign(credentialForm, {
        id: row.id,
        scrapingSourceId: row.scrapingSourceId,
        authenticationMode: String(row.authenticationMode),
        username: row.username ?? '',
        secretReference: '',
        expiresAt: row.expiresAt ?? '',
        metadataJson: row.metadataJson ?? '{}',
    });
    inspect(row);
}
async function saveCredential() {
    if (!credentialForm.scrapingSourceId || (!credentialForm.id && !credentialForm.secretReference.trim())) {
        toastStore.error(t('common.error'), t('scraping.requiredCredentialFields'));
        return;
    }
    try {
        saving.value = true;
        const payload = {
            authenticationMode: Number(credentialForm.authenticationMode) || 1,
            username: emptyToNull(credentialForm.username),
            expiresAt: emptyToNull(credentialForm.expiresAt),
            metadataJson: emptyToNull(credentialForm.metadataJson),
        };
        if (credentialForm.id) {
            await ScrapingService.updateCredential(credentialForm.id, payload);
            toastStore.success(t('scraping.credentialUpdated'));
        }
        else {
            await ScrapingService.createCredential({ scrapingSourceId: credentialForm.scrapingSourceId, secretReference: credentialForm.secretReference.trim(), ...payload });
            toastStore.success(t('scraping.credentialCreated'));
        }
        resetCredentialForm();
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.credentialCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function deleteCredential(row) {
    if (!confirmAction(t('scraping.confirmDelete')))
        return;
    try {
        await ScrapingService.deleteCredential(row.id);
        toastStore.success(t('scraping.deleted'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.deleteError'));
    }
}
async function rotateCredential(row) {
    const secretReference = window.prompt(t('scraping.newSecretReference'));
    if (!secretReference)
        return;
    try {
        await ScrapingService.rotateCredentialSecret(row.id, { secretReference });
        toastStore.success(t('scraping.credentialRotated'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.updateError'));
    }
}
async function toggleCredential(row) {
    try {
        await ScrapingService.setCredentialActive(row.id, !/active/i.test(row.statusName));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.updateError'));
    }
}
async function createJob() {
    if (!jobForm.portOfLoadingCatalogItemId || !jobForm.portOfDischargeCatalogItemId || !jobForm.containerTypeCatalogItemId) {
        toastStore.error(t('common.error'), t('scraping.requiredJobFields'));
        return;
    }
    jobForm.readyDate = nextReadyDate();
    try {
        saving.value = true;
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
        });
        toastStore.success(t('scraping.jobCreated'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.jobCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function startJob(jobId) { try {
    await ScrapingService.startJob(jobId);
    toastStore.success(t('scraping.jobStarted'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.jobStartError'));
} }
async function completeJob(jobId) { try {
    await ScrapingService.completeJob(jobId);
    toastStore.success(t('scraping.jobCompleted'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function cancelJob(jobId) { try {
    await ScrapingService.cancelJob(jobId, { reason: t('scraping.cancelledFromWeb') });
    toastStore.success(t('scraping.jobCancelled'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.jobCancelError'));
} }
async function failJob(jobId) {
    const failureMessage = window.prompt(t('scraping.failureMessage'));
    if (!failureMessage)
        return;
    try {
        await ScrapingService.failJob(jobId, { failureReason: 'ManualFailure', failureMessage });
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.updateError'));
    }
}
async function createRun() {
    if (!runForm.scrapingJobId || !runForm.scrapingSourceId) {
        toastStore.error(t('common.error'), t('scraping.requiredRunFields'));
        return;
    }
    try {
        saving.value = true;
        await ScrapingService.createRun({
            scrapingJobId: runForm.scrapingJobId,
            scrapingSourceId: runForm.scrapingSourceId,
            scrapingCredentialId: emptyToNull(runForm.scrapingCredentialId),
            correlationId: emptyToNull(runForm.correlationId),
            metadataJson: emptyToNull(runForm.metadataJson),
        });
        toastStore.success(t('scraping.runCreated'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.runCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function startRun(runId) { try {
    await ScrapingService.startRun(runId);
    toastStore.success(t('scraping.runStarted'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.runStartError'));
} }
async function completeRun(runId) { try {
    await ScrapingService.completeRun(runId, { extractedRateCount: 0, evidenceCount: 0, outputSummaryJson: null, metadataJson: null });
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function retryRun(runId) { try {
    await ScrapingService.retryRun(runId, t('scraping.retryFromWeb'));
    toastStore.success(t('scraping.runRetried'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.runRetryError'));
} }
async function failRun(row) {
    const reason = window.prompt(`${t('scraping.failureReason')} (${runFailureOptions.value.map(x => `${x.value}: ${x.label}`).join(', ')})`, '99');
    const message = window.prompt(t('scraping.failureMessage'), 'Manual failure');
    if (!reason || !message)
        return;
    try {
        await ScrapingService.failRun(row.id, { failureReason: Number(reason) || 99, failureMessage: message, metadataJson: null });
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.updateError'));
    }
}
function resetRuleForm() { Object.assign(ruleForm, { id: '', scrapingSourceId: '', fieldName: 'rateAmount', displayName: 'Monto de tarifa', ruleType: '1', expression: '.rate, [data-rate]', minimumConfidenceScore: '70', metadataJson: '{"createdFrom":"DholeWeb"}' }); }
function editRule(row) { activeModule.value = 'rules'; Object.assign(ruleForm, { id: row.id, scrapingSourceId: row.scrapingSourceId, fieldName: row.fieldName, displayName: row.displayName, ruleType: String(row.ruleType), expression: row.expression, minimumConfidenceScore: String(row.minimumConfidenceScore), metadataJson: row.metadataJson ?? '{}' }); inspect(row); }
async function saveRule() {
    if (!ruleForm.scrapingSourceId || !ruleForm.fieldName.trim() || !ruleForm.expression.trim()) {
        toastStore.error(t('common.error'), t('scraping.requiredRuleFields'));
        return;
    }
    try {
        saving.value = true;
        const payload = { displayName: ruleForm.displayName.trim() || ruleForm.fieldName.trim(), ruleType: Number(ruleForm.ruleType) || 1, expression: ruleForm.expression.trim(), minimumConfidenceScore: Number(ruleForm.minimumConfidenceScore) || 70, metadataJson: emptyToNull(ruleForm.metadataJson) };
        if (ruleForm.id) {
            await ScrapingService.updateExtractionRule(ruleForm.id, payload);
            toastStore.success(t('scraping.ruleUpdated'));
        }
        else {
            await ScrapingService.createExtractionRule({ scrapingSourceId: ruleForm.scrapingSourceId, fieldName: ruleForm.fieldName.trim(), ...payload });
            toastStore.success(t('scraping.ruleCreated'));
        }
        resetRuleForm();
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.ruleCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function deleteRule(row) { if (!confirmAction(t('scraping.confirmDelete')))
    return; try {
    await ScrapingService.deleteExtractionRule(row.id);
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.deleteError'));
} }
async function toggleRule(row) { try {
    await ScrapingService.setExtractionRuleActive(row.id, !/active/i.test(row.statusName));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function approveRule(row) { try {
    await ScrapingService.approveExtractionRule(row.id, t('scraping.approvedFromWeb'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function rejectRule(row) { const reason = window.prompt(t('scraping.rejectionReason')); if (!reason)
    return; try {
    await ScrapingService.rejectExtractionRule(row.id, reason);
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function createEvidence() {
    if (!evidenceForm.scrapingRunId || !evidenceForm.scrapingSourceId || !evidenceForm.storageObjectKey.trim()) {
        toastStore.error(t('common.error'), t('scraping.requiredEvidenceFields'));
        return;
    }
    try {
        saving.value = true;
        await ScrapingService.createEvidence({ scrapingRunId: evidenceForm.scrapingRunId, scrapingSourceId: evidenceForm.scrapingSourceId, evidenceType: Number(evidenceForm.evidenceType) || 1, storageObjectKey: evidenceForm.storageObjectKey.trim(), fileName: emptyToNull(evidenceForm.fileName), contentType: emptyToNull(evidenceForm.contentType), contentHash: emptyToNull(evidenceForm.contentHash), sizeBytes: numberOrNull(evidenceForm.sizeBytes), metadataJson: emptyToNull(evidenceForm.metadataJson) });
        toastStore.success(t('scraping.evidenceCreated'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.evidenceCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function deleteEvidence(row) { if (!confirmAction(t('scraping.confirmDelete')))
    return; try {
    await ScrapingService.deleteEvidence(row.id);
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.deleteError'));
} }
async function createCandidate() {
    if (!candidateForm.scrapingRunId || !candidateForm.scrapingSourceId || !candidateForm.rawJson.trim()) {
        toastStore.error(t('common.error'), t('scraping.requiredCandidateFields'));
        return;
    }
    try {
        saving.value = true;
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
        });
        toastStore.success(t('scraping.candidateCreated'));
        await load();
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.candidateCreateError'));
    }
    finally {
        saving.value = false;
    }
}
async function normalizeCandidate(row) { const normalizedJson = window.prompt(t('scraping.normalizedJson'), row.normalizedJson || row.rawJson || '{}'); if (!normalizedJson)
    return; try {
    await ScrapingService.normalizeRateCandidate(row.id, { normalizedJson, confidenceScore: row.confidenceScore ?? 80, validFrom: row.validFrom ?? null, validTo: row.validTo ?? null });
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
async function approveCandidate(candidateId) { try {
    await ScrapingService.approveRateCandidate(candidateId, t('scraping.approvedFromWeb'));
    toastStore.success(t('scraping.candidateApproved'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.candidateApproveError'));
} }
async function rejectCandidate(candidateId) { const reason = window.prompt(t('scraping.rejectionReason'), t('scraping.rejectedFromWeb')); if (!reason)
    return; try {
    await ScrapingService.rejectRateCandidate(candidateId, reason);
    toastStore.success(t('scraping.candidateRejected'));
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.candidateRejectError'));
} }
async function sendCandidateToPricing(row) { const pricingRateId = window.prompt(t('scraping.pricingRateId')); if (!pricingRateId)
    return; try {
    await ScrapingService.sendRateCandidateToPricing(row.id, { pricingRateId });
    await load();
}
catch (error) {
    toastStore.backendError(error, t('scraping.updateError'));
} }
function toggleAdvancedModules() {
    showAdvancedModules.value = !showAdvancedModules.value;
    if (!showAdvancedModules.value && !['jobs', 'runs', 'sources', 'credentials'].includes(activeModule.value)) {
        activeModule.value = 'jobs';
        selectedRecord.value = null;
    }
}
async function reloadScrapingView() {
    await Promise.all([load(), loadCatalogs()]);
}
useViewShortcuts({
    create: () => {
        selectedRecord.value = null;
    },
    save: reloadScrapingView,
    refresh: reloadScrapingView,
});
onMounted(reloadScrapingView);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: (__VLS_ctx.t('scraping.title')),
    subtitle: (__VLS_ctx.t('scraping.subtitle')),
    icon: (__VLS_ctx.Globe2),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('scraping.title')),
    subtitle: (__VLS_ctx.t('scraping.subtitle')),
    icon: (__VLS_ctx.Globe2),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { actions: __VLS_6 } = __VLS_3.slots;
    let __VLS_7;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.load),
    };
    var __VLS_10;
    var __VLS_11;
    let __VLS_14;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showCatalogSettings ? __VLS_ctx.t('scraping.hideCatalogs') : __VLS_ctx.t('scraping.configureCatalogs')),
        variant: "secondary",
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showCatalogSettings ? __VLS_ctx.t('scraping.hideCatalogs') : __VLS_ctx.t('scraping.configureCatalogs')),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_19;
    const __VLS_20 = {
        /** @type {typeof __VLS_19.click} */
        onClick: (...[$event]) => {
            __VLS_ctx.showCatalogSettings = !__VLS_ctx.showCatalogSettings;
            // @ts-ignore
            [t, t, t, t, t, Globe2, RefreshCcw, load, showCatalogSettings, showCatalogSettings, showCatalogSettings,];
        },
    };
    var __VLS_17;
    var __VLS_18;
    let __VLS_21;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showAdvancedModules ? __VLS_ctx.t('scraping.hideAdvancedModules') : __VLS_ctx.t('scraping.showAdvancedModules')),
        variant: "secondary",
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showAdvancedModules ? __VLS_ctx.t('scraping.hideAdvancedModules') : __VLS_ctx.t('scraping.showAdvancedModules')),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = {
        /** @type {typeof __VLS_26.click} */
        onClick: (__VLS_ctx.toggleAdvancedModules),
    };
    var __VLS_24;
    var __VLS_25;
    let __VLS_28;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        to: "/scraping/manual",
    }));
    const __VLS_30 = __VLS_29({
        to: "/scraping/manual",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    const { default: __VLS_33 } = __VLS_31.slots;
    let __VLS_34;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        icon: (__VLS_ctx.Search),
        label: (__VLS_ctx.t('scraping.manualTitle')),
    }));
    const __VLS_36 = __VLS_35({
        icon: (__VLS_ctx.Search),
        label: (__VLS_ctx.t('scraping.manualTitle')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    // @ts-ignore
    [t, t, t, showAdvancedModules, toggleAdvancedModules, Search,];
    var __VLS_31;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-4 md:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[30px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.activeSources'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.activeSources);
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[30px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.runningJobs'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.runningJobs);
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[30px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.failedRuns'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.failedRuns);
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[30px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.pendingCandidates'));
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "mt-2 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.pendingCandidates);
if (__VLS_ctx.showCatalogSettings) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "dh-glass dh-liquid rounded-[28px] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3 flex flex-wrap items-center justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('scraping.catalogConnection'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.catalogConnectionHint'));
    let __VLS_39;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('scraping.reloadCatalogs')),
        loading: (__VLS_ctx.catalogLoading),
        size: "sm",
        variant: "secondary",
    }));
    const __VLS_41 = __VLS_40({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('scraping.reloadCatalogs')),
        loading: (__VLS_ctx.catalogLoading),
        size: "sm",
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    let __VLS_44;
    const __VLS_45 = {
        /** @type {typeof __VLS_44.click} */
        onClick: (__VLS_ctx.loadCatalogs),
    };
    var __VLS_42;
    var __VLS_43;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
    let __VLS_46;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        modelValue: (__VLS_ctx.catalogSlugs.carriers),
        label: (__VLS_ctx.t('scraping.slugCarriers')),
    }));
    const __VLS_48 = __VLS_47({
        modelValue: (__VLS_ctx.catalogSlugs.carriers),
        label: (__VLS_ctx.t('scraping.slugCarriers')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_51;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
        modelValue: (__VLS_ctx.catalogSlugs.ports),
        label: (__VLS_ctx.t('scraping.slugPorts')),
    }));
    const __VLS_53 = __VLS_52({
        modelValue: (__VLS_ctx.catalogSlugs.ports),
        label: (__VLS_ctx.t('scraping.slugPorts')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_52));
    let __VLS_56;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        modelValue: (__VLS_ctx.catalogSlugs.containerTypes),
        label: (__VLS_ctx.t('scraping.slugContainers')),
    }));
    const __VLS_58 = __VLS_57({
        modelValue: (__VLS_ctx.catalogSlugs.containerTypes),
        label: (__VLS_ctx.t('scraping.slugContainers')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_61;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({
        modelValue: (__VLS_ctx.catalogSlugs.currencies),
        label: (__VLS_ctx.t('scraping.slugCurrencies')),
    }));
    const __VLS_63 = __VLS_62({
        modelValue: (__VLS_ctx.catalogSlugs.currencies),
        label: (__VLS_ctx.t('scraping.slugCurrencies')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_62));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "dh-scrollbar flex gap-2 overflow-x-auto rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-shell)] p-2 shadow-[var(--dh-shadow-sm)]" },
});
/** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-shell)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-2']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.displayedModuleItems))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.activeModule = item.key;
                __VLS_ctx.selectedRecord = null;
                // @ts-ignore
                [t, t, t, t, t, t, t, t, t, t, t, RefreshCcw, showCatalogSettings, activeSources, runningJobs, failedRuns, pendingCandidates, catalogLoading, loadCatalogs, catalogSlugs, catalogSlugs, catalogSlugs, catalogSlugs, displayedModuleItems, activeModule, selectedRecord,];
            } },
        key: (item.key),
        type: "button",
        ...{ class: "flex min-w-[12rem] items-center gap-3 rounded-[22px] px-4 py-3 text-left transition" },
        ...{ class: (__VLS_ctx.activeModule === item.key ? 'bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]' : 'text-[var(--dh-text-soft)] hover:bg-[var(--dh-card-hover)]') },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-w-[12rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    const __VLS_66 = (item.icon);
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({
        ...{ class: "h-5 w-5 shrink-0" },
    }));
    const __VLS_68 = __VLS_67({
        ...{ class: "h-5 w-5 shrink-0" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_67));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "block truncate text-sm font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (item.label);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "block truncate text-xs font-semibold opacity-80" },
    });
    /** @type {__VLS_StyleScopedClasses['block']} */ ;
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['opacity-80']} */ ;
    (item.count);
    (item.hint);
    // @ts-ignore
    [activeModule,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 xl:grid-cols-[1.15fr_0.85fr]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-[1.15fr_0.85fr]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-wrap items-center justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.moduleItems.find((x) => x.key === __VLS_ctx.activeModule)?.label);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.listHint'));
let __VLS_71;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_72 = __VLS_asFunctionalComponent1(__VLS_71, new __VLS_71({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: (__VLS_ctx.t('common.create')),
    size: "sm",
}));
const __VLS_73 = __VLS_72({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    label: (__VLS_ctx.t('common.create')),
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_72));
let __VLS_76;
const __VLS_77 = {
    /** @type {typeof __VLS_76.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.selectedRecord = null;
        // @ts-ignore
        [t, t, activeModule, selectedRecord, moduleItems, Plus,];
    },
};
var __VLS_74;
var __VLS_75;
if (__VLS_ctx.activeModule === 'sources') {
    let __VLS_78;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_79 = __VLS_asFunctionalComponent1(__VLS_78, new __VLS_78({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.sourceColumns),
        rows: (__VLS_ctx.sources),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptySources')),
    }));
    const __VLS_80 = __VLS_79({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.sourceColumns),
        rows: (__VLS_ctx.sources),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptySources')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_79));
    let __VLS_83;
    const __VLS_84 = {
        /** @type {typeof __VLS_83.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_85 } = __VLS_81.slots;
    {
        const { 'cell-baseUrl': __VLS_86 } = __VLS_81.slots;
        const [{ value }] = __VLS_vSlot(__VLS_86);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "line-clamp-1 max-w-[16rem]" },
        });
        /** @type {__VLS_StyleScopedClasses['line-clamp-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-[16rem]']} */ ;
        (value);
        // @ts-ignore
        [t, activeModule, sourceColumns, sources, loading, inspect,];
    }
    {
        const { 'cell-healthStatusName': __VLS_87 } = __VLS_81.slots;
        const [{ value }] = __VLS_vSlot(__VLS_87);
        let __VLS_88;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent1(__VLS_88, new __VLS_88({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_90 = __VLS_89({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
        // @ts-ignore
        [statusVariant,];
    }
    {
        const { 'cell-actions': __VLS_93 } = __VLS_81.slots;
        const [{ row }] = __VLS_vSlot(__VLS_93);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_94;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_95 = __VLS_asFunctionalComponent1(__VLS_94, new __VLS_94({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_96 = __VLS_95({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_95));
        let __VLS_99;
        const __VLS_100 = {
            /** @type {typeof __VLS_99.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'sources'))
                    return;
                __VLS_ctx.inspect(row);
                // @ts-ignore
                [inspect, Eye,];
            },
        };
        var __VLS_97;
        var __VLS_98;
        let __VLS_101;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_102 = __VLS_asFunctionalComponent1(__VLS_101, new __VLS_101({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_103 = __VLS_102({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_102));
        let __VLS_106;
        const __VLS_107 = {
            /** @type {typeof __VLS_106.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'sources'))
                    return;
                __VLS_ctx.editSource(row);
                // @ts-ignore
                [Pencil, editSource,];
            },
        };
        var __VLS_104;
        var __VLS_105;
        let __VLS_108;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent1(__VLS_108, new __VLS_108({
            ...{ 'onClick': {} },
            label: (row.isActive ? __VLS_ctx.t('common.inactivate') : __VLS_ctx.t('common.activate')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_110 = __VLS_109({
            ...{ 'onClick': {} },
            label: (row.isActive ? __VLS_ctx.t('common.inactivate') : __VLS_ctx.t('common.activate')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_109));
        let __VLS_113;
        const __VLS_114 = {
            /** @type {typeof __VLS_113.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'sources'))
                    return;
                __VLS_ctx.toggleSource(row);
                // @ts-ignore
                [t, t, toggleSource,];
            },
        };
        var __VLS_111;
        var __VLS_112;
        let __VLS_115;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }));
        const __VLS_117 = __VLS_116({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_116));
        let __VLS_120;
        const __VLS_121 = {
            /** @type {typeof __VLS_120.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'sources'))
                    return;
                __VLS_ctx.deleteSource(row);
                // @ts-ignore
                [Trash2, deleteSource,];
            },
        };
        var __VLS_118;
        var __VLS_119;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_81;
    var __VLS_82;
}
if (__VLS_ctx.activeModule === 'credentials') {
    let __VLS_122;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_123 = __VLS_asFunctionalComponent1(__VLS_122, new __VLS_122({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.credentialColumns),
        rows: (__VLS_ctx.credentials),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyCredentials')),
    }));
    const __VLS_124 = __VLS_123({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.credentialColumns),
        rows: (__VLS_ctx.credentials),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyCredentials')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_123));
    let __VLS_127;
    const __VLS_128 = {
        /** @type {typeof __VLS_127.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_129 } = __VLS_125.slots;
    {
        const { 'cell-statusName': __VLS_130 } = __VLS_125.slots;
        const [{ value }] = __VLS_vSlot(__VLS_130);
        let __VLS_131;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_132 = __VLS_asFunctionalComponent1(__VLS_131, new __VLS_131({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_133 = __VLS_132({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_132));
        // @ts-ignore
        [t, activeModule, loading, inspect, statusVariant, credentialColumns, credentials,];
    }
    {
        const { 'cell-actions': __VLS_136 } = __VLS_125.slots;
        const [{ row }] = __VLS_vSlot(__VLS_136);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_137;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_138 = __VLS_asFunctionalComponent1(__VLS_137, new __VLS_137({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_139 = __VLS_138({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_138));
        let __VLS_142;
        const __VLS_143 = {
            /** @type {typeof __VLS_142.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'credentials'))
                    return;
                __VLS_ctx.inspect(row);
                // @ts-ignore
                [inspect, Eye,];
            },
        };
        var __VLS_140;
        var __VLS_141;
        let __VLS_144;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_145 = __VLS_asFunctionalComponent1(__VLS_144, new __VLS_144({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_146 = __VLS_145({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_145));
        let __VLS_149;
        const __VLS_150 = {
            /** @type {typeof __VLS_149.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'credentials'))
                    return;
                __VLS_ctx.editCredential(row);
                // @ts-ignore
                [Pencil, editCredential,];
            },
        };
        var __VLS_147;
        var __VLS_148;
        let __VLS_151;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_152 = __VLS_asFunctionalComponent1(__VLS_151, new __VLS_151({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.RotateCcw),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_153 = __VLS_152({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.RotateCcw),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_152));
        let __VLS_156;
        const __VLS_157 = {
            /** @type {typeof __VLS_156.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'credentials'))
                    return;
                __VLS_ctx.rotateCredential(row);
                // @ts-ignore
                [RotateCcw, rotateCredential,];
            },
        };
        var __VLS_154;
        var __VLS_155;
        let __VLS_158;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
            ...{ 'onClick': {} },
            label: (/active/i.test(row.statusName) ? __VLS_ctx.t('common.inactivate') : __VLS_ctx.t('common.activate')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_160 = __VLS_159({
            ...{ 'onClick': {} },
            label: (/active/i.test(row.statusName) ? __VLS_ctx.t('common.inactivate') : __VLS_ctx.t('common.activate')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_159));
        let __VLS_163;
        const __VLS_164 = {
            /** @type {typeof __VLS_163.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'credentials'))
                    return;
                __VLS_ctx.toggleCredential(row);
                // @ts-ignore
                [t, t, toggleCredential,];
            },
        };
        var __VLS_161;
        var __VLS_162;
        let __VLS_165;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_166 = __VLS_asFunctionalComponent1(__VLS_165, new __VLS_165({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }));
        const __VLS_167 = __VLS_166({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_166));
        let __VLS_170;
        const __VLS_171 = {
            /** @type {typeof __VLS_170.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'credentials'))
                    return;
                __VLS_ctx.deleteCredential(row);
                // @ts-ignore
                [Trash2, deleteCredential,];
            },
        };
        var __VLS_168;
        var __VLS_169;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_125;
    var __VLS_126;
}
if (__VLS_ctx.activeModule === 'jobs') {
    let __VLS_172;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_173 = __VLS_asFunctionalComponent1(__VLS_172, new __VLS_172({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.jobColumns),
        rows: (__VLS_ctx.jobsWithDynamicReadyDate),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyJobs')),
    }));
    const __VLS_174 = __VLS_173({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.jobColumns),
        rows: (__VLS_ctx.jobsWithDynamicReadyDate),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyJobs')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_173));
    let __VLS_177;
    const __VLS_178 = {
        /** @type {typeof __VLS_177.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_179 } = __VLS_175.slots;
    {
        const { 'cell-route': __VLS_180 } = __VLS_175.slots;
        const [{ row }] = __VLS_vSlot(__VLS_180);
        (__VLS_ctx.routeLabel(row));
        // @ts-ignore
        [t, activeModule, loading, inspect, jobColumns, jobsWithDynamicReadyDate, routeLabel,];
    }
    {
        const { 'cell-statusName': __VLS_181 } = __VLS_175.slots;
        const [{ value }] = __VLS_vSlot(__VLS_181);
        let __VLS_182;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_183 = __VLS_asFunctionalComponent1(__VLS_182, new __VLS_182({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_184 = __VLS_183({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_183));
        // @ts-ignore
        [statusVariant,];
    }
    {
        const { 'cell-actions': __VLS_187 } = __VLS_175.slots;
        const [{ row }] = __VLS_vSlot(__VLS_187);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_188;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_189 = __VLS_asFunctionalComponent1(__VLS_188, new __VLS_188({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Play),
            label: (__VLS_ctx.t('scraping.start')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_190 = __VLS_189({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Play),
            label: (__VLS_ctx.t('scraping.start')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_189));
        let __VLS_193;
        const __VLS_194 = {
            /** @type {typeof __VLS_193.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'jobs'))
                    return;
                __VLS_ctx.startJob(row.id);
                // @ts-ignore
                [t, Play, startJob,];
            },
        };
        var __VLS_191;
        var __VLS_192;
        let __VLS_195;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_197 = __VLS_196({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_196));
        let __VLS_200;
        const __VLS_201 = {
            /** @type {typeof __VLS_200.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'jobs'))
                    return;
                __VLS_ctx.completeJob(row.id);
                // @ts-ignore
                [CheckCircle2, completeJob,];
            },
        };
        var __VLS_198;
        var __VLS_199;
        let __VLS_202;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_203 = __VLS_asFunctionalComponent1(__VLS_202, new __VLS_202({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.XCircle),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_204 = __VLS_203({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.XCircle),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_203));
        let __VLS_207;
        const __VLS_208 = {
            /** @type {typeof __VLS_207.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'jobs'))
                    return;
                __VLS_ctx.failJob(row.id);
                // @ts-ignore
                [XCircle, failJob,];
            },
        };
        var __VLS_205;
        var __VLS_206;
        let __VLS_209;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_210 = __VLS_asFunctionalComponent1(__VLS_209, new __VLS_209({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('common.cancel')),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_211 = __VLS_210({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('common.cancel')),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_210));
        let __VLS_214;
        const __VLS_215 = {
            /** @type {typeof __VLS_214.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'jobs'))
                    return;
                __VLS_ctx.cancelJob(row.id);
                // @ts-ignore
                [t, cancelJob,];
            },
        };
        var __VLS_212;
        var __VLS_213;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_175;
    var __VLS_176;
}
if (__VLS_ctx.activeModule === 'runs') {
    let __VLS_216;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_217 = __VLS_asFunctionalComponent1(__VLS_216, new __VLS_216({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.runColumns),
        rows: (__VLS_ctx.runs),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyRuns')),
    }));
    const __VLS_218 = __VLS_217({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.runColumns),
        rows: (__VLS_ctx.runs),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyRuns')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_217));
    let __VLS_221;
    const __VLS_222 = {
        /** @type {typeof __VLS_221.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_223 } = __VLS_219.slots;
    {
        const { 'cell-statusName': __VLS_224 } = __VLS_219.slots;
        const [{ value }] = __VLS_vSlot(__VLS_224);
        let __VLS_225;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_226 = __VLS_asFunctionalComponent1(__VLS_225, new __VLS_225({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_227 = __VLS_226({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_226));
        // @ts-ignore
        [t, activeModule, loading, inspect, statusVariant, runColumns, runs,];
    }
    {
        const { 'cell-actions': __VLS_230 } = __VLS_219.slots;
        const [{ row }] = __VLS_vSlot(__VLS_230);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_231;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_232 = __VLS_asFunctionalComponent1(__VLS_231, new __VLS_231({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Play),
            label: (__VLS_ctx.t('scraping.start')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_233 = __VLS_232({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Play),
            label: (__VLS_ctx.t('scraping.start')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_232));
        let __VLS_236;
        const __VLS_237 = {
            /** @type {typeof __VLS_236.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'runs'))
                    return;
                __VLS_ctx.startRun(row.id);
                // @ts-ignore
                [t, Play, startRun,];
            },
        };
        var __VLS_234;
        var __VLS_235;
        let __VLS_238;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_239 = __VLS_asFunctionalComponent1(__VLS_238, new __VLS_238({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.retry')),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_240 = __VLS_239({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.retry')),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_239));
        let __VLS_243;
        const __VLS_244 = {
            /** @type {typeof __VLS_243.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'runs'))
                    return;
                __VLS_ctx.retryRun(row.id);
                // @ts-ignore
                [t, retryRun,];
            },
        };
        var __VLS_241;
        var __VLS_242;
        let __VLS_245;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_246 = __VLS_asFunctionalComponent1(__VLS_245, new __VLS_245({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_247 = __VLS_246({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_246));
        let __VLS_250;
        const __VLS_251 = {
            /** @type {typeof __VLS_250.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'runs'))
                    return;
                __VLS_ctx.completeRun(row.id);
                // @ts-ignore
                [CheckCircle2, completeRun,];
            },
        };
        var __VLS_248;
        var __VLS_249;
        let __VLS_252;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_253 = __VLS_asFunctionalComponent1(__VLS_252, new __VLS_252({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.XCircle),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_254 = __VLS_253({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.XCircle),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_253));
        let __VLS_257;
        const __VLS_258 = {
            /** @type {typeof __VLS_257.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'runs'))
                    return;
                __VLS_ctx.failRun(row);
                // @ts-ignore
                [XCircle, failRun,];
            },
        };
        var __VLS_255;
        var __VLS_256;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_219;
    var __VLS_220;
}
if (__VLS_ctx.activeModule === 'rules') {
    let __VLS_259;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_260 = __VLS_asFunctionalComponent1(__VLS_259, new __VLS_259({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.ruleColumns),
        rows: (__VLS_ctx.rules),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyRules')),
    }));
    const __VLS_261 = __VLS_260({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.ruleColumns),
        rows: (__VLS_ctx.rules),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyRules')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_260));
    let __VLS_264;
    const __VLS_265 = {
        /** @type {typeof __VLS_264.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_266 } = __VLS_262.slots;
    {
        const { 'cell-statusName': __VLS_267 } = __VLS_262.slots;
        const [{ value }] = __VLS_vSlot(__VLS_267);
        let __VLS_268;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_269 = __VLS_asFunctionalComponent1(__VLS_268, new __VLS_268({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_270 = __VLS_269({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_269));
        // @ts-ignore
        [t, activeModule, loading, inspect, statusVariant, ruleColumns, rules,];
    }
    {
        const { 'cell-minimumConfidenceScore': __VLS_273 } = __VLS_262.slots;
        const [{ value }] = __VLS_vSlot(__VLS_273);
        (value ?? 0);
        // @ts-ignore
        [];
    }
    {
        const { 'cell-actions': __VLS_274 } = __VLS_262.slots;
        const [{ row }] = __VLS_vSlot(__VLS_274);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_275;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_276 = __VLS_asFunctionalComponent1(__VLS_275, new __VLS_275({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_277 = __VLS_276({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_276));
        let __VLS_280;
        const __VLS_281 = {
            /** @type {typeof __VLS_280.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'rules'))
                    return;
                __VLS_ctx.inspect(row);
                // @ts-ignore
                [inspect, Eye,];
            },
        };
        var __VLS_278;
        var __VLS_279;
        let __VLS_282;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_283 = __VLS_asFunctionalComponent1(__VLS_282, new __VLS_282({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_284 = __VLS_283({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_283));
        let __VLS_287;
        const __VLS_288 = {
            /** @type {typeof __VLS_287.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'rules'))
                    return;
                __VLS_ctx.editRule(row);
                // @ts-ignore
                [Pencil, editRule,];
            },
        };
        var __VLS_285;
        var __VLS_286;
        let __VLS_289;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_290 = __VLS_asFunctionalComponent1(__VLS_289, new __VLS_289({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.approve')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_291 = __VLS_290({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.approve')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_290));
        let __VLS_294;
        const __VLS_295 = {
            /** @type {typeof __VLS_294.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'rules'))
                    return;
                __VLS_ctx.approveRule(row);
                // @ts-ignore
                [t, approveRule,];
            },
        };
        var __VLS_292;
        var __VLS_293;
        let __VLS_296;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_297 = __VLS_asFunctionalComponent1(__VLS_296, new __VLS_296({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.reject')),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_298 = __VLS_297({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.reject')),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_297));
        let __VLS_301;
        const __VLS_302 = {
            /** @type {typeof __VLS_301.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'rules'))
                    return;
                __VLS_ctx.rejectRule(row);
                // @ts-ignore
                [t, rejectRule,];
            },
        };
        var __VLS_299;
        var __VLS_300;
        let __VLS_303;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_304 = __VLS_asFunctionalComponent1(__VLS_303, new __VLS_303({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }));
        const __VLS_305 = __VLS_304({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_304));
        let __VLS_308;
        const __VLS_309 = {
            /** @type {typeof __VLS_308.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'rules'))
                    return;
                __VLS_ctx.deleteRule(row);
                // @ts-ignore
                [Trash2, deleteRule,];
            },
        };
        var __VLS_306;
        var __VLS_307;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_262;
    var __VLS_263;
}
if (__VLS_ctx.activeModule === 'evidences') {
    let __VLS_310;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_311 = __VLS_asFunctionalComponent1(__VLS_310, new __VLS_310({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.evidenceColumns),
        rows: (__VLS_ctx.evidences),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyEvidences')),
    }));
    const __VLS_312 = __VLS_311({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.evidenceColumns),
        rows: (__VLS_ctx.evidences),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyEvidences')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_311));
    let __VLS_315;
    const __VLS_316 = {
        /** @type {typeof __VLS_315.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_317 } = __VLS_313.slots;
    {
        const { 'cell-actions': __VLS_318 } = __VLS_313.slots;
        const [{ row }] = __VLS_vSlot(__VLS_318);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_319;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_320 = __VLS_asFunctionalComponent1(__VLS_319, new __VLS_319({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_321 = __VLS_320({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Eye),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_320));
        let __VLS_324;
        const __VLS_325 = {
            /** @type {typeof __VLS_324.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'evidences'))
                    return;
                __VLS_ctx.inspect(row);
                // @ts-ignore
                [t, activeModule, loading, inspect, inspect, Eye, evidenceColumns, evidences,];
            },
        };
        var __VLS_322;
        var __VLS_323;
        let __VLS_326;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_327 = __VLS_asFunctionalComponent1(__VLS_326, new __VLS_326({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }));
        const __VLS_328 = __VLS_327({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            size: "sm",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_327));
        let __VLS_331;
        const __VLS_332 = {
            /** @type {typeof __VLS_331.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'evidences'))
                    return;
                __VLS_ctx.deleteEvidence(row);
                // @ts-ignore
                [Trash2, deleteEvidence,];
            },
        };
        var __VLS_329;
        var __VLS_330;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_313;
    var __VLS_314;
}
if (__VLS_ctx.activeModule === 'candidates') {
    let __VLS_333;
    /** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
    DhDataTable;
    // @ts-ignore
    const __VLS_334 = __VLS_asFunctionalComponent1(__VLS_333, new __VLS_333({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.candidateColumns),
        rows: (__VLS_ctx.candidates),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyCandidates')),
    }));
    const __VLS_335 = __VLS_334({
        ...{ 'onRowClick': {} },
        columns: (__VLS_ctx.candidateColumns),
        rows: (__VLS_ctx.candidates),
        loading: (__VLS_ctx.loading),
        emptyText: (__VLS_ctx.t('scraping.emptyCandidates')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_334));
    let __VLS_338;
    const __VLS_339 = {
        /** @type {typeof __VLS_338.rowClick} */
        onRowClick: (__VLS_ctx.inspect),
    };
    const { default: __VLS_340 } = __VLS_336.slots;
    {
        const { 'cell-route': __VLS_341 } = __VLS_336.slots;
        const [{ row }] = __VLS_vSlot(__VLS_341);
        (__VLS_ctx.routeLabel(row));
        // @ts-ignore
        [t, activeModule, loading, inspect, routeLabel, candidateColumns, candidates,];
    }
    {
        const { 'cell-confidenceScore': __VLS_342 } = __VLS_336.slots;
        const [{ value }] = __VLS_vSlot(__VLS_342);
        (value ?? 0);
        // @ts-ignore
        [];
    }
    {
        const { 'cell-statusName': __VLS_343 } = __VLS_336.slots;
        const [{ value }] = __VLS_vSlot(__VLS_343);
        let __VLS_344;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_345 = __VLS_asFunctionalComponent1(__VLS_344, new __VLS_344({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }));
        const __VLS_346 = __VLS_345({
            label: (String(value ?? '—')),
            variant: (__VLS_ctx.statusVariant(String(value))),
        }, ...__VLS_functionalComponentArgsRest(__VLS_345));
        // @ts-ignore
        [statusVariant,];
    }
    {
        const { 'cell-actions': __VLS_349 } = __VLS_336.slots;
        const [{ row }] = __VLS_vSlot(__VLS_349);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onClick: () => { } },
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        let __VLS_350;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_351 = __VLS_asFunctionalComponent1(__VLS_350, new __VLS_350({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.normalize')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_352 = __VLS_351({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.normalize')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_351));
        let __VLS_355;
        const __VLS_356 = {
            /** @type {typeof __VLS_355.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'candidates'))
                    return;
                __VLS_ctx.normalizeCandidate(row);
                // @ts-ignore
                [t, normalizeCandidate,];
            },
        };
        var __VLS_353;
        var __VLS_354;
        let __VLS_357;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_358 = __VLS_asFunctionalComponent1(__VLS_357, new __VLS_357({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.approve')),
            size: "sm",
            variant: "secondary",
        }));
        const __VLS_359 = __VLS_358({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.approve')),
            size: "sm",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_358));
        let __VLS_362;
        const __VLS_363 = {
            /** @type {typeof __VLS_362.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'candidates'))
                    return;
                __VLS_ctx.approveCandidate(row.id);
                // @ts-ignore
                [t, approveCandidate,];
            },
        };
        var __VLS_360;
        var __VLS_361;
        let __VLS_364;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_365 = __VLS_asFunctionalComponent1(__VLS_364, new __VLS_364({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.reject')),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_366 = __VLS_365({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.reject')),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_365));
        let __VLS_369;
        const __VLS_370 = {
            /** @type {typeof __VLS_369.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'candidates'))
                    return;
                __VLS_ctx.rejectCandidate(row.id);
                // @ts-ignore
                [t, rejectCandidate,];
            },
        };
        var __VLS_367;
        var __VLS_368;
        let __VLS_371;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_372 = __VLS_asFunctionalComponent1(__VLS_371, new __VLS_371({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.sendToPricing')),
            size: "sm",
            variant: "ghost",
        }));
        const __VLS_373 = __VLS_372({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('scraping.sendToPricing')),
            size: "sm",
            variant: "ghost",
        }, ...__VLS_functionalComponentArgsRest(__VLS_372));
        let __VLS_376;
        const __VLS_377 = {
            /** @type {typeof __VLS_376.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeModule === 'candidates'))
                    return;
                __VLS_ctx.sendCandidateToPricing(row);
                // @ts-ignore
                [t, sendCandidateToPricing,];
            },
        };
        var __VLS_374;
        var __VLS_375;
        // @ts-ignore
        [];
    }
    // @ts-ignore
    [];
    var __VLS_336;
    var __VLS_337;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('scraping.editor'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.editorHint'));
let __VLS_378;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_379 = __VLS_asFunctionalComponent1(__VLS_378, new __VLS_378({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.clear')),
    size: "sm",
    variant: "ghost",
}));
const __VLS_380 = __VLS_379({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.clear')),
    size: "sm",
    variant: "ghost",
}, ...__VLS_functionalComponentArgsRest(__VLS_379));
let __VLS_383;
const __VLS_384 = {
    /** @type {typeof __VLS_383.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.resetSourceForm();
        __VLS_ctx.resetCredentialForm();
        __VLS_ctx.resetRuleForm();
        __VLS_ctx.selectedRecord = null;
        // @ts-ignore
        [t, t, t, RefreshCcw, selectedRecord, resetSourceForm, resetCredentialForm, resetRuleForm,];
    },
};
var __VLS_381;
var __VLS_382;
if (__VLS_ctx.activeModule === 'sources') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_385;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_386 = __VLS_asFunctionalComponent1(__VLS_385, new __VLS_385({
        modelValue: (__VLS_ctx.sourceForm.code),
        disabled: (Boolean(__VLS_ctx.sourceForm.id)),
        label: (__VLS_ctx.t('scraping.sourceCode')),
        placeholder: "MAERSK",
    }));
    const __VLS_387 = __VLS_386({
        modelValue: (__VLS_ctx.sourceForm.code),
        disabled: (Boolean(__VLS_ctx.sourceForm.id)),
        label: (__VLS_ctx.t('scraping.sourceCode')),
        placeholder: "MAERSK",
    }, ...__VLS_functionalComponentArgsRest(__VLS_386));
    let __VLS_390;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_391 = __VLS_asFunctionalComponent1(__VLS_390, new __VLS_390({
        modelValue: (__VLS_ctx.sourceForm.name),
        label: (__VLS_ctx.t('scraping.sourceName')),
        placeholder: "Maersk Spot",
    }));
    const __VLS_392 = __VLS_391({
        modelValue: (__VLS_ctx.sourceForm.name),
        label: (__VLS_ctx.t('scraping.sourceName')),
        placeholder: "Maersk Spot",
    }, ...__VLS_functionalComponentArgsRest(__VLS_391));
    let __VLS_395;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_396 = __VLS_asFunctionalComponent1(__VLS_395, new __VLS_395({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.sourceForm.carrierCatalogItemId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.carrier')),
        placeholder: (__VLS_ctx.t('scraping.selectFromConfig')),
        options: (__VLS_ctx.carrierOptions),
    }));
    const __VLS_397 = __VLS_396({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.sourceForm.carrierCatalogItemId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.carrier')),
        placeholder: (__VLS_ctx.t('scraping.selectFromConfig')),
        options: (__VLS_ctx.carrierOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_396));
    let __VLS_400;
    const __VLS_401 = {
        /** @type {typeof __VLS_400.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyCarrierToSource),
    };
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    var __VLS_398;
    var __VLS_399;
    let __VLS_402;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_403 = __VLS_asFunctionalComponent1(__VLS_402, new __VLS_402({
        modelValue: (__VLS_ctx.sourceForm.baseUrl),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.baseUrl')),
        placeholder: "https://www.maersk.com",
    }));
    const __VLS_404 = __VLS_403({
        modelValue: (__VLS_ctx.sourceForm.baseUrl),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.baseUrl')),
        placeholder: "https://www.maersk.com",
    }, ...__VLS_functionalComponentArgsRest(__VLS_403));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_407;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_408 = __VLS_asFunctionalComponent1(__VLS_407, new __VLS_407({
        modelValue: (__VLS_ctx.sourceForm.sourceType),
        label: (__VLS_ctx.t('scraping.sourceType')),
        options: (__VLS_ctx.sourceTypeOptions),
    }));
    const __VLS_409 = __VLS_408({
        modelValue: (__VLS_ctx.sourceForm.sourceType),
        label: (__VLS_ctx.t('scraping.sourceType')),
        options: (__VLS_ctx.sourceTypeOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_408));
    let __VLS_412;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_413 = __VLS_asFunctionalComponent1(__VLS_412, new __VLS_412({
        modelValue: (__VLS_ctx.sourceForm.requiresLogin),
        label: (__VLS_ctx.t('scraping.requiresLogin')),
    }));
    const __VLS_414 = __VLS_413({
        modelValue: (__VLS_ctx.sourceForm.requiresLogin),
        label: (__VLS_ctx.t('scraping.requiresLogin')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_413));
    let __VLS_417;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_418 = __VLS_asFunctionalComponent1(__VLS_417, new __VLS_417({
        modelValue: (__VLS_ctx.sourceForm.navigationUrl),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.navigationUrl')),
        placeholder: "https://www.maersk.com/spot/search",
    }));
    const __VLS_419 = __VLS_418({
        modelValue: (__VLS_ctx.sourceForm.navigationUrl),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.navigationUrl')),
        placeholder: "https://www.maersk.com/spot/search",
    }, ...__VLS_functionalComponentArgsRest(__VLS_418));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_422;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_423 = __VLS_asFunctionalComponent1(__VLS_422, new __VLS_422({
        modelValue: (__VLS_ctx.sourceForm.waitForSelector),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.waitForSelector')),
        placeholder: ".rate-table",
    }));
    const __VLS_424 = __VLS_423({
        modelValue: (__VLS_ctx.sourceForm.waitForSelector),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.waitForSelector')),
        placeholder: ".rate-table",
    }, ...__VLS_functionalComponentArgsRest(__VLS_423));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_427;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_428 = __VLS_asFunctionalComponent1(__VLS_427, new __VLS_427({
        modelValue: (__VLS_ctx.sourceForm.navigationStepsJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.navigationSteps')),
        rows: (5),
    }));
    const __VLS_429 = __VLS_428({
        modelValue: (__VLS_ctx.sourceForm.navigationStepsJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.navigationSteps')),
        rows: (5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_428));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_432;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_433 = __VLS_asFunctionalComponent1(__VLS_432, new __VLS_432({
        modelValue: (__VLS_ctx.sourceForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_434 = __VLS_433({
        modelValue: (__VLS_ctx.sourceForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_433));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_437;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_438 = __VLS_asFunctionalComponent1(__VLS_437, new __VLS_437({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.sourceForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveSource')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_439 = __VLS_438({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.sourceForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveSource')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_438));
    let __VLS_442;
    const __VLS_443 = {
        /** @type {typeof __VLS_442.click} */
        onClick: (__VLS_ctx.saveSource),
    };
    var __VLS_440;
    var __VLS_441;
}
if (__VLS_ctx.activeModule === 'credentials') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_444;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_445 = __VLS_asFunctionalComponent1(__VLS_444, new __VLS_444({
        modelValue: (__VLS_ctx.credentialForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        placeholder: (__VLS_ctx.t('scraping.selectSource')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_446 = __VLS_445({
        modelValue: (__VLS_ctx.credentialForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        placeholder: (__VLS_ctx.t('scraping.selectSource')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_445));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_449;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_450 = __VLS_asFunctionalComponent1(__VLS_449, new __VLS_449({
        modelValue: (__VLS_ctx.credentialForm.authenticationMode),
        label: (__VLS_ctx.t('scraping.authMode')),
        options: (__VLS_ctx.authenticationModeOptions),
    }));
    const __VLS_451 = __VLS_450({
        modelValue: (__VLS_ctx.credentialForm.authenticationMode),
        label: (__VLS_ctx.t('scraping.authMode')),
        options: (__VLS_ctx.authenticationModeOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_450));
    let __VLS_454;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_455 = __VLS_asFunctionalComponent1(__VLS_454, new __VLS_454({
        modelValue: (__VLS_ctx.credentialForm.username),
        label: (__VLS_ctx.t('scraping.username')),
    }));
    const __VLS_456 = __VLS_455({
        modelValue: (__VLS_ctx.credentialForm.username),
        label: (__VLS_ctx.t('scraping.username')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_455));
    if (!__VLS_ctx.credentialForm.id) {
        let __VLS_459;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_460 = __VLS_asFunctionalComponent1(__VLS_459, new __VLS_459({
            modelValue: (__VLS_ctx.credentialForm.secretReference),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.secretReference')),
        }));
        const __VLS_461 = __VLS_460({
            modelValue: (__VLS_ctx.credentialForm.secretReference),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.secretReference')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_460));
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    }
    let __VLS_464;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_465 = __VLS_asFunctionalComponent1(__VLS_464, new __VLS_464({
        modelValue: (__VLS_ctx.credentialForm.expiresAt),
        label: (__VLS_ctx.t('scraping.expiresAt')),
        placeholder: "2026-12-31T00:00:00Z",
    }));
    const __VLS_466 = __VLS_465({
        modelValue: (__VLS_ctx.credentialForm.expiresAt),
        label: (__VLS_ctx.t('scraping.expiresAt')),
        placeholder: "2026-12-31T00:00:00Z",
    }, ...__VLS_functionalComponentArgsRest(__VLS_465));
    let __VLS_469;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_470 = __VLS_asFunctionalComponent1(__VLS_469, new __VLS_469({
        modelValue: (__VLS_ctx.credentialForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_471 = __VLS_470({
        modelValue: (__VLS_ctx.credentialForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_470));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_474;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_475 = __VLS_asFunctionalComponent1(__VLS_474, new __VLS_474({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.credentialForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveCredential')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_476 = __VLS_475({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.credentialForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveCredential')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_475));
    let __VLS_479;
    const __VLS_480 = {
        /** @type {typeof __VLS_479.click} */
        onClick: (__VLS_ctx.saveCredential),
    };
    var __VLS_477;
    var __VLS_478;
}
if (__VLS_ctx.activeModule === 'jobs') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_481;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_482 = __VLS_asFunctionalComponent1(__VLS_481, new __VLS_481({
        modelValue: (__VLS_ctx.jobForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        placeholder: (__VLS_ctx.t('scraping.selectSource')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_483 = __VLS_482({
        modelValue: (__VLS_ctx.jobForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        placeholder: (__VLS_ctx.t('scraping.selectSource')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_482));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_486;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_487 = __VLS_asFunctionalComponent1(__VLS_486, new __VLS_486({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.carrierCatalogItemId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.carrier')),
        placeholder: (__VLS_ctx.t('scraping.selectFromConfig')),
        options: (__VLS_ctx.carrierOptions),
    }));
    const __VLS_488 = __VLS_487({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.carrierCatalogItemId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.carrier')),
        placeholder: (__VLS_ctx.t('scraping.selectFromConfig')),
        options: (__VLS_ctx.carrierOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_487));
    let __VLS_491;
    const __VLS_492 = {
        /** @type {typeof __VLS_491.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyJobCarrier),
    };
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    var __VLS_489;
    var __VLS_490;
    let __VLS_493;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_494 = __VLS_asFunctionalComponent1(__VLS_493, new __VLS_493({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.portOfLoadingCatalogItemId),
        label: (__VLS_ctx.t('scraping.originPort')),
        options: (__VLS_ctx.portOptions),
    }));
    const __VLS_495 = __VLS_494({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.portOfLoadingCatalogItemId),
        label: (__VLS_ctx.t('scraping.originPort')),
        options: (__VLS_ctx.portOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_494));
    let __VLS_498;
    const __VLS_499 = {
        /** @type {typeof __VLS_498.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyPol),
    };
    var __VLS_496;
    var __VLS_497;
    let __VLS_500;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_501 = __VLS_asFunctionalComponent1(__VLS_500, new __VLS_500({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.portOfDischargeCatalogItemId),
        label: (__VLS_ctx.t('scraping.destinationPort')),
        options: (__VLS_ctx.portOptions),
    }));
    const __VLS_502 = __VLS_501({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.portOfDischargeCatalogItemId),
        label: (__VLS_ctx.t('scraping.destinationPort')),
        options: (__VLS_ctx.portOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_501));
    let __VLS_505;
    const __VLS_506 = {
        /** @type {typeof __VLS_505.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyPod),
    };
    var __VLS_503;
    var __VLS_504;
    let __VLS_507;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_508 = __VLS_asFunctionalComponent1(__VLS_507, new __VLS_507({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.containerTypeCatalogItemId),
        label: (__VLS_ctx.t('scraping.container')),
        options: (__VLS_ctx.containerOptions),
    }));
    const __VLS_509 = __VLS_508({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.jobForm.containerTypeCatalogItemId),
        label: (__VLS_ctx.t('scraping.container')),
        options: (__VLS_ctx.containerOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_508));
    let __VLS_512;
    const __VLS_513 = {
        /** @type {typeof __VLS_512.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyContainer),
    };
    var __VLS_510;
    var __VLS_511;
    let __VLS_514;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_515 = __VLS_asFunctionalComponent1(__VLS_514, new __VLS_514({
        modelValue: (__VLS_ctx.jobForm.scheduledAtUtc),
        label: (__VLS_ctx.t('scraping.scheduledAt')),
        type: "datetime-local",
    }));
    const __VLS_516 = __VLS_515({
        modelValue: (__VLS_ctx.jobForm.scheduledAtUtc),
        label: (__VLS_ctx.t('scraping.scheduledAt')),
        type: "datetime-local",
    }, ...__VLS_functionalComponentArgsRest(__VLS_515));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.readyDate'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.dynamicReadyDate);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.readyDateDynamicHint'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_519;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_520 = __VLS_asFunctionalComponent1(__VLS_519, new __VLS_519({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showAdvancedJobFields ? __VLS_ctx.t('scraping.hideJobAdvancedFields') : __VLS_ctx.t('scraping.showJobAdvancedFields')),
        size: "sm",
        variant: "secondary",
    }));
    const __VLS_521 = __VLS_520({
        ...{ 'onClick': {} },
        label: (__VLS_ctx.showAdvancedJobFields ? __VLS_ctx.t('scraping.hideJobAdvancedFields') : __VLS_ctx.t('scraping.showJobAdvancedFields')),
        size: "sm",
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_520));
    let __VLS_524;
    const __VLS_525 = {
        /** @type {typeof __VLS_524.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.activeModule === 'jobs'))
                return;
            __VLS_ctx.showAdvancedJobFields = !__VLS_ctx.showAdvancedJobFields;
            // @ts-ignore
            [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, activeModule, activeModule, activeModule, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, sourceForm, carrierOptions, carrierOptions, applyCarrierToSource, sourceTypeOptions, Save, Save, saving, saving, saveSource, credentialForm, credentialForm, credentialForm, credentialForm, credentialForm, credentialForm, credentialForm, credentialForm, sourceOptions, sourceOptions, authenticationModeOptions, saveCredential, jobForm, jobForm, jobForm, jobForm, jobForm, jobForm, applyJobCarrier, portOptions, portOptions, applyPol, applyPod, containerOptions, applyContainer, dynamicReadyDate, showAdvancedJobFields, showAdvancedJobFields, showAdvancedJobFields,];
        },
    };
    var __VLS_522;
    var __VLS_523;
    if (__VLS_ctx.showAdvancedJobFields) {
        let __VLS_526;
        /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
        DhSelect;
        // @ts-ignore
        const __VLS_527 = __VLS_asFunctionalComponent1(__VLS_526, new __VLS_526({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (__VLS_ctx.jobForm.portOfEntryCatalogItemId),
            label: (__VLS_ctx.t('scraping.entryPort')),
            placeholder: (__VLS_ctx.t('scraping.optional')),
            options: (__VLS_ctx.portOptions),
        }));
        const __VLS_528 = __VLS_527({
            ...{ 'onUpdate:modelValue': {} },
            modelValue: (__VLS_ctx.jobForm.portOfEntryCatalogItemId),
            label: (__VLS_ctx.t('scraping.entryPort')),
            placeholder: (__VLS_ctx.t('scraping.optional')),
            options: (__VLS_ctx.portOptions),
        }, ...__VLS_functionalComponentArgsRest(__VLS_527));
        let __VLS_531;
        const __VLS_532 = {
            /** @type {typeof __VLS_531.'update:modelValue'} */
            'onUpdate:modelValue': (__VLS_ctx.applyPoe),
        };
        var __VLS_529;
        var __VLS_530;
        let __VLS_533;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_534 = __VLS_asFunctionalComponent1(__VLS_533, new __VLS_533({
            modelValue: (__VLS_ctx.jobForm.weightKg),
            label: (__VLS_ctx.t('scraping.weightKg')),
            type: "number",
        }));
        const __VLS_535 = __VLS_534({
            modelValue: (__VLS_ctx.jobForm.weightKg),
            label: (__VLS_ctx.t('scraping.weightKg')),
            type: "number",
        }, ...__VLS_functionalComponentArgsRest(__VLS_534));
        let __VLS_538;
        /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
        DhInput;
        // @ts-ignore
        const __VLS_539 = __VLS_asFunctionalComponent1(__VLS_538, new __VLS_538({
            modelValue: (__VLS_ctx.jobForm.commodity),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.commodity')),
        }));
        const __VLS_540 = __VLS_539({
            modelValue: (__VLS_ctx.jobForm.commodity),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.commodity')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_539));
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
        let __VLS_543;
        /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
        DhSelect;
        // @ts-ignore
        const __VLS_544 = __VLS_asFunctionalComponent1(__VLS_543, new __VLS_543({
            modelValue: (__VLS_ctx.jobForm.triggerType),
            label: (__VLS_ctx.t('scraping.triggerType')),
            options: (__VLS_ctx.triggerTypeOptions),
        }));
        const __VLS_545 = __VLS_544({
            modelValue: (__VLS_ctx.jobForm.triggerType),
            label: (__VLS_ctx.t('scraping.triggerType')),
            options: (__VLS_ctx.triggerTypeOptions),
        }, ...__VLS_functionalComponentArgsRest(__VLS_544));
        let __VLS_548;
        /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
        DhTextarea;
        // @ts-ignore
        const __VLS_549 = __VLS_asFunctionalComponent1(__VLS_548, new __VLS_548({
            modelValue: (__VLS_ctx.jobForm.metadataJson),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.metadataJson')),
            rows: (3),
        }));
        const __VLS_550 = __VLS_549({
            modelValue: (__VLS_ctx.jobForm.metadataJson),
            ...{ class: "md:col-span-2" },
            label: (__VLS_ctx.t('scraping.metadataJson')),
            rows: (3),
        }, ...__VLS_functionalComponentArgsRest(__VLS_549));
        /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_553;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_554 = __VLS_asFunctionalComponent1(__VLS_553, new __VLS_553({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Route),
        label: (__VLS_ctx.t('scraping.saveJob')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_555 = __VLS_554({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Route),
        label: (__VLS_ctx.t('scraping.saveJob')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_554));
    let __VLS_558;
    const __VLS_559 = {
        /** @type {typeof __VLS_558.click} */
        onClick: (__VLS_ctx.createJob),
    };
    var __VLS_556;
    var __VLS_557;
}
if (__VLS_ctx.activeModule === 'runs') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_560;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_561 = __VLS_asFunctionalComponent1(__VLS_560, new __VLS_560({
        modelValue: (__VLS_ctx.runForm.scrapingJobId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.job')),
        options: (__VLS_ctx.jobOptions),
    }));
    const __VLS_562 = __VLS_561({
        modelValue: (__VLS_ctx.runForm.scrapingJobId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.job')),
        options: (__VLS_ctx.jobOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_561));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_565;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_566 = __VLS_asFunctionalComponent1(__VLS_565, new __VLS_565({
        modelValue: (__VLS_ctx.runForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_567 = __VLS_566({
        modelValue: (__VLS_ctx.runForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_566));
    let __VLS_570;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_571 = __VLS_asFunctionalComponent1(__VLS_570, new __VLS_570({
        modelValue: (__VLS_ctx.runForm.scrapingCredentialId),
        label: (__VLS_ctx.t('scraping.credential')),
        placeholder: (__VLS_ctx.t('scraping.noCredential')),
        options: (__VLS_ctx.credentialOptions),
    }));
    const __VLS_572 = __VLS_571({
        modelValue: (__VLS_ctx.runForm.scrapingCredentialId),
        label: (__VLS_ctx.t('scraping.credential')),
        placeholder: (__VLS_ctx.t('scraping.noCredential')),
        options: (__VLS_ctx.credentialOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_571));
    let __VLS_575;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_576 = __VLS_asFunctionalComponent1(__VLS_575, new __VLS_575({
        modelValue: (__VLS_ctx.runForm.correlationId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.correlationId')),
    }));
    const __VLS_577 = __VLS_576({
        modelValue: (__VLS_ctx.runForm.correlationId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.correlationId')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_576));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_580;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_581 = __VLS_asFunctionalComponent1(__VLS_580, new __VLS_580({
        modelValue: (__VLS_ctx.runForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_582 = __VLS_581({
        modelValue: (__VLS_ctx.runForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_581));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_585;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_586 = __VLS_asFunctionalComponent1(__VLS_585, new __VLS_585({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Activity),
        label: (__VLS_ctx.t('scraping.saveRun')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_587 = __VLS_586({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Activity),
        label: (__VLS_ctx.t('scraping.saveRun')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_586));
    let __VLS_590;
    const __VLS_591 = {
        /** @type {typeof __VLS_590.click} */
        onClick: (__VLS_ctx.createRun),
    };
    var __VLS_588;
    var __VLS_589;
}
if (__VLS_ctx.activeModule === 'rules') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_592;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_593 = __VLS_asFunctionalComponent1(__VLS_592, new __VLS_592({
        modelValue: (__VLS_ctx.ruleForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_594 = __VLS_593({
        modelValue: (__VLS_ctx.ruleForm.scrapingSourceId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_593));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_597;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_598 = __VLS_asFunctionalComponent1(__VLS_597, new __VLS_597({
        modelValue: (__VLS_ctx.ruleForm.fieldName),
        disabled: (Boolean(__VLS_ctx.ruleForm.id)),
        label: (__VLS_ctx.t('scraping.fieldName')),
    }));
    const __VLS_599 = __VLS_598({
        modelValue: (__VLS_ctx.ruleForm.fieldName),
        disabled: (Boolean(__VLS_ctx.ruleForm.id)),
        label: (__VLS_ctx.t('scraping.fieldName')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_598));
    let __VLS_602;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_603 = __VLS_asFunctionalComponent1(__VLS_602, new __VLS_602({
        modelValue: (__VLS_ctx.ruleForm.displayName),
        label: (__VLS_ctx.t('scraping.displayName')),
    }));
    const __VLS_604 = __VLS_603({
        modelValue: (__VLS_ctx.ruleForm.displayName),
        label: (__VLS_ctx.t('scraping.displayName')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_603));
    let __VLS_607;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_608 = __VLS_asFunctionalComponent1(__VLS_607, new __VLS_607({
        modelValue: (__VLS_ctx.ruleForm.ruleType),
        label: (__VLS_ctx.t('scraping.ruleType')),
        options: (__VLS_ctx.ruleTypeOptions),
    }));
    const __VLS_609 = __VLS_608({
        modelValue: (__VLS_ctx.ruleForm.ruleType),
        label: (__VLS_ctx.t('scraping.ruleType')),
        options: (__VLS_ctx.ruleTypeOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_608));
    let __VLS_612;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_613 = __VLS_asFunctionalComponent1(__VLS_612, new __VLS_612({
        modelValue: (__VLS_ctx.ruleForm.minimumConfidenceScore),
        label: (__VLS_ctx.t('scraping.minimumConfidence')),
        type: "number",
    }));
    const __VLS_614 = __VLS_613({
        modelValue: (__VLS_ctx.ruleForm.minimumConfidenceScore),
        label: (__VLS_ctx.t('scraping.minimumConfidence')),
        type: "number",
    }, ...__VLS_functionalComponentArgsRest(__VLS_613));
    let __VLS_617;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_618 = __VLS_asFunctionalComponent1(__VLS_617, new __VLS_617({
        modelValue: (__VLS_ctx.ruleForm.expression),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.expression')),
        rows: (3),
    }));
    const __VLS_619 = __VLS_618({
        modelValue: (__VLS_ctx.ruleForm.expression),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.expression')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_618));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_622;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_623 = __VLS_asFunctionalComponent1(__VLS_622, new __VLS_622({
        modelValue: (__VLS_ctx.ruleForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_624 = __VLS_623({
        modelValue: (__VLS_ctx.ruleForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_623));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_627;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_628 = __VLS_asFunctionalComponent1(__VLS_627, new __VLS_627({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.ruleForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveRule')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_629 = __VLS_628({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Save),
        label: (__VLS_ctx.ruleForm.id ? __VLS_ctx.t('common.save') : __VLS_ctx.t('scraping.saveRule')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_628));
    let __VLS_632;
    const __VLS_633 = {
        /** @type {typeof __VLS_632.click} */
        onClick: (__VLS_ctx.saveRule),
    };
    var __VLS_630;
    var __VLS_631;
}
if (__VLS_ctx.activeModule === 'evidences') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_634;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_635 = __VLS_asFunctionalComponent1(__VLS_634, new __VLS_634({
        modelValue: (__VLS_ctx.evidenceForm.scrapingRunId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.run')),
        options: (__VLS_ctx.runOptions),
    }));
    const __VLS_636 = __VLS_635({
        modelValue: (__VLS_ctx.evidenceForm.scrapingRunId),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.run')),
        options: (__VLS_ctx.runOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_635));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_639;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_640 = __VLS_asFunctionalComponent1(__VLS_639, new __VLS_639({
        modelValue: (__VLS_ctx.evidenceForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_641 = __VLS_640({
        modelValue: (__VLS_ctx.evidenceForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_640));
    let __VLS_644;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_645 = __VLS_asFunctionalComponent1(__VLS_644, new __VLS_644({
        modelValue: (__VLS_ctx.evidenceForm.evidenceType),
        label: (__VLS_ctx.t('scraping.evidenceType')),
        options: (__VLS_ctx.evidenceTypeOptions),
    }));
    const __VLS_646 = __VLS_645({
        modelValue: (__VLS_ctx.evidenceForm.evidenceType),
        label: (__VLS_ctx.t('scraping.evidenceType')),
        options: (__VLS_ctx.evidenceTypeOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_645));
    let __VLS_649;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_650 = __VLS_asFunctionalComponent1(__VLS_649, new __VLS_649({
        modelValue: (__VLS_ctx.evidenceForm.storageObjectKey),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.storageKey')),
    }));
    const __VLS_651 = __VLS_650({
        modelValue: (__VLS_ctx.evidenceForm.storageObjectKey),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.storageKey')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_650));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_654;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_655 = __VLS_asFunctionalComponent1(__VLS_654, new __VLS_654({
        modelValue: (__VLS_ctx.evidenceForm.fileName),
        label: (__VLS_ctx.t('scraping.fileName')),
    }));
    const __VLS_656 = __VLS_655({
        modelValue: (__VLS_ctx.evidenceForm.fileName),
        label: (__VLS_ctx.t('scraping.fileName')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_655));
    let __VLS_659;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_660 = __VLS_asFunctionalComponent1(__VLS_659, new __VLS_659({
        modelValue: (__VLS_ctx.evidenceForm.contentType),
        label: (__VLS_ctx.t('scraping.contentType')),
    }));
    const __VLS_661 = __VLS_660({
        modelValue: (__VLS_ctx.evidenceForm.contentType),
        label: (__VLS_ctx.t('scraping.contentType')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_660));
    let __VLS_664;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_665 = __VLS_asFunctionalComponent1(__VLS_664, new __VLS_664({
        modelValue: (__VLS_ctx.evidenceForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_666 = __VLS_665({
        modelValue: (__VLS_ctx.evidenceForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_665));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_669;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_670 = __VLS_asFunctionalComponent1(__VLS_669, new __VLS_669({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.FileJson),
        label: (__VLS_ctx.t('scraping.saveEvidence')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_671 = __VLS_670({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.FileJson),
        label: (__VLS_ctx.t('scraping.saveEvidence')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_670));
    let __VLS_674;
    const __VLS_675 = {
        /** @type {typeof __VLS_674.click} */
        onClick: (__VLS_ctx.createEvidence),
    };
    var __VLS_672;
    var __VLS_673;
}
if (__VLS_ctx.activeModule === 'candidates') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_676;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_677 = __VLS_asFunctionalComponent1(__VLS_676, new __VLS_676({
        modelValue: (__VLS_ctx.candidateForm.scrapingRunId),
        label: (__VLS_ctx.t('scraping.run')),
        options: (__VLS_ctx.runOptions),
    }));
    const __VLS_678 = __VLS_677({
        modelValue: (__VLS_ctx.candidateForm.scrapingRunId),
        label: (__VLS_ctx.t('scraping.run')),
        options: (__VLS_ctx.runOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_677));
    let __VLS_681;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_682 = __VLS_asFunctionalComponent1(__VLS_681, new __VLS_681({
        modelValue: (__VLS_ctx.candidateForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }));
    const __VLS_683 = __VLS_682({
        modelValue: (__VLS_ctx.candidateForm.scrapingSourceId),
        label: (__VLS_ctx.t('scraping.source')),
        options: (__VLS_ctx.sourceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_682));
    let __VLS_686;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_687 = __VLS_asFunctionalComponent1(__VLS_686, new __VLS_686({
        modelValue: (__VLS_ctx.candidateForm.scrapedEvidenceId),
        label: (__VLS_ctx.t('scraping.evidence')),
        placeholder: (__VLS_ctx.t('scraping.noEvidence')),
        options: (__VLS_ctx.evidenceOptions),
    }));
    const __VLS_688 = __VLS_687({
        modelValue: (__VLS_ctx.candidateForm.scrapedEvidenceId),
        label: (__VLS_ctx.t('scraping.evidence')),
        placeholder: (__VLS_ctx.t('scraping.noEvidence')),
        options: (__VLS_ctx.evidenceOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_687));
    let __VLS_691;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_692 = __VLS_asFunctionalComponent1(__VLS_691, new __VLS_691({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.candidateForm.currencyCatalogItemId),
        label: (__VLS_ctx.t('scraping.currency')),
        options: (__VLS_ctx.currencyOptions),
    }));
    const __VLS_693 = __VLS_692({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.candidateForm.currencyCatalogItemId),
        label: (__VLS_ctx.t('scraping.currency')),
        options: (__VLS_ctx.currencyOptions),
    }, ...__VLS_functionalComponentArgsRest(__VLS_692));
    let __VLS_696;
    const __VLS_697 = {
        /** @type {typeof __VLS_696.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.applyCurrency),
    };
    var __VLS_694;
    var __VLS_695;
    let __VLS_698;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_699 = __VLS_asFunctionalComponent1(__VLS_698, new __VLS_698({
        modelValue: (__VLS_ctx.candidateForm.confidenceScore),
        label: (__VLS_ctx.t('scraping.confidence')),
        type: "number",
    }));
    const __VLS_700 = __VLS_699({
        modelValue: (__VLS_ctx.candidateForm.confidenceScore),
        label: (__VLS_ctx.t('scraping.confidence')),
        type: "number",
    }, ...__VLS_functionalComponentArgsRest(__VLS_699));
    let __VLS_703;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_704 = __VLS_asFunctionalComponent1(__VLS_703, new __VLS_703({
        modelValue: (__VLS_ctx.candidateForm.validFrom),
        label: (__VLS_ctx.t('scraping.validFrom')),
    }));
    const __VLS_705 = __VLS_704({
        modelValue: (__VLS_ctx.candidateForm.validFrom),
        label: (__VLS_ctx.t('scraping.validFrom')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_704));
    let __VLS_708;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_709 = __VLS_asFunctionalComponent1(__VLS_708, new __VLS_708({
        modelValue: (__VLS_ctx.candidateForm.validTo),
        label: (__VLS_ctx.t('scraping.validTo')),
    }));
    const __VLS_710 = __VLS_709({
        modelValue: (__VLS_ctx.candidateForm.validTo),
        label: (__VLS_ctx.t('scraping.validTo')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_709));
    let __VLS_713;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_714 = __VLS_asFunctionalComponent1(__VLS_713, new __VLS_713({
        modelValue: (__VLS_ctx.candidateForm.rawJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.rawJson')),
        rows: (5),
    }));
    const __VLS_715 = __VLS_714({
        modelValue: (__VLS_ctx.candidateForm.rawJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.rawJson')),
        rows: (5),
    }, ...__VLS_functionalComponentArgsRest(__VLS_714));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    let __VLS_718;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_719 = __VLS_asFunctionalComponent1(__VLS_718, new __VLS_718({
        modelValue: (__VLS_ctx.candidateForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }));
    const __VLS_720 = __VLS_719({
        modelValue: (__VLS_ctx.candidateForm.metadataJson),
        ...{ class: "md:col-span-2" },
        label: (__VLS_ctx.t('scraping.metadataJson')),
        rows: (3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_719));
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "md:col-span-2 flex justify-end" },
    });
    /** @type {__VLS_StyleScopedClasses['md:col-span-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    let __VLS_723;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_724 = __VLS_asFunctionalComponent1(__VLS_723, new __VLS_723({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Database),
        label: (__VLS_ctx.t('scraping.saveCandidate')),
        loading: (__VLS_ctx.saving),
    }));
    const __VLS_725 = __VLS_724({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Database),
        label: (__VLS_ctx.t('scraping.saveCandidate')),
        loading: (__VLS_ctx.saving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_724));
    let __VLS_728;
    const __VLS_729 = {
        /** @type {typeof __VLS_728.click} */
        onClick: (__VLS_ctx.createCandidate),
    };
    var __VLS_726;
    var __VLS_727;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('scraping.detail'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.detailHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
    ...{ class: "dh-scrollbar mt-4 max-h-[26rem] overflow-auto rounded-[24px] border border-[var(--dh-border)] bg-black/[0.04] p-4 text-xs font-semibold text-[var(--dh-text-soft)] dark:bg-white/[0.04]" },
});
/** @type {__VLS_StyleScopedClasses['dh-scrollbar']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['max-h-[26rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.04]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.04]']} */ ;
(__VLS_ctx.selectedRecord ? JSON.stringify(__VLS_ctx.selectedRecord, null, 2) : __VLS_ctx.t('scraping.noSelection'));
// @ts-ignore
[t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, activeModule, activeModule, activeModule, activeModule, selectedRecord, selectedRecord, Save, saving, saving, saving, saving, saving, sourceOptions, sourceOptions, sourceOptions, sourceOptions, jobForm, jobForm, jobForm, jobForm, jobForm, portOptions, showAdvancedJobFields, applyPoe, triggerTypeOptions, Route, createJob, runForm, runForm, runForm, runForm, runForm, jobOptions, credentialOptions, Activity, createRun, ruleForm, ruleForm, ruleForm, ruleForm, ruleForm, ruleForm, ruleForm, ruleForm, ruleForm, ruleTypeOptions, saveRule, evidenceForm, evidenceForm, evidenceForm, evidenceForm, evidenceForm, evidenceForm, evidenceForm, runOptions, runOptions, evidenceTypeOptions, FileJson, createEvidence, candidateForm, candidateForm, candidateForm, candidateForm, candidateForm, candidateForm, candidateForm, candidateForm, candidateForm, evidenceOptions, currencyOptions, applyCurrency, Database, createCandidate,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
