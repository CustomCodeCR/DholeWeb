import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Activity, RefreshCcw, ServerCog } from 'lucide-vue-next';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhDataTable } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { MonitoringService } from '@/core/services/monitoringService';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const loading = ref(false);
const services = ref([]);
const columns = computed(() => [
    { key: 'name', label: t('monitoring.service') },
    { key: 'status', label: t('common.status'), align: 'center' },
    { key: 'latencyMs', label: t('monitoring.latency'), align: 'center' },
    { key: 'statusCode', label: t('monitoring.statusCode'), align: 'center' },
    { key: 'checkedAt', label: t('monitoring.checkedAt') },
    { key: 'url', label: 'URL' },
]);
const onlineCount = computed(() => services.value.filter((service) => service.status === 'online').length);
const offlineCount = computed(() => services.value.filter((service) => service.status === 'offline').length);
const averageLatency = computed(() => {
    const latencies = services.value
        .map((service) => service.latencyMs ?? 0)
        .filter((latency) => latency > 0);
    if (!latencies.length)
        return 0;
    return Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length);
});
function statusVariant(status) {
    if (status === 'online')
        return 'success';
    if (status === 'offline')
        return 'danger';
    return 'neutral';
}
function formatDate(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
}
async function load() {
    loading.value = true;
    try {
        services.value = await MonitoringService.checkAll();
    }
    finally {
        loading.value = false;
    }
}
useViewShortcuts({ save: load, refresh: load });
onMounted(load);
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
    title: (__VLS_ctx.t('monitoring.title')),
    subtitle: (__VLS_ctx.t('monitoring.subtitle')),
    icon: (__VLS_ctx.ServerCog),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('monitoring.title')),
    subtitle: (__VLS_ctx.t('monitoring.subtitle')),
    icon: (__VLS_ctx.ServerCog),
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
        loading: (__VLS_ctx.loading),
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refresh')),
        variant: "secondary",
        loading: (__VLS_ctx.loading),
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.load),
    };
    var __VLS_10;
    var __VLS_11;
    // @ts-ignore
    [t, t, t, ServerCog, RefreshCcw, loading, load,];
}
// @ts-ignore
[];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-3" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.online'));
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.Activity} */
Activity;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ...{ class: "h-5 w-5 text-green-500" },
}));
const __VLS_16 = __VLS_15({
    ...{ class: "h-5 w-5 text-green-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-green-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.onlineCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.onlineHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.offline'));
let __VLS_19;
/** @ts-ignore @type { | typeof __VLS_components.Activity} */
Activity;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    ...{ class: "h-5 w-5 text-red-500" },
}));
const __VLS_21 = __VLS_20({
    ...{ class: "h-5 w-5 text-red-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.offlineCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.offlineHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-sm font-black text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.averageLatency'));
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.ServerCog} */
ServerCog;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "mt-3 text-3xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.averageLatency);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('monitoring.averageLatencyHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
let __VLS_29;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_30 = __VLS_asFunctionalComponent1(__VLS_29, new __VLS_29({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.services),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('monitoring.empty')),
}));
const __VLS_31 = __VLS_30({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.services),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('monitoring.empty')),
}, ...__VLS_functionalComponentArgsRest(__VLS_30));
const { default: __VLS_34 } = __VLS_32.slots;
{
    const { 'cell-name': __VLS_35 } = __VLS_32.slots;
    const [{ row }] = __VLS_vSlot(__VLS_35);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (row.nameKey ? __VLS_ctx.t(row.nameKey) : row.name);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (row.descriptionKey ? __VLS_ctx.t(row.descriptionKey) : row.description);
    // @ts-ignore
    [t, t, t, t, t, t, t, t, t, loading, onlineCount, offlineCount, averageLatency, columns, services,];
}
{
    const { 'cell-status': __VLS_36 } = __VLS_32.slots;
    const [{ value }] = __VLS_vSlot(__VLS_36);
    let __VLS_37;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
        label: (__VLS_ctx.t(`monitoring.statuses.${String(value)}`)),
        variant: (__VLS_ctx.statusVariant(String(value))),
    }));
    const __VLS_39 = __VLS_38({
        label: (__VLS_ctx.t(`monitoring.statuses.${String(value)}`)),
        variant: (__VLS_ctx.statusVariant(String(value))),
    }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    // @ts-ignore
    [t, statusVariant,];
}
{
    const { 'cell-latencyMs': __VLS_42 } = __VLS_32.slots;
    const [{ value }] = __VLS_vSlot(__VLS_42);
    (value ?? '—');
    // @ts-ignore
    [];
}
{
    const { 'cell-statusCode': __VLS_43 } = __VLS_32.slots;
    const [{ value }] = __VLS_vSlot(__VLS_43);
    (value ?? '—');
    // @ts-ignore
    [];
}
{
    const { 'cell-checkedAt': __VLS_44 } = __VLS_32.slots;
    const [{ value }] = __VLS_vSlot(__VLS_44);
    (__VLS_ctx.formatDate(String(value)));
    // @ts-ignore
    [formatDate,];
}
{
    const { 'cell-url': __VLS_45 } = __VLS_32.slots;
    const [{ value }] = __VLS_vSlot(__VLS_45);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "line-clamp-1 max-w-sm" },
    });
    /** @type {__VLS_StyleScopedClasses['line-clamp-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-sm']} */ ;
    (value);
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_32;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
