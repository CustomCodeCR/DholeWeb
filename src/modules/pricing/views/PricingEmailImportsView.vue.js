import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Inbox, Mail, Paperclip, RefreshCw, } from 'lucide-vue-next';
import { DhBadge, DhButton, DhInput, DhSelect } from '@/shared/components/atoms';
import { DhDataTable, DhPagination } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
import { EmailExtractionService } from '@/core/services/emailExtractionService';
import PricingEmailMessageDrawer from '@/modules/pricing/components/PricingEmailMessageDrawer.vue';
const AUTO_REFRESH_MS = 30_000;
const router = useRouter();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const rows = ref([]);
const accounts = ref([]);
const jobs = ref([]);
const loading = ref(false);
const refreshing = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const lastUpdatedAt = ref(null);
let refreshTimer;
const filters = reactive({
    search: '',
    status: '',
    accountId: '',
});
const columns = [
    { key: 'sender', label: 'Remitente' },
    { key: 'subject', label: 'Correo' },
    { key: 'receivedAt', label: 'Recibido' },
    { key: 'confidence', label: 'Confianza', align: 'center' },
    { key: 'status', label: 'Extracción', align: 'center' },
    { key: 'pricing', label: 'Pricing', align: 'center' },
    { key: 'actions', label: '', align: 'right', width: '96px' },
];
const statusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Recibidos', value: 'Received' },
    { label: 'En cola', value: 'Queued' },
    { label: 'Procesando', value: 'Processing' },
    { label: 'Extraídos', value: 'Extracted' },
    { label: 'Necesitan revisión', value: 'NeedsReview' },
    { label: 'Fallidos', value: 'Failed' },
    { label: 'Ignorados', value: 'Ignored' },
    { label: 'Duplicados', value: 'Duplicated' },
];
const accountOptions = computed(() => [
    { label: 'Todas las cuentas', value: '' },
    ...accounts.value.map((account) => ({
        label: `${account.name} · ${account.emailAddress}`,
        value: account.id,
    })),
]);
const latestJobByMessage = computed(() => {
    const result = new Map();
    for (const job of jobs.value) {
        if (!result.has(job.emailMessageId))
            result.set(job.emailMessageId, job);
    }
    return result;
});
const summary = computed(() => {
    const sentMessageIds = new Set(jobs.value.filter((job) => job.status === 'SentToPricing').map((job) => job.emailMessageId));
    const inProgress = rows.value.filter((message) => ['Received', 'Queued', 'Processing'].includes(message.status)).length;
    const review = rows.value.filter((message) => message.status === 'NeedsReview').length;
    const failed = rows.value.filter((message) => message.status === 'Failed').length;
    return { sent: sentMessageIds.size, inProgress, review, failed };
});
const accountWithError = computed(() => accounts.value.find((account) => account.lastSyncError));
function accountName(id) {
    return accounts.value.find((account) => account.id === id)?.name ?? 'Cuenta de correo';
}
function messageStatusLabel(status) {
    return {
        Received: 'Recibido',
        Queued: 'En cola',
        Processing: 'Procesando',
        Extracted: 'Extraído',
        NeedsReview: 'Necesita revisión',
        Ignored: 'Ignorado',
        Duplicated: 'Duplicado',
        Failed: 'Fallido',
    }[status] ?? status;
}
function jobStatusLabel(status) {
    return {
        Pending: 'Pendiente',
        Processing: 'Procesando',
        SentToPricing: 'Enviado',
        NeedsReview: 'No enviado',
        Failed: 'Falló',
        Ignored: 'Ignorado',
    }[status] ?? status;
}
function statusVariant(status) {
    if (status === 'Extracted' || status === 'SentToPricing')
        return 'success';
    if (status === 'Failed')
        return 'danger';
    if (status === 'NeedsReview' || status === 'Queued' || status === 'Pending')
        return 'warning';
    if (status === 'Processing' || status === 'Received')
        return 'primary';
    return 'neutral';
}
function formatDateTime(value) {
    if (!value)
        return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return value;
    return new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}
function confidenceVariant(value) {
    if (value == null)
        return 'neutral';
    if (value >= 80)
        return 'success';
    if (value >= 60)
        return 'warning';
    return 'danger';
}
function latestJob(messageId) {
    return latestJobByMessage.value.get(messageId);
}
async function load(silent = false) {
    if (loading.value || refreshing.value)
        return;
    try {
        if (silent)
            refreshing.value = true;
        else
            loading.value = true;
        const [accountResult, messageResult, jobResult] = await Promise.all([
            EmailExtractionService.browseAccounts({ pageNumber: 1, pageSize: 100 }),
            EmailExtractionService.browseMessages({
                pageNumber: page.value,
                pageSize: pageSize.value,
                search: filters.search || undefined,
                status: filters.status || undefined,
                accountId: filters.accountId || undefined,
            }),
            EmailExtractionService.browseExtractionJobs({ pageNumber: 1, pageSize: 100 }),
        ]);
        accounts.value = accountResult.items;
        rows.value = messageResult.items;
        jobs.value = jobResult.items;
        total.value = messageResult.totalCount ?? messageResult.items.length;
        lastUpdatedAt.value = new Date();
    }
    catch (error) {
        if (!silent)
            toastStore.backendError(error, 'No se pudo cargar la bandeja de correos.');
    }
    finally {
        loading.value = false;
        refreshing.value = false;
    }
}
function applyFilters() {
    page.value = 1;
    load();
}
function clearFilters() {
    Object.assign(filters, { search: '', status: '', accountId: '' });
    applyFilters();
}
function openDetail(message) {
    drawerStore.open({
        title: 'Detalle del correo de tarifas',
        component: PricingEmailMessageDrawer,
        size: 'xl',
        props: {
            message,
            onReprocessed: () => load(true),
            onOpenPricing: openPricingBatch,
        },
    });
}
async function reprocess(message) {
    if (message.status !== 'NeedsReview' && message.status !== 'Failed')
        return;
    try {
        await EmailExtractionService.reprocessMessage(message.id);
        toastStore.success('Correo enviado a reproceso', 'La extracción se ejecutará nuevamente y se enviará a Pricing si supera la confianza configurada.');
        await load(true);
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo reprocesar el correo.');
    }
}
function openPricingBatch(batchId) {
    drawerStore.close();
    router.push({ path: '/pricing/imports', query: { importBatchId: batchId } });
}
function scheduleRefresh() {
    refreshTimer = window.setInterval(() => {
        if (!document.hidden)
            load(true);
    }, AUTO_REFRESH_MS);
}
watch([page, pageSize], () => load());
useViewShortcuts({ save: () => load(), refresh: () => load() });
onMounted(async () => {
    await load();
    scheduleRefresh();
});
onBeforeUnmount(() => {
    if (refreshTimer)
        window.clearInterval(refreshTimer);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: "Correos de tarifas",
    subtitle: "Siga cada correo desde la recepción hasta la creación del lote en Pricing.",
    icon: (__VLS_ctx.Mail),
}));
const __VLS_2 = __VLS_1({
    title: "Correos de tarifas",
    subtitle: "Siga cada correo desde la recepción hasta la creación del lote en Pricing.",
    icon: (__VLS_ctx.Mail),
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
        label: "Actualizar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        loading: (__VLS_ctx.refreshing),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        label: "Actualizar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        loading: (__VLS_ctx.refreshing),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (...[$event]) => {
            __VLS_ctx.load(true);
            // @ts-ignore
            [Mail, RefreshCw, refreshing, load,];
        },
    };
    var __VLS_10;
    var __VLS_11;
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_3;
if (__VLS_ctx.accountWithError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border border-red-500/20 bg-red-500/10 p-5" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-red-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-red-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    let __VLS_14;
    /** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
    AlertTriangle;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-red-500" },
    }));
    const __VLS_16 = __VLS_15({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-red-500" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.accountWithError.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-soft)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    (__VLS_ctx.accountWithError.lastSyncError);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.formatDateTime(__VLS_ctx.accountWithError.lastSyncAt));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[26px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_19;
/** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
CheckCircle2;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    ...{ class: "h-5 w-5 text-emerald-500" },
}));
const __VLS_21 = __VLS_20({
    ...{ class: "h-5 w-5 text-emerald-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-emerald-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.summary.sent);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[26px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.Clock3} */
Clock3;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}));
const __VLS_26 = __VLS_25({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.summary.inProgress);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[26px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_29;
/** @ts-ignore @type { | typeof __VLS_components.AlertTriangle} */
AlertTriangle;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
    ...{ class: "h-5 w-5 text-amber-500" },
}));
const __VLS_31 = __VLS_30({
    ...{ class: "h-5 w-5 text-amber-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-amber-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.summary.review);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[26px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
let __VLS_34;
/** @ts-ignore @type { | typeof __VLS_components.Inbox} */
Inbox;
// @ts-ignore
const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
    ...{ class: "h-5 w-5 text-red-500" },
}));
const __VLS_36 = __VLS_35({
    ...{ class: "h-5 w-5 text-red-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_35));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.summary.failed);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.total);
if (__VLS_ctx.lastUpdatedAt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.formatDateTime(__VLS_ctx.lastUpdatedAt.toISOString()));
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 sm:grid-cols-3 xl:w-[760px]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
/** @type {__VLS_StyleScopedClasses['xl:w-[760px]']} */ ;
let __VLS_39;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.filters.search),
    type: "search",
    label: "Buscar",
    placeholder: "Asunto o remitente",
}));
const __VLS_41 = __VLS_40({
    ...{ 'onKeyup': {} },
    modelValue: (__VLS_ctx.filters.search),
    type: "search",
    label: "Buscar",
    placeholder: "Asunto o remitente",
}, ...__VLS_functionalComponentArgsRest(__VLS_40));
let __VLS_44;
const __VLS_45 = {
    /** @type {typeof __VLS_44.keyup} */
    onKeyup: (__VLS_ctx.applyFilters),
};
var __VLS_42;
var __VLS_43;
let __VLS_46;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    modelValue: (__VLS_ctx.filters.accountId),
    label: "Cuenta",
    options: (__VLS_ctx.accountOptions),
    placeholder: "",
}));
const __VLS_48 = __VLS_47({
    modelValue: (__VLS_ctx.filters.accountId),
    label: "Cuenta",
    options: (__VLS_ctx.accountOptions),
    placeholder: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
let __VLS_51;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
    modelValue: (__VLS_ctx.filters.status),
    label: "Estado",
    options: (__VLS_ctx.statusOptions),
    placeholder: "",
}));
const __VLS_53 = __VLS_52({
    modelValue: (__VLS_ctx.filters.status),
    label: "Estado",
    options: (__VLS_ctx.statusOptions),
    placeholder: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_52));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_56;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    label: "Limpiar",
    variant: "ghost",
    size: "sm",
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    label: "Limpiar",
    variant: "ghost",
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_61;
const __VLS_62 = {
    /** @type {typeof __VLS_61.click} */
    onClick: (__VLS_ctx.clearFilters),
};
var __VLS_59;
var __VLS_60;
let __VLS_63;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_64 = __VLS_asFunctionalComponent1(__VLS_63, new __VLS_63({
    ...{ 'onClick': {} },
    label: "Aplicar filtros",
    size: "sm",
}));
const __VLS_65 = __VLS_64({
    ...{ 'onClick': {} },
    label: "Aplicar filtros",
    size: "sm",
}, ...__VLS_functionalComponentArgsRest(__VLS_64));
let __VLS_68;
const __VLS_69 = {
    /** @type {typeof __VLS_68.click} */
    onClick: (__VLS_ctx.applyFilters),
};
var __VLS_66;
var __VLS_67;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_70;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay correos de tarifas que coincidan con los filtros.",
}));
const __VLS_72 = __VLS_71({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay correos de tarifas que coincidan con los filtros.",
}, ...__VLS_functionalComponentArgsRest(__VLS_71));
let __VLS_75;
const __VLS_76 = {
    /** @type {typeof __VLS_75.rowClick} */
    onRowClick: (__VLS_ctx.openDetail),
};
const { default: __VLS_77 } = __VLS_73.slots;
{
    const { 'cell-sender': __VLS_78 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_78);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "max-w-56" },
    });
    /** @type {__VLS_StyleScopedClasses['max-w-56']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "truncate font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (row.fromName || row.fromAddress);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "truncate text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.fromAddress);
    // @ts-ignore
    [accountWithError, accountWithError, accountWithError, accountWithError, formatDateTime, formatDateTime, summary, summary, summary, summary, total, lastUpdatedAt, lastUpdatedAt, filters, filters, filters, applyFilters, applyFilters, accountOptions, statusOptions, clearFilters, columns, rows, loading, openDetail,];
}
{
    const { 'cell-subject': __VLS_79 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_79);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "max-w-72" },
    });
    /** @type {__VLS_StyleScopedClasses['max-w-72']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "truncate font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (row.subject);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-1 flex items-center gap-2 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.accountName(row.emailIngestionAccountId));
    if (row.hasAttachments) {
        let __VLS_80;
        /** @ts-ignore @type { | typeof __VLS_components.Paperclip} */
        Paperclip;
        // @ts-ignore
        const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
            ...{ class: "h-3.5 w-3.5" },
        }));
        const __VLS_82 = __VLS_81({
            ...{ class: "h-3.5 w-3.5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_81));
        /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
    }
    // @ts-ignore
    [accountName,];
}
{
    const { 'cell-receivedAt': __VLS_85 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_85);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "whitespace-nowrap text-xs font-bold" },
    });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.formatDateTime(row.receivedAt));
    // @ts-ignore
    [formatDateTime,];
}
{
    const { 'cell-confidence': __VLS_86 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_86);
    let __VLS_87;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_88 = __VLS_asFunctionalComponent1(__VLS_87, new __VLS_87({
        label: (row.classificationConfidence == null ? 'Sin clasificar' : `${row.classificationConfidence.toFixed(1)}%`),
        variant: (__VLS_ctx.confidenceVariant(row.classificationConfidence)),
    }));
    const __VLS_89 = __VLS_88({
        label: (row.classificationConfidence == null ? 'Sin clasificar' : `${row.classificationConfidence.toFixed(1)}%`),
        variant: (__VLS_ctx.confidenceVariant(row.classificationConfidence)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_88));
    // @ts-ignore
    [confidenceVariant,];
}
{
    const { 'cell-status': __VLS_92 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_92);
    let __VLS_93;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
        label: (__VLS_ctx.messageStatusLabel(row.status)),
        variant: (__VLS_ctx.statusVariant(row.status)),
    }));
    const __VLS_95 = __VLS_94({
        label: (__VLS_ctx.messageStatusLabel(row.status)),
        variant: (__VLS_ctx.statusVariant(row.status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_94));
    // @ts-ignore
    [messageStatusLabel, statusVariant,];
}
{
    const { 'cell-pricing': __VLS_98 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_98);
    if (__VLS_ctx.latestJob(row.id)) {
        let __VLS_99;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
            label: (__VLS_ctx.jobStatusLabel(__VLS_ctx.latestJob(row.id).status)),
            variant: (__VLS_ctx.statusVariant(__VLS_ctx.latestJob(row.id).status)),
        }));
        const __VLS_101 = __VLS_100({
            label: (__VLS_ctx.jobStatusLabel(__VLS_ctx.latestJob(row.id).status)),
            variant: (__VLS_ctx.statusVariant(__VLS_ctx.latestJob(row.id).status)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_100));
    }
    else if (row.status === 'Extracted') {
        let __VLS_104;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
            label: "Enviado",
            variant: "success",
        }));
        const __VLS_106 = __VLS_105({
            label: "Enviado",
            variant: "success",
        }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    }
    // @ts-ignore
    [statusVariant, latestJob, latestJob, latestJob, jobStatusLabel,];
}
{
    const { 'cell-actions': __VLS_109 } = __VLS_73.slots;
    const [{ row }] = __VLS_vSlot(__VLS_109);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "flex justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    if (__VLS_ctx.latestJob(row.id)?.pricingImportBatchId) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.latestJob(row.id)?.pricingImportBatchId))
                        return;
                    __VLS_ctx.openPricingBatch(__VLS_ctx.latestJob(row.id).pricingImportBatchId);
                    // @ts-ignore
                    [latestJob, latestJob, openPricingBatch,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 text-emerald-600 hover:bg-emerald-500/10" },
            title: "Ver lote en Pricing",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-emerald-500/10']} */ ;
        let __VLS_110;
        /** @ts-ignore @type { | typeof __VLS_components.ExternalLink} */
        ExternalLink;
        // @ts-ignore
        const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_112 = __VLS_111({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_111));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    if (row.status === 'NeedsReview' || row.status === 'Failed') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(row.status === 'NeedsReview' || row.status === 'Failed'))
                        return;
                    __VLS_ctx.reprocess(row);
                    // @ts-ignore
                    [reprocess,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]" },
            title: "Reprocesar correo",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]']} */ ;
        let __VLS_115;
        /** @ts-ignore @type { | typeof __VLS_components.RefreshCw} */
        RefreshCw;
        // @ts-ignore
        const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_117 = __VLS_116({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_116));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_73;
var __VLS_74;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_120;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_122 = __VLS_121({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_121));
// @ts-ignore
[total, page, pageSize,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
