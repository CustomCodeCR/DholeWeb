import { computed, onMounted, ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhButton, DhInput, DhPasswordInput, DhSelect, DhSwitch } from '@/shared/components/atoms';
import { useDrawerStore } from '@/core/stores/drawerStore';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { UsersService } from '@/core/services/usersService';
import { RolesService } from '@/core/services/rolesService';
import { ScopesService } from '@/core/services/scopesService';
import RoleQuickCreateModal from '@/modules/roles/components/RoleQuickCreateModal.vue';
const props = defineProps();
const { t } = useI18n();
const drawerStore = useDrawerStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const loading = ref(false);
const roles = ref([]);
const scopes = ref([]);
const selectedRoleIds = ref([]);
const selectedScopeIds = ref([]);
const originalRoleIds = ref([]);
const originalScopeIds = ref([]);
const form = ref({
    userName: props.user?.userName ?? '',
    displayName: props.user?.displayName ?? '',
    email: props.user?.email ?? '',
    password: '',
    userType: (props.user?.userType ?? 'Internal'),
    isActive: props.user?.isActive ?? true,
    isLocked: props.user?.isLocked ?? false,
});
const isEdit = computed(() => Boolean(props.user));
const canCreateUser = computed(() => authStore.hasScope(AUTH_SCOPES.users.create));
const canUpdateUser = computed(() => authStore.hasScope(AUTH_SCOPES.users.update));
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.users.setActive));
const canSetLocked = computed(() => authStore.hasScope(AUTH_SCOPES.users.setLocked));
const canViewRoles = computed(() => authStore.hasScope(AUTH_SCOPES.roles.view));
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view));
const canCreateRole = computed(() => authStore.hasScope(AUTH_SCOPES.roles.create));
const canAssignRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesAssign) && canViewRoles.value);
const canRevokeRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesRevoke));
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesAssign) && canViewScopes.value);
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesRevoke));
const canSaveCore = computed(() => (isEdit.value ? canUpdateUser.value : canCreateUser.value));
const canManageRoles = computed(() => canAssignRoles.value || canRevokeRoles.value);
const canManageScopes = computed(() => canAssignScopes.value || canRevokeScopes.value);
const showRoleSection = computed(() => canManageRoles.value && roles.value.length > 0);
const showScopeSection = computed(() => canManageScopes.value && scopes.value.length > 0);
const showStatusSection = computed(() => Boolean(props.user) && (canSetActive.value || canSetLocked.value));
function diffAdded(current, original) {
    return current.filter((id) => !original.includes(id));
}
function diffRemoved(current, original) {
    return original.filter((id) => !current.includes(id));
}
function mergeRoleOptions(existing, assigned) {
    const map = new Map(existing.map((role) => [role.id, role]));
    assigned.forEach((role) => {
        if (!map.has(role.roleId)) {
            map.set(role.roleId, { id: role.roleId, name: role.roleName });
        }
    });
    return [...map.values()];
}
function mergeScopeOptions(existing, assigned) {
    const map = new Map(existing.map((scope) => [scope.id, scope]));
    assigned.forEach((scope) => {
        if (!map.has(scope.scopeId)) {
            map.set(scope.scopeId, { id: scope.scopeId, code: scope.scopeCode, name: scope.scopeName });
        }
    });
    return [...map.values()];
}
async function loadAccessData() {
    try {
        const [roleOptions, scopeOptions, userRoles, userScopes] = await Promise.all([
            canAssignRoles.value ? RolesService.select() : Promise.resolve([]),
            canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
            props.user && canManageRoles.value ? UsersService.getRoles(props.user.id) : Promise.resolve([]),
            props.user && canManageScopes.value ? UsersService.getScopes(props.user.id) : Promise.resolve([]),
        ]);
        originalRoleIds.value = userRoles.map((x) => x.roleId);
        originalScopeIds.value = userScopes.map((x) => x.scopeId);
        selectedRoleIds.value = [...originalRoleIds.value];
        selectedScopeIds.value = [...originalScopeIds.value];
        roles.value = mergeRoleOptions(roleOptions, userRoles);
        scopes.value = mergeScopeOptions(scopeOptions, userScopes);
    }
    catch (error) {
        toastStore.backendWarning(error, 'No se pudieron cargar roles o permisos.');
    }
}
function openCreateRoleModal() {
    if (!canCreateRole.value)
        return;
    modalStore.open({
        title: t('roles.new'),
        component: RoleQuickCreateModal,
        size: 'md',
        props: {
            onSaved: async () => {
                await loadAccessData();
            },
        },
    });
}
async function syncUserRoles(userId) {
    const added = diffAdded(selectedRoleIds.value, originalRoleIds.value);
    const removed = diffRemoved(selectedRoleIds.value, originalRoleIds.value);
    if (canAssignRoles.value && added.length > 0)
        await UsersService.assignRoles(userId, { roleIds: added });
    if (canRevokeRoles.value && removed.length > 0)
        await UsersService.revokeRoles(userId, { roleIds: removed });
}
async function syncUserScopes(userId) {
    const added = diffAdded(selectedScopeIds.value, originalScopeIds.value);
    const removed = diffRemoved(selectedScopeIds.value, originalScopeIds.value);
    if (canAssignScopes.value && added.length > 0)
        await UsersService.assignScopes(userId, { scopeIds: added });
    if (canRevokeScopes.value && removed.length > 0)
        await UsersService.revokeScopes(userId, { scopeIds: removed });
}
async function save() {
    if (!canSaveCore.value) {
        toastStore.warning('Sin permiso', 'No tiene permiso para guardar este usuario.');
        return;
    }
    try {
        loading.value = true;
        if (props.user) {
            await UsersService.update(props.user.id, {
                userName: form.value.userName,
                displayName: form.value.displayName,
                email: form.value.email,
            });
            if (canSetActive.value && form.value.isActive !== props.user.isActive) {
                await UsersService.setActive(props.user.id, { isActive: form.value.isActive });
            }
            if (canSetLocked.value && form.value.isLocked !== props.user.isLocked) {
                await UsersService.setLocked(props.user.id, { isLocked: form.value.isLocked });
            }
            await syncUserRoles(props.user.id);
            await syncUserScopes(props.user.id);
        }
        else {
            const userId = await UsersService.create({
                userName: form.value.userName,
                displayName: form.value.displayName,
                email: form.value.email,
                password: form.value.password,
                userType: form.value.userType,
            });
            if (canAssignRoles.value && selectedRoleIds.value.length > 0) {
                await UsersService.assignRoles(userId, { roleIds: selectedRoleIds.value });
            }
            if (canAssignScopes.value && selectedScopeIds.value.length > 0) {
                await UsersService.assignScopes(userId, { scopeIds: selectedScopeIds.value });
            }
        }
        toastStore.success('Guardado', 'Usuario guardado correctamente.');
        await props.onSaved?.();
        drawerStore.close();
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo guardar el usuario.');
    }
    finally {
        loading.value = false;
    }
}
onMounted(loadAccessData);
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.save) },
    ...{ class: "space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "grid gap-4 md:grid-cols-2" },
});
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    modelValue: (__VLS_ctx.form.userName),
    label: (__VLS_ctx.t('users.userName')),
    placeholder: "mlopez",
    disabled: (!__VLS_ctx.canSaveCore),
}));
const __VLS_2 = __VLS_1({
    modelValue: (__VLS_ctx.form.userName),
    label: (__VLS_ctx.t('users.userName')),
    placeholder: "mlopez",
    disabled: (!__VLS_ctx.canSaveCore),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    modelValue: (__VLS_ctx.form.displayName),
    label: (__VLS_ctx.t('users.displayName')),
    placeholder: "Maurice López",
    disabled: (!__VLS_ctx.canSaveCore),
}));
const __VLS_7 = __VLS_6({
    modelValue: (__VLS_ctx.form.displayName),
    label: (__VLS_ctx.t('users.displayName')),
    placeholder: "Maurice López",
    disabled: (!__VLS_ctx.canSaveCore),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhInput} */
DhInput;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    modelValue: (__VLS_ctx.form.email),
    label: (__VLS_ctx.t('users.email')),
    placeholder: "usuario@empresa.com",
    type: "email",
    disabled: (!__VLS_ctx.canSaveCore),
}));
const __VLS_12 = __VLS_11({
    modelValue: (__VLS_ctx.form.email),
    label: (__VLS_ctx.t('users.email')),
    placeholder: "usuario@empresa.com",
    type: "email",
    disabled: (!__VLS_ctx.canSaveCore),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    modelValue: (__VLS_ctx.form.userType),
    label: (__VLS_ctx.t('users.type')),
    disabled: (Boolean(__VLS_ctx.user) || !__VLS_ctx.canSaveCore),
    options: ([
        { label: 'Internal', value: 'Internal' },
        { label: 'External', value: 'External' },
    ]),
}));
const __VLS_17 = __VLS_16({
    modelValue: (__VLS_ctx.form.userType),
    label: (__VLS_ctx.t('users.type')),
    disabled: (Boolean(__VLS_ctx.user) || !__VLS_ctx.canSaveCore),
    options: ([
        { label: 'Internal', value: 'Internal' },
        { label: 'External', value: 'External' },
    ]),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
if (!__VLS_ctx.user) {
    let __VLS_20;
    /** @ts-ignore @type { | typeof __VLS_components.DhPasswordInput} */
    DhPasswordInput;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        modelValue: (__VLS_ctx.form.password),
        label: (__VLS_ctx.t('users.password')),
    }));
    const __VLS_22 = __VLS_21({
        modelValue: (__VLS_ctx.form.password),
        label: (__VLS_ctx.t('users.password')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
if (__VLS_ctx.showRoleSection) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3 flex items-center justify-between gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('users.roles'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    if (__VLS_ctx.canCreateRole) {
        let __VLS_25;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Plus),
            label: (__VLS_ctx.t('roles.new')),
            variant: "secondary",
            size: "sm",
        }));
        const __VLS_27 = __VLS_26({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Plus),
            label: (__VLS_ctx.t('roles.new')),
            variant: "secondary",
            size: "sm",
        }, ...__VLS_functionalComponentArgsRest(__VLS_26));
        let __VLS_30;
        const __VLS_31 = {
            /** @type {typeof __VLS_30.click} */
            onClick: (__VLS_ctx.openCreateRoleModal),
        };
        var __VLS_28;
        var __VLS_29;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [role] of __VLS_vFor((__VLS_ctx.roles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (role.id),
            ...{ class: "flex items-center gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-bold" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            value: (role.id),
            disabled: ((!__VLS_ctx.originalRoleIds.includes(role.id) && !__VLS_ctx.canAssignRoles) || (__VLS_ctx.originalRoleIds.includes(role.id) && !__VLS_ctx.canRevokeRoles && __VLS_ctx.isEdit)),
            ...{ class: "accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40" },
        });
        (__VLS_ctx.selectedRoleIds);
        /** @type {__VLS_StyleScopedClasses['accent-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
        (role.name);
        // @ts-ignore
        [save, form, form, form, form, form, t, t, t, t, t, t, t, canSaveCore, canSaveCore, canSaveCore, canSaveCore, user, user, showRoleSection, canCreateRole, Plus, openCreateRoleModal, roles, originalRoleIds, originalRoleIds, canAssignRoles, canRevokeRoles, isEdit, selectedRoleIds,];
    }
}
if (__VLS_ctx.showScopeSection) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "rounded-[26px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4 shadow-[var(--dh-shadow-sm)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[26px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-[var(--dh-shadow-sm)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mb-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "text-sm font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('users.directScopes'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-semibold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [scope] of __VLS_vFor((__VLS_ctx.scopes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            key: (scope.id),
            ...{ class: "flex items-start gap-2 rounded-[18px] border border-[var(--dh-border)] bg-[var(--dh-input)] p-3 text-sm font-bold" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-[18px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-input)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "checkbox",
            value: (scope.id),
            disabled: ((!__VLS_ctx.originalScopeIds.includes(scope.id) && !__VLS_ctx.canAssignScopes) || (__VLS_ctx.originalScopeIds.includes(scope.id) && !__VLS_ctx.canRevokeScopes && __VLS_ctx.isEdit)),
            ...{ class: "mt-1 accent-[var(--dh-primary)] disabled:cursor-not-allowed disabled:opacity-40" },
        });
        (__VLS_ctx.selectedScopeIds);
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['accent-[var(--dh-primary)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:cursor-not-allowed']} */ ;
        /** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (scope.code);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "block text-xs text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['block']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (scope.name);
        // @ts-ignore
        [t, isEdit, showScopeSection, scopes, originalScopeIds, originalScopeIds, canAssignScopes, canRevokeScopes, selectedScopeIds,];
    }
}
if (__VLS_ctx.showStatusSection) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-4 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    if (__VLS_ctx.canSetActive) {
        let __VLS_32;
        /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
        DhSwitch;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({
            modelValue: (__VLS_ctx.form.isActive),
            label: (__VLS_ctx.t('common.active')),
        }));
        const __VLS_34 = __VLS_33({
            modelValue: (__VLS_ctx.form.isActive),
            label: (__VLS_ctx.t('common.active')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
    }
    if (__VLS_ctx.canSetLocked) {
        let __VLS_37;
        /** @ts-ignore @type { | typeof __VLS_components.DhSwitch} */
        DhSwitch;
        // @ts-ignore
        const __VLS_38 = __VLS_asFunctionalComponent1(__VLS_37, new __VLS_37({
            modelValue: (__VLS_ctx.form.isLocked),
            label: (__VLS_ctx.t('users.locked')),
        }));
        const __VLS_39 = __VLS_38({
            modelValue: (__VLS_ctx.form.isLocked),
            label: (__VLS_ctx.t('users.locked')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_38));
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex justify-end gap-2" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_42;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_43 = __VLS_asFunctionalComponent1(__VLS_42, new __VLS_42({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}));
const __VLS_44 = __VLS_43({
    ...{ 'onClick': {} },
    label: (__VLS_ctx.t('common.cancel')),
    variant: "secondary",
}, ...__VLS_functionalComponentArgsRest(__VLS_43));
let __VLS_47;
const __VLS_48 = {
    /** @type {typeof __VLS_47.click} */
    onClick: (...[$event]) => {
        __VLS_ctx.drawerStore.close();
        // @ts-ignore
        [form, form, t, t, t, showStatusSection, canSetActive, canSetLocked, drawerStore,];
    },
};
var __VLS_45;
var __VLS_46;
let __VLS_49;
/** @ts-ignore @type { | typeof __VLS_components.DhButton} */
DhButton;
// @ts-ignore
const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSaveCore),
}));
const __VLS_51 = __VLS_50({
    type: "submit",
    label: (__VLS_ctx.t('common.save')),
    loading: (__VLS_ctx.loading),
    disabled: (!__VLS_ctx.canSaveCore),
}, ...__VLS_functionalComponentArgsRest(__VLS_50));
// @ts-ignore
[t, canSaveCore, loading,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
