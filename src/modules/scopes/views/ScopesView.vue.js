import { computed, onMounted, ref } from 'vue';
import { KeyRound } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { ScopesService } from '@/core/services/scopesService';
import { useToastStore } from '@/core/stores/toastStore';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const toastStore = useToastStore();
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = ref(25);
const scopes = ref([]);
const columns = [
    { key: 'code', label: t('common.code') },
    { key: 'name', label: t('common.name') },
];
const filteredScopes = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q)
        return scopes.value;
    return scopes.value.filter((x) => `${x.code} ${x.name}`.toLowerCase().includes(q));
});
async function loadScopes() {
    try {
        loading.value = true;
        scopes.value = await ScopesService.select();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar los permisos.');
    }
    finally {
        loading.value = false;
    }
}
useViewShortcuts({ save: loadScopes, refresh: loadScopes });
onMounted(loadScopes);
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
/** @ts-ignore @type { | typeof __VLS_components.DhPageHeader} */
DhPageHeader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    title: (__VLS_ctx.t('scopes.title')),
    subtitle: (__VLS_ctx.t('scopes.subtitle')),
    icon: (__VLS_ctx.KeyRound),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('scopes.title')),
    subtitle: (__VLS_ctx.t('scopes.subtitle')),
    icon: (__VLS_ctx.KeyRound),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhCrudToolbar} */
DhCrudToolbar;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: (__VLS_ctx.t('scopes.title')),
    showCreate: (false),
}));
const __VLS_7 = __VLS_6({
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: (__VLS_ctx.t('scopes.title')),
    showCreate: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = {
    /** @type {typeof __VLS_10.refresh} */
    onRefresh: (__VLS_ctx.loadScopes),
};
const __VLS_12 = {
    /** @type {typeof __VLS_10.filter} */
    onFilter: (__VLS_ctx.loadScopes),
};
const __VLS_13 = {
    /** @type {typeof __VLS_10.search} */
    onSearch: (__VLS_ctx.loadScopes),
};
var __VLS_8;
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.filteredScopes),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('scopes.empty')),
}));
const __VLS_16 = __VLS_15({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.filteredScopes),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('scopes.empty')),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
const { default: __VLS_19 } = __VLS_17.slots;
{
    const { 'cell-code': __VLS_20 } = __VLS_17.slots;
    const [{ value }] = __VLS_vSlot(__VLS_20);
    let __VLS_21;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
        label: (String(value)),
        variant: "primary",
    }));
    const __VLS_23 = __VLS_22({
        label: (String(value)),
        variant: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    // @ts-ignore
    [t, t, t, t, KeyRound, search, loadScopes, loadScopes, loadScopes, columns, filteredScopes, loading,];
}
// @ts-ignore
[];
var __VLS_17;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_26;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.filteredScopes.length),
}));
const __VLS_28 = __VLS_27({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.filteredScopes.length),
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
// @ts-ignore
[filteredScopes, page, pageSize,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
