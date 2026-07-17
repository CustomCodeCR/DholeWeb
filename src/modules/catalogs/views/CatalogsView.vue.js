import { computed, onMounted, ref, watch } from 'vue';
import { BookOpen, Pencil, Trash2 } from 'lucide-vue-next';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination, } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useToastStore } from '@/core/stores/toastStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useAuthStore } from '@/core/stores/authStore';
import { CONFIG_SCOPES } from '@/core/auth/scopes';
import { CatalogGroupsService } from '@/core/services/catalogGroupsService';
import CatalogGroupFormDrawer from '@/modules/catalogs/components/CatalogGroupFormDrawer.vue';
import CatalogGroupDetailDrawer from '@/modules/catalogs/components/CatalogGroupDetailDrawer.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const toastStore = useToastStore();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const authStore = useAuthStore();
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const groups = ref([]);
const canCreate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.create));
const canUpdate = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update));
const canDelete = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.delete));
const showRowActions = computed(() => canUpdate.value || canDelete.value);
const columns = computed(() => {
    const base = [
        { key: 'name', label: 'Catálogo' },
        { key: 'slug', label: 'Slug' },
        { key: 'code', label: 'Código' },
        { key: 'isSystem', label: 'Tipo', align: 'center' },
        { key: 'isActive', label: 'Estado', align: 'center' },
    ];
    if (showRowActions.value) {
        base.push({ key: 'actions', label: '', align: 'right' });
    }
    return base;
});
async function loadCatalogGroups() {
    try {
        loading.value = true;
        const result = await CatalogGroupsService.browsePaged({
            pageNumber: page.value,
            pageSize: pageSize.value,
            search: search.value || undefined,
        });
        groups.value = result.items;
        total.value = result.totalCount ?? result.items.length;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar los catálogos.');
    }
    finally {
        loading.value = false;
    }
}
function openCreateDrawer() {
    if (!canCreate.value)
        return;
    drawerStore.open({
        title: 'Nuevo catálogo',
        component: CatalogGroupFormDrawer,
        size: 'lg',
        props: {
            onSaved: loadCatalogGroups,
        },
    });
}
function openEditDrawer(group) {
    if (!canUpdate.value)
        return;
    drawerStore.open({
        title: 'Editar catálogo',
        component: CatalogGroupFormDrawer,
        size: 'lg',
        props: {
            group,
            onSaved: loadCatalogGroups,
        },
    });
}
function openDetailDrawer(group) {
    drawerStore.open({
        title: group.name,
        component: CatalogGroupDetailDrawer,
        size: 'xl',
        props: {
            group,
            onSaved: loadCatalogGroups,
        },
    });
}
function confirmDelete(group) {
    if (!canDelete.value)
        return;
    modalStore.open({
        title: 'Eliminar catálogo',
        component: DhConfirmDialog,
        size: 'md',
        props: {
            title: 'Eliminar catálogo',
            message: `¿Eliminar ${group.name}?`,
            confirmLabel: 'Eliminar',
            cancelLabel: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await CatalogGroupsService.delete(group.id);
                modalStore.close();
                toastStore.success('Catálogo eliminado');
                await loadCatalogGroups();
            },
            onCancel: () => modalStore.close(),
        },
    });
}
watch([page, pageSize], loadCatalogGroups);
useViewShortcuts({
    create: () => {
        if (canCreate.value)
            openCreateDrawer();
    },
    save: loadCatalogGroups,
    refresh: loadCatalogGroups,
});
onMounted(loadCatalogGroups);
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
    title: "Catálogos",
    subtitle: "Administre catálogos y sus items desde una sola vista.",
    icon: (__VLS_ctx.BookOpen),
}));
const __VLS_2 = __VLS_1({
    title: "Catálogos",
    subtitle: "Administre catálogos y sus items desde una sola vista.",
    icon: (__VLS_ctx.BookOpen),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
if (__VLS_ctx.canCreate) {
    {
        const { actions: __VLS_6 } = __VLS_3.slots;
        let __VLS_7;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
            ...{ 'onClick': {} },
            label: "Nuevo catálogo",
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onClick': {} },
            label: "Nuevo catálogo",
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.click} */
            onClick: (__VLS_ctx.openCreateDrawer),
        };
        var __VLS_10;
        var __VLS_11;
        // @ts-ignore
        [BookOpen, canCreate, openCreateDrawer,];
    }
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
let __VLS_14;
/** @ts-ignore @type { | typeof __VLS_components.DhCrudToolbar} */
DhCrudToolbar;
// @ts-ignore
const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: "Catálogos",
    createLabel: "Nuevo catálogo",
    showCreate: (__VLS_ctx.canCreate),
}));
const __VLS_16 = __VLS_15({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: "Catálogos",
    createLabel: "Nuevo catálogo",
    showCreate: (__VLS_ctx.canCreate),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_19;
const __VLS_20 = {
    /** @type {typeof __VLS_19.create} */
    onCreate: (__VLS_ctx.openCreateDrawer),
};
const __VLS_21 = {
    /** @type {typeof __VLS_19.refresh} */
    onRefresh: (__VLS_ctx.loadCatalogGroups),
};
const __VLS_22 = {
    /** @type {typeof __VLS_19.filter} */
    onFilter: (__VLS_ctx.loadCatalogGroups),
};
const __VLS_23 = {
    /** @type {typeof __VLS_19.search} */
    onSearch: (__VLS_ctx.loadCatalogGroups),
};
var __VLS_17;
var __VLS_18;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.groups),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay catálogos registrados.",
}));
const __VLS_26 = __VLS_25({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.groups),
    loading: (__VLS_ctx.loading),
    emptyText: "No hay catálogos registrados.",
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_29;
const __VLS_30 = {
    /** @type {typeof __VLS_29.rowClick} */
    onRowClick: (__VLS_ctx.openDetailDrawer),
};
const { default: __VLS_31 } = __VLS_27.slots;
{
    const { 'cell-slug': __VLS_32 } = __VLS_27.slots;
    const [{ value }] = __VLS_vSlot(__VLS_32);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rounded-full bg-[var(--dh-primary-soft)] px-3 py-1 text-xs font-black text-[var(--dh-primary)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-primary-soft)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
    (value);
    // @ts-ignore
    [canCreate, openCreateDrawer, search, loadCatalogGroups, loadCatalogGroups, loadCatalogGroups, columns, groups, loading, openDetailDrawer,];
}
{
    const { 'cell-isSystem': __VLS_33 } = __VLS_27.slots;
    const [{ value }] = __VLS_vSlot(__VLS_33);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_34;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        label: (value ? 'Sistema' : 'Administrable'),
        variant: (value ? 'primary' : 'neutral'),
    }));
    const __VLS_36 = __VLS_35({
        label: (value ? 'Sistema' : 'Administrable'),
        variant: (value ? 'primary' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    // @ts-ignore
    [];
}
{
    const { 'cell-isActive': __VLS_39 } = __VLS_27.slots;
    const [{ value }] = __VLS_vSlot(__VLS_39);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_40;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_41 = __VLS_asFunctionalComponent1(__VLS_40, new __VLS_40({
        label: (value ? 'Activo' : 'Inactivo'),
        variant: (value ? 'success' : 'neutral'),
    }));
    const __VLS_42 = __VLS_41({
        label: (value ? 'Activo' : 'Inactivo'),
        variant: (value ? 'success' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    // @ts-ignore
    [];
}
if (__VLS_ctx.showRowActions) {
    {
        const { 'cell-actions': __VLS_45 } = __VLS_27.slots;
        const [{ row }] = __VLS_vSlot(__VLS_45);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-1" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
        if (__VLS_ctx.canUpdate) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showRowActions))
                            return;
                        if (!(__VLS_ctx.canUpdate))
                            return;
                        __VLS_ctx.openEditDrawer(row);
                        // @ts-ignore
                        [showRowActions, canUpdate, openEditDrawer,];
                    } },
                ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
                title: "Editar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
            let __VLS_46;
            /** @ts-ignore @type { | typeof __VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_48 = __VLS_47({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_47));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        if (__VLS_ctx.canDelete) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showRowActions))
                            return;
                        if (!(__VLS_ctx.canDelete))
                            return;
                        __VLS_ctx.confirmDelete(row);
                        // @ts-ignore
                        [canDelete, confirmDelete,];
                    } },
                ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
                title: "Eliminar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
            let __VLS_51;
            /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
            Trash2;
            // @ts-ignore
            const __VLS_52 = __VLS_asFunctionalComponent1(__VLS_51, new __VLS_51({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_53 = __VLS_52({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_52));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
var __VLS_27;
var __VLS_28;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_56;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_58 = __VLS_57({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
// @ts-ignore
[page, pageSize, total,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
