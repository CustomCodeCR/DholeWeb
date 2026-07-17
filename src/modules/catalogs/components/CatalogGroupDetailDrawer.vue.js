import { computed, onMounted, ref } from 'vue';
import { Ban, CheckCircle2, GripVertical, PackagePlus, Pencil, RefreshCcw, Tag, Trash2, } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { CONFIG_SCOPES } from '@/core/auth/scopes';
import { CatalogGroupsService } from '@/core/services/catalogGroupsService';
import { CatalogItemsService } from '@/core/services/catalogItemsService';
import CatalogGroupFormDrawer from '@/modules/catalogs/components/CatalogGroupFormDrawer.vue';
import CatalogItemFormDrawer from '@/modules/catalogs/components/CatalogItemFormDrawer.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
const props = defineProps();
const { t } = useI18n();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const loading = ref(false);
const savingOrder = ref(false);
const detail = ref(null);
const items = ref([]);
const draggingIndex = ref(null);
const localGroup = computed(() => detail.value ?? props.group);
const canUpdateGroup = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.update));
const canDeleteGroup = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.delete));
const canSetGroupActive = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogGroups.setActive));
const canCreateItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.create));
const canUpdateItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.update));
const canDeleteItem = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.delete));
const canSetItemActive = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.setActive));
const canChangeItemOrder = computed(() => authStore.hasScope(CONFIG_SCOPES.catalogItems.changeSortOrder));
const showGroupActions = computed(() => canUpdateGroup.value || canDeleteGroup.value || canSetGroupActive.value);
const showItemActions = computed(() => canUpdateItem.value || canDeleteItem.value || canSetItemActive.value);
function formatMetadata(metadataJson) {
    if (!metadataJson)
        return [];
    try {
        const parsed = JSON.parse(metadataJson);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object')
            return [];
        return Object.entries(parsed).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        }));
    }
    catch {
        return [];
    }
}
function sortItems(values) {
    return [...values].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
async function loadDetail() {
    try {
        loading.value = true;
        const groupResult = await CatalogGroupsService.getById(props.group.id);
        detail.value = groupResult;
        const groupSlug = groupResult.slug || props.group.slug;
        if (!groupSlug) {
            items.value = [];
            return;
        }
        const itemResult = await CatalogItemsService.getByGroupSlug(groupSlug);
        items.value = sortItems(itemResult);
    }
    catch (error) {
        toastStore.backendError(error, t('catalogs.detailLoadError'));
    }
    finally {
        loading.value = false;
    }
}
async function refreshAll() {
    await loadDetail();
    await props.onSaved?.();
}
function openEditGroup() {
    if (!canUpdateGroup.value)
        return;
    drawerStore.open({
        title: t('catalogs.edit'),
        component: CatalogGroupFormDrawer,
        size: 'lg',
        props: {
            group: localGroup.value,
            onSaved: refreshAll,
        },
    });
}
async function setGroupActive(isActive) {
    if (!canSetGroupActive.value)
        return;
    try {
        await CatalogGroupsService.setActive(localGroup.value.id, { isActive });
        toastStore.success(isActive ? t('catalogs.catalogActivated') : t('catalogs.catalogInactivated'));
        await refreshAll();
    }
    catch (error) {
        toastStore.backendError(error, t('catalogs.changeStatusError'));
    }
}
function confirmDeleteGroup() {
    if (!canDeleteGroup.value)
        return;
    modalStore.open({
        title: t('catalogs.delete'),
        component: DhConfirmDialog,
        size: 'md',
        props: {
            title: t('catalogs.delete'),
            message: t('catalogs.deleteConfirm', { name: localGroup.value.name }),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            danger: true,
            onConfirm: async () => {
                await CatalogGroupsService.delete(localGroup.value.id);
                modalStore.close();
                drawerStore.close();
                toastStore.success(t('catalogs.catalogDeleted'));
                await props.onSaved?.();
            },
            onCancel: () => modalStore.close(),
        },
    });
}
function openCreateItem() {
    if (!canCreateItem.value)
        return;
    const maxSortOrder = items.value.reduce((max, item) => Math.max(max, item.sortOrder), 0);
    drawerStore.open({
        title: t('catalogs.newItem'),
        component: CatalogItemFormDrawer,
        size: 'lg',
        props: {
            group: localGroup.value,
            nextSortOrder: maxSortOrder + 1,
            onSaved: refreshAll,
        },
    });
}
function openEditItem(item) {
    if (!canUpdateItem.value)
        return;
    drawerStore.open({
        title: t('catalogs.editItem'),
        component: CatalogItemFormDrawer,
        size: 'lg',
        props: {
            group: localGroup.value,
            item,
            onSaved: refreshAll,
        },
    });
}
async function setItemActive(item, isActive) {
    if (!canSetItemActive.value)
        return;
    try {
        await CatalogItemsService.setActive(item.id, { isActive });
        toastStore.success(isActive ? t('catalogs.itemActivated') : t('catalogs.itemInactivated'));
        await refreshAll();
    }
    catch (error) {
        toastStore.backendError(error, t('catalogs.changeStatusError'));
    }
}
function confirmDeleteItem(item) {
    if (!canDeleteItem.value)
        return;
    modalStore.open({
        title: t('catalogs.deleteItem'),
        component: DhConfirmDialog,
        size: 'md',
        props: {
            title: t('catalogs.deleteItem'),
            message: t('catalogs.deleteItemConfirm', { name: item.name }),
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            danger: true,
            onConfirm: async () => {
                await CatalogItemsService.delete(item.id);
                modalStore.close();
                toastStore.success(t('catalogs.itemDeleted'));
                await refreshAll();
            },
            onCancel: () => modalStore.close(),
        },
    });
}
function onDragStart(index) {
    if (!canChangeItemOrder.value)
        return;
    draggingIndex.value = index;
}
async function onDrop(dropIndex) {
    if (!canChangeItemOrder.value || draggingIndex.value === null)
        return;
    const fromIndex = draggingIndex.value;
    draggingIndex.value = null;
    if (fromIndex === dropIndex)
        return;
    const nextItems = [...items.value];
    const [moved] = nextItems.splice(fromIndex, 1);
    if (!moved)
        return;
    nextItems.splice(dropIndex, 0, moved);
    items.value = nextItems.map((item, index) => ({
        ...item,
        sortOrder: index + 1,
    }));
    await saveOrder();
}
async function saveOrder() {
    if (!canChangeItemOrder.value)
        return;
    try {
        savingOrder.value = true;
        for (const item of items.value) {
            await CatalogItemsService.changeSortOrder(item.id, {
                sortOrder: item.sortOrder,
            });
        }
        toastStore.success(t('catalogs.orderUpdated'));
        await refreshAll();
    }
    catch (error) {
        toastStore.backendError(error, t('catalogs.orderError'));
        await loadDetail();
    }
    finally {
        savingOrder.value = false;
    }
}
onMounted(loadDetail);
const __VLS_ctx = {
    ...{},
    ...{},
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-start justify-between gap-4" },
});
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
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Tag} */
Tag;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}));
const __VLS_2 = __VLS_1({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['h-5']} */ ;
/** @type {__VLS_StyleScopedClasses['w-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "truncate text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['truncate']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.localGroup.name);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.localGroup.description || __VLS_ctx.t('catalogs.withoutDescription'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    label: (__VLS_ctx.localGroup.code),
    variant: "neutral",
}));
const __VLS_7 = __VLS_6({
    label: (__VLS_ctx.localGroup.code),
    variant: "neutral",
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    label: (__VLS_ctx.localGroup.slug),
    variant: "primary",
}));
const __VLS_12 = __VLS_11({
    label: (__VLS_ctx.localGroup.slug),
    variant: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    label: (__VLS_ctx.localGroup.isSystem ? __VLS_ctx.t('common.system') : __VLS_ctx.t('common.administrable')),
    variant: (__VLS_ctx.localGroup.isSystem ? 'primary' : 'neutral'),
}));
const __VLS_17 = __VLS_16({
    label: (__VLS_ctx.localGroup.isSystem ? __VLS_ctx.t('common.system') : __VLS_ctx.t('common.administrable')),
    variant: (__VLS_ctx.localGroup.isSystem ? 'primary' : 'neutral'),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
let __VLS_20;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
    label: (__VLS_ctx.localGroup.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localGroup.isActive ? 'success' : 'neutral'),
}));
const __VLS_22 = __VLS_21({
    label: (__VLS_ctx.localGroup.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localGroup.isActive ? 'success' : 'neutral'),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
if (__VLS_ctx.showGroupActions) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 grid gap-2 md:grid-cols-4" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-4']} */ ;
    if (__VLS_ctx.canUpdateGroup) {
        let __VLS_25;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            label: (__VLS_ctx.t('common.edit')),
            variant: "secondary",
        }));
        const __VLS_27 = __VLS_26({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Pencil),
            label: (__VLS_ctx.t('common.edit')),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        let __VLS_30;
        const __VLS_31 = {
            /** @type {typeof __VLS_30.click} */
            onClick: (__VLS_ctx.openEditGroup),
        };
        var __VLS_28;
        var __VLS_29;
    }
    if (__VLS_ctx.canSetGroupActive && __VLS_ctx.localGroup.isActive) {
        let __VLS_32;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: (__VLS_ctx.t('common.inactivate')),
            variant: "secondary",
        }));
        const __VLS_34 = __VLS_33({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: (__VLS_ctx.t('common.inactivate')),
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        let __VLS_37;
        const __VLS_38 = {
            /** @type {typeof __VLS_37.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupActions))
                    return;
                if (!(__VLS_ctx.canSetGroupActive && __VLS_ctx.localGroup.isActive))
                    return;
                __VLS_ctx.setGroupActive(false);
                // @ts-ignore
                [localGroup, localGroup, localGroup, localGroup, localGroup, localGroup, localGroup, localGroup, localGroup, t, t, t, t, t, t, t, showGroupActions, canUpdateGroup, Pencil, openEditGroup, canSetGroupActive, Ban, setGroupActive,];
            },
        };
        var __VLS_35;
        var __VLS_36;
    }
    else if (__VLS_ctx.canSetGroupActive) {
        let __VLS_39;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_40 = __VLS_asFunctionalComponent1(__VLS_39, new __VLS_39({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: (__VLS_ctx.t('common.activate')),
        }));
        const __VLS_41 = __VLS_40({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: (__VLS_ctx.t('common.activate')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_40));
        let __VLS_44;
        const __VLS_45 = {
            /** @type {typeof __VLS_44.click} */
            onClick: (...[$event]) => {
                if (!(__VLS_ctx.showGroupActions))
                    return;
                if (!!(__VLS_ctx.canSetGroupActive && __VLS_ctx.localGroup.isActive))
                    return;
                if (!(__VLS_ctx.canSetGroupActive))
                    return;
                __VLS_ctx.setGroupActive(true);
                // @ts-ignore
                [t, canSetGroupActive, setGroupActive, CheckCircle2,];
            },
        };
        var __VLS_42;
        var __VLS_43;
    }
    if (__VLS_ctx.canDeleteGroup) {
        let __VLS_46;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            label: (__VLS_ctx.t('common.delete')),
            variant: "danger",
        }));
        const __VLS_48 = __VLS_47({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Trash2),
            label: (__VLS_ctx.t('common.delete')),
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_47));
        let __VLS_51;
        const __VLS_52 = {
            /** @type {typeof __VLS_51.click} */
            onClick: (__VLS_ctx.confirmDeleteGroup),
        };
        var __VLS_49;
        var __VLS_50;
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-4 flex items-center justify-between gap-3" },
});
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-sm font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('catalogs.catalogMetadata'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('catalogs.metadataDisplayHint'));
if (__VLS_ctx.formatMetadata(__VLS_ctx.localGroup.metadataJson).length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "text-sm font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('catalogs.withoutMetadata'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [field] of __VLS_vFor((__VLS_ctx.formatMetadata(__VLS_ctx.localGroup.metadataJson)))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (field.key),
            ...{ class: "rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (field.key);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all text-sm font-bold text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (field.value);
        // @ts-ignore
        [localGroup, localGroup, t, t, t, t, canDeleteGroup, Trash2, confirmDeleteGroup, formatMetadata, formatMetadata,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-[28px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-5" },
});
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
    ...{ class: "text-lg font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.t('catalogs.itemsTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('catalogs.itemsSubtitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_53;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_54 = __VLS_asFunctionalComponent1(__VLS_53, new __VLS_53({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.refresh')),
    variant: "secondary",
    loading: (__VLS_ctx.loading),
}));
const __VLS_55 = __VLS_54({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.RefreshCcw),
    label: (__VLS_ctx.t('common.refresh')),
    variant: "secondary",
    loading: (__VLS_ctx.loading),
}, ...__VLS_functionalComponentArgsRest(__VLS_54));
let __VLS_58;
const __VLS_59 = {
    /** @type {typeof __VLS_58.click} */
    onClick: (__VLS_ctx.loadDetail),
};
var __VLS_56;
var __VLS_57;
if (__VLS_ctx.canCreateItem) {
    let __VLS_60;
    /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
    DhButton;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.PackagePlus),
        label: (__VLS_ctx.t('catalogs.newItem')),
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.PackagePlus),
        label: (__VLS_ctx.t('catalogs.newItem')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = {
        /** @type {typeof __VLS_65.click} */
        onClick: (__VLS_ctx.openCreateItem),
    };
    var __VLS_63;
    var __VLS_64;
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('common.loading'));
}
else if (__VLS_ctx.items.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-dashed border-[var(--dh-border)] p-8 text-center" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-dashed']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('catalogs.emptyItems'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('catalogs.emptyItemsHint'));
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    for (const [item, index] of __VLS_vFor((__VLS_ctx.items))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onDragstart: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.items.length === 0))
                        return;
                    __VLS_ctx.onDragStart(index);
                    // @ts-ignore
                    [t, t, t, t, t, t, t, RefreshCcw, loading, loading, loadDetail, canCreateItem, PackagePlus, openCreateItem, items, items, onDragStart,];
                } },
            ...{ onDragover: () => { } },
            ...{ onDrop: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.items.length === 0))
                        return;
                    __VLS_ctx.onDrop(index);
                    // @ts-ignore
                    [onDrop,];
                } },
            key: (item.id),
            draggable: (__VLS_ctx.canChangeItemOrder),
            ...{ class: "group rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--dh-shadow-sm)]" },
            ...{ class: ({ 'cursor-grab active:cursor-grabbing': __VLS_ctx.canChangeItemOrder }) },
        });
        /** @type {__VLS_StyleScopedClasses['group']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:-translate-y-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:shadow-[var(--dh-shadow-sm)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['cursor-grab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active:cursor-grabbing']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex min-w-0 gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-1 rounded-2xl border border-[var(--dh-border)] bg-[var(--dh-card)] p-2 text-[var(--dh-text-muted)]" },
            ...{ class: ({ 'opacity-40': !__VLS_ctx.canChangeItemOrder }) },
            title: (__VLS_ctx.t('catalogs.dragToSort')),
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['opacity-40']} */ ;
        let __VLS_67;
        /** @ts-ignore @type { | typeof __VLS_components.GripVertical} */
        GripVertical;
        // @ts-ignore
        const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
            ...{ class: "h-4 w-4" },
        }));
        const __VLS_69 = __VLS_68({
            ...{ class: "h-4 w-4" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_68));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "truncate text-sm font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (item.name);
        let __VLS_72;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_73 = __VLS_asFunctionalComponent1(__VLS_72, new __VLS_72({
            label: (`#${item.sortOrder}`),
            variant: "neutral",
        }));
        const __VLS_74 = __VLS_73({
            label: (`#${item.sortOrder}`),
            variant: "neutral",
        }, ...__VLS_functionalComponentArgsRest(__VLS_73));
        let __VLS_77;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_78 = __VLS_asFunctionalComponent1(__VLS_77, new __VLS_77({
            label: (item.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
            variant: (item.isActive ? 'success' : 'neutral'),
        }));
        const __VLS_79 = __VLS_78({
            label: (item.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
            variant: (item.isActive ? 'success' : 'neutral'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_78));
        if (item.isSystem) {
            let __VLS_82;
            /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
            DhBadge;
            // @ts-ignore
            const __VLS_83 = __VLS_asFunctionalComponent1(__VLS_82, new __VLS_82({
                label: (__VLS_ctx.t('common.system')),
                variant: "primary",
            }));
            const __VLS_84 = __VLS_83({
                label: (__VLS_ctx.t('common.system')),
                variant: "primary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_83));
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-bold text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        (item.slug);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (item.description || __VLS_ctx.t('catalogs.withoutDescription'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "mt-2 flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "rounded-full bg-[var(--dh-card)] px-3 py-1 text-xs font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.t('common.code'));
        (item.code);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "rounded-full bg-[var(--dh-card)] px-3 py-1 text-xs font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (__VLS_ctx.t('common.value'));
        (item.value || '—');
        if (__VLS_ctx.formatMetadata(item.metadataJson).length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-3 grid gap-2 md:grid-cols-2" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
            for (const [field] of __VLS_vFor((__VLS_ctx.formatMetadata(item.metadataJson)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    key: (field.key),
                    ...{ class: "rounded-[16px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-2" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded-[16px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "text-[10px] font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
                /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
                /** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
                (field.key);
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-1 break-all text-xs font-bold text-[var(--dh-text)]" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
                (field.value);
                // @ts-ignore
                [t, t, t, t, t, t, t, formatMetadata, formatMetadata, canChangeItemOrder, canChangeItemOrder, canChangeItemOrder,];
            }
        }
        if (__VLS_ctx.showItemActions) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex shrink-0 items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            if (__VLS_ctx.canUpdateItem) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.items.length === 0))
                                return;
                            if (!(__VLS_ctx.showItemActions))
                                return;
                            if (!(__VLS_ctx.canUpdateItem))
                                return;
                            __VLS_ctx.openEditItem(item);
                            // @ts-ignore
                            [showItemActions, canUpdateItem, openEditItem,];
                        } },
                    ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
                    title: (__VLS_ctx.t('common.edit')),
                });
                /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
                /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
                let __VLS_87;
                /** @ts-ignore @type { | typeof __VLS_components.Pencil} */
                Pencil;
                // @ts-ignore
                const __VLS_88 = __VLS_asFunctionalComponent1(__VLS_87, new __VLS_87({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_89 = __VLS_88({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_88));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            if (__VLS_ctx.canSetItemActive && item.isActive) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.items.length === 0))
                                return;
                            if (!(__VLS_ctx.showItemActions))
                                return;
                            if (!(__VLS_ctx.canSetItemActive && item.isActive))
                                return;
                            __VLS_ctx.setItemActive(item, false);
                            // @ts-ignore
                            [t, canSetItemActive, setItemActive,];
                        } },
                    ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
                    title: (__VLS_ctx.t('common.inactivate')),
                });
                /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
                /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
                let __VLS_92;
                /** @ts-ignore @type { | typeof __VLS_components.Ban} */
                Ban;
                // @ts-ignore
                const __VLS_93 = __VLS_asFunctionalComponent1(__VLS_92, new __VLS_92({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_94 = __VLS_93({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            else if (__VLS_ctx.canSetItemActive) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.items.length === 0))
                                return;
                            if (!(__VLS_ctx.showItemActions))
                                return;
                            if (!!(__VLS_ctx.canSetItemActive && item.isActive))
                                return;
                            if (!(__VLS_ctx.canSetItemActive))
                                return;
                            __VLS_ctx.setItemActive(item, true);
                            // @ts-ignore
                            [t, canSetItemActive, setItemActive,];
                        } },
                    ...{ class: "rounded-2xl p-2 text-emerald-500 hover:bg-emerald-500/10" },
                    title: (__VLS_ctx.t('common.activate')),
                });
                /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-emerald-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-emerald-500/10']} */ ;
                let __VLS_97;
                /** @ts-ignore @type { | typeof __VLS_components.CheckCircle2} */
                CheckCircle2;
                // @ts-ignore
                const __VLS_98 = __VLS_asFunctionalComponent1(__VLS_97, new __VLS_97({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_99 = __VLS_98({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_98));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
            if (__VLS_ctx.canDeleteItem) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.items.length === 0))
                                return;
                            if (!(__VLS_ctx.showItemActions))
                                return;
                            if (!(__VLS_ctx.canDeleteItem))
                                return;
                            __VLS_ctx.confirmDeleteItem(item);
                            // @ts-ignore
                            [t, canDeleteItem, confirmDeleteItem,];
                        } },
                    ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
                    title: (__VLS_ctx.t('common.delete')),
                });
                /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
                /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
                let __VLS_102;
                /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
                Trash2;
                // @ts-ignore
                const __VLS_103 = __VLS_asFunctionalComponent1(__VLS_102, new __VLS_102({
                    ...{ class: "h-4 w-4" },
                }));
                const __VLS_104 = __VLS_103({
                    ...{ class: "h-4 w-4" },
                }, ...__VLS_functionalComponentArgsRest(__VLS_103));
                /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
            }
        }
        // @ts-ignore
        [t,];
    }
    if (__VLS_ctx.savingOrder) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-[20px] border border-[var(--dh-border)] p-3 text-center text-xs font-black text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (__VLS_ctx.t('catalogs.savingOrder'));
    }
}
// @ts-ignore
[t, savingOrder,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
