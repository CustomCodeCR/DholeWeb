import { computed, onMounted, reactive, ref, watch } from 'vue';
import { Anchor, CalendarDays, Check, CheckCircle2, CircleDollarSign, FileSpreadsheet, MapPin, Package, RefreshCw, Route, Ship, Sparkles, Truck, } from 'lucide-vue-next';
import { DhBadge, DhButton, DhEmptyState, DhInput, DhSelect, DhSpinner, } from '@/shared/components/atoms';
import { DhPageHeader } from '@/shared/components/organisms';
import { useAuthStore } from '@/core/stores/authStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useToastStore } from '@/core/stores/toastStore';
import { PRICING_SCOPES } from '@/core/auth/scopes';
import { PricingService } from '@/core/services/pricingService';
import PricingRateDetailDrawer from '@/modules/pricing/components/PricingRateDetailDrawer.vue';
import PricingRateFormDrawer from '@/modules/pricing/components/PricingRateFormDrawer.vue';
import PricingUploadDrawer from '@/modules/pricing/components/PricingUploadDrawer.vue';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatDate, formatMoney } from '@/modules/pricing/utils/pricingFormat';
const authStore = useAuthStore();
const drawerStore = useDrawerStore();
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const loading = ref(false);
const selectingImportId = ref('');
const creatingFinalRate = ref(false);
const dashboard = ref(null);
const selectedRate = ref(null);
const selectedImport = ref(null);
const activeLaneKey = ref('limon-moin');
const filters = reactive({ dateFrom: '', dateTo: '', containerTypeId: '' });
const importCache = new Map();
const canUpload = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.create));
const canApproveImport = computed(() => authStore.hasScope(PRICING_SCOPES.importFclRates.approve));
const canCreateFinalRate = computed(() => authStore.hasScope(PRICING_SCOPES.rates.create) &&
    authStore.hasScope(PRICING_SCOPES.importFclRates.createAsRate));
const dateRangeInvalid = computed(() => Boolean(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo));
const containerFilterOptions = computed(() => [
    { label: 'Todos los contenedores', value: '' },
    ...catalogs.containerOptions.value,
]);
function matchesContainer(rate) {
    if (!filters.containerTypeId)
        return true;
    return (catalogs.findBestMatch(catalogs.containerTypes.value, null, rate.containerType)?.id ===
        filters.containerTypeId);
}
const lanes = computed(() => {
    const source = dashboard.value?.lanes ?? [];
    const order = ['limon-moin', 'puerto-caldera', 'multimodal'];
    return [...source]
        .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
        .map((lane) => {
        const rates = lane.rates.filter(matchesContainer);
        return { ...lane, rates, totalOptions: rates.length };
    });
});
const visibleTotalOptions = computed(() => lanes.value.reduce((total, lane) => total + lane.totalOptions, 0));
const activeLane = computed(() => lanes.value.find((lane) => lane.key === activeLaneKey.value) ?? lanes.value[0] ?? null);
const activeRates = computed(() => [...(activeLane.value?.rates ?? [])].sort((a, b) => comparableAmount(a) - comparableAmount(b)));
const selectedStatus = computed(() => selectedImport.value?.status ?? null);
const selectedNeedsApproval = computed(() => selectedStatus.value === 'Pending');
const selectedCanContinue = computed(() => {
    if (!selectedImport.value || !canCreateFinalRate.value)
        return false;
    if (selectedImport.value.status === 'Rejected')
        return false;
    if (selectedImport.value.status === 'Pending')
        return canApproveImport.value;
    return ['Approved', 'Created'].includes(selectedImport.value.status);
});
const finalActionLabel = computed(() => {
    if (selectedNeedsApproval.value && canApproveImport.value)
        return 'Aprobar y crear tarifa final';
    return 'Crear tarifa final';
});
function laneIcon(lane) {
    if (lane.key === 'multimodal')
        return Truck;
    if (lane.key === 'puerto-caldera')
        return Anchor;
    return Ship;
}
function laneAccent(lane, active = false) {
    if (active)
        return 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white shadow-[var(--dh-glow)]';
    if (lane.key === 'multimodal')
        return 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300';
    if (lane.key === 'puerto-caldera')
        return 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300';
}
function normalizeCurrency(value) {
    return value
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
function isUsd(rate) {
    const currency = normalizeCurrency(rate.currency);
    return currency.includes('usd') || currency.includes('dolar') || currency.includes('dollar');
}
function comparableAmount(rate) {
    return rate.internationalOceanFreight + (rate.internationalLandFreight ?? 0);
}
function totalFreightLabel(rate) {
    if (rate.internationalLandFreight == null) {
        return formatMoney(rate.internationalOceanFreight, rate.currency);
    }
    if (isUsd(rate)) {
        return formatMoney(comparableAmount(rate), 'USD');
    }
    return `${formatMoney(rate.internationalOceanFreight, rate.currency)} + ${formatMoney(rate.internationalLandFreight, 'USD')}`;
}
function lowestLaneLabel(lane) {
    if (!lane.rates.length)
        return 'Sin opciones';
    const best = [...lane.rates].sort((a, b) => comparableAmount(a) - comparableAmount(b))[0];
    return `Desde ${totalFreightLabel(best)}`;
}
function statusLabel(status) {
    if (!status)
        return 'Cargando información';
    return {
        Pending: 'Pendiente de aprobación',
        Approved: 'Lista para crear',
        Rejected: 'Rechazada',
        Created: 'Utilizada anteriormente',
        Expired: 'Vencida',
    }[status];
}
function statusVariant(status) {
    if (status === 'Approved' || status === 'Created')
        return 'success';
    if (status === 'Pending')
        return 'warning';
    if (status === 'Rejected' || status === 'Expired')
        return 'danger';
    return 'neutral';
}
function clearSelection() {
    selectedRate.value = null;
    selectedImport.value = null;
    selectingImportId.value = '';
}
function changeLane(key) {
    if (activeLaneKey.value === key)
        return;
    activeLaneKey.value = key;
    clearSelection();
}
async function load() {
    if (dateRangeInvalid.value) {
        toastStore.warning('La fecha desde no puede ser mayor que la fecha hasta.');
        return;
    }
    try {
        loading.value = true;
        dashboard.value = await PricingService.getDecisionDashboard({
            dateFrom: filters.dateFrom || null,
            dateTo: filters.dateTo || null,
        });
        if (!dashboard.value.lanes.some((lane) => lane.key === activeLaneKey.value)) {
            activeLaneKey.value = dashboard.value.lanes[0]?.key ?? 'limon-moin';
        }
        clearSelection();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cargar el dashboard para toma de decisiones.');
    }
    finally {
        loading.value = false;
    }
}
async function clearFilters() {
    filters.dateFrom = '';
    filters.dateTo = '';
    filters.containerTypeId = '';
    await load();
}
function openUpload() {
    drawerStore.open({
        title: 'Importar tarifario',
        component: PricingUploadDrawer,
        size: 'lg',
        props: { onSaved: load },
    });
}
async function selectRate(rate) {
    selectedRate.value = rate;
    selectedImport.value = null;
    selectingImportId.value = rate.importRateId;
    try {
        const cached = importCache.get(rate.importRateId);
        const source = cached ?? (await PricingService.getImportRate(rate.importRateId));
        importCache.set(rate.importRateId, source);
        if (selectedRate.value?.importRateId === rate.importRateId) {
            selectedImport.value = source;
        }
    }
    catch (error) {
        clearSelection();
        toastStore.backendError(error, 'No se pudo cargar la tarifa importada seleccionada.');
    }
    finally {
        if (selectingImportId.value === rate.importRateId)
            selectingImportId.value = '';
    }
}
async function openCreatedRate(rateId) {
    try {
        const createdRate = await PricingService.getRate(rateId);
        drawerStore.open({
            title: 'Tarifa final creada',
            component: PricingRateDetailDrawer,
            size: 'xl',
            props: { rate: createdRate, onSaved: load },
        });
    }
    catch (error) {
        toastStore.backendError(error, 'La tarifa fue creada, pero no se pudo abrir automáticamente su detalle.');
    }
}
async function createFinalRate() {
    if (!selectedRate.value || !selectedImport.value || !selectedCanContinue.value)
        return;
    try {
        creatingFinalRate.value = true;
        let source = selectedImport.value;
        if (source.status === 'Pending') {
            await PricingService.approveImportRate(source.id);
            source = await PricingService.getImportRate(source.id);
            selectedImport.value = source;
            importCache.set(source.id, source);
            toastStore.success('Importación aprobada', 'La alternativa seleccionada ya puede convertirse en tarifa final.');
        }
        drawerStore.open({
            title: `Crear tarifa final · ${source.carrier}`,
            component: PricingRateFormDrawer,
            size: 'full',
            props: {
                sourceImport: source,
                decisionInternationalLandFreight: selectedRate.value?.internationalLandFreight ?? null,
                onSaved: async (rateId) => {
                    await load();
                    if (rateId)
                        await openCreatedRate(rateId);
                },
            },
        });
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo preparar la creación de la tarifa final.');
    }
    finally {
        creatingFinalRate.value = false;
    }
}
watch(() => filters.containerTypeId, () => clearSelection());
onMounted(() => {
    void catalogs.loadAll();
    void load();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "space-y-6 pb-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-6']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: "Mesa de decisión FCL",
    subtitle: "Seleccione una alternativa importada y conviértala directamente en la tarifa final para el cliente.",
    icon: (__VLS_ctx.Route),
}));
const __VLS_2 = __VLS_1({
    title: "Mesa de decisión FCL",
    subtitle: "Seleccione una alternativa importada y conviértala directamente en la tarifa final para el cliente.",
    icon: (__VLS_ctx.Route),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
{
    const { actions: __VLS_6 } = __VLS_3.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    if (__VLS_ctx.canUpload) {
        let __VLS_7;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            ...{ 'onClick': {} },
            label: "Importar tarifario",
            icon: (__VLS_ctx.FileSpreadsheet),
            variant: "secondary",
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onClick': {} },
            label: "Importar tarifario",
            icon: (__VLS_ctx.FileSpreadsheet),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.click} */
            onClick: (__VLS_ctx.openUpload),
        };
        var __VLS_10;
        var __VLS_11;
    }
    let __VLS_14;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
        ...{ 'onClick': {} },
        label: "Actualizar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_16 = __VLS_15({
        ...{ 'onClick': {} },
        label: "Actualizar",
        icon: (__VLS_ctx.RefreshCw),
        variant: "secondary",
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_19;
    const __VLS_20 = {
        /** @type {typeof __VLS_19.click} */
        onClick: (__VLS_ctx.load),
    };
    var __VLS_17;
    var __VLS_18;
    // @ts-ignore
    [Route, canUpload, FileSpreadsheet, openUpload, RefreshCw, loading, load,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-liquid overflow-hidden rounded-[32px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]" },
});
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid lg:grid-cols-[1.25fr_0.75fr]" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[1.25fr_0.75fr]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative overflow-hidden p-6 md:p-8" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div)({
    ...{ class: "pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[var(--dh-primary)] opacity-[0.08] blur-3xl" },
});
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-right-20']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-24']} */ ;
/** @type {__VLS_StyleScopedClasses['h-72']} */ ;
/** @type {__VLS_StyleScopedClasses['w-72']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-[0.08]']} */ ;
/** @type {__VLS_StyleScopedClasses['blur-3xl']} */ ;
let __VLS_21;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    label: "Decisión → cotización final",
    variant: "primary",
}));
const __VLS_23 = __VLS_22({
    label: "Decisión → cotización final",
    variant: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "relative mt-4 max-w-3xl text-3xl font-black tracking-[-0.04em] text-[var(--dh-text)] md:text-4xl" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[-0.04em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
/** @type {__VLS_StyleScopedClasses['md:text-4xl']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "relative mt-6 flex flex-wrap gap-3" },
});
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] px-4 py-3" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-[10px] font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-2xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.visibleTotalOptions);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "border-t border-[var(--dh-border)] bg-black/[0.025] p-6 dark:bg-white/[0.025] lg:border-l lg:border-t-0 md:p-8" },
});
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/[0.025]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-6']} */ ;
/** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.025]']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:border-l']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:border-t-0']} */ ;
/** @type {__VLS_StyleScopedClasses['md:p-8']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_26;
/** @ts-ignore @type { | typeof __VLS_components.CalendarDays} */
CalendarDays;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
}));
const __VLS_28 = __VLS_27({
    ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
/** @type {__VLS_StyleScopedClasses['h-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 grid gap-3 sm:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
let __VLS_31;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
    modelValue: (__VLS_ctx.filters.dateFrom),
    type: "date",
    label: "Fecha desde",
    error: (__VLS_ctx.dateRangeInvalid ? 'Rango inválido' : undefined),
}));
const __VLS_33 = __VLS_32({
    modelValue: (__VLS_ctx.filters.dateFrom),
    type: "date",
    label: "Fecha desde",
    error: (__VLS_ctx.dateRangeInvalid ? 'Rango inválido' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
let __VLS_36;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.filters.dateTo),
    type: "date",
    label: "Fecha hasta",
    error: (__VLS_ctx.dateRangeInvalid ? 'Rango inválido' : undefined),
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.filters.dateTo),
    type: "date",
    label: "Fecha hasta",
    error: (__VLS_ctx.dateRangeInvalid ? 'Rango inválido' : undefined),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
let __VLS_41;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
    modelValue: (__VLS_ctx.filters.containerTypeId),
    ...{ class: "sm:col-span-2" },
    label: "Contenedor",
    options: (__VLS_ctx.containerFilterOptions),
    placeholder: "",
    disabled: (__VLS_ctx.catalogs.loading.value),
}));
const __VLS_43 = __VLS_42({
    modelValue: (__VLS_ctx.filters.containerTypeId),
    ...{ class: "sm:col-span-2" },
    label: "Contenedor",
    options: (__VLS_ctx.containerFilterOptions),
    placeholder: "",
    disabled: (__VLS_ctx.catalogs.loading.value),
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
/** @type {__VLS_StyleScopedClasses['sm:col-span-2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-4 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_46;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
    ...{ 'onClick': {} },
    label: "Aplicar filtros",
    icon: (__VLS_ctx.CalendarDays),
    disabled: (__VLS_ctx.dateRangeInvalid),
    loading: (__VLS_ctx.loading),
}));
const __VLS_48 = __VLS_47({
    ...{ 'onClick': {} },
    label: "Aplicar filtros",
    icon: (__VLS_ctx.CalendarDays),
    disabled: (__VLS_ctx.dateRangeInvalid),
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_47));
let __VLS_51;
const __VLS_52 = {
    /** @type {typeof __VLS_51.click} */
    onClick: (__VLS_ctx.load),
};
var __VLS_49;
var __VLS_50;
let __VLS_53;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
    ...{ 'onClick': {} },
    label: "Limpiar",
    variant: "ghost",
    disabled: (__VLS_ctx.loading || (!__VLS_ctx.filters.dateFrom && !__VLS_ctx.filters.dateTo && !__VLS_ctx.filters.containerTypeId)),
}));
const __VLS_55 = __VLS_54({
    ...{ 'onClick': {} },
    label: "Limpiar",
    variant: "ghost",
    disabled: (__VLS_ctx.loading || (!__VLS_ctx.filters.dateFrom && !__VLS_ctx.filters.dateTo && !__VLS_ctx.filters.containerTypeId)),
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
let __VLS_58;
const __VLS_59 = {
    /** @type {typeof __VLS_58.click} */
    onClick: (__VLS_ctx.clearFilters),
};
var __VLS_56;
var __VLS_57;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-3 flex items-center gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-8']} */ ;
/** @type {__VLS_StyleScopedClasses['w-8']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-3 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
for (const [lane] of __VLS_vFor((__VLS_ctx.lanes))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.changeLane(lane.key);
                // @ts-ignore
                [loading, loading, load, visibleTotalOptions, filters, filters, filters, filters, filters, filters, dateRangeInvalid, dateRangeInvalid, dateRangeInvalid, containerFilterOptions, catalogs, CalendarDays, clearFilters, lanes, changeLane,];
            } },
        key: (lane.key),
        type: "button",
        ...{ class: "group rounded-[26px] border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]" },
        ...{ class: (__VLS_ctx.activeLaneKey === lane.key
                ? 'border-[var(--dh-primary)] bg-[var(--dh-card)] ring-2 ring-[var(--dh-primary)]/15'
                : 'border-[var(--dh-border)] bg-[var(--dh-card)] hover:border-[var(--dh-primary)]/35') },
    });
    /** @type {__VLS_StyleScopedClasses['group']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:-translate-y-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:shadow-[var(--dh-shadow-sm)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-start justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border transition" },
        ...{ class: (__VLS_ctx.laneAccent(lane, __VLS_ctx.activeLaneKey === lane.key)) },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-11']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-11']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[17px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    const __VLS_60 = (__VLS_ctx.laneIcon(lane));
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ class: "h-5 w-5" },
    }));
    const __VLS_62 = __VLS_61({
        ...{ class: "h-5 w-5" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "flex h-7 w-7 items-center justify-center rounded-full border transition" },
        ...{ class: (__VLS_ctx.activeLaneKey === lane.key
                ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                : 'border-[var(--dh-border)] text-transparent') },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    let __VLS_65;
    /** @ts-ignore @type { | typeof __VLS_components.Check} */
    Check;
    // @ts-ignore
    const __VLS_66 = __VLS_asFunctionalComponent1(__VLS_65, new __VLS_65({
        ...{ class: "h-4 w-4" },
    }));
    const __VLS_67 = __VLS_66({
        ...{ class: "h-4 w-4" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_66));
    /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "mt-4 text-base font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (lane.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 min-h-10 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-10']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (lane.description);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-4 flex items-end justify-between gap-3 border-t border-[var(--dh-border)] pt-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['pt-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xl font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (lane.totalOptions);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-right text-xs font-black text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    (__VLS_ctx.lowestLaneLabel(lane));
    // @ts-ignore
    [activeLaneKey, activeLaneKey, activeLaneKey, laneAccent, laneIcon, lowestLaneLabel,];
}
if (__VLS_ctx.loading && !__VLS_ctx.dashboard) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex min-h-[360px] items-center justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['min-h-[360px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_70;
    /** @ts-ignore @type { | typeof __VLS_components.DhSpinner} */
    DhSpinner;
    // @ts-ignore
    const __VLS_71 = __VLS_asFunctionalComponent1(__VLS_70, new __VLS_70({
        size: "lg",
    }));
    const __VLS_72 = __VLS_71({
        size: "lg",
    }, ...__VLS_functionalComponentArgsRest(__VLS_71));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_370px] xl:items-start" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-[minmax(0,1fr)_370px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:items-start']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5 shadow-[var(--dh-shadow-sm)] md:p-6" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:p-6']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.activeLane?.name);
    let __VLS_75;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
        label: (`${__VLS_ctx.activeRates.length} disponibles`),
        variant: "neutral",
    }));
    const __VLS_77 = __VLS_76({
        label: (`${__VLS_ctx.activeRates.length} disponibles`),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    if (__VLS_ctx.activeRates.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-5 grid gap-4 lg:grid-cols-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['lg:grid-cols-2']} */ ;
        for (const [rate, index] of __VLS_vFor((__VLS_ctx.activeRates))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading && !__VLS_ctx.dashboard))
                            return;
                        if (!(__VLS_ctx.activeRates.length))
                            return;
                        __VLS_ctx.selectRate(rate);
                        // @ts-ignore
                        [loading, dashboard, activeLane, activeRates, activeRates, activeRates, selectRate,];
                    } },
                key: (rate.importRateId),
                type: "button",
                ...{ class: "relative overflow-hidden rounded-[26px] border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]" },
                ...{ class: (__VLS_ctx.selectedRate?.importRateId === rate.importRateId
                        ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)]/[0.035] ring-2 ring-[var(--dh-primary)]/15'
                        : 'border-[var(--dh-border)] bg-[var(--dh-input)] hover:border-[var(--dh-primary)]/35') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-left']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
            /** @type {__VLS_StyleScopedClasses['duration-200']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:-translate-y-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:shadow-[var(--dh-shadow-sm)]']} */ ;
            if (__VLS_ctx.selectedRate?.importRateId === rate.importRateId) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
                    ...{ class: "absolute right-0 top-0 h-20 w-20 rounded-bl-[70px] bg-[var(--dh-primary)]/10" },
                });
                /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
                /** @type {__VLS_StyleScopedClasses['right-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['top-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['h-20']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-20']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded-bl-[70px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]/10']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "relative flex items-start justify-between gap-4" },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex flex-wrap items-center gap-2" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            if (index === 0) {
                let __VLS_80;
                /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
                DhBadge;
                // @ts-ignore
                const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
                    label: "Menor costo",
                    variant: "success",
                }));
                const __VLS_82 = __VLS_81({
                    label: "Menor costo",
                    variant: "success",
                }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            }
            let __VLS_85;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_86 = __VLS_asFunctionalComponent1(__VLS_85, new __VLS_85({
                label: (rate.containerType),
                variant: "primary",
            }));
            const __VLS_87 = __VLS_86({
                label: (rate.containerType),
                variant: "primary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_86));
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                ...{ class: "mt-3 truncate text-xl font-black tracking-tight text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (rate.carrier);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            let __VLS_90;
            /** @ts-ignore @type { | typeof __VLS_components.MapPin} */
            MapPin;
            // @ts-ignore
            const __VLS_91 = __VLS_asFunctionalComponent1(__VLS_90, new __VLS_90({
                ...{ class: "h-3.5 w-3.5" },
            }));
            const __VLS_92 = __VLS_91({
                ...{ class: "h-3.5 w-3.5" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_91));
            /** @type {__VLS_StyleScopedClasses['h-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-3.5']} */ ;
            (rate.pol);
            (rate.poe);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition" },
                ...{ class: (__VLS_ctx.selectedRate?.importRateId === rate.importRateId
                        ? 'border-[var(--dh-primary)] bg-[var(--dh-primary)] text-white'
                        : 'border-[var(--dh-border)] bg-[var(--dh-card)] text-transparent') },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            let __VLS_95;
            /** @ts-ignore @type { | typeof __VLS_components.Check} */
            Check;
            // @ts-ignore
            const __VLS_96 = __VLS_asFunctionalComponent1(__VLS_95, new __VLS_95({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_97 = __VLS_96({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_96));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "relative mt-5 grid gap-3 sm:grid-cols-2" },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3.5" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (__VLS_ctx.formatMoney(rate.internationalOceanFreight, rate.currency));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-[18px] border p-3.5" },
                ...{ class: (rate.internationalLandFreight != null
                        ? 'border-violet-500/20 bg-violet-500/10'
                        : 'border-[var(--dh-border)] bg-[var(--dh-card)]') },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3.5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            (rate.internationalLandFreight != null
                ? 'Terrestre internacional'
                : 'Costo de la vía');
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-1 text-lg font-black text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (rate.internationalLandFreight != null
                ? __VLS_ctx.formatMoney(rate.internationalLandFreight, 'USD')
                : __VLS_ctx.formatMoney(rate.internationalOceanFreight, rate.currency));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "relative mt-4 flex items-end justify-between gap-4 border-t border-[var(--dh-border)] pt-4" },
            });
            /** @type {__VLS_StyleScopedClasses['relative']} */ ;
            /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
            /** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-[10px] font-black uppercase tracking-[0.1em] text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-[0.1em]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-1 text-xl font-black text-[var(--dh-primary)]" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
            (__VLS_ctx.totalFreightLabel(rate));
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "text-right text-[11px] font-semibold leading-5 text-[var(--dh-text-muted)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
            (__VLS_ctx.formatDate(rate.validFrom));
            __VLS_asFunctionalElement1(__VLS_intrinsics.br)({});
            (__VLS_ctx.formatDate(rate.validTo));
            if (__VLS_ctx.selectingImportId === rate.importRateId) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "absolute inset-0 flex items-center justify-center bg-[var(--dh-card)]/80 backdrop-blur-sm" },
                });
                /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
                /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]/80']} */ ;
                /** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
                let __VLS_100;
                /** @ts-ignore @type { | typeof __VLS_components.DhSpinner} */
                DhSpinner;
                // @ts-ignore
                const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({}));
                const __VLS_102 = __VLS_101({}, ...__VLS_functionalComponentArgsRest(__VLS_101));
            }
            // @ts-ignore
            [selectedRate, selectedRate, selectedRate, formatMoney, formatMoney, formatMoney, totalFreightLabel, formatDate, formatDate, selectingImportId,];
        }
    }
    else {
        let __VLS_105;
        /** @ts-ignore @type { | typeof __VLS_components.DhEmptyState} */
        DhEmptyState;
        // @ts-ignore
        const __VLS_106 = __VLS_asFunctionalComponent1(__VLS_105, new __VLS_105({
            ...{ class: "mt-5" },
            title: "Sin alternativas para esta vía",
            description: "Cambie la vía, el contenedor o el rango de fechas para encontrar tarifas importadas vigentes.",
            icon: (__VLS_ctx.activeLane ? __VLS_ctx.laneIcon(__VLS_ctx.activeLane) : __VLS_ctx.Route),
        }));
        const __VLS_107 = __VLS_106({
            ...{ class: "mt-5" },
            title: "Sin alternativas para esta vía",
            description: "Cambie la vía, el contenedor o el rango de fechas para encontrar tarifas importadas vigentes.",
            icon: (__VLS_ctx.activeLane ? __VLS_ctx.laneIcon(__VLS_ctx.activeLane) : __VLS_ctx.Route),
        }, ...__VLS_functionalComponentArgsRest(__VLS_106));
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "xl:sticky xl:top-5" },
    });
    /** @type {__VLS_StyleScopedClasses['xl:sticky']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:top-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "overflow-hidden rounded-[30px] border border-[var(--dh-border)] bg-[var(--dh-card)] shadow-[var(--dh-shadow-sm)]" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[30px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "border-b border-[var(--dh-border)] p-5" },
    });
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--dh-primary)] text-sm font-black text-white" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    if (__VLS_ctx.selectedRate) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "p-5" },
        });
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        let __VLS_110;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_111 = __VLS_asFunctionalComponent1(__VLS_110, new __VLS_110({
            label: (__VLS_ctx.statusLabel(__VLS_ctx.selectedStatus)),
            variant: (__VLS_ctx.statusVariant(__VLS_ctx.selectedStatus)),
        }));
        const __VLS_112 = __VLS_111({
            label: (__VLS_ctx.statusLabel(__VLS_ctx.selectedStatus)),
            variant: (__VLS_ctx.statusVariant(__VLS_ctx.selectedStatus)),
        }, ...__VLS_functionalComponentArgsRest(__VLS_111));
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "mt-3 truncate text-xl font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.selectedRate.carrier);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.activeLane?.name);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-green-500/10 text-green-600 dark:text-green-400" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-11']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-11']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-green-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:text-green-400']} */ ;
        let __VLS_115;
        /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
        CheckCircle2;
        // @ts-ignore
        const __VLS_116 = __VLS_asFunctionalComponent1(__VLS_115, new __VLS_115({
            ...{ class: "h-5 w-5" },
        }));
        const __VLS_117 = __VLS_116({
            ...{ class: "h-5 w-5" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_116));
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-5 space-y-2.5" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-2.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[17px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        let __VLS_120;
        /** @ts-ignore @type { | typeof __VLS_components.Ship} */
        Ship;
        // @ts-ignore
        const __VLS_121 = __VLS_asFunctionalComponent1(__VLS_120, new __VLS_120({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_122 = __VLS_121({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_121));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ class: "text-sm text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.formatMoney(__VLS_ctx.selectedRate.internationalOceanFreight, __VLS_ctx.selectedRate.currency));
        if (__VLS_ctx.selectedRate.internationalLandFreight != null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex items-center justify-between gap-3 rounded-[17px] bg-violet-500/10 px-3.5 py-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[17px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-violet-500/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-3.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "flex items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-violet-700']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-violet-300']} */ ;
            let __VLS_125;
            /** @ts-ignore @type { | typeof __VLS_components.Truck} */
            Truck;
            // @ts-ignore
            const __VLS_126 = __VLS_asFunctionalComponent1(__VLS_125, new __VLS_125({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_127 = __VLS_126({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_126));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
                ...{ class: "text-sm text-[var(--dh-text)]" },
            });
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
            (__VLS_ctx.formatMoney(__VLS_ctx.selectedRate.internationalLandFreight, 'USD'));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[17px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        let __VLS_130;
        /** @ts-ignore @type { | typeof __VLS_components.Package} */
        Package;
        // @ts-ignore
        const __VLS_131 = __VLS_asFunctionalComponent1(__VLS_130, new __VLS_130({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_132 = __VLS_131({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_131));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ class: "text-sm text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.selectedRate.containerType);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-3 rounded-[17px] bg-black/[0.035] px-3.5 py-3 dark:bg-white/[0.05]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[17px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.035]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.05]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex items-center gap-2 text-xs font-bold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        let __VLS_135;
        /** @ts-ignore @type { | typeof __VLS_components.MapPin} */
        MapPin;
        // @ts-ignore
        const __VLS_136 = __VLS_asFunctionalComponent1(__VLS_135, new __VLS_135({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_137 = __VLS_136({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_136));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({
            ...{ class: "max-w-[190px] truncate text-right text-sm text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['max-w-[190px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.selectedRate.pol);
        (__VLS_ctx.selectedRate.poe);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-5 rounded-[22px] bg-[var(--dh-primary)] p-4 text-white shadow-[var(--dh-glow)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-glow)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-[10px] font-black uppercase tracking-[0.12em] text-white/70" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white/70']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-2xl font-black" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        (__VLS_ctx.totalFreightLabel(__VLS_ctx.selectedRate));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-[11px] font-semibold text-white/75" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white/75']} */ ;
        if (__VLS_ctx.selectedNeedsApproval && !__VLS_ctx.canApproveImport) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-4 rounded-[18px] border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold leading-5 text-amber-800 dark:text-amber-300" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-amber-500/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-amber-300']} */ ;
        }
        if (__VLS_ctx.selectedStatus === 'Rejected') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-4 rounded-[18px] border border-red-500/20 bg-red-500/10 p-3 text-xs font-semibold leading-5 text-red-700 dark:text-red-300" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-red-500/20']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-red-500/10']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-red-700']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:text-red-300']} */ ;
        }
        let __VLS_140;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_141 = __VLS_asFunctionalComponent1(__VLS_140, new __VLS_140({
            ...{ 'onClick': {} },
            ...{ class: "mt-5 w-full" },
            label: (__VLS_ctx.finalActionLabel),
            icon: (__VLS_ctx.Sparkles),
            size: "lg",
            loading: (__VLS_ctx.creatingFinalRate || Boolean(__VLS_ctx.selectingImportId)),
            disabled: (!__VLS_ctx.selectedCanContinue),
        }));
        const __VLS_142 = __VLS_141({
            ...{ 'onClick': {} },
            ...{ class: "mt-5 w-full" },
            label: (__VLS_ctx.finalActionLabel),
            icon: (__VLS_ctx.Sparkles),
            size: "lg",
            loading: (__VLS_ctx.creatingFinalRate || Boolean(__VLS_ctx.selectingImportId)),
            disabled: (!__VLS_ctx.selectedCanContinue),
        }, ...__VLS_functionalComponentArgsRest(__VLS_141));
        let __VLS_145;
        const __VLS_146 = {
            /** @type {typeof __VLS_145.click} */
            onClick: (__VLS_ctx.createFinalRate),
        };
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        var __VLS_143;
        var __VLS_144;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearSelection) },
            type: "button",
            ...{ class: "mt-3 w-full text-center text-xs font-black text-[var(--dh-text-muted)] transition hover:text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-[var(--dh-primary)]']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "p-5" },
        });
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex min-h-[360px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--dh-border)] bg-black/[0.02] p-6 text-center dark:bg-white/[0.02]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-[360px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/[0.02]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['dark:bg-white/[0.02]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--dh-primary)]/10 text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-16']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-16']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary)]/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        let __VLS_147;
        /** @ts-ignore @type { | typeof __VLS_components.CircleDollarSign} */
        CircleDollarSign;
        // @ts-ignore
        const __VLS_148 = __VLS_asFunctionalComponent1(__VLS_147, new __VLS_147({
            ...{ class: "h-7 w-7" },
        }));
        const __VLS_149 = __VLS_148({
            ...{ class: "h-7 w-7" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_148));
        /** @type {__VLS_StyleScopedClasses['h-7']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-7']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "mt-5 text-lg font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 text-xs font-semibold leading-5 text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 flex items-start gap-3 rounded-[22px] border border-green-500/20 bg-green-500/10 p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-green-500/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-green-500/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    let __VLS_152;
    /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
    CheckCircle2;
    // @ts-ignore
    const __VLS_153 = __VLS_asFunctionalComponent1(__VLS_152, new __VLS_152({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" },
    }));
    const __VLS_154 = __VLS_153({
        ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-green-600 dark:text-green-400" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_153));
    /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-green-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-green-400']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold leading-5 text-green-800 dark:text-green-300" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-green-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['dark:text-green-300']} */ ;
}
// @ts-ignore
[Route, laneIcon, activeLane, activeLane, activeLane, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, selectedRate, formatMoney, formatMoney, totalFreightLabel, selectingImportId, statusLabel, selectedStatus, selectedStatus, selectedStatus, statusVariant, selectedNeedsApproval, canApproveImport, finalActionLabel, Sparkles, creatingFinalRate, selectedCanContinue, createFinalRate, clearSelection,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
