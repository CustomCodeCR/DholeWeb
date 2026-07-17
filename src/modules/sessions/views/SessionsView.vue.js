import { computed, onMounted, ref, watch } from 'vue';
import { Ban, Clock3, MonitorCheck, RefreshCcw, ShieldAlert } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { DhBadge, DhButton, DhSelect } from '@/shared/components/atoms';
import { DhCrudToolbar, DhDataTable, DhPagination } from '@/shared/components/molecules';
import { DhPageHeader } from '@/shared/components/organisms';
import { useModalStore } from '@/core/stores/modalStore';
import { useToastStore } from '@/core/stores/toastStore';
import { useAuthStore } from '@/core/stores/authStore';
import { AUTH_SCOPES } from '@/core/auth/scopes';
import { SessionsService } from '@/core/services/sessionsService';
import { AuthService } from '@/core/services/authService';
import { UsersService } from '@/core/services/usersService';
import AuthReasonModal from '@/modules/auth/components/AuthReasonModal.vue';
import { useViewShortcuts } from '@/core/composables/useViewShortcuts';
const { t } = useI18n();
const authStore = useAuthStore();
const modalStore = useModalStore();
const toastStore = useToastStore();
const loading = ref(false);
const search = ref('');
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const sessions = ref([]);
const users = ref([]);
const selectedUserId = ref(authStore.userId ?? '');
const activeOnly = ref(false);
const canBrowseUsers = computed(() => authStore.hasScope(AUTH_SCOPES.users.view));
const canRevoke = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revoke));
const canRevokeAll = computed(() => authStore.hasScope(AUTH_SCOPES.sessions.revokeAll));
const showRowActions = computed(() => canRevoke.value);
const activeSessionCount = computed(() => sessions.value.filter((session) => !session.isRevoked).length);
const revokedSessionCount = computed(() => sessions.value.filter((session) => session.isRevoked).length);
const expiringSoonCount = computed(() => {
    const limit = Date.now() + 60 * 60 * 1000;
    return sessions.value.filter((session) => {
        if (session.isRevoked || !session.expiresAt)
            return false;
        const expiresAt = new Date(session.expiresAt).getTime();
        return !Number.isNaN(expiresAt) && expiresAt <= limit;
    }).length;
});
const columns = computed(() => {
    const base = [
        { key: 'ipAddress', label: t('sessions.ipAddress') },
        { key: 'userAgent', label: t('sessions.userAgent') },
        { key: 'createdAt', label: t('sessions.createdAt') },
        { key: 'expiresAt', label: t('sessions.expiresAt') },
        { key: 'isRevoked', label: t('sessions.revoked'), align: 'center' },
    ];
    if (showRowActions.value) {
        base.push({ key: 'actions', label: '', align: 'right' });
    }
    return base;
});
const userOptions = computed(() => [
    ...(authStore.userId ? [{ label: 'Mi usuario actual', value: authStore.userId }] : []),
    ...users.value.map((user) => ({ label: `${user.displayName || user.userName} · ${user.email}`, value: user.id })),
]);
const filteredSessions = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q)
        return sessions.value;
    return sessions.value.filter((x) => `${x.ipAddress ?? ''} ${x.userAgent ?? ''} ${x.id}`.toLowerCase().includes(q));
});
function formatDate(value) {
    if (!value)
        return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
async function loadUsers() {
    if (!canBrowseUsers.value) {
        users.value = [];
        return;
    }
    try {
        const result = await UsersService.browsePaged({ pageNumber: 1, pageSize: 100 });
        users.value = result.items.filter((user) => user.id !== authStore.userId);
        if (!selectedUserId.value && result.items[0])
            selectedUserId.value = result.items[0].id;
    }
    catch (error) {
        users.value = [];
        toastStore.backendWarning(error, 'No se pudieron cargar usuarios para revisar sesiones.');
    }
}
async function loadSessions() {
    if (!selectedUserId.value) {
        sessions.value = [];
        total.value = 0;
        return;
    }
    try {
        loading.value = true;
        if (activeOnly.value) {
            const result = await SessionsService.getActiveByUser(selectedUserId.value);
            sessions.value = result;
            total.value = result.length;
            return;
        }
        const result = await SessionsService.getByUserPaged(selectedUserId.value, { pageNumber: page.value, pageSize: pageSize.value });
        sessions.value = result.items;
        total.value = result.totalCount ?? result.items.length;
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudieron cargar las sesiones.');
    }
    finally {
        loading.value = false;
    }
}
function openRevoke(session) {
    if (!canRevoke.value || session.isRevoked)
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
                await loadSessions();
            },
        },
    });
}
function openRevokeAll() {
    if (!canRevokeAll.value || !selectedUserId.value)
        return;
    modalStore.open({
        title: t('common.revokeAll'),
        component: AuthReasonModal,
        size: 'md',
        props: {
            title: 'Revocar sesiones del usuario',
            message: 'Esto revoca todas las sesiones activas del usuario seleccionado.',
            confirmLabel: t('common.revokeAll'),
            danger: true,
            onConfirm: async (reason) => {
                await SessionsService.revokeByUser(selectedUserId.value, { revokedBy: authStore.userId, reason });
                toastStore.success('Sesiones revocadas');
                await loadSessions();
            },
        },
    });
}
async function refreshToken() {
    if (!authStore.refreshToken) {
        toastStore.error('Error', 'No hay refresh token activo.');
        return;
    }
    try {
        const response = await AuthService.refreshToken({ refreshToken: authStore.refreshToken });
        authStore.setSession(response);
        toastStore.success('Token refrescado');
    }
    catch (error) {
        toastStore.backendError(error, 'No se pudo refrescar el token.');
    }
}
watch([selectedUserId, activeOnly, page, pageSize], loadSessions);
async function reloadSessionsView() {
    await loadUsers();
    await loadSessions();
}
useViewShortcuts({ save: reloadSessionsView, refresh: reloadSessionsView });
onMounted(reloadSessionsView);
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
    title: (__VLS_ctx.t('sessions.title')),
    subtitle: (__VLS_ctx.t('sessions.subtitle')),
    icon: (__VLS_ctx.MonitorCheck),
}));
const __VLS_2 = __VLS_1({
    title: (__VLS_ctx.t('sessions.title')),
    subtitle: (__VLS_ctx.t('sessions.subtitle')),
    icon: (__VLS_ctx.MonitorCheck),
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
        label: (__VLS_ctx.t('common.refreshSession')),
        variant: "secondary",
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClick': {} },
        icon: (__VLS_ctx.RefreshCcw),
        label: (__VLS_ctx.t('common.refreshSession')),
        variant: "secondary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = {
        /** @type {typeof __VLS_12.click} */
        onClick: (__VLS_ctx.refreshToken),
    };
    var __VLS_10;
    var __VLS_11;
    if (__VLS_ctx.canRevokeAll) {
        let __VLS_14;
        /** @ts-ignore @type { | typeof __VLS_components.DhButton} */
        DhButton;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: (__VLS_ctx.t('common.revokeAll')),
            variant: "danger",
        }));
        const __VLS_16 = __VLS_15({
            ...{ 'onClick': {} },
            icon: (__VLS_ctx.Ban),
            label: (__VLS_ctx.t('common.revokeAll')),
            variant: "danger",
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
        let __VLS_19;
        const __VLS_20 = {
            /** @type {typeof __VLS_19.click} */
            onClick: (__VLS_ctx.openRevokeAll),
        };
        var __VLS_17;
        var __VLS_18;
    }
    // @ts-ignore
    [t, t, t, t, MonitorCheck, RefreshCcw, refreshToken, canRevokeAll, Ban, openRevokeAll,];
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
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
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
(__VLS_ctx.t('sessions.monitoring.active'));
let __VLS_21;
/** @ts-ignore @type { | typeof __VLS_components.MonitorCheck} */
MonitorCheck;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    ...{ class: "h-5 w-5 text-green-500" },
}));
const __VLS_23 = __VLS_22({
    ...{ class: "h-5 w-5 text-green-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
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
(__VLS_ctx.activeSessionCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('sessions.monitoring.activeHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
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
(__VLS_ctx.t('sessions.monitoring.revoked'));
let __VLS_26;
/** @ts-ignore @type { | typeof __VLS_components.ShieldAlert} */
ShieldAlert;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    ...{ class: "h-5 w-5 text-red-500" },
}));
const __VLS_28 = __VLS_27({
    ...{ class: "h-5 w-5 text-red-500" },
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
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
(__VLS_ctx.revokedSessionCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('sessions.monitoring.revokedHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
    ...{ class: "dh-glass dh-liquid rounded-[28px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[28px]']} */ ;
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
(__VLS_ctx.t('sessions.monitoring.expiringSoon'));
let __VLS_31;
/** @ts-ignore @type { | typeof __VLS_components.Clock3} */
Clock3;
// @ts-ignore
const __VLS_32 = __VLS_asFunctionalComponent1(__VLS_31, new __VLS_31({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}));
const __VLS_33 = __VLS_32({
    ...{ class: "h-5 w-5 text-[var(--dh-primary)]" },
}, ...__VLS_functionalComponentArgsRest(__VLS_32));
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
(__VLS_ctx.expiringSoonCount);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1 text-xs font-semibold text-[var(--dh-text-muted)]" },
});
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[var(--dh-text-muted)]']} */ ;
(__VLS_ctx.t('sessions.monitoring.expiringSoonHint'));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "dh-glass dh-liquid rounded-[32px] p-5" },
});
/** @type {__VLS_StyleScopedClasses['dh-glass']} */ ;
/** @type {__VLS_StyleScopedClasses['dh-liquid']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[32px]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mb-5 grid gap-3 lg:grid-cols-[1fr_auto]" },
});
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['lg:grid-cols-[1fr_auto]']} */ ;
let __VLS_36;
/** @ts-ignore @type { | typeof __VLS_components.DhSelect} */
DhSelect;
// @ts-ignore
const __VLS_37 = __VLS_asFunctionalComponent1(__VLS_36, new __VLS_36({
    modelValue: (__VLS_ctx.selectedUserId),
    label: "Usuario",
    options: (__VLS_ctx.userOptions),
    disabled: (!__VLS_ctx.canBrowseUsers),
}));
const __VLS_38 = __VLS_37({
    modelValue: (__VLS_ctx.selectedUserId),
    label: "Usuario",
    options: (__VLS_ctx.userOptions),
    disabled: (!__VLS_ctx.canBrowseUsers),
}, ...__VLS_functionalComponentArgsRest(__VLS_37));
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex items-end gap-2 rounded-[22px] border border-[var(--dh-border)] bg-[var(--dh-card)] px-4 py-3 text-sm font-bold" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[22px]']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-[var(--dh-border)]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-[var(--dh-card)]']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "checkbox",
    ...{ class: "accent-[var(--dh-primary)]" },
});
(__VLS_ctx.activeOnly);
/** @type {__VLS_StyleScopedClasses['accent-[var(--dh-primary)]']} */ ;
(__VLS_ctx.t('sessions.activeOnly'));
let __VLS_41;
/** @ts-ignore @type { | typeof __VLS_components.DhCrudToolbar} */
DhCrudToolbar;
// @ts-ignore
const __VLS_42 = __VLS_asFunctionalComponent1(__VLS_41, new __VLS_41({
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: (__VLS_ctx.t('sessions.title')),
    showCreate: (false),
}));
const __VLS_43 = __VLS_42({
    ...{ 'onRefresh': {} },
    ...{ 'onFilter': {} },
    ...{ 'onSearch': {} },
    search: (__VLS_ctx.search),
    title: (__VLS_ctx.t('sessions.title')),
    showCreate: (false),
}, ...__VLS_functionalComponentArgsRest(__VLS_42));
let __VLS_46;
const __VLS_47 = {
    /** @type {typeof __VLS_46.refresh} */
    onRefresh: (__VLS_ctx.loadSessions),
};
const __VLS_48 = {
    /** @type {typeof __VLS_46.filter} */
    onFilter: (__VLS_ctx.loadSessions),
};
const __VLS_49 = {
    /** @type {typeof __VLS_46.search} */
    onSearch: (__VLS_ctx.loadSessions),
};
var __VLS_44;
var __VLS_45;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_50;
/** @ts-ignore @type { | typeof __VLS_components.DhDataTable | typeof __VLS_components.DhDataTable} */
DhDataTable;
// @ts-ignore
const __VLS_51 = __VLS_asFunctionalComponent1(__VLS_50, new __VLS_50({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.filteredSessions),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('sessions.empty')),
}));
const __VLS_52 = __VLS_51({
    columns: (__VLS_ctx.columns),
    rows: (__VLS_ctx.filteredSessions),
    loading: (__VLS_ctx.loading),
    emptyText: (__VLS_ctx.t('sessions.empty')),
}, ...__VLS_functionalComponentArgsRest(__VLS_51));
const { default: __VLS_55 } = __VLS_53.slots;
{
    const { 'cell-userAgent': __VLS_56 } = __VLS_53.slots;
    const [{ value }] = __VLS_vSlot(__VLS_56);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "line-clamp-1 max-w-md" },
    });
    /** @type {__VLS_StyleScopedClasses['line-clamp-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
    (value ?? '—');
    // @ts-ignore
    [t, t, t, t, t, t, t, t, t, activeSessionCount, revokedSessionCount, expiringSoonCount, selectedUserId, userOptions, canBrowseUsers, activeOnly, search, loadSessions, loadSessions, loadSessions, columns, filteredSessions, loading,];
}
{
    const { 'cell-createdAt': __VLS_57 } = __VLS_53.slots;
    const [{ value }] = __VLS_vSlot(__VLS_57);
    (__VLS_ctx.formatDate(String(value)));
    // @ts-ignore
    [formatDate,];
}
{
    const { 'cell-expiresAt': __VLS_58 } = __VLS_53.slots;
    const [{ value }] = __VLS_vSlot(__VLS_58);
    (__VLS_ctx.formatDate(String(value)));
    // @ts-ignore
    [formatDate,];
}
{
    const { 'cell-isRevoked': __VLS_59 } = __VLS_53.slots;
    const [{ value }] = __VLS_vSlot(__VLS_59);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex justify-center" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
    let __VLS_60;
    /** @ts-ignore @type { | typeof __VLS_components.DhBadge} */
    DhBadge;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        label: (value ? __VLS_ctx.t('common.yes') : __VLS_ctx.t('common.no')),
        variant: (value ? 'danger' : 'success'),
    }));
    const __VLS_62 = __VLS_61({
        label: (value ? __VLS_ctx.t('common.yes') : __VLS_ctx.t('common.no')),
        variant: (value ? 'danger' : 'success'),
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    // @ts-ignore
    [t, t,];
}
if (__VLS_ctx.showRowActions) {
    {
        const { 'cell-actions': __VLS_65 } = __VLS_53.slots;
        const [{ row }] = __VLS_vSlot(__VLS_65);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex justify-end" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        if (__VLS_ctx.canRevoke && !row.isRevoked) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showRowActions))
                            return;
                        if (!(__VLS_ctx.canRevoke && !row.isRevoked))
                            return;
                        __VLS_ctx.openRevoke(row);
                        // @ts-ignore
                        [showRowActions, canRevoke, openRevoke,];
                    } },
                ...{ class: "rounded-2xl p-2 text-red-500 hover:bg-red-500/10" },
                title: "Revocar",
            });
            /** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-red-500']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-red-500/10']} */ ;
            let __VLS_66;
            /** @ts-ignore @type { | typeof __VLS_components.Ban} */
            Ban;
            // @ts-ignore
            const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({
                ...{ class: "h-4 w-4" },
            }));
            const __VLS_68 = __VLS_67({
                ...{ class: "h-4 w-4" },
            }, ...__VLS_functionalComponentArgsRest(__VLS_67));
            /** @type {__VLS_StyleScopedClasses['h-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-4']} */ ;
        }
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
var __VLS_53;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "mt-5" },
});
/** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
let __VLS_71;
/** @ts-ignore @type { | typeof __VLS_components.DhPagination} */
DhPagination;
// @ts-ignore
const __VLS_72 = __VLS_asFunctionalComponent1(__VLS_71, new __VLS_71({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}));
const __VLS_73 = __VLS_72({
    page: (__VLS_ctx.page),
    pageSize: (__VLS_ctx.pageSize),
    total: (__VLS_ctx.total),
}, ...__VLS_functionalComponentArgsRest(__VLS_72));
// @ts-ignore
[page, pageSize, total,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
