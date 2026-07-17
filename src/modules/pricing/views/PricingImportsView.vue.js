import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Check, Eye, FileSpreadsheet, Import, Mail, Ship, Trash2, X } from 'lucide-vue-next';
import { DhBadge, DhButton, DhCheckbox, DhInput, DhSelect } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination, } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useAuthStore } from '@/core/stores/authStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue';
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue';
import PricingImportPreviewDrawer from '@/modules/pricing/components/PricingImportPreviewDrawer.vue';
import PricingReasonModal from '@/modules/pricing/components/PricingReasonModal.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat';
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const rows = ref([]);
const selectedIds = ref([]);
const loading = ref(false);
const filtersOpen = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const batchFilter = ref(typeof route.query.importBatchId === 'string' ? route.query.importBatchId : '');
const refreshing = ref(false);
const bulkApproving = ref(false);
const processingId = ref(null);
let refreshTimer;
const filters = reactive({
    search: '',
    status: '',
    sourceType: '',
    agentId: '',
    carrierId: '',
    polId: '',
    poeId: '',
    podId: '',
    containerTypeId: '',
    currencyId: '',
    quoteDate: '',
    validFrom: '',
    validTo: '',
});
const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create));
const canApprove = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve));
const canReject = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.reject));
const canDelete = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.delete));
const canCreateRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create) &&
    authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate));
const allSelected = computed(() => rows.value.length > 0 && rows.value.every((row) => selectedIds.value.includes(row.id)));
const selectedRows = computed(() => rows.value.filter((row) => selectedIds.value.includes(row.id)));
const selectedPendingIds = computed(() => selectedRows.value.filter((row) => row.status === 'Pending').map((row) => row.id));
const columns = [
    { key: 'selected', label: '', width: '48px', align: 'center' },
    { key: 'carrier', label: 'Naviera' },
    { key: 'agent', label: 'Agente' },
    { key: 'route', label: 'Ruta' },
    { key: 'containerType', label: 'Contenedor' },
    { key: 'freight', label: 'Flete', align: 'right' },
    { key: 'freeDays', label: 'Días libres', align: 'center' },
    { key: 'validity', label: 'Vigencia' },
    { key: 'status', label: 'Estado', align: 'center' },
    { key: 'usedAsRateCount', label: 'Uso', align: 'center' },
    { key: 'actions', label: '', align: 'right', width: '190px' },
];
const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Pendientes', value: 'Pending' },
    { label: 'Aprobadas', value: 'Approved' },
    { label: 'Rechazadas', value: 'Rejected' },
    { label: 'Creadas', value: 'Created' },
];
const sourceOptions = [
    { label: 'Todos', value: '' },
    { label: 'Correo', value: 'Email' },
    { label: 'PDF', value: 'Pdf' },
    { label: 'Excel', value: 'Excel' },
    { label: 'CSV', value: 'Csv' },
    { label: 'Imagen', value: 'Image' },
];
function statusLabel(status) {
    return ({
        Pending: 'Pendiente',
        Approved: 'Aprobada',
        Rejected: 'Rechazada',
        Created: 'Creada',
        Expired: 'Vencida',
    }[status] ?? status);
}
function sourceLabel(sourceType) {
    return ({
        Email: 'Correo',
        Pdf: 'PDF',
        Excel: 'Excel',
        Csv: 'CSV',
        Image: 'Imagen',
    }[sourceType] ?? sourceType);
}
function catalogLabel(items, id, value, fallback = '—') {
    return catalogs.findBestMatch(items, id, value)?.name || value || fallback;
}
function carrierLabel(row) {
    return catalogLabel(catalogs.carriers.value, row.carrierId, row.carrier);
}
function agentLabel(row) {
    return catalogLabel(catalogs.agents.value, row.agentId, row.agent, 'Por asignar');
}
function polLabel(row) {
    return catalogLabel(catalogs.polPorts.value, row.polId, row.pol);
}
function poeLabel(row) {
    return catalogLabel(catalogs.poePorts.value, row.poeId, row.poe, '');
}
function podLabel(row) {
    return catalogLabel(catalogs.podPorts.value, row.podId, row.pod);
}
function routeLabel(row) {
    return [polLabel(row), poeLabel(row), podLabel(row)].filter(Boolean).join(' → ');
}
function containerLabel(row) {
    return catalogLabel(catalogs.containerTypes.value, row.containerTypeId, row.containerType);
}
function currencyName(row) {
    return catalogLabel(catalogs.currencies.value, row.currencyId, row.currency, 'USD');
}
function filterValue(items, id) {
    const item = catalogs.findById(items, id);
    if (!item)
        return undefined;
    const values = [...new Set([item.code, item.name].map((value) => value.trim()).filter(Boolean))];
    return values.join('|') || undefined;
}
async function load(silent = false) {
    if (loading.value || refreshing.value)
        return;
    try {
        if (silent)
            refreshing.value = true;
        else
            loading.value = true;
        const result = await PricingService.browseImportRates({
            pageNumber: page.value,
            pageSize: pageSize.value,
            importBatchId: batchFilter.value || undefined,
            search: filters.search || undefined,
            status: filters.status || undefined,
            sourceType: filters.sourceType || undefined,
            agent: filterValue(catalogs.agents.value, filters.agentId),
            carrier: filterValue(catalogs.carriers.value, filters.carrierId),
            pol: filterValue(catalogs.polPorts.value, filters.polId),
            poe: filterValue(catalogs.poePorts.value, filters.poeId),
            pod: filterValue(catalogs.podPorts.value, filters.podId),
            containerType: filterValue(catalogs.containerTypes.value, filters.containerTypeId),
            currency: filterValue(catalogs.currencies.value, filters.currencyId),
            quoteDate: filters.quoteDate || undefined,
            validFrom: filters.validFrom || undefined,
            validTo: filters.validTo || undefined,
        });
        rows.value = result.items;
        total.value = result.totalCount ?? result.items.length;
        selectedIds.value = selectedIds.value.filter((id) => result.items.some((row) => row.id === id));
    }
    catch (error) {
        if (!silent)
            toastStore.backendError(error, 'No se pudieron cargar las tarifas importadas.');
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
    Object.assign(filters, {
        search: '',
        status: '',
        sourceType: '',
        agentId: '',
        carrierId: '',
        polId: '',
        poeId: '',
        podId: '',
        containerTypeId: '',
        currencyId: '',
        quoteDate: '',
        validFrom: '',
        validTo: '',
    });
    batchFilter.value = '';
    if (route.query.importBatchId) {
        const query = { ...route.query };
        delete query.importBatchId;
        router.replace({ query });
    }
    applyFilters();
}
function clearBatchFilter() {
    batchFilter.value = '';
    const query = { ...route.query };
    delete query.importBatchId;
    router.replace({ query });
    page.value = 1;
    load();
}
function toggleSelection(id) {
    selectedIds.value = selectedIds.value.includes(id)
        ? selectedIds.value.filter((value) => value !== id)
        : [...selectedIds.value, id];
}
function toggleAll() {
    selectedIds.value = allSelected.value ? [] : rows.value.map((row) => row.id);
}
function clearSelection() {
    selectedIds.value = [];
}
async function approveOne(row) {
    if (!canApprove.value || row.status !== 'Pending' || processingId.value)
        return;
    try {
        processingId.value = row.id;
        await PricingService.approveImportRate(row.id);
        toastStore.success('Importación aprobada');
        await load();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo aprobar la importación.');
    }
    finally {
        processingId.value = null;
    }
}
async function approveSelected() {
    const ids = [...selectedPendingIds.value];
    if (!canApprove.value || !ids.length || bulkApproving.value)
        return;
    try {
        bulkApproving.value = true;
        await PricingService.approveImportRates(ids);
        toastStore.success(`${ids.length} importación${ids.length === 1 ? '' : 'es'} aprobada${ids.length === 1 ? '' : 's'}`);
        clearSelection();
        await load();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron aprobar las importaciones seleccionadas.');
    }
    finally {
        bulkApproving.value = false;
    }
}
function rejectSelected() {
    const ids = [...selectedPendingIds.value];
    if (!canReject.value || !ids.length)
        return;
    modalStore.open({
        title: 'Rechazar importaciones',
        component: PricingReasonModal,
        props: {
            target: 'import',
            ids,
            onSaved: async () => {
                clearSelection();
                await load();
            },
        },
    });
}
function openUpload() {
    drawerStore.open({
        title: 'Importar tarifario',
        component: PricingUploadDrawer,
        size: 'lg',
        props: { onSaved: load },
    });
}
function openConvert(row) {
    if (!canCreateRate.value || row.status === 'Rejected')
        return;
    if (row.status !== 'Approved') {
        toastStore.warning('Aprobación requerida', 'Apruebe la importación antes de convertirla en tarifa.');
        return;
    }
    drawerStore.open({
        title: 'Crear tarifa desde importación',
        component: PricingRateFormDrawer,
        size: 'full',
        props: { sourceImport: row, onSaved: load },
    });
}
function openEmailInbox() {
    router.push('/pricing/email-imports');
}
function openPreview(row) {
    drawerStore.open({
        title: 'Detalle de tarifa importada',
        component: PricingImportPreviewDrawer,
        size: 'xl',
        props: {
            importRate: row,
            canApprove: canApprove.value,
            canReject: canReject.value,
            canCreateRate: canCreateRate.value,
            onApproved: load,
            onReject: (current) => {
                drawerStore.close();
                reject(current);
            },
            onCreateRate: openConvert,
        },
    });
}
function reject(row) {
    if (!canReject.value || row.status !== 'Pending')
        return;
    modalStore.open({
        title: 'Rechazar importación',
        component: PricingReasonModal,
        props: { target: 'import', id: row.id, onSaved: load },
    });
}
function confirmDelete() {
    if (!selectedIds.value.length)
        return;
    modalStore.open({
        title: 'Eliminar importaciones',
        component: DhConfirmDialog,
        props: {
            title: 'Eliminar importaciones',
            message: `¿Desea eliminar ${selectedIds.value.length} tarifa${selectedIds.value.length === 1 ? '' : 's'} importada${selectedIds.value.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await PricingService.deleteImportRates(selectedIds.value);
                selectedIds.value = [];
                modalStore.close();
                toastStore.success('Importaciones eliminadas');
                await load();
            },
            onCancel: modalStore.close,
        },
    });
}
watch([page, pageSize], () => load());
watch(() => route.query.importBatchId, (value) => {
    const next = typeof value === 'string' ? value : '';
    if (next === batchFilter.value)
        return;
    batchFilter.value = next;
    page.value = 1;
    load();
});
useViewShortcuts({
    create: () => {
        if (canUpload.value)
            openUpload();
    },
    save: load,
    refresh: load,
});
onMounted(async () => {
    await catalogs.loadAll();
    await load();
    refreshTimer = window.setInterval(() => {
        if (!document.hidden)
            load(true);
    }, 30_000);
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
    title: "Tarifas importadas",
    subtitle: "Revise, apruebe y convierta los tarifarios extraídos en tarifas oficiales.",
    icon: (__VLS_ctx.Import),
}));
const __VLS_2 = __VLS_1({
    title: "Tarifas importadas",
    subtitle: "Revise, apruebe y convierta los tarifarios extraídos en tarifas oficiales.",
    icon: (__VLS_ctx.Import),
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
        label: "Correos de tarifas",
        icon: (__VLS_ctx.Mail),
        variant: "secondary",
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        label: "Correos de tarifas",
        icon: (__VLS_ctx.Mail),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.openEmailInbox),
    };
    var __VLS_10;
    var __VLS_11;
    if (__VLS_ctx.canUpload) {
        let __VLS_14;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            ...{ 'onClick': {} },
            label: "Importar tarifario",
            icon: (__VLS_ctx.FileSpreadsheet),
        }));
        const __VLS_16 = __VLS_15({
            ...{ 'onClick': {} },
            label: "Importar tarifario",
            icon: (__VLS_ctx.FileSpreadsheet),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        let __VLS_19;
        const __VLS_20 = {
            /** @type {typeof __VLS_19.click} */
            onClick: (__VLS_ctx.openUpload),
        };
        var __VLS_17;
        var __VLS_18;
    }
    // @ts-ignore
    [Import, Mail, openEmailInbox, canUpload, FileSpreadsheet, openUpload,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
if (__VLS_ctx.batchFilter) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-5 flex flex-col gap-3 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-emerald-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-emerald-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-emerald-700 dark:text-emerald-300" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-700']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-emerald-300']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 break-all text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.batchFilter);
    let __VLS_21;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        ...{ 'onClick': {} },
        label: "Ver todas",
        variant: "secondary",
        size: "sm",
    }));
    const __VLS_23 = __VLS_22({
        ...{ 'onClick': {} },
        label: "Ver todas",
        variant: "secondary",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    let __VLS_26;
    const __VLS_27 = {
        /** @type {typeof __VLS_26.click} */
        onClick: (__VLS_ctx.clearBatchFilter),
    };
    var __VLS_24;
    var __VLS_25;
}
let __VLS_28;
/** @ts-ignore @type { | typeof __VLS_components.DhCrudToolbar | typeof __VLS_components.DhCrudToolbar} */
DhCrudToolbar;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onSearch': {} },
    ...{ 'onFilter': {} },
    search: (__VLS_ctx.filters.search),
    title: "Bandeja de revisión",
    createLabel: "Importar tarifario",
    showCreate: (__VLS_ctx.canUpload),
}));
const __VLS_30 = __VLS_29({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onSearch': {} },
    ...{ 'onFilter': {} },
    search: (__VLS_ctx.filters.search),
    title: "Bandeja de revisión",
    createLabel: "Importar tarifario",
    showCreate: (__VLS_ctx.canUpload),
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
let __VLS_33;
const __VLS_34 = {
    /** @type {typeof __VLS_33.create} */
    onCreate: (__VLS_ctx.openUpload),
};
const __VLS_35 = {
    /** @type {typeof __VLS_33.refresh} */
    onRefresh: (__VLS_ctx.load),
};
const __VLS_36 = {
    /** @type {typeof __VLS_33.search} */
    onSearch: (__VLS_ctx.applyFilters),
};
const __VLS_37 = {
    /** @type {typeof __VLS_33.filter} */
    onFilter: (...[$event]) => {
        __VLS_ctx.filtersOpen = !__VLS_ctx.filtersOpen;
        // @ts-ignore
        [canUpload, openUpload, batchFilter, batchFilter, clearBatchFilter, filters, load, applyFilters, filtersOpen, filtersOpen,];
    },
};
const { default: __VLS_38 } = __VLS_31.slots;
{
    const { description: __VLS_39 } = __VLS_31.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.total);
    // @ts-ignore
    [total,];
}
// @ts-ignore
[];
var __VLS_31;
var __VLS_32;
if (__VLS_ctx.filtersOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 rounded-[26px] border border-[var(--dh-border)] bg-black/[0.025] p-4 dark:bg-white/[0.04]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.025]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.04]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 md:grid-cols-2 xl:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
    let __VLS_40;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        modelValue: (__VLS_ctx.filters.status),
        label: "Estado",
        options: (__VLS_ctx.statusOptions),
        placeholder: "",
    }));
    const __VLS_42 = __VLS_41({
        modelValue: (__VLS_ctx.filters.status),
        label: "Estado",
        options: (__VLS_ctx.statusOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    let __VLS_45;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
        modelValue: (__VLS_ctx.filters.sourceType),
        label: "Origen",
        options: (__VLS_ctx.sourceOptions),
        placeholder: "",
    }));
    const __VLS_47 = __VLS_46({
        modelValue: (__VLS_ctx.filters.sourceType),
        label: "Origen",
        options: (__VLS_ctx.sourceOptions),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    let __VLS_50;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }));
    const __VLS_52 = __VLS_51({
        modelValue: (__VLS_ctx.filters.agentId),
        label: "Agente",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.agentOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_51));
    let __VLS_55;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }));
    const __VLS_57 = __VLS_56({
        modelValue: (__VLS_ctx.filters.carrierId),
        label: "Naviera",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.carrierOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_56));
    let __VLS_60;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        modelValue: (__VLS_ctx.filters.containerTypeId),
        label: "Contenedor",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.containerOptions.value]),
        placeholder: "",
    }));
    const __VLS_62 = __VLS_61({
        modelValue: (__VLS_ctx.filters.containerTypeId),
        label: "Contenedor",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.containerOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
        modelValue: (__VLS_ctx.filters.polId),
        label: "POL",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.polOptions.value]),
        placeholder: "",
    }));
    const __VLS_67 = __VLS_66({
        modelValue: (__VLS_ctx.filters.polId),
        label: "POL",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.polOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    let __VLS_70;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
        modelValue: (__VLS_ctx.filters.poeId),
        label: "POE",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.poeOptions.value]),
        placeholder: "",
    }));
    const __VLS_72 = __VLS_71({
        modelValue: (__VLS_ctx.filters.poeId),
        label: "POE",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.poeOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
    let __VLS_75;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
        modelValue: (__VLS_ctx.filters.podId),
        label: "POD",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.podOptions.value]),
        placeholder: "",
    }));
    const __VLS_77 = __VLS_76({
        modelValue: (__VLS_ctx.filters.podId),
        label: "POD",
        options: ([{ label: 'Todos', value: '' }, ...__VLS_ctx.catalogs.podOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    let __VLS_80;
    /** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
    DhSelect;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }));
    const __VLS_82 = __VLS_81({
        modelValue: (__VLS_ctx.filters.currencyId),
        label: "Moneda",
        options: ([{ label: 'Todas', value: '' }, ...__VLS_ctx.catalogs.currencyOptions.value]),
        placeholder: "",
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    let __VLS_85;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
        modelValue: (__VLS_ctx.filters.quoteDate),
        type: "date",
        label: "Fecha de cotización",
    }));
    const __VLS_87 = __VLS_86({
        modelValue: (__VLS_ctx.filters.quoteDate),
        type: "date",
        label: "Fecha de cotización",
    }, ...__VLS_functionalComponentArgsRest(__VLS_86));
    let __VLS_90;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
        modelValue: (__VLS_ctx.filters.validFrom),
        type: "date",
        label: "Vigente desde",
    }));
    const __VLS_92 = __VLS_91({
        modelValue: (__VLS_ctx.filters.validFrom),
        type: "date",
        label: "Vigente desde",
    }, ...__VLS_functionalComponentArgsRest(__VLS_91));
    let __VLS_95;
    /** @ts-ignore @type { | typeof __VLS_components.DhInput} */
    DhInput;
    // @ts-ignore
    const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({
        modelValue: (__VLS_ctx.filters.validTo),
        type: "date",
        label: "Vigente hasta",
    }));
    const __VLS_97 = __VLS_96({
        modelValue: (__VLS_ctx.filters.validTo),
        type: "date",
        label: "Vigente hasta",
    }, ...__VLS_functionalComponentArgsRest(__VLS_96));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 flex justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    let __VLS_100;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }));
    const __VLS_102 = __VLS_101({
        ...{ 'onClick': {} },
        label: "Limpiar",
        variant: "ghost",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_101));
    let __VLS_105;
    const __VLS_106 = {
        /** @type {typeof __VLS_105.click} */
        onClick: (__VLS_ctx.clearFilters),
    };
    var __VLS_103;
    var __VLS_104;
    let __VLS_107;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }));
    const __VLS_109 = __VLS_108({
        ...{ 'onClick': {} },
        label: "Aplicar filtros",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_108));
    let __VLS_112;
    const __VLS_113 = {
        /** @type {typeof __VLS_112.click} */
        onClick: (__VLS_ctx.applyFilters),
    };
    var __VLS_110;
    var __VLS_111;
}
if (__VLS_ctx.rows.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 flex flex-col gap-3 rounded-[22px] border border-[var(--dh-border)] bg-black/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.03]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/[0.02]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.03]']} */ ;
    let __VLS_114;
    /** @ts-ignore @type { | typeof __VLS_components.DhCheckbox} */
    DhCheckbox;
    // @ts-ignore
    const __VLS_115 = __VLS_asFunctionalComponent1(__VLS_114, new __VLS_114({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.allSelected),
        label: "Seleccionar todo",
        description: "Selecciona todos los registros visibles en esta página.",
    }));
    const __VLS_116 = __VLS_115({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.allSelected),
        label: "Seleccionar todo",
        description: "Selecciona todos los registros visibles en esta página.",
    }, ...__VLS_functionalComponentArgsRest(__VLS_115));
    let __VLS_119;
    const __VLS_120 = {
        /** @type {typeof __VLS_119.'update:modelValue'} */
        'onUpdate:modelValue': (__VLS_ctx.toggleAll),
    };
    var __VLS_117;
    var __VLS_118;
    if (__VLS_ctx.selectedIds.length) {
        let __VLS_121;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_122 = __VLS_asFunctionalComponent1(__VLS_121, new __VLS_121({
            ...{ 'onClick': {} },
            label: "Limpiar selección",
            variant: "ghost",
            size: "sm",
        }));
        const __VLS_123 = __VLS_122({
            ...{ 'onClick': {} },
            label: "Limpiar selección",
            variant: "ghost",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_122));
        let __VLS_126;
        const __VLS_127 = {
            /** @type {typeof __VLS_126.click} */
            onClick: (__VLS_ctx.clearSelection),
        };
        var __VLS_124;
        var __VLS_125;
    }
}
if (__VLS_ctx.selectedIds.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex flex-col gap-3 rounded-[22px] dh-bg-primary-soft px-4 py-3 lg:flex-row lg:items-center lg:justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    (__VLS_ctx.selectedIds.length);
    (__VLS_ctx.selectedIds.length === 1 ? '' : 's');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.selectedPendingIds.length);
    (__VLS_ctx.selectedPendingIds.length === 1 ? '' : 's');
    (__VLS_ctx.selectedPendingIds.length === 1 ? '' : 's');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap justify-end gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.canApprove && __VLS_ctx.selectedPendingIds.length) {
        let __VLS_128;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_129 = __VLS_asFunctionalComponent1(__VLS_128, new __VLS_128({
            ...{ 'onClick': {} },
            label: (`Aprobar (${__VLS_ctx.selectedPendingIds.length})`),
            icon: (__VLS_ctx.Check),
            size: "sm",
            loading: (__VLS_ctx.bulkApproving),
        }));
        const __VLS_130 = __VLS_129({
            ...{ 'onClick': {} },
            label: (`Aprobar (${__VLS_ctx.selectedPendingIds.length})`),
            icon: (__VLS_ctx.Check),
            size: "sm",
            loading: (__VLS_ctx.bulkApproving),
        }, ...__VLS_functionalComponentArgsRest(__VLS_129));
        let __VLS_133;
        const __VLS_134 = {
            /** @type {typeof __VLS_133.click} */
            onClick: (__VLS_ctx.approveSelected),
        };
        var __VLS_131;
        var __VLS_132;
    }
    if (__VLS_ctx.canReject && __VLS_ctx.selectedPendingIds.length) {
        let __VLS_135;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_136 = __VLS_asFunctionalComponent1(__VLS_135, new __VLS_135({
            ...{ 'onClick': {} },
            label: (`Rechazar (${__VLS_ctx.selectedPendingIds.length})`),
            icon: (__VLS_ctx.X),
            variant: "danger",
            size: "sm",
        }));
        const __VLS_137 = __VLS_136({
            ...{ 'onClick': {} },
            label: (`Rechazar (${__VLS_ctx.selectedPendingIds.length})`),
            icon: (__VLS_ctx.X),
            variant: "danger",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_136));
        let __VLS_140;
        const __VLS_141 = {
            /** @type {typeof __VLS_140.click} */
            onClick: (__VLS_ctx.rejectSelected),
        };
        var __VLS_138;
        var __VLS_139;
    }
    if (__VLS_ctx.canDelete) {
        let __VLS_142;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_143 = __VLS_asFunctionalComponent1(__VLS_142, new __VLS_142({
            ...{ 'onClick': {} },
            label: "Eliminar seleccionadas",
            icon: (__VLS_ctx.Trash2),
            variant: "danger",
            size: "sm",
        }));
        const __VLS_144 = __VLS_143({
            ...{ 'onClick': {} },
            label: "Eliminar seleccionadas",
            icon: (__VLS_ctx.Trash2),
            variant: "danger",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_143));
        let __VLS_147;
        const __VLS_148 = {
            /** @type {typeof __VLS_147.click} */
            onClick: (__VLS_ctx.confirmDelete),
        };
        var __VLS_145;
        var __VLS_146;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_149;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_150 = __VLS_asFunctionalComponent1(__VLS_149, new __VLS_149({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay tarifas importadas que coincidan con los filtros.",
}));
const __VLS_151 = __VLS_150({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.rows),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay tarifas importadas que coincidan con los filtros.",
}, ...__VLS_functionalComponentArgsRest(__VLS_150));
let __VLS_154;
const __VLS_155 = {
    /** @type {typeof __VLS_154.rowClick} */
    onRowClick: (__VLS_ctx.openPreview),
};
const { default: __VLS_156 } = __VLS_152.slots;
{
    const { 'cell-selected': __VLS_157 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_157);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_158;
    /** @ts-ignore @type { | typeof __VLS_components.DhCheckbox} */
    DhCheckbox;
    // @ts-ignore
    const __VLS_159 = __VLS_asFunctionalComponent1(__VLS_158, new __VLS_158({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedIds.includes(row.id)),
    }));
    const __VLS_160 = __VLS_159({
        ...{ 'onUpdate:modelValue': {} },
        modelValue: (__VLS_ctx.selectedIds.includes(row.id)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_159));
    let __VLS_163;
    const __VLS_164 = {
        /** @type {typeof __VLS_163.'update:modelValue'} */
        'onUpdate:modelValue': (...[$event]) => {
            __VLS_ctx.toggleSelection(row.id);
            // @ts-ignore
            [filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, filters, applyFilters, filtersOpen, statusOptions, sourceOptions, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, catalogs, clearFilters, rows, rows, allSelected, toggleAll, selectedIds, selectedIds, selectedIds, selectedIds, selectedIds, clearSelection, selectedPendingIds, selectedPendingIds, selectedPendingIds, selectedPendingIds, selectedPendingIds, selectedPendingIds, selectedPendingIds, canApprove, Check, bulkApproving, approveSelected, canReject, X, rejectSelected, canDelete, Trash2, confirmDelete, columns, loading, openPreview, toggleSelection,];
        },
    };
    var __VLS_161;
    var __VLS_162;
    // @ts-ignore
    [];
}
{
    const { 'cell-carrier': __VLS_165 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_165);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.carrierLabel(row));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.sourceLabel(row.sourceType));
    // @ts-ignore
    [carrierLabel, sourceLabel,];
}
{
    const { 'cell-agent': __VLS_166 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_166);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-bold" },
        ...{ class: (__VLS_ctx.agentLabel(row) === 'Por asignar' ? 'text-amber-600 dark:text-amber-400' : '') },
    });
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    (__VLS_ctx.agentLabel(row));
    // @ts-ignore
    [agentLabel, agentLabel,];
}
{
    const { 'cell-route': __VLS_167 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_167);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "whitespace-nowrap font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.routeLabel(row));
    // @ts-ignore
    [routeLabel,];
}
{
    const { 'cell-containerType': __VLS_168 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_168);
    let __VLS_169;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_170 = __VLS_asFunctionalComponent1(__VLS_169, new __VLS_169({
        label: (__VLS_ctx.containerLabel(row)),
        variant: "neutral",
    }));
    const __VLS_171 = __VLS_170({
        label: (__VLS_ctx.containerLabel(row)),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_170));
    // @ts-ignore
    [containerLabel,];
}
{
    const { 'cell-freight': __VLS_174 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_174);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (__VLS_ctx.formatMoney(row.freight, __VLS_ctx.currencyName(row)));
    // @ts-ignore
    [formatMoney, currencyName,];
}
{
    const { 'cell-freeDays': __VLS_175 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_175);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "font-black" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    (row.freeDays);
    // @ts-ignore
    [];
}
{
    const { 'cell-validity': __VLS_176 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_176);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-xs font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.formatDate(row.validFrom));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.formatDate(row.validTo));
    // @ts-ignore
    [formatDate, formatDate,];
}
{
    const { 'cell-status': __VLS_177 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_177);
    let __VLS_178;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_179 = __VLS_asFunctionalComponent1(__VLS_178, new __VLS_178({
        label: (__VLS_ctx.statusLabel(row.status)),
        variant: (__VLS_ctx.statusTone(row.status)),
    }));
    const __VLS_180 = __VLS_179({
        label: (__VLS_ctx.statusLabel(row.status)),
        variant: (__VLS_ctx.statusTone(row.status)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_179));
    // @ts-ignore
    [statusLabel, statusTone,];
}
{
    const { 'cell-usedAsRateCount': __VLS_183 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_183);
    let __VLS_184;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_185 = __VLS_asFunctionalComponent1(__VLS_184, new __VLS_184({
        label: (row.usedAsRateCount ? `Disponible · ${row.usedAsRateCount} usos` : 'Disponible'),
        variant: "success",
    }));
    const __VLS_186 = __VLS_185({
        label: (row.usedAsRateCount ? `Disponible · ${row.usedAsRateCount} usos` : 'Disponible'),
        variant: "success",
    }, ...__VLS_functionalComponentArgsRest(__VLS_185));
    // @ts-ignore
    [];
}
{
    const { 'cell-actions': __VLS_189 } = __VLS_152.slots;
    const [{ row }] = __VLS_vSlot(__VLS_189);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-end gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openPreview(row);
                // @ts-ignore
                [openPreview,];
            } },
        type: "button",
        ...{ class: "rounded-2xl p-2 text-[var(--dh-text-soft)] hover:bg-black/5 dark:hover:bg-white/10" },
        title: "Ver detalle",
    });
    /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
    let __VLS_190;
    /** @ts-ignore @type { | typeof __VLS_components.Eye} */
    Eye;
    // @ts-ignore
    const __VLS_191 = __VLS_asFunctionalComponent1(__VLS_190, new __VLS_190({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_192 = __VLS_191({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_191));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    if (__VLS_ctx.canApprove && row.status === 'Pending') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canApprove && row.status === 'Pending'))
                        return;
                    __VLS_ctx.approveOne(row);
                    // @ts-ignore
                    [canApprove, approveOne,];
                } },
            type: "button",
            disabled: (__VLS_ctx.processingId === row.id),
            ...{ class: "rounded-2xl p-2 text-emerald-600 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50" },
            title: "Aprobar directamente",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-emerald-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-emerald-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
        let __VLS_195;
        /** @ts-ignore @type { | typeof __VLS_components.Check} */
        Check;
        // @ts-ignore
        const __VLS_196 = __VLS_asFunctionalComponent1(__VLS_195, new __VLS_195({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_197 = __VLS_196({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_196));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    if (__VLS_ctx.canReject && row.status === 'Pending') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canReject && row.status === 'Pending'))
                        return;
                    __VLS_ctx.reject(row);
                    // @ts-ignore
                    [canReject, processingId, reject,];
                } },
            type: "button",
            disabled: (__VLS_ctx.processingId === row.id),
            ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50" },
            title: "Rechazar directamente",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
        let __VLS_200;
        /** @ts-ignore @type { | typeof __VLS_components.X} */
        X;
        // @ts-ignore
        const __VLS_201 = __VLS_asFunctionalComponent1(__VLS_200, new __VLS_200({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_202 = __VLS_201({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_201));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    if (__VLS_ctx.canCreateRate && row.status === 'Approved') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.canCreateRate && row.status === 'Approved'))
                        return;
                    __VLS_ctx.openConvert(row);
                    // @ts-ignore
                    [processingId, canCreateRate, openConvert,];
                } },
            type: "button",
            ...{ class: "rounded-2xl p-2 text-[var(--dh-primary)] hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]" },
            title: "Crear tarifa",
        });
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-[rgb(var(--dh-primary-rgb)/0.1)]']} */ ;
        let __VLS_205;
        /** @ts-ignore @type { | typeof __VLS_components.Ship} */
        Ship;
        // @ts-ignore
        const __VLS_206 = __VLS_asFunctionalComponent1(__VLS_205, new __VLS_205({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_207 = __VLS_206({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_206));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_152;
var __VLS_153;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_210;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_211 = __VLS_asFunctionalComponent1(__VLS_210, new __VLS_210({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_212 = __VLS_211({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_211));
// @ts-ignore
[total, page, pageSize,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
