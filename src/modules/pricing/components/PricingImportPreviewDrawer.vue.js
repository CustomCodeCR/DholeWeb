import { computed, onMounted, ref } from 'vue';
import { AlertCircle, Check, FileSearch, Ship, X } from 'lucide-vue-next';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { PricingService } from '@/core/services/pricingService';
import { useToastStore } from '@/core/stores/toastStore';
import { usePricingCatalogs } from '@/modules/pricing/composables/usePricingCatalogs';
import { formatDate, formatMoney, statusTone } from '@/modules/pricing/utils/pricingFormat';
const props = withDefaults(defineProps(), {
    canApprove: false,
    canReject: false,
    canCreateRate: false,
});
const toastStore = useToastStore();
const catalogs = usePricingCatalogs();
const current = ref(props.importRate);
const loading = ref(false);
const approving = ref(false);
function displayName(items, id, fallback = '—', ...values) {
    return catalogs.findBestMatch(items, id, ...values)?.name || values.find(Boolean) || fallback;
}
const carrier = computed(() => displayName(catalogs.carriers.value, current.value.carrierId, '—', current.value.carrier, current.value.carrierCode, current.value.carrierSlug));
const agent = computed(() => displayName(catalogs.agents.value, current.value.agentId, 'Por asignar', current.value.agent, current.value.agentCode, current.value.agentSlug));
const pol = computed(() => displayName(catalogs.polPorts.value, current.value.polId, '—', current.value.pol, current.value.polCode, current.value.polSlug));
const poe = computed(() => displayName(catalogs.poePorts.value, current.value.poeId, '—', current.value.poe, current.value.poeCode, current.value.poeSlug));
const pod = computed(() => displayName(catalogs.podPorts.value, current.value.podId, '—', current.value.pod, current.value.podCode, current.value.podSlug));
const container = computed(() => displayName(catalogs.containerTypes.value, current.value.containerTypeId, '—', current.value.containerType, current.value.containerTypeCode, current.value.containerTypeSlug));
const currency = computed(() => displayName(catalogs.currencies.value, current.value.currencyId, 'USD', current.value.currency, current.value.currencyCode, current.value.currencySlug));
const profile = computed(() => displayName(catalogs.importProfiles.value, current.value.importProfileId, '—', current.value.importProfileName, current.value.importProfileCode, current.value.importProfileSlug));
const route = computed(() => [pol.value, poe.value, pod.value].filter((value) => value !== '—').join(' → '));
const oceanFreight = computed(() => current.value.oceanFreight ?? current.value.freight ?? 0);
const calculatedCost = computed(() => current.value.totalCost ??
    oceanFreight.value +
        Number(current.value.originCharges ?? 0) +
        Number(current.value.destinationCharges ?? 0) +
        Number(current.value.surcharges ?? 0));
const calculatedProfit = computed(() => {
    if (current.value.profit != null)
        return current.value.profit;
    if (current.value.totalSale == null)
        return null;
    return current.value.totalSale - calculatedCost.value;
});
const margin = computed(() => {
    const value = current.value.margin;
    if (value == null)
        return null;
    return Math.abs(value) <= 1 ? value * 100 : value;
});
const canApproveCurrent = computed(() => props.canApprove && current.value.status === 'Pending' && !approving.value);
const canRejectCurrent = computed(() => props.canReject && current.value.status === 'Pending');
const canCreateCurrent = computed(() => props.canCreateRate && current.value.status === 'Approved');
const commercialRows = computed(() => [
    { label: 'Flete internacional', value: oceanFreight.value },
    { label: 'Cargos de origen', value: current.value.originCharges },
    { label: 'Cargos de destino', value: current.value.destinationCharges },
    { label: 'Recargos', value: current.value.surcharges },
]);
function statusLabel(status) {
    return ({
        Pending: 'Pendiente de revisión',
        Approved: 'Aprobada',
        Rejected: 'Rechazada',
        Created: 'Convertida en tarifa',
    }[status] ?? status);
}
function sourceLabel(source) {
    return ({
        Email: 'Correo',
        Pdf: 'PDF',
        Excel: 'Excel',
        Csv: 'CSV',
        Image: 'Imagen',
    }[source] ?? source);
}
async function load() {
    try {
        loading.value = true;
        const [, detail] = await Promise.all([
            catalogs.loadAll(),
            PricingService.getImportRate(props.importRate.id),
        ]);
        current.value = detail;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cargar el detalle de la tarifa importada.');
    }
    finally {
        loading.value = false;
    }
}
async function approve() {
    if (!canApproveCurrent.value)
        return;
    try {
        approving.value = true;
        await PricingService.approveImportRate(current.value.id);
        current.value = { ...current.value, status: 'Approved' };
        toastStore.success('Importación aprobada', 'Los datos fueron revisados y la tarifa ya puede convertirse en una tarifa oficial.');
        await props.onApproved?.();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo aprobar la importación.');
    }
    finally {
        approving.value = false;
    }
}
onMounted(load);
const __VLS_defaults = {
    canApprove: false,
    canReject: false,
    canCreateRate: false,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "space-y-6" },
});
/** @type {__VLS_StyleScopedClasses['space-y-6']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-liquid rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:items-start']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex min-w-0 gap-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] dh-bg-primary-soft text-[var(--dh-primary)]" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-bg-primary-soft']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.FileSearch} */
FileSearch;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
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
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    label: (__VLS_ctx.statusLabel(__VLS_ctx.current.status)),
    variant: (__VLS_ctx.statusTone(__VLS_ctx.current.status)),
}));
const __VLS_7 = __VLS_6({
    label: (__VLS_ctx.statusLabel(__VLS_ctx.current.status)),
    variant: (__VLS_ctx.statusTone(__VLS_ctx.current.status)),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    label: (__VLS_ctx.sourceLabel(__VLS_ctx.current.sourceType)),
    variant: "neutral",
}));
const __VLS_12 = __VLS_11({
    label: (__VLS_ctx.sourceLabel(__VLS_ctx.current.sourceType)),
    variant: "neutral",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    label: (__VLS_ctx.profile),
    variant: "neutral",
}));
const __VLS_17 = __VLS_16({
    label: (__VLS_ctx.profile),
    variant: "neutral",
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.carrier);
(__VLS_ctx.container);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.route);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
if (__VLS_ctx.canRejectCurrent) {
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        ...{ 'onClick': {} },
        label: "Rechazar",
        icon: (__VLS_ctx.X),
        variant: "danger",
        size: "sm",
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onClick': {} },
        label: "Rechazar",
        icon: (__VLS_ctx.X),
        variant: "danger",
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_25;
    const __VLS_26 = {
        /** @type {typeof __VLS_25.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.canRejectCurrent))
                return;
            props.onReject?.(__VLS_ctx.current);
            // @ts-ignore
            [statusLabel, current, current, current, current, statusTone, sourceLabel, profile, carrier, container, route, canRejectCurrent, X,];
        },
    };
    var __VLS_23;
    var __VLS_24;
}
if (__VLS_ctx.canApproveCurrent) {
    let __VLS_27;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
        ...{ 'onClick': {} },
        label: "Aprobar tarifa",
        icon: (__VLS_ctx.Check),
        size: "sm",
        loading: (__VLS_ctx.approving),
    }));
    const __VLS_29 = __VLS_28({
        ...{ 'onClick': {} },
        label: "Aprobar tarifa",
        icon: (__VLS_ctx.Check),
        size: "sm",
        loading: (__VLS_ctx.approving),
    }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    let __VLS_32;
    const __VLS_33 = {
        /** @type {typeof __VLS_32.click} */
        onClick: (__VLS_ctx.approve),
    };
    var __VLS_30;
    var __VLS_31;
}
if (__VLS_ctx.canCreateCurrent) {
    let __VLS_34;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        ...{ 'onClick': {} },
        label: "Crear tarifa oficial",
        icon: (__VLS_ctx.Ship),
        size: "sm",
    }));
    const __VLS_36 = __VLS_35({
        ...{ 'onClick': {} },
        label: "Crear tarifa oficial",
        icon: (__VLS_ctx.Ship),
        size: "sm",
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    let __VLS_39;
    const __VLS_40 = {
        /** @type {typeof __VLS_39.click} */
        onClick: (...[$event]) => {
            if (!(__VLS_ctx.canCreateCurrent))
                return;
            props.onCreateRate?.(__VLS_ctx.current);
            // @ts-ignore
            [current, canApproveCurrent, Check, approving, approve, canCreateCurrent, Ship,];
        },
    };
    var __VLS_37;
    var __VLS_38;
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-5 py-12 text-center font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-12']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "mb-3 font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-3']} */ ;
    for (const [item] of __VLS_vFor(([
        { label: 'Naviera', value: __VLS_ctx.carrier },
        { label: 'Agente', value: __VLS_ctx.agent },
        { label: 'POL · Origen', value: __VLS_ctx.pol },
        { label: 'POE · Puerto de entrada', value: __VLS_ctx.poe },
        { label: 'POD · Destino final', value: __VLS_ctx.pod },
        { label: 'Contenedor', value: __VLS_ctx.container },
    ]))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (item.label),
            ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (item.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (item.value);
        // @ts-ignore
        [carrier, container, loading, agent, pol, poe, pod,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "mb-3 font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "overflow-hidden rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)]" },
    });
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.commercialRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (item.label),
            ...{ class: "flex items-center justify-between gap-4 border-b border-[var(--dh-border)] px-5 py-4 last:border-b-0" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['last:border-b-0']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-semibold text-[var(--dh-text-soft)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
        (item.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (item.value == null ? 'No informado' : __VLS_ctx.formatMoney(item.value, __VLS_ctx.currency));
        // @ts-ignore
        [commercialRows, formatMoney, currency,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.formatMoney(__VLS_ctx.calculatedCost, __VLS_ctx.currency));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.current.totalSale == null
        ? 'No informada'
        : __VLS_ctx.formatMoney(__VLS_ctx.current.totalSale, __VLS_ctx.currency));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.calculatedProfit == null ? 'No informada' : __VLS_ctx.formatMoney(__VLS_ctx.calculatedProfit, __VLS_ctx.currency));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-lg font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.margin == null ? 'No informado' : `${__VLS_ctx.margin.toFixed(2)}%`);
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['sm:grid-cols-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['xl:grid-cols-4']} */ ;
    for (const [item] of __VLS_vFor(([
        { label: 'Moneda', value: __VLS_ctx.currency },
        { label: 'Días libres', value: String(__VLS_ctx.current.freeDays) },
        {
            label: 'Días de tránsito',
            value: __VLS_ctx.current.transitDays == null ? 'No informados' : String(__VLS_ctx.current.transitDays),
        },
        { label: 'Mercancía', value: __VLS_ctx.current.commodity || 'No informada' },
        { label: 'Válida desde', value: __VLS_ctx.formatDate(__VLS_ctx.current.validFrom) },
        { label: 'Válida hasta', value: __VLS_ctx.formatDate(__VLS_ctx.current.validTo) },
        { label: 'Usos como tarifa', value: String(__VLS_ctx.current.usedAsRateCount) },
        { label: 'Perfil de importación', value: __VLS_ctx.profile },
    ]))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (item.label),
            ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black uppercase tracking-[0.12em] text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.12em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (item.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-2 font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (item.value);
        // @ts-ignore
        [current, current, current, current, current, current, current, current, current, profile, formatMoney, formatMoney, formatMoney, currency, currency, currency, currency, calculatedCost, calculatedProfit, calculatedProfit, margin, margin, formatDate, formatDate,];
    }
    if (__VLS_ctx.current.status === 'Pending') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "flex gap-3 rounded-[26px] border border-amber-500/20 bg-amber-500/10 p-5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-amber-500/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-amber-500/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
        let __VLS_41;
        /** @ts-ignore @type { | typeof __VLS_components.AlertCircle} */
        AlertCircle;
        // @ts-ignore
        const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-600" },
        }));
        const __VLS_43 = __VLS_42({
            ...{ class: "mt-0.5 h-5 w-5 shrink-0 text-amber-600" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_42));
        /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-5']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-600']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-soft)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-soft)]']} */ ;
    }
}
// @ts-ignore
[current,];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
