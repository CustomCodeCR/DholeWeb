import { computed, onMounted, ref, watch } from 'vue';
import { Pencil, Trash2, Users } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useToastStore } from '@/core/stores/toastStore';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { UsersService } from '@/core/services/usersService';
import { parseDate } from '@/core/utils/date';
import UserFormDrawer from '@/modules/users/components/UserFormDrawer.vue';
import UserDetailDrawer from '@/modules/users/components/UserDetailDrawer.vue';
import DhConfirmDialog from '@/shared/components/molecules/DhConfirmDialog.vue';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const toastStore = useToastStore();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const authStore = useAuthStore();
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const users = ref([]);
const canCreate = computed(() => authStore.hasScope(AUTH_SCOPES.users.create));
const canUpdate = computed(() => authStore.hasScope(AUTH_SCOPES.users.update));
const canDelete = computed(() => authStore.hasScope(AUTH_SCOPES.users.delete));
const showRowActions = computed(() => canUpdate.value || canDelete.value);
const columns = computed(() => {
    const base = [
        { key: 'userName', label: t('users.userName') },
        { key: 'displayName', label: t('users.displayName') },
        { key: 'email', label: t('users.email') },
        { key: 'userTypeName', label: t('users.type') },
        { key: 'lastLoginAt', label: t('users.lastLogin') },
        { key: 'isLocked', label: t('users.locked'), align: 'center' },
        { key: 'isActive', label: t('users.status'), align: 'center' },
    ];
    if (showRowActions.value) {
        base.push({ key: 'actions', label: '', align: 'right' });
    }
    return base;
});
async function loadUsers() {
    try {
        loading.value = true;
        const result = await UsersService.browsePaged({
            pageNumber: page.value,
            pageSize: pageSize.value,
            search: search.value || undefined,
        });
        users.value = result.items;
        total.value = result.totalCount ?? result.items.length;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar los usuarios.');
    }
    finally {
        loading.value = false;
    }
}
function openCreateDrawer() {
    if (!canCreate.value)
        return;
    drawerStore.open({ title: t('users.new'), component: UserFormDrawer, size: 'lg', props: { onSaved: loadUsers } });
}
function openEditDrawer(user) {
    if (!canUpdate.value || user.isProtected)
        return;
    drawerStore.open({ title: t('common.edit'), component: UserFormDrawer, size: 'lg', props: { user, onSaved: loadUsers } });
}
function openDetailDrawer(user) {
    drawerStore.open({
        title: user.displayName || user.userName,
        component: UserDetailDrawer,
        size: 'xl',
        props: { user, onSaved: loadUsers },
    });
}
function confirmDelete(user) {
    if (!canDelete.value || user.isProtected)
        return;
    modalStore.open({
        title: t('common.delete'),
        component: DhConfirmDialog,
        size: 'md',
        props: {
            title: t('common.delete'),
            message: `¿Eliminar ${user.displayName || user.userName}?`,
            confirmLabel: t('common.delete'),
            cancelLabel: t('common.cancel'),
            danger: true,
            onConfirm: async () => {
                await UsersService.delete(user.id);
                modalStore.close();
                toastStore.success('Usuario eliminado');
                await loadUsers();
            },
            onCancel: () => modalStore.close(),
        },
    });
}
watch([page, pageSize], loadUsers);
useViewShortcuts({
    create: () => {
        if (canCreate.value)
            openCreateDrawer();
    },
    save: loadUsers,
    refresh: loadUsers,
});
onMounted(loadUsers);
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
    title: (__VLS_ctx.t('users.title')),
    subtitle: (__VLS_ctx.t('users.subtitle')),
    icon: (__VLS_ctx.Users),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('users.title')),
    subtitle: (__VLS_ctx.t('users.subtitle')),
    icon: (__VLS_ctx.Users),
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
            label: (__VLS_ctx.t('users.new')),
        }));
        const __VLS_9 = __VLS_8({
            ...{ 'onClick': {} },
            label: (__VLS_ctx.t('users.new')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_8));
        let __VLS_12;
        const __VLS_13 = {
            /** @type {typeof __VLS_12.click} */
            onClick: (__VLS_ctx.openCreateDrawer),
        };
        var __VLS_10;
        var __VLS_11;
        // @ts-ignore
        [t, t, t, Users, canCreate, openCreateDrawer,];
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
    title: (__VLS_ctx.t('users.title')),
    createLabel: (__VLS_ctx.t('users.new')),
    showCreate: (__VLS_ctx.canCreate),
}));
const __VLS_16 = __VLS_15({
    ...{ 'onCreate': {} },
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: (__VLS_ctx.t('users.title')),
    createLabel: (__VLS_ctx.t('users.new')),
    showCreate: (__VLS_ctx.canCreate),
}, ...__VLS_functionalComponentArgsRest(__VLS_15));
let __VLS_19;
const __VLS_20 = {
    /** @type {typeof __VLS_19.create} */
    onCreate: (__VLS_ctx.openCreateDrawer),
};
const __VLS_21 = {
    /** @type {typeof __VLS_19.refresh} */
    onRefresh: (__VLS_ctx.loadUsers),
};
const __VLS_22 = {
    /** @type {typeof __VLS_19.filter} */
    onFilter: (__VLS_ctx.loadUsers),
};
const __VLS_23 = {
    /** @type {typeof __VLS_19.search} */
    onSearch: (__VLS_ctx.loadUsers),
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
    rows: (__VLS_ctx.users),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('users.empty')),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onRowClick': {} },
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.users),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('users.empty')),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_29;
const __VLS_30 = {
    /** @type {typeof __VLS_29.rowClick} */
    onRowClick: (__VLS_ctx.openDetailDrawer),
};
const { default: __VLS_31 } = __VLS_27.slots;
{
    const { 'cell-lastLoginAt': __VLS_32 } = __VLS_27.slots;
    const [{ value }] = __VLS_vSlot(__VLS_32);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (value ? __VLS_ctx.parseDate(String(value)) : __VLS_ctx.t('common.never'));
    // @ts-ignore
    [t, t, t, t, canCreate, openCreateDrawer, search, loadUsers, loadUsers, loadUsers, columns, users, loading, openDetailDrawer, parseDate,];
}
{
    const { 'cell-userTypeName': __VLS_33 } = __VLS_27.slots;
    const [{ row, value }] = __VLS_vSlot(__VLS_33);
    let __VLS_34;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
        label: (String(value ?? row.userType ?? '—')),
        variant: "neutral",
    }));
    const __VLS_36 = __VLS_35({
        label: (String(value ?? row.userType ?? '—')),
        variant: "neutral",
    }, ...__VLS_functionalComponentArgsRest(__VLS_35));
    // @ts-ignore
    [];
}
{
    const { 'cell-isLocked': __VLS_39 } = __VLS_27.slots;
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
        label: (value ? __VLS_ctx.t('common.yes') : __VLS_ctx.t('common.no')),
        variant: (value ? 'danger' : 'neutral'),
    }));
    const __VLS_42 = __VLS_41({
        label: (value ? __VLS_ctx.t('common.yes') : __VLS_ctx.t('common.no')),
        variant: (value ? 'danger' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    // @ts-ignore
    [t, t,];
}
{
    const { 'cell-isActive': __VLS_45 } = __VLS_27.slots;
    const [{ value }] = __VLS_vSlot(__VLS_45);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_46;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        label: (value ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
        variant: (value ? 'success' : 'neutral'),
    }));
    const __VLS_48 = __VLS_47({
        label: (value ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
        variant: (value ? 'success' : 'neutral'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    // @ts-ignore
    [t, t,];
}
if (__VLS_ctx.showRowActions) {
    {
        const { 'cell-actions': __VLS_51 } = __VLS_27.slots;
        const [{ row }] = __VLS_vSlot(__VLS_51);
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
                disabled: (row.isProtected),
                ...{ class: (row.isProtected ? 'cursor-not-allowed opacity-40' : '') },
                ...{ class: "rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/10" },
                title: "Editar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-black/5']} */ ;
            /** @type {__VLS_StyleScopedClasses['dark:hover:bg-white/10']} */ ;
            let __VLS_52;
            /** @ts-ignore @type { | typeof __VLS_components.Pencil} */
            Pencil;
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_54 = __VLS_53({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_53));
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
                disabled: (row.isProtected),
                ...{ class: (row.isProtected ? 'cursor-not-allowed opacity-40' : '') },
                ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
                title: "Eliminar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
            let __VLS_57;
            /** @ts-ignore @type { | typeof __VLS_components.Trash2} */
            Trash2;
            // @ts-ignore
            const __VLS_58 = __VLS_asFunctionalComponent1(__VLS_57, new __VLS_57({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_59 = __VLS_58({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_58));
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
let __VLS_62;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_63 = __VLS_asFunctionalComponent1(__VLS_62, new __VLS_62({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_64 = __VLS_63({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_63));
// @ts-ignore
[page, pageSize, total,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
