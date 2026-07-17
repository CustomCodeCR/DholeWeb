import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { AlertTriangle, Bot, CheckCircle2, Globe2, KeyRound, Play, RefreshCcw, ShieldCheck } from 'lucide-vue-next';
import { DhBadge, DhButton, DhInput, DhSelect, DhSwitch, DhTextarea } from '@/shared/components/atoms';
import { DhPageHeader } from '@/shared/components/organisms';
import { ScrapingService } from '@/core/services/scrapingService';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const toastStore = useToastStore();
const loading = ref(false);
const bootstrapLoading = ref(false);
const loadingData = ref(false);
const showAdvanced = ref(false);
const showDiagnostics = ref(false);
const showBootstrapDiagnostics = ref(false);
const showHtml = ref(false);
const sources = ref([]);
const credentials = ref([]);
const jobs = ref([]);
const scrapingSourceId = ref('');
const scrapingCredentialId = ref('');
const scrapingJobId = ref('');
const reuseSession = ref(true);
const forceLogin = ref(false);
const resetSession = ref(false);
const persistResult = ref(true);
const completeJob = ref(false);
const url = ref('');
const waitForSelector = ref('');
const loginStepsJson = ref('');
const navigationStepsJson = ref('');
const extractionRulesJson = ref('');
const timeoutSeconds = ref('180');
const bootstrapTimeoutSeconds = ref('300');
const captureHtml = ref(true);
const captureScreenshot = ref(true);
const result = ref(null);
const bootstrapResult = ref(null);
const dynamicReadyDate = computed(() => nextReadyDate());
const sourceOptions = computed(() => sources.value.map((source) => ({
    value: source.id,
    label: `${source.name} (${source.code})`,
})));
const credentialOptions = computed(() => credentials.value
    .filter((credential) => !scrapingSourceId.value || credential.scrapingSourceId === scrapingSourceId.value)
    .map((credential) => ({
    value: credential.id,
    label: `${credential.username || t('scraping.noUsername')} · ${credential.authenticationModeName}`,
})));
const jobOptions = computed(() => jobs.value
    .filter((job) => !scrapingSourceId.value || job.scrapingSourceId === scrapingSourceId.value)
    .map((job) => ({
    value: job.id,
    label: `${job.carrierName || job.scrapingSourceName || 'Job'} · ${job.portOfLoadingName || '?'} → ${job.portOfDischargeName || '?'} · ${t('scraping.readyDateDynamicShort')}: ${dynamicReadyDate.value}`,
})));
const selectedSource = computed(() => sources.value.find((source) => source.id === scrapingSourceId.value) ?? null);
const selectedCredential = computed(() => credentials.value.find((credential) => credential.id === scrapingCredentialId.value) ?? null);
const selectedJob = computed(() => jobs.value.find((job) => job.id === scrapingJobId.value) ?? null);
const isMaerskSource = computed(() => {
    const source = selectedSource.value;
    if (!source)
        return false;
    return [source.code, source.name, source.baseUrl, source.carrierCode, source.carrierName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes('maersk'));
});
const sourceRequiresLogin = computed(() => Boolean(selectedSource.value?.requiresLogin || isMaerskSource.value));
const canBootstrap = computed(() => Boolean((scrapingSourceId.value || executionUrl.value) && !bootstrapLoading.value));
const canRun = computed(() => Boolean(scrapingJobId.value || url.value.trim().startsWith('http')));
const success = computed(() => result.value?.success !== false && !result.value?.errorMessage);
const bootstrapSuccess = computed(() => bootstrapResult.value?.success === true);
const executionUrl = computed(() => {
    const manualUrl = url.value.trim();
    if (manualUrl)
        return manualUrl;
    if (selectedSource.value?.baseUrl)
        return selectedSource.value.baseUrl;
    return isMaerskSource.value ? 'https://www.maersk.com/book/' : null;
});
const storageStateKey = computed(() => {
    const credentialPart = scrapingCredentialId.value || selectedCredential.value?.id || 'anonymous';
    if (scrapingSourceId.value) {
        return `sources/${scrapingSourceId.value}/credentials/${credentialPart}`;
    }
    const target = executionUrl.value;
    if (!target)
        return null;
    try {
        const parsed = new URL(target);
        return `manual/${parsed.hostname}/${credentialPart}`;
    }
    catch {
        return `manual/custom/${credentialPart}`;
    }
});
watch(scrapingSourceId, () => {
    bootstrapResult.value = null;
    if (!credentialOptions.value.some((option) => option.value === scrapingCredentialId.value)) {
        scrapingCredentialId.value = '';
    }
    if (!jobOptions.value.some((option) => option.value === scrapingJobId.value)) {
        scrapingJobId.value = '';
    }
});
watch(scrapingCredentialId, () => {
    bootstrapResult.value = null;
});
watch(scrapingJobId, (jobId) => {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job)
        return;
    if (job.scrapingSourceId)
        scrapingSourceId.value = job.scrapingSourceId;
});
function nextReadyDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function buildRequest(overrides = {}) {
    return {
        url: executionUrl.value,
        scrapingSourceId: scrapingSourceId.value || null,
        scrapingCredentialId: scrapingCredentialId.value || null,
        scrapingJobId: scrapingJobId.value || null,
        waitForSelector: waitForSelector.value.trim() || null,
        timeoutSeconds: Number(timeoutSeconds.value) || 180,
        userAgent: null,
        headers: null,
        waitAfterLoadMilliseconds: 1000,
        captureScreenshot: captureScreenshot.value,
        captureHtml: captureHtml.value,
        viewportWidth: 1440,
        viewportHeight: 900,
        reuseSession: reuseSession.value,
        forceLogin: forceLogin.value,
        resetSession: resetSession.value,
        storageStateKey: storageStateKey.value,
        persistResult: persistResult.value,
        completeJob: completeJob.value,
        loginStepsJson: loginStepsJson.value.trim() || null,
        navigationStepsJson: navigationStepsJson.value.trim() || null,
        extractionRulesJson: extractionRulesJson.value.trim() || null,
        inputValues: { readyDate: nextReadyDate(), effectiveReadyDate: nextReadyDate() },
        ...overrides,
    };
}
async function loadData() {
    try {
        loadingData.value = true;
        const [sourcesResult, credentialsResult, jobsResult] = await Promise.all([
            ScrapingService.browseSources({ pageNumber: 1, pageSize: 100 }),
            ScrapingService.browseCredentials({ pageNumber: 1, pageSize: 100 }),
            ScrapingService.browseJobs({ pageNumber: 1, pageSize: 100 }),
        ]);
        sources.value = sourcesResult.items;
        credentials.value = credentialsResult.items;
        jobs.value = jobsResult.items;
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.loadError'));
    }
    finally {
        loadingData.value = false;
    }
}
async function bootstrapAuthentication() {
    if (!canBootstrap.value) {
        toastStore.error(t('common.error'), t('scraping.authBootstrapNeedsTarget'));
        return;
    }
    try {
        bootstrapLoading.value = true;
        bootstrapResult.value = await ScrapingService.bootstrapAuthentication(buildRequest({
            scrapingJobId: null,
            timeoutSeconds: Number(bootstrapTimeoutSeconds.value) || 300,
            captureHtml: false,
            captureScreenshot: false,
            persistResult: false,
            completeJob: false,
            reuseSession: true,
            storageStateKey: storageStateKey.value,
            forceLogin: true,
            resetSession: true,
            loginStepsJson: null,
            navigationStepsJson: null,
            extractionRulesJson: null,
        }));
        if (!bootstrapResult.value.success) {
            toastStore.error(t('scraping.authBootstrapFailed'), bootstrapResult.value.errorMessage || t('scraping.authBootstrapFailedHint'));
            return;
        }
        reuseSession.value = true;
        forceLogin.value = false;
        resetSession.value = false;
        toastStore.success(t('scraping.authBootstrapSuccess'), t('scraping.authBootstrapSuccessHint'));
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.authBootstrapError'));
    }
    finally {
        bootstrapLoading.value = false;
    }
}
async function execute() {
    if (!canRun.value) {
        toastStore.error(t('common.error'), t('scraping.manualNeedsJobOrUrl'));
        return;
    }
    try {
        loading.value = true;
        result.value = await ScrapingService.executeManual(buildRequest());
        if (result.value.success === false || result.value.errorMessage) {
            toastStore.error(t('common.error'), result.value.errorMessage || result.value.message || t('scraping.manualError'));
            return;
        }
        toastStore.success(t('scraping.manualSuccess'));
    }
    catch (error) {
        toastStore.backendError(error, t('scraping.manualError'));
    }
    finally {
        loading.value = false;
    }
}
function clearResult() {
    result.value = null;
}
useViewShortcuts({ save: loadData, refresh: loadData });
onMounted(loadData);
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
    title: (__VLS_ctx.t('scraping.manualTitle')),
    subtitle: (__VLS_ctx.t('scraping.manualSubtitle')),
    icon: (__VLS_ctx.Bot),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('scraping.manualTitle')),
    subtitle: (__VLS_ctx.t('scraping.manualSubtitle')),
    icon: (__VLS_ctx.Bot),
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
        loading: (__VLS_ctx.loadingData),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
        loading: (__VLS_ctx.loadingData),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.loadData),
    };
    var __VLS_10;
    var __VLS_11;
    if (__VLS_ctx.result) {
        let __VLS_14;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('common.clear')),
            variant: "secondary",
        }));
        const __VLS_16 = __VLS_15({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('common.clear')),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        let __VLS_19;
        const __VLS_20 = {
            /** @type {typeof __VLS_19.click} */
            onClick: (__VLS_ctx.clearResult),
        };
        var __VLS_17;
        var __VLS_18;
    }
    let __VLS_21;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Play),
        label: (__VLS_ctx.t('scraping.execute')),
        disabled: (!__VLS_ctx.canRun || __VLS_ctx.loading),
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.Play),
        label: (__VLS_ctx.t('scraping.execute')),
        disabled: (!__VLS_ctx.canRun || __VLS_ctx.loading),
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = {
        /** @type {typeof __VLS_26.click} */
        onClick: (__VLS_ctx.execute),
    };
    var __VLS_24;
    var __VLS_25;
    // @ts-ignore
    [t, t, t, t, t, Bot, RefreshCcw, loadingData, loadData, result, clearResult, Play, canRun, loading, loading, execute,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-wrap items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
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
(__VLS_ctx.t('scraping.realExecution'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.realExecutionHint'));
let __VLS_28;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
    label: (__VLS_ctx.persistResult ? __VLS_ctx.t('scraping.persistResult') : __VLS_ctx.t('scraping.previewOnly')),
    variant: (__VLS_ctx.persistResult ? 'success' : 'neutral'),
}));
const __VLS_30 = __VLS_29({
    label: (__VLS_ctx.persistResult ? __VLS_ctx.t('scraping.persistResult') : __VLS_ctx.t('scraping.previewOnly')),
    variant: (__VLS_ctx.persistResult ? 'success' : 'neutral'),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
let __VLS_33;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
    modelValue: (__VLS_ctx.scrapingJobId),
    label: (__VLS_ctx.t('scraping.job')),
    placeholder: (__VLS_ctx.t('scraping.selectJob')),
    options: (__VLS_ctx.jobOptions),
}));
const __VLS_35 = __VLS_34({
    modelValue: (__VLS_ctx.scrapingJobId),
    label: (__VLS_ctx.t('scraping.job')),
    placeholder: (__VLS_ctx.t('scraping.selectJob')),
    options: (__VLS_ctx.jobOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
if (__VLS_ctx.selectedJob) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.selectedJob.carrierName || __VLS_ctx.selectedJob.scrapingSourceName);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    (__VLS_ctx.selectedJob.portOfLoadingName);
    (__VLS_ctx.selectedJob.portOfDischargeName);
    (__VLS_ctx.selectedJob.containerTypeName);
    (__VLS_ctx.t('scraping.readyDateDynamicShort'));
    (__VLS_ctx.dynamicReadyDate);
    if (__VLS_ctx.selectedJob.scheduledAtUtc) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        (__VLS_ctx.t('scraping.scheduledAt'));
        (__VLS_ctx.selectedJob.scheduledAtUtc);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_38;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
    modelValue: (__VLS_ctx.scrapingSourceId),
    label: (__VLS_ctx.t('scraping.source')),
    placeholder: (__VLS_ctx.t('scraping.selectSource')),
    options: (__VLS_ctx.sourceOptions),
}));
const __VLS_40 = __VLS_39({
    modelValue: (__VLS_ctx.scrapingSourceId),
    label: (__VLS_ctx.t('scraping.source')),
    placeholder: (__VLS_ctx.t('scraping.selectSource')),
    options: (__VLS_ctx.sourceOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_39));
let __VLS_43;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_44 = __VLS_asFunctionalComponent1(__VLS_43, new __VLS_43({
    modelValue: (__VLS_ctx.scrapingCredentialId),
    label: (__VLS_ctx.t('scraping.credential')),
    placeholder: (__VLS_ctx.t('scraping.autoCredential')),
    options: (__VLS_ctx.credentialOptions),
}));
const __VLS_45 = __VLS_44({
    modelValue: (__VLS_ctx.scrapingCredentialId),
    label: (__VLS_ctx.t('scraping.credential')),
    placeholder: (__VLS_ctx.t('scraping.autoCredential')),
    options: (__VLS_ctx.credentialOptions),
}, ...__VLS_functionalComponentArgsRest(__VLS_44));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex flex-wrap items-start justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-2xl bg-[var(--dh-primary-soft)] p-3 text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary-soft)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_48;
/** @ts-ignore @type { | typeof __VLS_components.KeyRound} */
KeyRound;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent1(__VLS_48, new __VLS_48({
    ...{ class: "h-5 w-5" },
}));
const __VLS_50 = __VLS_49({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('scraping.authBootstrapTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.authBootstrapHint'));
let __VLS_53;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
    label: (__VLS_ctx.bootstrapSuccess ? __VLS_ctx.t('scraping.sessionReady') : __VLS_ctx.t('scraping.sessionNotReady')),
    variant: (__VLS_ctx.bootstrapSuccess ? 'success' : 'warning'),
}));
const __VLS_55 = __VLS_54({
    label: (__VLS_ctx.bootstrapSuccess ? __VLS_ctx.t('scraping.sessionReady') : __VLS_ctx.t('scraping.sessionNotReady')),
    variant: (__VLS_ctx.bootstrapSuccess ? 'success' : 'warning'),
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-4" },
});
/** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
let __VLS_58;
/** @ts-ignore @type { | typeof __VLS_components.ShieldCheck} */
ShieldCheck;
// @ts-ignore
const __VLS_59 = __VLS_asFunctionalComponent1(__VLS_58, new __VLS_58({
    ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" },
}));
const __VLS_60 = __VLS_59({
    ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_59));
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('scraping.authBootstrapStepTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.authBootstrapStepHint'));
if (__VLS_ctx.sourceRequiresLogin && !__VLS_ctx.bootstrapSuccess) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-amber-500/25 bg-amber-500/10 p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-500/25']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    let __VLS_63;
    /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
    AlertTriangle;
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent1(__VLS_63, new __VLS_63({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-400" },
    }));
    const __VLS_65 = __VLS_64({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold leading-5 text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('scraping.authBootstrapWarning'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:grid-cols-[minmax(0,1fr)_10rem]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-[minmax(0,1fr)_10rem]']} */ ;
let __VLS_68;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
    modelValue: (__VLS_ctx.bootstrapTimeoutSeconds),
    label: (__VLS_ctx.t('scraping.authBootstrapTimeout')),
    type: "number",
}));
const __VLS_70 = __VLS_69({
    modelValue: (__VLS_ctx.bootstrapTimeoutSeconds),
    label: (__VLS_ctx.t('scraping.authBootstrapTimeout')),
    type: "number",
}, ...__VLS_functionalComponentArgsRest(__VLS_69));
let __VLS_73;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
    ...{ 'onClick': {} },
    ...{ class: "self-end" },
    icon: (__VLS_ctx.KeyRound),
    label: (__VLS_ctx.t('scraping.authBootstrapAction')),
    disabled: (!__VLS_ctx.canBootstrap),
    loading: (__VLS_ctx.bootstrapLoading),
}));
const __VLS_75 = __VLS_74({
    ...{ 'onClick': {} },
    ...{ class: "self-end" },
    icon: (__VLS_ctx.KeyRound),
    label: (__VLS_ctx.t('scraping.authBootstrapAction')),
    disabled: (!__VLS_ctx.canBootstrap),
    loading: (__VLS_ctx.bootstrapLoading),
}, ...__VLS_functionalComponentArgsRest(__VLS_74));
let __VLS_78;
const __VLS_79 = {
    /** @type {typeof __VLS_78.click} */
    onClick: (__VLS_ctx.bootstrapAuthentication),
};
/** @type {__VLS_StyleScopedClasses['self-end']} */ ;
var __VLS_76;
var __VLS_77;
if (__VLS_ctx.bootstrapResult) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.authBootstrapResult'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 break-all text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.bootstrapResult.finalUrl || __VLS_ctx.bootstrapResult.initialUrl);
    if (__VLS_ctx.storageStateKey) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.t('scraping.storageStateKey'));
        (__VLS_ctx.storageStateKey);
    }
    if (__VLS_ctx.bootstrapResult.storageStatePath) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.t('scraping.storageState'));
        (__VLS_ctx.bootstrapResult.storageStatePath);
    }
    if (__VLS_ctx.bootstrapResult.persistentProfilePath) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.t('scraping.profilePath'));
        (__VLS_ctx.bootstrapResult.persistentProfilePath);
    }
    let __VLS_80;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
        label: (__VLS_ctx.bootstrapSuccess ? __VLS_ctx.t('common.success') : __VLS_ctx.t('common.failed')),
        variant: (__VLS_ctx.bootstrapSuccess ? 'success' : 'danger'),
    }));
    const __VLS_82 = __VLS_81({
        label: (__VLS_ctx.bootstrapSuccess ? __VLS_ctx.t('common.success') : __VLS_ctx.t('common.failed')),
        variant: (__VLS_ctx.bootstrapSuccess ? 'success' : 'danger'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    if (__VLS_ctx.bootstrapResult.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-3 text-sm font-semibold text-red-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
        (__VLS_ctx.bootstrapResult.errorMessage);
    }
    if (__VLS_ctx.bootstrapResult.diagnostics?.length) {
        let __VLS_85;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
            ...{ 'onClick': {} },
            ...{ class: "mt-3" },
            label: (__VLS_ctx.showBootstrapDiagnostics ? __VLS_ctx.t('scraping.hideDiagnostics') : __VLS_ctx.t('scraping.showDiagnostics')),
            variant: "secondary",
            size: "sm",
        }));
        const __VLS_87 = __VLS_86({
            ...{ 'onClick': {} },
            ...{ class: "mt-3" },
            label: (__VLS_ctx.showBootstrapDiagnostics ? __VLS_ctx.t('scraping.hideDiagnostics') : __VLS_ctx.t('scraping.showDiagnostics')),
            variant: "secondary",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_86));
        let __VLS_90;
        const __VLS_91 = {
            /** @type {typeof __VLS_90.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.bootstrapResult))
                    return;
                if (!(__VLS_ctx.bootstrapResult.diagnostics?.length))
                    return;
                __VLS_ctx.showBootstrapDiagnostics = !__VLS_ctx.showBootstrapDiagnostics;
                // @ts-ignore
                [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, persistResult, persistResult, scrapingJobId, jobOptions, selectedJob, selectedJob, selectedJob, selectedJob, selectedJob, selectedJob, selectedJob, selectedJob, dynamicReadyDate, scrapingSourceId, sourceOptions, scrapingCredentialId, credentialOptions, bootstrapSuccess, bootstrapSuccess, bootstrapSuccess, bootstrapSuccess, bootstrapSuccess, sourceRequiresLogin, bootstrapTimeoutSeconds, KeyRound, canBootstrap, bootstrapLoading, bootstrapAuthentication, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, bootstrapResult, storageStateKey, storageStateKey, showBootstrapDiagnostics, showBootstrapDiagnostics, showBootstrapDiagnostics,];
            },
        };
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        var __VLS_88;
        var __VLS_89;
    }
    if (__VLS_ctx.showBootstrapDiagnostics && __VLS_ctx.bootstrapResult.diagnostics?.length) {
        let __VLS_92;
        /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
        DhTextarea;
        // @ts-ignore
        const __VLS_93 = __VLS_asFunctionalComponent1(__VLS_92, new __VLS_92({
            ...{ class: "mt-3" },
            modelValue: (__VLS_ctx.bootstrapResult.diagnostics.join('\n')),
            label: (__VLS_ctx.t('scraping.diagnostics')),
            readonly: true,
            rows: (7),
        }));
        const __VLS_94 = __VLS_93({
            ...{ class: "mt-3" },
            modelValue: (__VLS_ctx.bootstrapResult.diagnostics.join('\n')),
            label: (__VLS_ctx.t('scraping.diagnostics')),
            readonly: true,
            rows: (7),
        }, ...__VLS_functionalComponentArgsRest(__VLS_93));
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('scraping.runOptions'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('scraping.runOptionsHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 sm:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
let __VLS_97;
/** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
DhSwitch;
// @ts-ignore
const __VLS_98 = __VLS_asFunctionalComponent1(__VLS_97, new __VLS_97({
    modelValue: (__VLS_ctx.reuseSession),
    label: (__VLS_ctx.t('scraping.reuseSession')),
}));
const __VLS_99 = __VLS_98({
    modelValue: (__VLS_ctx.reuseSession),
    label: (__VLS_ctx.t('scraping.reuseSession')),
}, ...__VLS_functionalComponentArgsRest(__VLS_98));
let __VLS_102;
/** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
DhSwitch;
// @ts-ignore
const __VLS_103 = __VLS_asFunctionalComponent1(__VLS_102, new __VLS_102({
    modelValue: (__VLS_ctx.forceLogin),
    label: (__VLS_ctx.t('scraping.forceLogin')),
}));
const __VLS_104 = __VLS_103({
    modelValue: (__VLS_ctx.forceLogin),
    label: (__VLS_ctx.t('scraping.forceLogin')),
}, ...__VLS_functionalComponentArgsRest(__VLS_103));
let __VLS_107;
/** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
DhSwitch;
// @ts-ignore
const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
    modelValue: (__VLS_ctx.resetSession),
    label: (__VLS_ctx.t('scraping.resetSession')),
}));
const __VLS_109 = __VLS_108({
    modelValue: (__VLS_ctx.resetSession),
    label: (__VLS_ctx.t('scraping.resetSession')),
}, ...__VLS_functionalComponentArgsRest(__VLS_108));
let __VLS_112;
/** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
DhSwitch;
// @ts-ignore
const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
    modelValue: (__VLS_ctx.persistResult),
    label: (__VLS_ctx.t('scraping.persistResult')),
}));
const __VLS_114 = __VLS_113({
    modelValue: (__VLS_ctx.persistResult),
    label: (__VLS_ctx.t('scraping.persistResult')),
}, ...__VLS_functionalComponentArgsRest(__VLS_113));
let __VLS_117;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
    ...{ 'onClick': {} },
    ...{ class: "mt-4" },
    label: (__VLS_ctx.showAdvanced ? __VLS_ctx.t('scraping.hideAdvanced') : __VLS_ctx.t('scraping.showAdvanced')),
    variant: "secondary",
}));
const __VLS_119 = __VLS_118({
    ...{ 'onClick': {} },
    ...{ class: "mt-4" },
    label: (__VLS_ctx.showAdvanced ? __VLS_ctx.t('scraping.hideAdvanced') : __VLS_ctx.t('scraping.showAdvanced')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_118));
let __VLS_122;
const __VLS_123 = {
    /** @type {typeof __VLS_122.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.showAdvanced = !__VLS_ctx.showAdvanced;
        // @ts-ignore
        [t, t, t, t, t, t, t, t, t, persistResult, bootstrapResult, bootstrapResult, showBootstrapDiagnostics, reuseSession, forceLogin, resetSession, showAdvanced, showAdvanced, showAdvanced,];
    },
};
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
var __VLS_120;
var __VLS_121;
if (__VLS_ctx.showAdvanced) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
    });
    /** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-4" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('scraping.advancedManualOptions'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.advancedManualOptionsHint'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    let __VLS_124;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_125 = __VLS_asFunctionalComponent1(__VLS_124, new __VLS_124({
        modelValue: (__VLS_ctx.url),
        label: (__VLS_ctx.t('scraping.url')),
        placeholder: "https://www.maersk.com/book/",
    }));
    const __VLS_126 = __VLS_125({
        modelValue: (__VLS_ctx.url),
        label: (__VLS_ctx.t('scraping.url')),
        placeholder: "https://www.maersk.com/book/",
    }, ...__VLS_functionalComponentArgsRest(__VLS_125));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    let __VLS_129;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_130 = __VLS_asFunctionalComponent1(__VLS_129, new __VLS_129({
        modelValue: (__VLS_ctx.waitForSelector),
        label: (__VLS_ctx.t('scraping.waitForSelector')),
        placeholder: "#mc-input-origin",
    }));
    const __VLS_131 = __VLS_130({
        modelValue: (__VLS_ctx.waitForSelector),
        label: (__VLS_ctx.t('scraping.waitForSelector')),
        placeholder: "#mc-input-origin",
    }, ...__VLS_functionalComponentArgsRest(__VLS_130));
    let __VLS_134;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_135 = __VLS_asFunctionalComponent1(__VLS_134, new __VLS_134({
        modelValue: (__VLS_ctx.timeoutSeconds),
        label: (__VLS_ctx.t('scraping.timeoutSeconds')),
        type: "number",
    }));
    const __VLS_136 = __VLS_135({
        modelValue: (__VLS_ctx.timeoutSeconds),
        label: (__VLS_ctx.t('scraping.timeoutSeconds')),
        type: "number",
    }, ...__VLS_functionalComponentArgsRest(__VLS_135));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 sm:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
    let __VLS_139;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_140 = __VLS_asFunctionalComponent1(__VLS_139, new __VLS_139({
        modelValue: (__VLS_ctx.completeJob),
        label: (__VLS_ctx.t('scraping.completeJobAfterManual')),
    }));
    const __VLS_141 = __VLS_140({
        modelValue: (__VLS_ctx.completeJob),
        label: (__VLS_ctx.t('scraping.completeJobAfterManual')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_140));
    let __VLS_144;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_145 = __VLS_asFunctionalComponent1(__VLS_144, new __VLS_144({
        modelValue: (__VLS_ctx.captureScreenshot),
        label: (__VLS_ctx.t('scraping.captureScreenshot')),
    }));
    const __VLS_146 = __VLS_145({
        modelValue: (__VLS_ctx.captureScreenshot),
        label: (__VLS_ctx.t('scraping.captureScreenshot')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_145));
    let __VLS_149;
    /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
    DhSwitch;
    // @ts-ignore
    const __VLS_150 = __VLS_asFunctionalComponent1(__VLS_149, new __VLS_149({
        modelValue: (__VLS_ctx.captureHtml),
        label: (__VLS_ctx.t('scraping.captureHtml')),
    }));
    const __VLS_151 = __VLS_150({
        modelValue: (__VLS_ctx.captureHtml),
        label: (__VLS_ctx.t('scraping.captureHtml')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_150));
    let __VLS_154;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_155 = __VLS_asFunctionalComponent1(__VLS_154, new __VLS_154({
        modelValue: (__VLS_ctx.loginStepsJson),
        label: (__VLS_ctx.t('scraping.loginStepsOverride')),
        rows: (4),
    }));
    const __VLS_156 = __VLS_155({
        modelValue: (__VLS_ctx.loginStepsJson),
        label: (__VLS_ctx.t('scraping.loginStepsOverride')),
        rows: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_155));
    let __VLS_159;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_160 = __VLS_asFunctionalComponent1(__VLS_159, new __VLS_159({
        modelValue: (__VLS_ctx.navigationStepsJson),
        label: (__VLS_ctx.t('scraping.navigationStepsOverride')),
        rows: (4),
    }));
    const __VLS_161 = __VLS_160({
        modelValue: (__VLS_ctx.navigationStepsJson),
        label: (__VLS_ctx.t('scraping.navigationStepsOverride')),
        rows: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_160));
    let __VLS_164;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_165 = __VLS_asFunctionalComponent1(__VLS_164, new __VLS_164({
        modelValue: (__VLS_ctx.extractionRulesJson),
        label: (__VLS_ctx.t('scraping.extractionRulesOverride')),
        rows: (4),
    }));
    const __VLS_166 = __VLS_165({
        modelValue: (__VLS_ctx.extractionRulesJson),
        label: (__VLS_ctx.t('scraping.extractionRulesOverride')),
        rows: (4),
    }, ...__VLS_functionalComponentArgsRest(__VLS_165));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    let __VLS_169;
    /** @ts-ignore @type { | typeof __VLS_components.Globe2} */
    Globe2;
    // @ts-ignore
    const __VLS_170 = __VLS_asFunctionalComponent1(__VLS_169, new __VLS_169({
        ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
    }));
    const __VLS_171 = __VLS_170({
        ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_170));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('scraping.manualNoteTitle'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.manualNote'));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
if (!__VLS_ctx.result) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex min-h-[22rem] items-center justify-center text-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[22rem]']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    let __VLS_174;
    /** @ts-ignore @type { | typeof __VLS_components.Bot} */
    Bot;
    // @ts-ignore
    const __VLS_175 = __VLS_asFunctionalComponent1(__VLS_174, new __VLS_174({
        ...{ class: "mx-auto h-10 w-10 text-[var(--dh-primary)]" },
    }));
    const __VLS_176 = __VLS_175({
        ...{ class: "mx-auto h-10 w-10 text-[var(--dh-primary)]" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_175));
    /** @type {__VLS_StyleScopedClasses['mx-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "mt-3 text-xl font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('scraping.noManualResult'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.noManualResultHint'));
    if (__VLS_ctx.bootstrapSuccess) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-400" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-emerald-500/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-emerald-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-400']} */ ;
        let __VLS_179;
        /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_180 = __VLS_asFunctionalComponent1(__VLS_179, new __VLS_179({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_181 = __VLS_180({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_180));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        (__VLS_ctx.t('scraping.sessionReady'));
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.result'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "mt-1 text-xl font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.result.title || __VLS_ctx.result.finalUrl || __VLS_ctx.result.url || 'Resultado');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.result.finalUrl || __VLS_ctx.result.url);
    let __VLS_184;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent1(__VLS_184, new __VLS_184({
        label: (__VLS_ctx.success ? __VLS_ctx.t('common.success') : __VLS_ctx.t('common.failed')),
        variant: (__VLS_ctx.success ? 'success' : 'danger'),
    }));
    const __VLS_186 = __VLS_185({
        label: (__VLS_ctx.success ? __VLS_ctx.t('common.success') : __VLS_ctx.t('common.failed')),
        variant: (__VLS_ctx.success ? 'success' : 'danger'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    if (__VLS_ctx.result.errorMessage) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-[22px] border border-red-500/25 bg-red-500/10 p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-red-500/25']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-red-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black uppercase tracking-[0.16em] text-red-400" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.16em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-400']} */ ;
        (__VLS_ctx.t('common.error'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 text-sm font-semibold text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.result.errorMessage);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.statusCode'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.result.statusCode ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.elapsed'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (Math.round(__VLS_ctx.result.durationMilliseconds ?? __VLS_ctx.result.elapsedMilliseconds ?? 0));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.evidences'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.result.evidenceCount ?? 0);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('scraping.extractedRates'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.result.extractedRateCount ?? 0);
    if (__VLS_ctx.result.scrapingRunId || __VLS_ctx.result.scrapedRateCandidateId) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-3 md:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-sm font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.result.scrapingRunId || '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-sm font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.result.scrapedRateCandidateId || '—');
    }
    let __VLS_189;
    /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
    DhTextarea;
    // @ts-ignore
    const __VLS_190 = __VLS_asFunctionalComponent1(__VLS_189, new __VLS_189({
        modelValue: (JSON.stringify(__VLS_ctx.result.extractedValues || {}, null, 2)),
        label: (__VLS_ctx.t('scraping.extractedValues')),
        readonly: true,
        rows: (6),
    }));
    const __VLS_191 = __VLS_190({
        modelValue: (JSON.stringify(__VLS_ctx.result.extractedValues || {}, null, 2)),
        label: (__VLS_ctx.t('scraping.extractedValues')),
        readonly: true,
        rows: (6),
    }, ...__VLS_functionalComponentArgsRest(__VLS_190));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.result.diagnostics?.length) {
        let __VLS_194;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_195 = __VLS_asFunctionalComponent1(__VLS_194, new __VLS_194({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.showDiagnostics ? __VLS_ctx.t('scraping.hideDiagnostics') : __VLS_ctx.t('scraping.showDiagnostics')),
            variant: "secondary",
        }));
        const __VLS_196 = __VLS_195({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.showDiagnostics ? __VLS_ctx.t('scraping.hideDiagnostics') : __VLS_ctx.t('scraping.showDiagnostics')),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_195));
        let __VLS_199;
        const __VLS_200 = {
            /** @type {typeof __VLS_199.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.result))
                    return;
                if (!(__VLS_ctx.result.diagnostics?.length))
                    return;
                __VLS_ctx.showDiagnostics = !__VLS_ctx.showDiagnostics;
                // @ts-ignore
                [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, result, result, result, result, result, result, result, result, result, result, result, result, result, result, result, result, result, result, result, bootstrapSuccess, showAdvanced, url, waitForSelector, timeoutSeconds, completeJob, captureScreenshot, captureHtml, loginStepsJson, navigationStepsJson, extractionRulesJson, success, success, showDiagnostics, showDiagnostics, showDiagnostics,];
            },
        };
        var __VLS_197;
        var __VLS_198;
    }
    if (__VLS_ctx.result.html) {
        let __VLS_201;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_202 = __VLS_asFunctionalComponent1(__VLS_201, new __VLS_201({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.showHtml ? __VLS_ctx.t('scraping.hideHtml') : __VLS_ctx.t('scraping.showHtml')),
            variant: "secondary",
        }));
        const __VLS_203 = __VLS_202({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.showHtml ? __VLS_ctx.t('scraping.hideHtml') : __VLS_ctx.t('scraping.showHtml')),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_202));
        let __VLS_206;
        const __VLS_207 = {
            /** @type {typeof __VLS_206.click} */
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.result))
                    return;
                if (!(__VLS_ctx.result.html))
                    return;
                __VLS_ctx.showHtml = !__VLS_ctx.showHtml;
                // @ts-ignore
                [t, t, result, showHtml, showHtml, showHtml,];
            },
        };
        var __VLS_204;
        var __VLS_205;
    }
    if (__VLS_ctx.showDiagnostics && __VLS_ctx.result.diagnostics?.length) {
        let __VLS_208;
        /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
        DhTextarea;
        // @ts-ignore
        const __VLS_209 = __VLS_asFunctionalComponent1(__VLS_208, new __VLS_208({
            modelValue: ((__VLS_ctx.result.diagnostics || []).join('\n')),
            label: (__VLS_ctx.t('scraping.diagnostics')),
            readonly: true,
            rows: (8),
        }));
        const __VLS_210 = __VLS_209({
            modelValue: ((__VLS_ctx.result.diagnostics || []).join('\n')),
            label: (__VLS_ctx.t('scraping.diagnostics')),
            readonly: true,
            rows: (8),
        }, ...__VLS_functionalComponentArgsRest(__VLS_209));
    }
    if (__VLS_ctx.showHtml && __VLS_ctx.result.html) {
        let __VLS_213;
        /** @ts-ignore @type { | typeof __VLS_components.DhTextarea} */
        DhTextarea;
        // @ts-ignore
        const __VLS_214 = __VLS_asFunctionalComponent1(__VLS_213, new __VLS_213({
            modelValue: (__VLS_ctx.result.html),
            label: "HTML",
            readonly: true,
            rows: (8),
        }));
        const __VLS_215 = __VLS_214({
            modelValue: (__VLS_ctx.result.html),
            label: "HTML",
            readonly: true,
            rows: (8),
        }, ...__VLS_functionalComponentArgsRest(__VLS_214));
    }
}
// @ts-ignore
[t, result, result, result, result, showDiagnostics, showHtml,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
