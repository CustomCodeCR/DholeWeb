import { computed, onMounted, ref } from 'vue';
import { Ban, CheckCircle2, KeyRound, Lock, MonitorCheck, RefreshCcw, Shield, ShieldMinus, ShieldPlus, Unlock, UserCog } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton } from '@/shared/components/atoms';
import { DhTabs } from '@/shared/components/molecules';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { UsersService } from '@/core/services/usersService';
import { RolesService } from '@/core/services/rolesService';
import { ScopesService } from '@/core/services/scopesService';
import { SessionsService } from '@/core/services/sessionsService';
import { AuthService } from '@/core/services/authService';
import AuthMultiSelectModal from '@/modules/auth/components/AuthMultiSelectModal.vue';
import AuthReasonModal from '@/modules/auth/components/AuthReasonModal.vue';
import UserPasswordModal from '@/modules/users/components/UserPasswordModal.vue';
const props = defineProps();
const { t } = useI18n();
const modalStore = useModalStore();
const toastStore = useToastStore();
const authStore = useAuthStore();
const localUser = ref({ ...props.user });
const activeTab = ref('summary');
const loading = ref(false);
const roles = ref([]);
const directScopes = ref([]);
const permissions = ref(null);
const sessions = ref([]);
const availableRoles = ref([]);
const availableScopes = ref([]);
const canSetActive = computed(() => authStore.hasScope(AUTH_SCOPES.users.setActive));
const canSetLocked = computed(() => authStore.hasScope(AUTH_SCOPES.users.setLocked));
const canChangePassword = computed(() => authStore.hasScope(AUTH_SCOPES.users.changePassword));
const canViewRoles = computed(() => authStore.hasScope(AUTH_SCOPES.roles.view));
const canViewScopes = computed(() => authStore.hasScope(AUTH_SCOPES.scopes.view));
const canAssignRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesAssign) && canViewRoles.value);
const canRevokeRoles = computed(() => authStore.hasScope(AUTH_SCOPES.users.rolesRevoke));
const canAssignScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesAssign) && canViewScopes.value);
const canRevokeScopes = computed(() => authStore.hasScope(AUTH_SCOPES.users.scopesRevoke));
const canViewSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.view));
const canRevokeSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revoke));
const canRevokeAllSessions = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revokeAll));
const canRefreshCurrentToken = computed(() => localUser.value.id === authStore.userId);
const isProtectedUser = computed(() => Boolean(localUser.value.isProtected));
const showAccountActions = computed(() => !isProtectedUser.value && (canSetActive.value || canSetLocked.value || canChangePassword.value));
const showRoleActions = computed(() => canAssignRoles.value || canRevokeRoles.value);
const showScopeActions = computed(() => canAssignScopes.value || canRevokeScopes.value);
const showSessionActions = computed(() => canRefreshCurrentToken.value || canRevokeAllSessions.value);
const tabs = computed(() => {
    const items = [
        { key: 'summary', label: 'Resumen' },
        { key: 'roles', label: `${t('users.roles')} (${roles.value.length})` },
        { key: 'scopes', label: `${t('users.scopes')} (${directScopes.value.length})` },
        { key: 'permissions', label: t('users.permissions') },
    ];
    if (canViewSessions.value) {
        items.push({ key: 'sessions', label: `${t('users.sessions')} (${sessions.value.length})` });
    }
    return items;
});
function formatDate(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
async function loadRelated() {
    loading.value = true;
    try {
        const [userRoles, userScopes, userPermissions, userSessions, roleOptions, scopeOptions] = await Promise.all([
            UsersService.getRoles(localUser.value.id),
            UsersService.getScopes(localUser.value.id),
            UsersService.getPermissions(localUser.value.id),
            canViewSessions.value ? SessionsService.getByUser(localUser.value.id, { pageNumber: 1, pageSize: 50 }) : Promise.resolve([]),
            canAssignRoles.value ? RolesService.select() : Promise.resolve([]),
            canAssignScopes.value ? ScopesService.select() : Promise.resolve([]),
        ]);
        roles.value = userRoles;
        directScopes.value = userScopes;
        permissions.value = userPermissions;
        sessions.value = userSessions;
        availableRoles.value = roleOptions;
        availableScopes.value = scopeOptions;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo cargar el detalle del usuario.');
    }
    finally {
        loading.value = false;
    }
}
async function refreshParent() {
    await props.onSaved?.();
}
async function activate() {
    if (!canSetActive.value || isProtectedUser.value)
        return;
    await UsersService.activate(localUser.value.id);
    localUser.value.isActive = true;
    toastStore.success('Usuario activado');
    await refreshParent();
}
async function inactivate() {
    if (!canSetActive.value || isProtectedUser.value)
        return;
    await UsersService.inactivate(localUser.value.id);
    localUser.value.isActive = false;
    toastStore.success('Usuario inactivado');
    await refreshParent();
}
function openBlockModal() {
    if (!canSetLocked.value || isProtectedUser.value)
        return;
    modalStore.open({
        title: t('common.block'),
        component: AuthReasonModal,
        size: 'md',
        props: {
            title: 'Bloquear usuario',
            message: `Bloquear a ${localUser.value.displayName || localUser.value.userName}`,
            confirmLabel: t('common.block'),
            danger: true,
            onConfirm: async (reason) => {
                await UsersService.block(localUser.value.id, reason);
                localUser.value.isLocked = true;
                toastStore.success('Usuario bloqueado');
                await refreshParent();
            },
        },
    });
}
async function unblock() {
    if (!canSetLocked.value || isProtectedUser.value)
        return;
    await UsersService.unblock(localUser.value.id);
    localUser.value.isLocked = false;
    toastStore.success('Usuario desbloqueado');
    await refreshParent();
}
function openPasswordModal() {
    if (!canChangePassword.value || isProtectedUser.value)
        return;
    modalStore.open({
        title: t('users.changePassword'),
        component: UserPasswordModal,
        size: 'md',
        props: { userId: localUser.value.id },
    });
}
function roleItems(items) {
    return items.map((role) => ({ id: role.id, label: role.name, badge: 'Rol' }));
}
function scopeItems(items) {
    return items.map((scope) => ({ id: scope.id, label: scope.name, description: scope.code, badge: 'Scope' }));
}
function openAssignRoles() {
    if (!canAssignRoles.value || isProtectedUser.value)
        return;
    const selected = roles.value.map((role) => role.roleId);
    modalStore.open({
        title: t('users.assignRoles'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('users.assignRoles'),
            description: 'Seleccione los roles que desea asignar al usuario.',
            items: roleItems(availableRoles.value),
            initiallySelectedIds: selected,
            confirmLabel: t('common.assign'),
            onConfirm: async (ids) => {
                const toAssign = ids.filter((id) => !selected.includes(id));
                if (toAssign.length > 0)
                    await UsersService.assignRoles(localUser.value.id, { roleIds: toAssign });
                toastStore.success('Roles asignados');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
function openRevokeRoles() {
    if (!canRevokeRoles.value || isProtectedUser.value || roles.value.length === 0)
        return;
    modalStore.open({
        title: t('users.revokeRoles'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('users.revokeRoles'),
            description: 'Seleccione los roles que desea quitar del usuario.',
            items: roles.value.map((role) => ({ id: role.roleId, label: role.roleName, badge: 'Rol' })),
            confirmLabel: t('common.revoke'),
            onConfirm: async (ids) => {
                if (ids.length > 0)
                    await UsersService.revokeRoles(localUser.value.id, { roleIds: ids });
                toastStore.success('Roles revocados');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
function openAssignScopes() {
    if (!canAssignScopes.value || isProtectedUser.value)
        return;
    const selected = directScopes.value.map((scope) => scope.scopeId);
    modalStore.open({
        title: t('users.assignScopes'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('users.assignScopes'),
            description: 'Seleccione los scopes directos que desea asignar al usuario.',
            items: scopeItems(availableScopes.value),
            initiallySelectedIds: selected,
            confirmLabel: t('common.assign'),
            onConfirm: async (ids) => {
                const toAssign = ids.filter((id) => !selected.includes(id));
                if (toAssign.length > 0)
                    await UsersService.assignScopes(localUser.value.id, { scopeIds: toAssign });
                toastStore.success('Scopes asignados');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
function openRevokeScopes() {
    if (!canRevokeScopes.value || isProtectedUser.value || directScopes.value.length === 0)
        return;
    modalStore.open({
        title: t('users.revokeScopes'),
        component: AuthMultiSelectModal,
        size: 'lg',
        props: {
            title: t('users.revokeScopes'),
            description: 'Seleccione los scopes directos que desea quitar del usuario.',
            items: directScopes.value.map((scope) => ({ id: scope.scopeId, label: scope.scopeName, description: scope.scopeCode, badge: 'Scope' })),
            confirmLabel: t('common.revoke'),
            danger: true,
            onConfirm: async (ids) => {
                if (ids.length > 0)
                    await UsersService.revokeScopes(localUser.value.id, { scopeIds: ids });
                toastStore.success('Scopes revocados');
                await loadRelated();
                await refreshParent();
            },
        },
    });
}
function openRevokeSession(session) {
    if (!canRevokeSessions.value || session.isRevoked)
        return;
    modalStore.open({
        title: t('sessions.revoke'),
        component: AuthReasonModal,
        size: 'md',
        props: {
            title: t('sessions.revoke'),
            message: session.id,
            confirmLabel: t('common.revoke'),
            danger: true,
            onConfirm: async (reason) => {
                await SessionsService.revoke(session.id, { revokedBy: authStore.userId, reason });
                toastStore.success('Sesión revocada');
                await loadRelated();
            },
        },
    });
}
function openRevokeAllSessions() {
    if (!canRevokeAllSessions.value)
        return;
    modalStore.open({
        title: t('common.revokeAll'),
        component: AuthReasonModal,
        size: 'md',
        props: {
            title: 'Revocar sesiones del usuario',
            message: 'Esto revoca todas las sesiones activas de este usuario.',
            confirmLabel: t('common.revokeAll'),
            danger: true,
            onConfirm: async (reason) => {
                await SessionsService.revokeByUser(localUser.value.id, { revokedBy: authStore.userId, reason });
                toastStore.success('Sesiones revocadas');
                await loadRelated();
            },
        },
    });
}
async function refreshCurrentToken() {
    if (!canRefreshCurrentToken.value || !authStore.refreshToken)
        return;
    try {
        const response = await AuthService.refreshToken({ refreshToken: authStore.refreshToken });
        authStore.setSession(response);
        toastStore.success('Token refrescado');
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo refrescar el token.');
    }
}
onMounted(loadRelated);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "text-xl font-black text-[var(--dh-text)]" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
(__VLS_ctx.localUser.displayName || __VLS_ctx.localUser.userName);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-sm font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.localUser.email);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-3 flex flex-wrap gap-2" },
});
/** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    label: (__VLS_ctx.localUser.userTypeName || __VLS_ctx.localUser.userType),
    variant: "primary",
}));
const __VLS_2 = __VLS_1({
    label: (__VLS_ctx.localUser.userTypeName || __VLS_ctx.localUser.userType),
    variant: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.localUser.isProtected) {
    let __VLS_5;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        label: (__VLS_ctx.t('users.protectedUser')),
        variant: "warning",
    }));
    const __VLS_7 = __VLS_6({
        label: (__VLS_ctx.t('users.protectedUser')),
        variant: "warning",
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    label: (__VLS_ctx.localUser.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localUser.isActive ? 'success' : 'neutral'),
}));
const __VLS_12 = __VLS_11({
    label: (__VLS_ctx.localUser.isActive ? __VLS_ctx.t('common.active') : __VLS_ctx.t('common.inactive')),
    variant: (__VLS_ctx.localUser.isActive ? 'success' : 'neutral'),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
/** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
DhBadge;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
    label: (__VLS_ctx.localUser.isLocked ? 'Bloqueado' : 'Desbloqueado'),
    variant: (__VLS_ctx.localUser.isLocked ? 'danger' : 'success'),
}));
const __VLS_17 = __VLS_16({
    label: (__VLS_ctx.localUser.isLocked ? 'Bloqueado' : 'Desbloqueado'),
    variant: (__VLS_ctx.localUser.isLocked ? 'danger' : 'success'),
}, ...__VLS_functionalComponentArgsRest(__VLS_16));
if (__VLS_ctx.showAccountActions) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "mt-5 grid gap-2 md:grid-cols-3" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-3']} */ ;
    if (__VLS_ctx.canSetActive && __VLS_ctx.localUser.isActive) {
        let __VLS_20;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: "Inactivar",
            variant: "secondary",
        }));
        const __VLS_22 = __VLS_21({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: "Inactivar",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_21));
        let __VLS_25;
        const __VLS_26 = {
            /** @type {typeof __VLS_25.click} */
            onClick: (__VLS_ctx.inactivate),
        };
        var __VLS_23;
        var __VLS_24;
    }
    else if (__VLS_ctx.canSetActive) {
        let __VLS_27;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_28 = __VLS_asFunctionalComponent1(__VLS_27, new __VLS_27({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: "Activar",
        }));
        const __VLS_29 = __VLS_28({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.CheckCircle2),
            label: "Activar",
        }, ...__VLS_functionalComponentArgsRest(__VLS_28));
        let __VLS_32;
        const __VLS_33 = {
            /** @type {typeof __VLS_32.click} */
            onClick: (__VLS_ctx.activate),
        };
        var __VLS_30;
        var __VLS_31;
    }
    if (__VLS_ctx.canSetLocked && __VLS_ctx.localUser.isLocked) {
        let __VLS_34;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_35 = __VLS_asFunctionalComponent1(__VLS_34, new __VLS_34({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Unlock),
            label: "Desbloquear",
            variant: "secondary",
        }));
        const __VLS_36 = __VLS_35({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Unlock),
            label: "Desbloquear",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_35));
        let __VLS_39;
        const __VLS_40 = {
            /** @type {typeof __VLS_39.click} */
            onClick: (__VLS_ctx.unblock),
        };
        var __VLS_37;
        var __VLS_38;
    }
    else if (__VLS_ctx.canSetLocked) {
        let __VLS_41;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Lock),
            label: "Bloquear",
            variant: "danger",
        }));
        const __VLS_43 = __VLS_42({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Lock),
            label: "Bloquear",
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_42));
        let __VLS_46;
        const __VLS_47 = {
            /** @type {typeof __VLS_46.click} */
            onClick: (__VLS_ctx.openBlockModal),
        };
        var __VLS_44;
        var __VLS_45;
    }
    if (__VLS_ctx.canChangePassword) {
        let __VLS_48;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_49 = __VLS_asFunctionalComponent1(__VLS_48, new __VLS_48({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.UserCog),
            label: "Cambiar contraseña",
            variant: "secondary",
        }));
        const __VLS_50 = __VLS_49({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.UserCog),
            label: "Cambiar contraseña",
            variant: "secondary",
        }, ...__VLS_functionalComponentArgsRest(__VLS_49));
        let __VLS_53;
        const __VLS_54 = {
            /** @type {typeof __VLS_53.click} */
            onClick: (__VLS_ctx.openPasswordModal),
        };
        var __VLS_51;
        var __VLS_52;
    }
}
let __VLS_55;
/** @ts-ignore @type { | typeof __VLS_components.DhTabs} */
DhTabs;
// @ts-ignore
const __VLS_56 = __VLS_asFunctionalComponent1(__VLS_55, new __VLS_55({
    modelValue: (__VLS_ctx.activeTab),
    items: (__VLS_ctx.tabs),
}));
const __VLS_57 = __VLS_56({
    modelValue: (__VLS_ctx.activeTab),
    items: (__VLS_ctx.tabs),
}, ...__VLS_functionalComponentArgsRest(__VLS_56));
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[28px] border border-[var(--dh-border)] p-8 text-center text-sm font-bold text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-8']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    (__VLS_ctx.t('common.loading'));
}
else if (__VLS_ctx.activeTab === 'summary') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "grid gap-3 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 break-all text-sm font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.localUser.id);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-[24px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-[24px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs font-black uppercase tracking-[0.14em] text-[var(--dh-text-muted)]" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
    /** @type {__VLS_StyleScopedClasses['tracking-[0.14em]']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-sm font-bold text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.formatDate(__VLS_ctx.localUser.lastLoginAt));
}
else if (__VLS_ctx.activeTab === 'roles') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.showRoleActions) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.canAssignRoles) {
            let __VLS_60;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldPlus),
                label: (__VLS_ctx.t('users.assignRoles')),
            }));
            const __VLS_62 = __VLS_61({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldPlus),
                label: (__VLS_ctx.t('users.assignRoles')),
            }, ...__VLS_functionalComponentArgsRest(__VLS_61));
            let __VLS_65;
            const __VLS_66 = {
                /** @type {typeof __VLS_65.click} */
                onClick: (__VLS_ctx.openAssignRoles),
            };
            var __VLS_63;
            var __VLS_64;
        }
        if (__VLS_ctx.canRevokeRoles && __VLS_ctx.roles.length > 0) {
            let __VLS_67;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_68 = __VLS_asFunctionalComponent1(__VLS_67, new __VLS_67({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldMinus),
                label: (__VLS_ctx.t('users.revokeRoles')),
                variant: "secondary",
            }));
            const __VLS_69 = __VLS_68({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.ShieldMinus),
                label: (__VLS_ctx.t('users.revokeRoles')),
                variant: "secondary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_68));
            let __VLS_72;
            const __VLS_73 = {
                /** @type {typeof __VLS_72.click} */
                onClick: (__VLS_ctx.openRevokeRoles),
            };
            var __VLS_70;
            var __VLS_71;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2 md:grid-cols-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['md:grid-cols-2']} */ ;
    for (const [role] of __VLS_vFor((__VLS_ctx.roles))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (role.roleId),
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        let __VLS_74;
        /** @ts-ignore @type { | typeof __VLS_components.Shield} */
        Shield;
        // @ts-ignore
        const __VLS_75 = __VLS_asFunctionalComponent1(__VLS_74, new __VLS_74({
            ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
        }));
        const __VLS_76 = __VLS_75({
            ...{ class: "h-4 w-4 text-[var(--dh-primary)]" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_75));
        /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (role.roleName);
        // @ts-ignore
        [localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, localUser, t, t, t, t, t, t, showAccountActions, canSetActive, canSetActive, Ban, inactivate, CheckCircle2, activate, canSetLocked, canSetLocked, Unlock, unblock, Lock, openBlockModal, canChangePassword, UserCog, openPasswordModal, activeTab, activeTab, activeTab, tabs, loading, formatDate, showRoleActions, canAssignRoles, ShieldPlus, openAssignRoles, canRevokeRoles, roles, roles, ShieldMinus, openRevokeRoles,];
    }
}
else if (__VLS_ctx.activeTab === 'scopes') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.showScopeActions) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.canAssignScopes) {
            let __VLS_79;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_80 = __VLS_asFunctionalComponent1(__VLS_79, new __VLS_79({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.KeyRound),
                label: (__VLS_ctx.t('users.assignScopes')),
            }));
            const __VLS_81 = __VLS_80({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.KeyRound),
                label: (__VLS_ctx.t('users.assignScopes')),
            }, ...__VLS_functionalComponentArgsRest(__VLS_80));
            let __VLS_84;
            const __VLS_85 = {
                /** @type {typeof __VLS_84.click} */
                onClick: (__VLS_ctx.openAssignScopes),
            };
            var __VLS_82;
            var __VLS_83;
        }
        if (__VLS_ctx.canRevokeScopes && __VLS_ctx.directScopes.length > 0) {
            let __VLS_86;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_87 = __VLS_asFunctionalComponent1(__VLS_86, new __VLS_86({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.Ban),
                label: (__VLS_ctx.t('users.revokeScopes')),
                variant: "secondary",
            }));
            const __VLS_88 = __VLS_87({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.Ban),
                label: (__VLS_ctx.t('users.revokeScopes')),
                variant: "secondary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_87));
            let __VLS_91;
            const __VLS_92 = {
                /** @type {typeof __VLS_91.click} */
                onClick: (__VLS_ctx.openRevokeScopes),
            };
            var __VLS_89;
            var __VLS_90;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [scope] of __VLS_vFor((__VLS_ctx.directScopes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (scope.scopeId),
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (scope.scopeName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-bold text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        (scope.scopeCode);
        // @ts-ignore
        [t, t, Ban, activeTab, showScopeActions, canAssignScopes, KeyRound, openAssignScopes, canRevokeScopes, directScopes, directScopes, openRevokeScopes,];
    }
}
else if (__VLS_ctx.activeTab === 'permissions') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-4" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-4']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
        ...{ class: "mb-2 font-black text-[var(--dh-text)]" },
    });
    /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
    (__VLS_ctx.t('users.effectiveScopes'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [scope] of __VLS_vFor((__VLS_ctx.permissions?.effectiveScopes ?? []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (scope.scopeId),
            ...{ class: "rounded-[20px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-3" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[20px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (scope.scopeName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs font-bold text-[var(--dh-primary)]" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-primary)]']} */ ;
        (scope.scopeCode);
        // @ts-ignore
        [t, activeTab, permissions,];
    }
}
else if (__VLS_ctx.activeTab === 'sessions' && __VLS_ctx.canViewSessions) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "space-y-3" },
    });
    /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
    if (__VLS_ctx.showSessionActions) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        if (__VLS_ctx.canRefreshCurrentToken) {
            let __VLS_93;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_94 = __VLS_asFunctionalComponent1(__VLS_93, new __VLS_93({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.RefreshCcw),
                label: (__VLS_ctx.t('common.refreshSession')),
                variant: "secondary",
            }));
            const __VLS_95 = __VLS_94({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.RefreshCcw),
                label: (__VLS_ctx.t('common.refreshSession')),
                variant: "secondary",
            }, ...__VLS_functionalComponentArgsRest(__VLS_94));
            let __VLS_98;
            const __VLS_99 = {
                /** @type {typeof __VLS_98.click} */
                onClick: (__VLS_ctx.refreshCurrentToken),
            };
            var __VLS_96;
            var __VLS_97;
        }
        if (__VLS_ctx.canRevokeAllSessions) {
            let __VLS_100;
            /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
            DhButton;
            // @ts-ignore
            const __VLS_101 = __VLS_asFunctionalComponent1(__VLS_100, new __VLS_100({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.Ban),
                label: (__VLS_ctx.t('common.revokeAll')),
                variant: "danger",
            }));
            const __VLS_102 = __VLS_101({
                ...{ 'onClick': {} },
                icon: (__VLS_ctx.Ban),
                label: (__VLS_ctx.t('common.revokeAll')),
                variant: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_101));
            let __VLS_105;
            const __VLS_106 = {
                /** @type {typeof __VLS_105.click} */
                onClick: (__VLS_ctx.openRevokeAllSessions),
            };
            var __VLS_103;
            var __VLS_104;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "grid gap-2" },
    });
    /** @type {__VLS_StyleScopedClasses['grid']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
    for (const [session] of __VLS_vFor((__VLS_ctx.sessions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (session.id),
            ...{ class: "rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
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
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "break-all text-xs font-black text-[var(--dh-text)]" },
        });
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-black']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text)]']} */ ;
        (session.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 truncate text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (session.userAgent ?? '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
        (session.ipAddress ?? '—');
        (__VLS_ctx.formatDate(session.createdAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex shrink-0 items-center gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        let __VLS_107;
        /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
        DhBadge;
        // @ts-ignore
        const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
            label: (session.isRevoked ? 'Revocada' : 'Activa'),
            variant: (session.isRevoked ? 'danger' : 'success'),
        }));
        const __VLS_109 = __VLS_108({
            label: (session.isRevoked ? 'Revocada' : 'Activa'),
            variant: (session.isRevoked ? 'danger' : 'success'),
        }, ...__VLS_functionalComponentArgsRest(__VLS_108));
        if (__VLS_ctx.canRevokeSessions && !session.isRevoked) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'summary'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'roles'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'scopes'))
                            return;
                        if (!!(__VLS_ctx.activeTab === 'permissions'))
                            return;
                        if (!(__VLS_ctx.activeTab === 'sessions' && __VLS_ctx.canViewSessions))
                            return;
                        if (!(__VLS_ctx.canRevokeSessions && !session.isRevoked))
                            return;
                        __VLS_ctx.openRevokeSession(session);
                        // @ts-ignore
                        [t, t, Ban, activeTab, formatDate, canViewSessions, showSessionActions, canRefreshCurrentToken, RefreshCcw, refreshCurrentToken, canRevokeAllSessions, openRevokeAllSessions, sessions, canRevokeSessions, openRevokeSession,];
                    } },
                ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
                title: "Revocar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
            let __VLS_112;
            /** @ts-ignore @type { | typeof __VLS_components.MonitorCheck} */
            MonitorCheck;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_114 = __VLS_113({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
